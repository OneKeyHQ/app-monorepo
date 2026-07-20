import BigNumber from 'bignumber.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  ISwapQuoteEventError,
  ISwapQuoteEventInfo,
  ISwapQuoteEventQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { SwapBuildShouldFallBackNetworkIds } from '@onekeyhq/shared/types/swap/types';

const marketWrappedQuoteTimeoutMs = 15_000;

type IMarketSwapQuoteEvent =
  IAppEventBusPayload[typeof EAppEventBusNames.SwapQuoteEvent];

export type IMarketWrappedQuoteRequest = {
  accountId: string;
  fromToken: ISwapToken;
  toToken: ISwapToken;
  quoteEventSessionId: string;
  fromTokenAmount: string;
  slippagePercentage: number;
};

export function isMatchingMarketWrappedQuoteEvent({
  event,
  request,
}: {
  event: IMarketSwapQuoteEvent;
  request: IMarketWrappedQuoteRequest;
}) {
  return (
    event.accountId === request.accountId &&
    event.quoteEventSessionId === request.quoteEventSessionId &&
    event.params.fromTokenAmount === request.fromTokenAmount &&
    event.params.slippagePercentage === request.slippagePercentage &&
    event.params.fromNetworkId === request.fromToken.networkId &&
    event.params.toNetworkId === request.toToken.networkId &&
    equalTokenNoCaseSensitive({
      token1: event.tokenPairs.fromToken,
      token2: request.fromToken,
    }) &&
    equalTokenNoCaseSensitive({
      token1: event.tokenPairs.toToken,
      token2: request.toToken,
    })
  );
}

export function waitForMarketWrappedQuote({
  request,
  subscribe,
  start,
  cancel,
  timeoutMs = marketWrappedQuoteTimeoutMs,
}: {
  request: IMarketWrappedQuoteRequest;
  subscribe: (listener: (event: IMarketSwapQuoteEvent) => void) => () => void;
  start: () => Promise<unknown>;
  cancel: () => Promise<unknown>;
  timeoutMs?: number;
}): Promise<IFetchQuoteResult> {
  return new Promise((resolve, reject) => {
    let activeEventId: string | undefined;
    let settled = false;
    const timeoutRef: {
      current?: ReturnType<typeof setTimeout>;
    } = {};
    let unsubscribe: () => void = () => undefined;

    const cleanup = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      unsubscribe();
      void cancel().catch(() => undefined);
    };

    const finish = (
      quoteResult?: IFetchQuoteResult,
      error?: OneKeyLocalError,
    ) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      if (quoteResult) {
        resolve(quoteResult);
      } else {
        reject(
          error ?? new OneKeyLocalError('Market wrapped quote unavailable.'),
        );
      }
    };

    const maybeSetActiveEventId = (eventId?: string) => {
      if (!eventId) {
        return true;
      }
      if (activeEventId && activeEventId !== eventId) {
        return false;
      }
      activeEventId = eventId;
      return true;
    };

    const listener = (event: IMarketSwapQuoteEvent) => {
      if (!isMatchingMarketWrappedQuoteEvent({ event, request })) {
        return;
      }

      if (event.type === 'message') {
        const messageData = (event.event as { data?: string }).data;
        if (!messageData) {
          return;
        }

        let parsedData: unknown;
        try {
          parsedData = JSON.parse(messageData);
        } catch {
          return;
        }

        const errorData = parsedData as ISwapQuoteEventError;
        if (errorData.errorMessage) {
          if (!maybeSetActiveEventId(errorData.eventId)) {
            return;
          }
          finish(undefined, new OneKeyLocalError(errorData.errorMessage));
          return;
        }

        const eventInfo = parsedData as ISwapQuoteEventInfo;
        if (typeof eventInfo.totalQuoteCount === 'number') {
          if (!maybeSetActiveEventId(eventInfo.eventId)) {
            return;
          }
          if (eventInfo.totalQuoteCount === 0) {
            finish();
          }
          return;
        }

        const quoteData = parsedData as ISwapQuoteEventQuoteResult;
        const wrappedQuote = quoteData.data?.find(
          (quote) =>
            quote.isWrapped &&
            (!activeEventId || quote.eventId === activeEventId) &&
            Boolean(quote.fromAmount) &&
            Boolean(quote.toAmount),
        );
        if (wrappedQuote && maybeSetActiveEventId(wrappedQuote.eventId)) {
          finish(wrappedQuote);
        }
        return;
      }

      if (
        event.type === 'done' ||
        event.type === 'close' ||
        event.type === 'error'
      ) {
        finish();
      }
    };

    unsubscribe = subscribe(listener);
    timeoutRef.current = setTimeout(() => {
      finish(
        undefined,
        new OneKeyLocalError('Market wrapped quote request timed out.'),
      );
    }, timeoutMs);

    void start().catch((error: unknown) => {
      finish(
        undefined,
        error instanceof OneKeyLocalError
          ? error
          : new OneKeyLocalError(
              error instanceof Error
                ? error.message
                : 'Market wrapped quote request failed.',
            ),
      );
    });
  });
}

export function buildMarketReviewShouldFallback({
  networkId,
  isCustomRpcUnavailable,
}: {
  networkId?: string;
  isCustomRpcUnavailable?: boolean;
}) {
  return (
    SwapBuildShouldFallBackNetworkIds.includes(networkId ?? '') ||
    Boolean(isCustomRpcUnavailable)
  );
}

export function buildDefaultMarketSpeedCheckState() {
  return {
    speedCheckError: '',
    checkSpenderAddress: '',
    isStock: false,
    shouldApprove: false,
    shouldResetApprove: false,
  };
}

export function shouldFetchMarketQuoteFallbackData(
  buildRes?: IFetchBuildTxResponse,
) {
  const buildGasLimitBN = new BigNumber(buildRes?.result?.gasLimit ?? 0);

  return (
    buildGasLimitBN.isNaN() ||
    buildGasLimitBN.isZero() ||
    !buildRes?.result?.routesData?.length
  );
}

export function pickMarketQuoteResultByProvider({
  quotes,
  provider,
  providerName,
}: {
  quotes?: IFetchQuoteResult[];
  provider?: string;
  providerName?: string;
}) {
  if (!quotes?.length) {
    return undefined;
  }

  return (
    quotes.find(
      (item) =>
        item.info.provider === provider &&
        item.info.providerName === providerName,
    ) ??
    quotes.find((item) => item.info.provider === provider) ??
    quotes.find((item) => item.info.providerName === providerName)
  );
}

export function mergeMarketBuildResultWithQuote({
  buildRes,
  quoteResult,
}: {
  buildRes: IFetchBuildTxResponse;
  quoteResult?: IFetchQuoteResult;
}) {
  const nextBuildRes: IFetchBuildTxResponse = {
    ...buildRes,
    result: {
      ...buildRes.result,
    },
  };

  const buildGasLimitBN = new BigNumber(nextBuildRes.result?.gasLimit ?? 0);
  const quoteGasLimitBN = new BigNumber(quoteResult?.gasLimit ?? 0);

  if (
    (buildGasLimitBN.isNaN() || buildGasLimitBN.isZero()) &&
    !quoteGasLimitBN.isNaN() &&
    !quoteGasLimitBN.isZero()
  ) {
    nextBuildRes.result.gasLimit = quoteGasLimitBN.toNumber();
  }

  if (
    !nextBuildRes.result?.routesData?.length &&
    quoteResult?.routesData?.length
  ) {
    nextBuildRes.result.routesData = quoteResult.routesData;
  }

  if (!nextBuildRes.result?.minToAmount && quoteResult?.minToAmount) {
    nextBuildRes.result.minToAmount = quoteResult.minToAmount;
  }

  return nextBuildRes;
}
