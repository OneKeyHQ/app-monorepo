import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { resolveQuoteShowTip } from '@onekeyhq/kit/src/views/Swap/utils/quoteShowTipUtils';
import { getSwapQuoteLimitError } from '@onekeyhq/kit/src/views/Swap/utils/swapErrorUtils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import {
  checkWrappedTokenPair,
  equalTokenNoCaseSensitive,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IDustSweepReason,
  IDustSweepSnapshot,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';
import { DUST_SWEEP_PROVIDER } from '@onekeyhq/shared/types/swap/dustSweep';
import type {
  IFetchQuoteResult,
  ISwapQuoteEventData,
  ISwapQuoteEventPayload,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  EQuoteShowTipType,
  ESwapQuoteKind,
  ESwapQuoteSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { DustSweepError } from './DustSweepError';

export class DustSweepSkip extends DustSweepError {}

// Unwrap quotes use the native wrapper contract instead of a DEX provider.
export function isDustSweepQuoteCandidate(quote: IFetchQuoteResult) {
  return (
    quote.info?.provider === DUST_SWEEP_PROVIDER ||
    quote.info?.provider === 'wrapped'
  );
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

function getUsablePrice(localPrice?: string, quotePrice?: string) {
  const price = new BigNumber(localPrice ?? '');
  return price.isFinite() && price.gt(0) ? localPrice : quotePrice;
}

function isMatchingDustSweepQuote(
  quote: IFetchQuoteResult,
  token: IDustSweepToken,
  snapshot: IDustSweepSnapshot,
) {
  return !(
    !isDustSweepQuoteCandidate(quote) ||
    !isSameDustSweepToken({
      quoteToken: quote.fromTokenInfo,
      expectedToken: token,
    }) ||
    !isSameDustSweepToken({
      quoteToken: quote.toTokenInfo,
      expectedToken: snapshot.nativeToken,
    }) ||
    (quote.fromAmount !== undefined &&
      !new BigNumber(quote.fromAmount).eq(token.amount)) ||
    (quote.protocol !== undefined &&
      quote.protocol !== EProtocolOfExchange.SWAP) ||
    (quote.kind !== undefined && quote.kind !== ESwapQuoteKind.SELL)
  );
}

export function getDustSweepQuoteErrorMessage(
  quote: IFetchQuoteResult,
  token: IDustSweepToken,
  snapshot: IDustSweepSnapshot,
) {
  if (!isMatchingDustSweepQuote(quote, token, snapshot)) return undefined;
  if (quote.errorMessage?.trim()) return quote.errorMessage.trim();
  const { tip } = getDustSweepQuoteRiskResult(quote, token, snapshot);
  return (
    [tip?.title?.trim(), tip?.detail?.trim()].filter(Boolean).join('\n') ||
    undefined
  );
}

export function getDustSweepQuoteError(
  reason: IDustSweepReason,
  quote: IFetchQuoteResult,
  token: IDustSweepToken,
  snapshot: IDustSweepSnapshot,
) {
  return new DustSweepSkip(reason, {
    providerErrorMessage: getDustSweepQuoteErrorMessage(quote, token, snapshot),
    localError: isMatchingDustSweepQuote(quote, token, snapshot)
      ? getSwapQuoteLimitError({
          limit: quote.limit,
          fromTokenAmount: token.amount,
          fromTokenSymbol: token.symbol,
        })
      : undefined,
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

function getDustSweepQuoteRiskResult(
  quote: IFetchQuoteResult,
  token: IDustSweepToken,
  snapshot: IDustSweepSnapshot,
): { reason?: IDustSweepReason; tip?: IFetchQuoteResult['quoteShowTip'] } {
  const toAmount = new BigNumber(quote.toAmount ?? '');
  if (
    !isDustSweepQuoteCandidate(quote) ||
    quote.errorMessage ||
    getSwapQuoteLimitError({
      limit: quote.limit,
      fromTokenAmount: token.amount,
    }) ||
    !toAmount.isFinite() ||
    !toAmount.gt(0)
  )
    return { reason: 'noQuote' };
  if (
    (quote.protocol !== undefined &&
      quote.protocol !== EProtocolOfExchange.SWAP) ||
    (quote.kind !== undefined && quote.kind !== ESwapQuoteKind.SELL) ||
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
    return { reason: 'unknown' };
  const isWrapped = quote.info.provider === 'wrapped';
  if (isWrapped ? quote.isWrapped !== true : quote.isWrapped)
    return { reason: 'unknown' };
  if (
    isWrapped &&
    (token.isNative ||
      quote.fromTokenInfo.isNative ||
      !snapshot.nativeToken.isNative ||
      !quote.toTokenInfo.isNative ||
      token.decimals !== snapshot.nativeToken.decimals ||
      !checkWrappedTokenPair({
        fromToken: token,
        toToken: snapshot.nativeToken,
      }) ||
      !toAmount.eq(token.amount) ||
      quote.allowanceResult ||
      quote.approvedInfo ||
      quote.quoteShowTip?.showCheckbox ||
      (quote.fee?.protocolFees !== undefined &&
        !new BigNumber(quote.fee.protocolFees).isZero()) ||
      (quote.fee !== undefined &&
        !new BigNumber(quote.fee.percentageFee).isZero()))
  )
    return { reason: 'unknown' };
  if (
    quote.swapShouldSignedData ||
    quote.shouldWrappedToken ||
    tokenRebaseUtils.isScalingBalanceMultiplier(token.balanceMultiplier)
  )
    return { reason: 'unknown' };
  for (const fee of quote.fee?.otherFeeInfos ?? []) {
    const amount = new BigNumber(fee.amount ?? '');
    if (
      !amount.isFinite() ||
      amount.isNegative() ||
      (isWrapped && amount.gt(0)) ||
      (amount.gt(0) &&
        !isSameDustSweepToken({ quoteToken: fee.token, expectedToken: token }))
    )
      return { reason: 'unknown' };
  }
  // A verified 1:1 withdrawal has no market-price impact or slippage.
  if (isWrapped) return {};
  const fromToken = {
    ...token,
    price: getUsablePrice(token.price, quote.fromTokenInfo.price),
  };
  const toToken = {
    ...snapshot.nativeToken,
    price: getUsablePrice(snapshot.nativeToken.price, quote.toTokenInfo.price),
  };
  const tip = resolveQuoteShowTip({
    quoteShowTip: quote.quoteShowTip,
    fromToken,
    toToken,
    fromAmount: token.amount,
    toAmount: quote.toAmount,
  });
  if (tip?.type === EQuoteShowTipType.PRICE_IMPACT)
    return { reason: 'valueDrop', tip };
  if (tip) return { reason: 'unknown', tip };
  const quotedImpact =
    quote.valueDropPercent ?? quote.quoteShowTip?.priceImpact;
  const impactPercent =
    quotedImpact === undefined
      ? getActualPriceImpactPercent({
          fromToken,
          toToken,
          fromAmount: token.amount,
          toAmount: quote.toAmount,
        })
      : new BigNumber(quotedImpact);
  if (!impactPercent || !impactPercent.isFinite()) return { reason: 'unknown' };
  if (impactPercent.gt(snapshot.slippage)) return { reason: 'priceImpact' };
  return {};
}

export function getDustSweepQuoteRisk(
  quote: IFetchQuoteResult,
  token: IDustSweepToken,
  snapshot: IDustSweepSnapshot,
): IDustSweepReason | undefined {
  return getDustSweepQuoteRiskResult(quote, token, snapshot).reason;
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
    let unavailable = new DustSweepSkip('noQuote');
    const finishRef: {
      current: (error?: unknown, quote?: IFetchQuoteResult) => void;
    } = {
      current: () => undefined,
    };
    const abort = () =>
      finishRef.current(new OneKeyLocalError('Dust Sweep cancelled'));
    const listener = (event: ISwapQuoteEventPayload) => {
      if (event.quoteRequestId !== quoteRequestId) return;
      if (event.type === 'error') {
        finishRef.current(
          new DustSweepSkip('noQuote', {
            message: 'message' in event.event ? event.event.message : undefined,
          }),
        );
        return;
      }
      if (event.type === 'done' || event.type === 'close') {
        // Native dispatches done immediately before error on dropped connections.
        void Promise.resolve().then(() => finishRef.current(unavailable));
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
              if (isDustSweepQuoteCandidate(candidate)) {
                unavailable = getDustSweepQuoteError(
                  risk,
                  candidate,
                  token,
                  snapshot,
                );
              }
              return false;
            }
            return true;
          });
          if (quote) finishRef.current(undefined, quote);
        }
        if ('errorMessage' in payload && payload.errorMessage)
          finishRef.current(
            new DustSweepSkip('noQuote', {
              providerErrorMessage: payload.errorMessage,
            }),
          );
        if ('totalQuoteCount' in payload && payload.totalQuoteCount === 0)
          finishRef.current(new DustSweepSkip('noQuote'));
      } catch {
        finishRef.current(new DustSweepSkip('noQuote'));
      }
    };
    const timeout = setTimeout(() => finishRef.current(unavailable), 25_000);
    const finish = (error?: unknown, quote?: IFetchQuoteResult) => {
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
        denySingleSwapProvider: snapshot.denySingleSwapProvider,
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
      .catch((error: unknown) => finish(error));
  });
}
