import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { resolveQuoteShowTip } from '@onekeyhq/kit/src/views/Swap/utils/quoteShowTipUtils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IDustSweepReason,
  IDustSweepSnapshot,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';
import type {
  IFetchQuoteResult,
  ISwapQuoteEventData,
  ISwapQuoteEventPayload,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';
import {
  EQuoteShowTipType,
  ESwapQuoteKind,
  ESwapQuoteSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

/**
 * Dust Sweep receives a provider stream from the SWEEP quote contract. The
 * backend owns the provider allowlist; the client only requires an explicit
 * provider id so the selected provider can be carried through build/history.
 */
export function isDustSweepQuoteCandidate(quote: IFetchQuoteResult) {
  return Boolean(quote.info?.provider?.trim());
}

export class DustSweepSkip extends OneKeyLocalError {
  reason: IDustSweepReason;
  constructor(reason: IDustSweepReason, message?: string) {
    super(message ?? reason);
    this.reason = reason;
  }
}

function isSameDustSweepToken({
  quoteToken,
  expectedToken,
}: {
  quoteToken: ISwapTokenBase;
  expectedToken: ISwapTokenBase;
}) {
  if (quoteToken.networkId !== expectedToken.networkId) return false;
  // Native tokens can be represented by an empty local address or 0xeeee... by the swap API.
  if (quoteToken.isNative && expectedToken.isNative) return true;
  return equalTokenNoCaseSensitive({
    token1: quoteToken,
    token2: expectedToken,
  });
}

function getActualPriceImpactPercent({
  fromToken,
  toToken,
  fromAmount,
  toAmount,
}: {
  fromToken: IDustSweepToken;
  toToken: IDustSweepSnapshot['nativeToken'];
  fromAmount: string;
  toAmount?: string;
}) {
  const fromValue = new BigNumber(fromAmount).times(fromToken.price ?? '');
  const toValue = new BigNumber(toAmount ?? '').times(toToken.price ?? '');
  if (!fromValue.isFinite() || !fromValue.gt(0) || !toValue.isFinite())
    return undefined;
  return fromValue.minus(toValue).dividedBy(fromValue).times(100);
}

export function getDustSweepQuoteRisk(
  quote: IFetchQuoteResult,
  token: IDustSweepToken,
  snapshot: IDustSweepSnapshot,
): IDustSweepReason | undefined {
  const toAmount = new BigNumber(quote.toAmount ?? '');
  if (
    !isDustSweepQuoteCandidate(quote) ||
    quote.errorMessage ||
    !toAmount.isFinite() ||
    !toAmount.gt(0)
  )
    return 'noQuote';
  if (
    token.networkId !== snapshot.networkId ||
    snapshot.nativeToken.networkId !== snapshot.networkId ||
    !isSameDustSweepToken({
      quoteToken: quote.fromTokenInfo,
      expectedToken: token,
    }) ||
    !isSameDustSweepToken({
      quoteToken: quote.toTokenInfo,
      expectedToken: snapshot.nativeToken,
    }) ||
    !new BigNumber(token.amount).isFinite() ||
    !new BigNumber(token.amount).gt(0) ||
    !new BigNumber(quote.fromAmount ?? '').eq(token.amount)
  )
    return 'unknown';
  if (
    quote.swapShouldSignedData ||
    quote.shouldWrappedToken ||
    tokenRebaseUtils.isScalingBalanceMultiplier(token.balanceMultiplier)
  )
    return 'unknown';
  const tip = resolveQuoteShowTip({
    quoteShowTip: quote.quoteShowTip,
    fromToken: token,
    toToken: snapshot.nativeToken,
    fromAmount: token.amount,
    toAmount: quote.toAmount,
  });
  if (tip?.type === EQuoteShowTipType.PRICE_IMPACT) return 'valueDrop';
  if (tip) return 'unknown';
  const quotedImpact =
    quote.valueDropPercent ?? quote.quoteShowTip?.priceImpact;
  const impactPercent =
    quotedImpact === undefined
      ? getActualPriceImpactPercent({
          fromToken: token,
          toToken: snapshot.nativeToken,
          fromAmount: token.amount,
          toAmount: quote.toAmount,
        })
      : new BigNumber(quotedImpact);
  if (!impactPercent || !impactPercent.isFinite()) return 'unknown';
  if (impactPercent.gt(snapshot.slippage)) return 'priceImpact';
  return undefined;
}

let quoteSequence = 0;

export function fetchDustSweepQuote(
  token: IDustSweepToken,
  snapshot: IDustSweepSnapshot,
  signal: AbortSignal,
): Promise<IFetchQuoteResult> {
  const quoteRequestId = `sweep-${snapshot.id}-${(quoteSequence += 1)}`;
  return new Promise((resolve, reject) => {
    let done = false;
    let unavailableReason: IDustSweepReason = 'noQuote';
    const finishRef: {
      current: (error?: Error, quote?: IFetchQuoteResult) => void;
    } = {
      current: () => undefined,
    };
    const abort = () =>
      finishRef.current(new OneKeyLocalError('Dust Sweep cancelled'));
    const listener = (event: ISwapQuoteEventPayload) => {
      if (event.quoteRequestId !== quoteRequestId) return;
      if (event.type === 'error') {
        finishRef.current(
          new DustSweepSkip(
            'noQuote',
            'message' in event.event ? event.event.message : undefined,
          ),
        );
        return;
      }
      if (event.type === 'done' || event.type === 'close') {
        // Native dispatches done immediately before error on dropped connections.
        void Promise.resolve().then(() =>
          finishRef.current(new DustSweepSkip(unavailableReason)),
        );
        return;
      }
      if (event.type !== 'message') return;
      try {
        const payload = JSON.parse(
          String((event.event as { data?: string }).data),
        ) as ISwapQuoteEventData;
        if ('data' in payload && Array.isArray(payload.data)) {
          const quote = payload.data.find((candidate) => {
            const risk = getDustSweepQuoteRisk(candidate, token, snapshot);
            if (risk) {
              if (isDustSweepQuoteCandidate(candidate))
                unavailableReason = risk;
              return false;
            }
            return true;
          });
          if (quote) finishRef.current(undefined, quote);
        }
        if ('errorMessage' in payload && payload.errorMessage)
          finishRef.current(new DustSweepSkip('noQuote', payload.errorMessage));
        if ('totalQuoteCount' in payload && payload.totalQuoteCount === 0)
          finishRef.current(new DustSweepSkip('noQuote'));
      } catch {
        finishRef.current(new DustSweepSkip('noQuote'));
      }
    };
    const timeout = setTimeout(
      () => finishRef.current(new DustSweepSkip(unavailableReason)),
      25_000,
    );
    const finish = (error?: Error, quote?: IFetchQuoteResult) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      appEventBus.off(EAppEventBusNames.SwapQuoteEvent, listener);
      void backgroundApiProxy.serviceSwap
        .cancelFetchQuoteEvents(quoteRequestId)
        .catch(() => undefined);
      if (error) reject(error);
      else if (quote) resolve(quote);
      else reject(new DustSweepSkip('noQuote'));
    };
    finishRef.current = finish;
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    appEventBus.on(EAppEventBusNames.SwapQuoteEvent, listener);
    void backgroundApiProxy.serviceSwap
      .fetchQuotesEvents({
        source: ESwapQuoteSource.SWEEP,
        fromToken: token,
        toToken: snapshot.nativeToken,
        fromTokenAmount: token.amount,
        userAddress: snapshot.address,
        receivingAddress: snapshot.address,
        accountId: snapshot.accountId,
        slippagePercentage: snapshot.slippage,
        kind: ESwapQuoteKind.SELL,
        protocol: ESwapTabSwitchType.SWAP,
        quoteRequestId,
      })
      .catch((error: unknown) =>
        finish(error instanceof Error ? error : new DustSweepSkip('noQuote')),
      );
  });
}
