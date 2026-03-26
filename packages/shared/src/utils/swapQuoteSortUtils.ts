import BigNumber from 'bignumber.js';

import {
  ESwapProviderSort,
  swapProviderRecommendApprovedWeights,
} from '../../types/swap/SwapProvider.constants';

import type { IFetchQuoteResult } from '../../types/swap/types';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface ISortSwapQuotesOptions {
  sort?: ESwapProviderSort;
  fromTokenAmount?: string;
}

// ---------------------------------------------------------------------------
// sortSwapQuotes – pure function, 1:1 parity with atoms.ts:227-407
// ---------------------------------------------------------------------------

export function sortSwapQuotes(
  quotes: IFetchQuoteResult[],
  options?: ISortSwapQuotesOptions,
): IFetchQuoteResult[] {
  if (quotes.length === 0) return [];

  const sortType = options?.sort || ESwapProviderSort.RECOMMENDED;
  const fromTokenAmountBN = options?.fromTokenAmount
    ? new BigNumber(options.fromTokenAmount)
    : undefined;

  // Step 1: Reset badges (spread to avoid mutation)
  const resetList: IFetchQuoteResult[] = quotes.map((item) => ({
    ...item,
    receivedBest: false,
    isBest: false,
    minGasCost: false,
  }));

  // Step 2: Pre-compute all sort orders
  // ---- Gas fee sort (ascending) ----
  const gasFeeSorted = [...resetList].sort((a, b) => {
    const aBig = new BigNumber(a.fee?.estimatedFeeFiatValue || Infinity);
    const bBig = new BigNumber(b.fee?.estimatedFeeFiatValue || Infinity);
    return aBig.comparedTo(bBig);
  });

  // ---- Duration sort (ascending) ----
  const durationSorted = [...resetList].sort((a, b) => {
    const aVal = new BigNumber(a.estimatedTime || Infinity);
    const bVal = new BigNumber(b.estimatedTime || Infinity);
    return aVal.comparedTo(bVal);
  });

  // ---- Received sort (descending, with slippage adjustment) ----
  const receivedSorted = [...resetList].sort((a, b) => {
    const aToAmountSlippage = new BigNumber(a.toAmountSlippage || 0).plus(1);
    const bToAmountSlippage = new BigNumber(b.toAmountSlippage || 0).plus(1);
    const aVal = new BigNumber(a.toAmount || 0).multipliedBy(aToAmountSlippage);
    const bVal = new BigNumber(b.toAmount || 0).multipliedBy(bToAmountSlippage);

    const aHasLimit = !!a.limit;
    const bHasLimit = !!b.limit;

    if (aVal.isZero() && bVal.isZero() && aHasLimit && !bHasLimit) {
      return -1;
    }
    if (aVal.isZero() && bVal.isZero() && bHasLimit && !aHasLimit) {
      return 1;
    }

    if (fromTokenAmountBN) {
      if (
        aVal.isZero() ||
        aVal.isNaN() ||
        fromTokenAmountBN.lt(new BigNumber(a.limit?.min || 0)) ||
        fromTokenAmountBN.gt(new BigNumber(a.limit?.max || Infinity))
      ) {
        return 1;
      }
      if (
        bVal.isZero() ||
        bVal.isNaN() ||
        fromTokenAmountBN.lt(new BigNumber(b.limit?.min || 0)) ||
        fromTokenAmountBN.gt(new BigNumber(b.limit?.max || Infinity))
      ) {
        return -1;
      }
    } else {
      if (aVal.isZero() || aVal.isNaN()) {
        return 1;
      }
      if (bVal.isZero() || bVal.isNaN()) {
        return -1;
      }
    }

    return bVal.comparedTo(aVal);
  });

  // ---- Received original sort (no slippage, for receivedBest badge) ----
  const receivedOriginalSorted = [...resetList].sort((a, b) => {
    const aVal = new BigNumber(a.toAmount || 0);
    const bVal = new BigNumber(b.toAmount || 0);

    const aHasLimit = !!a.limit;
    const bHasLimit = !!b.limit;

    if (aVal.isZero() && bVal.isZero() && aHasLimit && !bHasLimit) {
      return -1;
    }
    if (aVal.isZero() && bVal.isZero() && bHasLimit && !aHasLimit) {
      return 1;
    }

    if (fromTokenAmountBN) {
      if (
        aVal.isZero() ||
        aVal.isNaN() ||
        fromTokenAmountBN.lt(new BigNumber(a.limit?.min || 0)) ||
        fromTokenAmountBN.gt(new BigNumber(a.limit?.max || Infinity))
      ) {
        return 1;
      }
      if (
        bVal.isZero() ||
        bVal.isNaN() ||
        fromTokenAmountBN.lt(new BigNumber(b.limit?.min || 0)) ||
        fromTokenAmountBN.gt(new BigNumber(b.limit?.max || Infinity))
      ) {
        return -1;
      }
    } else {
      if (aVal.isZero() || aVal.isNaN()) {
        return 1;
      }
      if (bVal.isZero() || bVal.isNaN()) {
        return -1;
      }
    }

    return bVal.comparedTo(aVal);
  });

  // Step 3: Recommended sort – starts from receivedSorted + approved boost
  let recommendedSorted = receivedSorted.slice();
  const recommendedSortedApproved = recommendedSorted.filter(
    (item) =>
      !item.allowanceResult && item.toAmount && item.approvedInfo?.isApproved,
  );

  if (
    receivedSorted.length > 0 &&
    recommendedSortedApproved.length > 0 &&
    receivedSorted[0].allowanceResult
  ) {
    const recommendedSortedApprovedSorted = [...recommendedSortedApproved].sort(
      (a, b) => {
        const aVal = new BigNumber(a.toAmount || 0);
        const bVal = new BigNumber(b.toAmount || 0);
        return bVal.comparedTo(aVal);
      },
    );

    const recommendedSortedAllowanceSortedBestAmountBN = new BigNumber(
      recommendedSortedApprovedSorted[0].toAmount || 0,
    );
    const receivedSortedBestAmountBN = new BigNumber(
      receivedSorted[0].toAmount || 0,
    );

    if (
      recommendedSortedAllowanceSortedBestAmountBN
        .multipliedBy(swapProviderRecommendApprovedWeights)
        .gt(receivedSortedBestAmountBN)
    ) {
      recommendedSorted = recommendedSorted.filter(
        (item) => item.quoteId !== recommendedSortedApprovedSorted[0].quoteId,
      );
      recommendedSorted = [
        recommendedSortedApprovedSorted[0],
        ...recommendedSorted,
      ];
    }
  }

  // Step 4: Select the sorted list based on sort type
  let sortedList = [...resetList];
  if (sortType === ESwapProviderSort.GAS_FEE) {
    sortedList = [...gasFeeSorted];
  }
  if (sortType === ESwapProviderSort.SWAP_DURATION) {
    sortedList = [...durationSorted];
  }
  if (sortType === ESwapProviderSort.RECEIVED) {
    sortedList = [...receivedSorted];
  }
  if (sortType === ESwapProviderSort.RECOMMENDED) {
    sortedList = [...recommendedSorted];
  }

  // Step 5: Post-sort limit re-ordering (stable sort)
  sortedList = [...sortedList].sort((a, b) => {
    if (a.limit && b.limit) {
      const aMin = new BigNumber(a.limit?.min || 0);
      const aMax = new BigNumber(a.limit?.max || 0);
      const bMin = new BigNumber(b.limit?.min || 0);
      const bMax = new BigNumber(b.limit?.max || 0);
      if (aMin.lt(bMin)) {
        return -1;
      }
      if (aMin.gt(bMin)) {
        return 1;
      }
      if (aMax.lt(bMax)) {
        return -1;
      }
      if (aMax.gt(bMax)) {
        return 1;
      }
    }
    return 0;
  });

  // Step 6: Badge assignment (spread to avoid mutation)
  return sortedList.map((p) => {
    let result = { ...p };
    if (result.quoteId === recommendedSorted?.[0]?.quoteId && result.toAmount) {
      result = { ...result, isBest: true };
    }
    if (
      result.quoteId === receivedOriginalSorted?.[0]?.quoteId &&
      result.toAmount
    ) {
      result = { ...result, receivedBest: true };
    }
    if (result.quoteId === gasFeeSorted?.[0]?.quoteId && result.toAmount) {
      result = { ...result, minGasCost: true };
    }
    return result;
  });
}
