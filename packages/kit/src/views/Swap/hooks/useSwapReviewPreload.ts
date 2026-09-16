import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  ESwapDirectionType,
  ESwapQuoteKind,
} from '@onekeyhq/shared/types/swap/types';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

import {
  useSwapFromTokenAmountAtom,
  useSwapManualSelectQuoteProvidersAtom,
  useSwapQuoteActionLockAtom,
  useSwapQuoteEventCompletedAtom,
  useSwapQuoteEventTotalCountAtom,
  useSwapQuoteFetchingAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapShouldRefreshQuoteAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';
import {
  isSwapQuoteProvenForCurrentRequest,
  isSwapQuoteRequestForCurrentInput,
} from '../../../states/jotai/contexts/swap/quoteProgress';
import {
  createSwapReviewPreloadWithBuildCache,
  getSwapReviewPreparationKey,
  shouldPreloadSwapReview,
  supportsSwapReviewPreload,
} from '../utils/swapReviewPreload';

import { useSwapAddressInfo } from './useSwapAccount';

import type { ISwapPreparedBuild, ISwapPreparedReview } from './useSwapBuiltTx';

export function useSwapReviewPreload({
  enabled,
  quote,
  contextKey,
  prepare,
  prepareBuild,
  getBuildKey,
  isWaitingAutoSlippage,
}: {
  enabled: boolean;
  quote?: IFetchQuoteResult;
  contextKey: string;
  isWaitingAutoSlippage: boolean;
  getBuildKey: (quote: IFetchQuoteResult) => string;
  prepareBuild: (
    quote: IFetchQuoteResult,
    isCurrent: () => boolean,
  ) => Promise<ISwapPreparedBuild>;
  prepare: (
    quote: IFetchQuoteResult,
    isCurrent: () => boolean,
    build: Promise<ISwapPreparedBuild>,
  ) => Promise<ISwapPreparedReview>;
}) {
  const [request] = useSwapQuoteActionLockAtom();
  const [completed] = useSwapQuoteEventCompletedAtom();
  const [event] = useSwapQuoteEventTotalCountAtom();
  const [manualSelection] = useSwapManualSelectQuoteProvidersAtom();
  const [loading] = useSwapQuoteFetchingAtom();
  const [shouldRefresh] = useSwapShouldRefreshQuoteAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [fromAmount] = useSwapFromTokenAmountAtom();
  const [toAmount] = useSwapToTokenAmountAtom();
  const [swapType] = useSwapTypeSwitchAtom();
  const from = useSwapAddressInfo(ESwapDirectionType.FROM);
  const to = useSwapAddressInfo(ESwapDirectionType.TO);
  const cache = useRef(
    createSwapReviewPreloadWithBuildCache<
      ISwapPreparedBuild,
      ISwapPreparedReview
    >(),
  );
  const prepareRef = useRef({ prepare, prepareBuild });
  prepareRef.current = { prepare, prepareBuild };
  const buildKey = useMemo(
    () => (quote ? getBuildKey(quote) : undefined),
    [getBuildKey, quote],
  );
  const quoteRef = useRef(quote);
  quoteRef.current = quote;
  const key = useMemo(
    () => (quote ? getSwapReviewPreparationKey(quote, contextKey) : undefined),
    [contextKey, quote],
  );
  const requestMatchesCurrentInput = isSwapQuoteRequestForCurrentInput({
    currentAccountId: from.accountInfo?.account?.id,
    currentAddress: from.address,
    currentReceivingAddress: to.address,
    currentSwapType: swapType,
    fromAmount: fromAmount.value,
    toAmount: toAmount.value,
    fromToken,
    toToken,
    quoteKind: quote?.kind ?? ESwapQuoteKind.SELL,
    quoteRequest: request,
  });
  const proven = isSwapQuoteProvenForCurrentRequest({
    quote,
    quoteEventTotalCount: event,
    quoteLoading: loading,
    quoteEventFetching: !completed,
    quoteActionLocked: request.actionLock,
    requestMatchesCurrentInput,
  });
  const mayPreload =
    enabled &&
    from.networkId === quote?.fromTokenInfo.networkId &&
    !shouldRefresh &&
    shouldPreloadSwapReview({
      quote,
      proven,
      completed,
      manualSelection,
      isWaitingAutoSlippage,
    });

  useEffect(() => {
    const owner = cache.current;
    const snapshot = quoteRef.current;
    if (mayPreload && key && buildKey && snapshot) {
      const prepareSnapshot = prepareRef.current;
      owner.preload(
        key,
        buildKey,
        (isCurrent) => prepareSnapshot.prepareBuild(snapshot, isCurrent),
        (build, isCurrent) =>
          prepareSnapshot.prepare(snapshot, isCurrent, build),
      );
    } else {
      owner.clearCandidate();
    }
  }, [key, buildKey, mayPreload]);

  useEffect(() => {
    const owner = cache.current;
    return owner.clear;
  }, []);

  const claimPreparation = useCallback(() => {
    if (
      !enabled ||
      !quote ||
      !key ||
      !buildKey ||
      !supportsSwapReviewPreload(quote) ||
      from.networkId !== quote.fromTokenInfo.networkId
    )
      return undefined;
    return cache.current.claim(
      key,
      buildKey,
      (isCurrent) => prepareBuild(quote, isCurrent),
      (build, isCurrent) => prepare(quote, isCurrent, build),
    );
  }, [enabled, key, buildKey, prepare, prepareBuild, quote, from.networkId]);
  const clearPreparation = useCallback(() => cache.current.clear(), []);
  return { claimPreparation, clearPreparation };
}
