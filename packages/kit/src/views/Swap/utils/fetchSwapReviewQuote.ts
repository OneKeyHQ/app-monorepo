import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  ESwapQuoteKind,
  type IFetchQuoteResult,
  type IFetchSwapQuoteParams,
  type ISwapQuoteEventPayload,
} from '@onekeyhq/shared/types/swap/types';

import { isSwapQuoteAvailable } from './swapErrorUtils';

const REVIEW_QUOTE_TIMEOUT_MS = 25_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function matchesReviewQuote(
  candidate: unknown,
  {
    expectedQuote,
    params,
  }: {
    expectedQuote: IFetchQuoteResult;
    params: IFetchSwapQuoteParams;
  },
): candidate is IFetchQuoteResult {
  if (
    !isRecord(candidate) ||
    !isRecord(candidate.info) ||
    !isRecord(candidate.fromTokenInfo) ||
    !isRecord(candidate.toTokenInfo) ||
    typeof candidate.eventId !== 'string' ||
    !candidate.eventId ||
    candidate.info.provider !== expectedQuote.info.provider ||
    candidate.info.providerName !== expectedQuote.info.providerName ||
    candidate.protocol !== expectedQuote.protocol ||
    (candidate.kind ?? ESwapQuoteKind.SELL) !==
      (params.kind ?? ESwapQuoteKind.SELL) ||
    typeof candidate.fromTokenInfo.networkId !== 'string' ||
    typeof candidate.fromTokenInfo.contractAddress !== 'string' ||
    candidate.fromTokenInfo.decimals !== params.fromToken.decimals ||
    typeof candidate.toTokenInfo.networkId !== 'string' ||
    typeof candidate.toTokenInfo.contractAddress !== 'string' ||
    candidate.toTokenInfo.decimals !== params.toToken.decimals ||
    typeof candidate.fromAmount !== 'string' ||
    typeof candidate.toAmount !== 'string' ||
    (candidate.autoSuggestedSlippage !== undefined &&
      (typeof candidate.autoSuggestedSlippage !== 'number' ||
        !Number.isFinite(candidate.autoSuggestedSlippage) ||
        candidate.autoSuggestedSlippage <= 0)) ||
    candidate.errorMessage
  ) {
    return false;
  }
  const fromToken = {
    networkId: candidate.fromTokenInfo.networkId,
    contractAddress: candidate.fromTokenInfo.contractAddress,
  };
  const toToken = {
    networkId: candidate.toTokenInfo.networkId,
    contractAddress: candidate.toTokenInfo.contractAddress,
  };
  const fromAmount = new BigNumber(candidate.fromAmount);
  const toAmount = new BigNumber(candidate.toAmount);
  const requestedAmount = new BigNumber(
    params.kind === ESwapQuoteKind.BUY
      ? (params.toTokenAmount ?? '')
      : (params.fromTokenAmount ?? ''),
  );
  const quotedInput =
    params.kind === ESwapQuoteKind.BUY ? toAmount : fromAmount;
  return Boolean(
    equalTokenNoCaseSensitive({
      token1: fromToken,
      token2: params.fromToken,
    }) &&
    equalTokenNoCaseSensitive({ token1: toToken, token2: params.toToken }) &&
    fromAmount.isFinite() &&
    fromAmount.gt(0) &&
    toAmount.isFinite() &&
    toAmount.gt(0) &&
    requestedAmount.isFinite() &&
    requestedAmount.gt(0) &&
    quotedInput.eq(requestedAmount),
  );
}

export function fetchSwapReviewQuote({
  params,
  expectedQuote,
  signal,
  getErrorMessage,
}: {
  params: IFetchSwapQuoteParams;
  expectedQuote: IFetchQuoteResult;
  signal: AbortSignal;
  getErrorMessage: () => string;
}): Promise<IFetchQuoteResult> {
  const createRefreshError = (reason: string) =>
    new OneKeyLocalError({ message: getErrorMessage(), data: { reason } });
  const quoteRequestId = `review-refresh-${generateUUID()}`;
  return new Promise((resolve, reject) => {
    let finished = false;
    let matchingQuote: IFetchQuoteResult | undefined;
    const suggestedSlippages = new Map<string, number>();
    let streamEventId: string | undefined;
    const handles: {
      timeout?: ReturnType<typeof setTimeout>;
      abort?: () => void;
      listener?: (event: ISwapQuoteEventPayload) => void;
    } = {};
    const canResolveQuote = () =>
      matchingQuote &&
      (!params.autoSlippage ||
        matchingQuote.autoSuggestedSlippage ||
        (matchingQuote.eventId &&
          suggestedSlippages.has(matchingQuote.eventId)));
    const finish = (error?: unknown) => {
      if (finished) return;
      finished = true;
      clearTimeout(handles.timeout);
      if (handles.abort) signal.removeEventListener('abort', handles.abort);
      if (handles.listener) {
        appEventBus.off(EAppEventBusNames.SwapQuoteEvent, handles.listener);
      }
      void backgroundApiProxy.serviceSwap
        .cancelFetchQuoteEvents(quoteRequestId)
        .catch(() => undefined);
      if (error) {
        reject(error);
      } else if (matchingQuote) {
        const suggestedSlippage = matchingQuote.eventId
          ? suggestedSlippages.get(matchingQuote.eventId)
          : undefined;
        resolve(
          suggestedSlippage !== undefined &&
            !matchingQuote.autoSuggestedSlippage
            ? {
                ...matchingQuote,
                autoSuggestedSlippage: suggestedSlippage,
              }
            : matchingQuote,
        );
      } else {
        reject(createRefreshError('The selected provider has no fresh quote'));
      }
    };
    handles.abort = () =>
      finish(
        new OneKeyLocalError({
          message: 'Swap review was closed',
          autoToast: false,
        }),
      );
    handles.listener = (event: ISwapQuoteEventPayload) => {
      if (event.quoteRequestId !== quoteRequestId) return;
      if (event.type === 'error') {
        finish(createRefreshError('Failed to refresh the swap quote'));
        return;
      }
      if (event.type === 'done' || event.type === 'close') {
        // Native may deliver an error immediately after done.
        void Promise.resolve().then(() => finish());
        return;
      }
      if (event.type !== 'message' || !('data' in event.event)) return;
      try {
        const payload: unknown = JSON.parse(String(event.event.data));
        if (!isRecord(payload)) return;
        if (
          typeof payload.totalQuoteCount === 'number' &&
          typeof payload.eventId === 'string'
        ) {
          streamEventId = payload.eventId;
          if (matchingQuote?.eventId !== streamEventId) {
            matchingQuote = undefined;
          }
        }
        if (
          typeof payload.eventId === 'string' &&
          typeof payload.autoSuggestedSlippage === 'number' &&
          Number.isFinite(payload.autoSuggestedSlippage) &&
          payload.autoSuggestedSlippage > 0 &&
          payload.fromNetworkId === params.fromToken.networkId &&
          payload.toNetworkId === params.toToken.networkId &&
          typeof payload.fromTokenAddress === 'string' &&
          typeof payload.toTokenAddress === 'string' &&
          equalTokenNoCaseSensitive({
            token1: {
              networkId: payload.fromNetworkId,
              contractAddress: payload.fromTokenAddress,
            },
            token2: params.fromToken,
          }) &&
          equalTokenNoCaseSensitive({
            token1: {
              networkId: payload.toNetworkId,
              contractAddress: payload.toTokenAddress,
            },
            token2: params.toToken,
          })
        ) {
          suggestedSlippages.set(
            payload.eventId,
            payload.autoSuggestedSlippage,
          );
        }
        if (Array.isArray(payload.data)) {
          const match = payload.data.find(
            (candidate: unknown) =>
              matchesReviewQuote(candidate, { expectedQuote, params }) &&
              (!streamEventId || candidate.eventId === streamEventId) &&
              isSwapQuoteAvailable(candidate, candidate.fromAmount),
          );
          if (matchesReviewQuote(match, { expectedQuote, params })) {
            matchingQuote = match;
            streamEventId ??= match.eventId;
          }
        }
        if (canResolveQuote()) {
          finish();
          return;
        }
        if (typeof payload.errorMessage === 'string' && payload.errorMessage) {
          finish(new OneKeyLocalError(payload.errorMessage));
        } else if (payload.totalQuoteCount === 0) {
          finish();
        }
      } catch {
        finish(createRefreshError('Invalid swap quote response'));
      }
    };
    handles.timeout = setTimeout(() => {
      finish(
        matchingQuote
          ? undefined
          : createRefreshError('Swap quote refresh timed out'),
      );
    }, REVIEW_QUOTE_TIMEOUT_MS);
    if (signal.aborted) {
      handles.abort();
      return;
    }
    signal.addEventListener('abort', handles.abort, { once: true });
    appEventBus.on(EAppEventBusNames.SwapQuoteEvent, handles.listener);
    void backgroundApiProxy.serviceSwap
      .fetchQuotesEvents({ ...params, quoteRequestId })
      .then(() => {
        if (finished) {
          void backgroundApiProxy.serviceSwap
            .cancelFetchQuoteEvents(quoteRequestId)
            .catch(() => undefined);
        }
      })
      .catch((error: unknown) => finish(error));
  });
}
