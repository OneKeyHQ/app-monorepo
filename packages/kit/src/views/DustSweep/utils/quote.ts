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
} from '@onekeyhq/shared/types/swap/types';
import {
  EQuoteShowTipType,
  ESwapQuoteKind,
  ESwapQuoteSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

export const DUST_SWEEP_PROVIDER = 'SwapOKX';

export class DustSweepSkip extends OneKeyLocalError {
  reason: IDustSweepReason;
  constructor(reason: IDustSweepReason, message?: string) {
    super(message ?? reason);
    this.reason = reason;
  }
}

export function getDustSweepQuoteRisk(
  quote: IFetchQuoteResult,
  token: IDustSweepToken,
  snapshot: IDustSweepSnapshot,
): IDustSweepReason | undefined {
  const toAmount = new BigNumber(quote.toAmount ?? '');
  if (
    quote.info?.provider !== DUST_SWEEP_PROVIDER ||
    quote.errorMessage ||
    !toAmount.isFinite() ||
    !toAmount.gt(0)
  )
    return 'noQuote';
  if (
    token.networkId !== snapshot.networkId ||
    snapshot.nativeToken.networkId !== snapshot.networkId ||
    !equalTokenNoCaseSensitive({
      token1: quote.fromTokenInfo,
      token2: token,
    }) ||
    !equalTokenNoCaseSensitive({
      token1: quote.toTokenInfo,
      token2: snapshot.nativeToken,
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
  const impact = quote.valueDropPercent ?? quote.quoteShowTip?.priceImpact;
  if (impact !== undefined) {
    const impactPercent = new BigNumber(impact);
    if (!impactPercent.isFinite()) return 'unknown';
    if (impactPercent.gt(snapshot.slippage)) return 'priceImpact';
  }
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
          finishRef.current(new DustSweepSkip('noQuote')),
        );
        return;
      }
      if (event.type !== 'message') return;
      try {
        const payload = JSON.parse(
          String((event.event as { data?: string }).data),
        ) as ISwapQuoteEventData;
        if ('data' in payload && Array.isArray(payload.data)) {
          const quote = payload.data.find(
            (item) => item.info?.provider === DUST_SWEEP_PROVIDER,
          );
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
      () => finishRef.current(new DustSweepSkip('noQuote')),
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
