import BigNumber from 'bignumber.js';

import {
  ESwapProviderSort,
  swapProviderRecommendApprovedWeights,
} from '../../types/swap/SwapProvider.constants';

import { getSwapQuoteDurationSortValue } from './swapQuoteDurationUtils';

import type { IFetchQuoteResult } from '../../types/swap/types';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface ISortSwapQuotesOptions {
  sort?: ESwapProviderSort;
  fromTokenAmount?: string;
}

export interface ISelectBestQuoteOptions {
  manualSelect?: IFetchQuoteResult;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Factory that builds a received-amount comparator.
 * When `useSlippage` is true the effective toAmount is adjusted by
 * `toAmountSlippage`; otherwise raw `toAmount` is used.
 */
function makeReceivedComparator(
  useSlippage: boolean,
  fromTokenAmountBN: BigNumber | undefined,
): (a: IFetchQuoteResult, b: IFetchQuoteResult) => number {
  return (a, b) => {
    const aVal = useSlippage
      ? new BigNumber(a.toAmount || 0).multipliedBy(
          new BigNumber(a.toAmountSlippage || 0).plus(1),
        )
      : new BigNumber(a.toAmount || 0);
    const bVal = useSlippage
      ? new BigNumber(b.toAmount || 0).multipliedBy(
          new BigNumber(b.toAmountSlippage || 0).plus(1),
        )
      : new BigNumber(b.toAmount || 0);

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
  };
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
  const gasFeeSorted = [...resetList].toSorted((a, b) => {
    const aBig = new BigNumber(a.fee?.estimatedFeeFiatValue || Infinity);
    const bBig = new BigNumber(b.fee?.estimatedFeeFiatValue || Infinity);
    return aBig.comparedTo(bBig);
  });

  // ---- Duration sort (ascending) ----
  const durationSorted = [...resetList].toSorted((a, b) => {
    const aVal = getSwapQuoteDurationSortValue(a);
    const bVal = getSwapQuoteDurationSortValue(b);
    return aVal.comparedTo(bVal);
  });

  // ---- Received sort (descending, with slippage adjustment) ----
  const receivedSorted = [...resetList].toSorted(
    makeReceivedComparator(true, fromTokenAmountBN),
  );

  // ---- Received original sort (no slippage, for receivedBest badge) ----
  const receivedOriginalSorted = [...resetList].toSorted(
    makeReceivedComparator(false, fromTokenAmountBN),
  );

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
    const recommendedSortedApprovedSorted = [
      ...recommendedSortedApproved,
    ].toSorted((a, b) => {
      const aVal = new BigNumber(a.toAmount || 0);
      const bVal = new BigNumber(b.toAmount || 0);
      return bVal.comparedTo(aVal);
    });

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
  let sortedList: IFetchQuoteResult[];
  switch (sortType) {
    case ESwapProviderSort.GAS_FEE:
      sortedList = [...gasFeeSorted];
      break;
    case ESwapProviderSort.SWAP_DURATION:
      sortedList = [...durationSorted];
      break;
    case ESwapProviderSort.RECEIVED:
      sortedList = [...receivedSorted];
      break;
    case ESwapProviderSort.RECOMMENDED:
    default:
      sortedList = [...recommendedSorted];
      break;
  }

  // Step 5: Post-sort limit re-ordering (stable sort)
  sortedList = [...sortedList].toSorted((a, b) => {
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

  // Step 6: Badge assignment (single spread per item)
  return sortedList.map((p) => ({
    ...p,
    isBest: p.quoteId === recommendedSorted[0]?.quoteId && !!p.toAmount,
    receivedBest:
      p.quoteId === receivedOriginalSorted[0]?.quoteId && !!p.toAmount,
    minGasCost: p.quoteId === gasFeeSorted[0]?.quoteId && !!p.toAmount,
  }));
}

// ---------------------------------------------------------------------------
// selectBestQuote – pure function, 1:1 parity with atoms.ts:409-433
// ---------------------------------------------------------------------------

export function selectBestQuote(
  sortedQuotes: IFetchQuoteResult[],
  options?: ISelectBestQuoteOptions,
): IFetchQuoteResult | undefined {
  if (sortedQuotes.length === 0) return undefined;

  const manual = options?.manualSelect;
  if (manual) {
    const matched = sortedQuotes.find(
      (item) =>
        item.info.provider === manual.info.provider &&
        item.info.providerName === manual.info.providerName,
    );
    if (matched?.toAmount) {
      return matched;
    }
    // Manual set but no match — check unSupportReceiveAddressDifferent
    if (!manual.unSupportReceiveAddressDifferent) {
      return sortedQuotes.find(
        (item) => !item.unSupportReceiveAddressDifferent,
      );
    }
  }

  return sortedQuotes[0];
}
