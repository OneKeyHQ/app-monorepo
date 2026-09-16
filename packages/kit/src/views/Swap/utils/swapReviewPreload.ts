// A preparation belongs to one quote snapshot. Claiming it transfers ownership
// from the changing quote list to the frozen review, without replacing its Promise.
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  IFetchQuoteResult,
  ISwapPreSwapData,
} from '@onekeyhq/shared/types/swap/types';

import {
  type ISwapQuoteSelectionIntent,
  buildSwapQuoteProviderKey,
  isSwapQuoteActionable,
} from '../../../states/jotai/contexts/swap/quoteProgress';

export const SWAP_REVIEW_PRELOAD_MAX_AGE_MS = 30_000;

function getDeadlineMs(value?: string) {
  if (!value) return undefined;
  const numeric = Number(value);
  let deadline = Date.parse(value);
  if (Number.isFinite(numeric)) {
    deadline = numeric > 10 ** 12 ? numeric : numeric * 1000;
  }
  return Number.isFinite(deadline) ? deadline : undefined;
}

export function isSwapPreparedBuildExpired({
  buildResult,
  builtAt,
}: {
  buildResult: NonNullable<ISwapPreSwapData['swapBuildResultData']>;
  builtAt: number;
}) {
  const deadline = getDeadlineMs(
    buildResult.swapInfo?.swapBuildResData.thorSwapCallData?.expiration,
  );
  return (
    Date.now() - builtAt >= SWAP_REVIEW_PRELOAD_MAX_AGE_MS ||
    (deadline !== undefined && deadline <= Date.now() + 5000)
  );
}

export function isSwapPreparedFeeExpired(
  netWorkFee: ISwapPreSwapData['netWorkFee'],
  preparedAt: number,
) {
  return (
    Date.now() - preparedAt >= SWAP_REVIEW_PRELOAD_MAX_AGE_MS ||
    Boolean(
      netWorkFee?.gasInfos?.some(({ gasInfo }) => {
        const deadline = getDeadlineMs(gasInfo.gasAccountQuote?.expiresAt);
        return deadline !== undefined && deadline <= Date.now() + 5000;
      }),
    )
  );
}

export function getSwapReviewPreparationKey(
  quote: IFetchQuoteResult,
  contextKey: string,
) {
  const { isBest, receivedBest, minGasCost, ...buildQuote } = quote;
  return JSON.stringify([contextKey, buildQuote]);
}

// Only the source chain owns the unsigned transaction. Destination-chain state
// is handled by the provider. Other source chains keep the existing cold Review
// path until their encoded-transaction lifetime can be validated on adoption.
export function supportsSwapReviewPreload(quote?: IFetchQuoteResult) {
  return networkUtils.isEvmNetwork({
    networkId: quote?.fromTokenInfo?.networkId,
  });
}

export function shouldPreloadSwapReview({
  quote,
  proven,
  completed,
  manualSelection,
  isWaitingAutoSlippage = false,
}: {
  quote?: IFetchQuoteResult;
  proven: boolean;
  completed: boolean;
  manualSelection?: ISwapQuoteSelectionIntent;
  isWaitingAutoSlippage?: boolean;
}) {
  if (
    !quote ||
    !supportsSwapReviewPreload(quote) ||
    !proven ||
    isWaitingAutoSlippage ||
    !isSwapQuoteActionable(quote)
  )
    return false;
  return (
    completed ||
    Boolean(
      manualSelection &&
      buildSwapQuoteProviderKey(manualSelection) ===
        buildSwapQuoteProviderKey(quote),
    )
  );
}

export type ISwapReviewPreloadWithBuild<B, T> = ISwapReviewPreload<T> & {
  build: ISwapReviewPreload<B>;
  cancelFee: () => void;
};

// The quote owns the build; a replaceable fee task borrows it. A fee change must
// never invalidate the predicate used by an in-flight order build.
export function createSwapReviewPreloadWithBuildCache<B, T>() {
  let candidate: ISwapReviewPreloadWithBuild<B, T> | undefined;
  let claimed: ISwapReviewPreloadWithBuild<B, T> | undefined;
  const clearCandidate = () => {
    candidate?.cancel();
    candidate = undefined;
  };
  const preload = (
    key: string,
    buildKey: string,
    prepareBuild: (isCurrent: () => boolean) => Promise<B>,
    prepareFee: (build: Promise<B>, isCurrent: () => boolean) => Promise<T>,
  ): ISwapReviewPreloadWithBuild<B, T> => {
    if (claimed?.build.isCurrent()) return claimed;
    if (candidate?.key === key && candidate.isCurrent()) return candidate;
    let build = candidate?.build;
    if (build?.key !== buildKey || !build.isCurrent()) {
      clearCandidate();
      let buildCurrent = true;
      const isCurrent = () => buildCurrent;
      const promise = prepareBuild(isCurrent);
      build = {
        key: buildKey,
        isCurrent,
        cancel: () => {
          buildCurrent = false;
        },
        promise,
      };
      const buildOwner = build;
      void promise.catch(() => {
        // A rejected build cannot be adopted by a later Review attempt.
        // Invalidate it so the next claim starts a fresh request.
        buildOwner.cancel();
      });
    } else {
      candidate?.cancelFee();
    }
    const buildOwner = build;
    let feeCurrent = true;
    const isCurrent = () => feeCurrent && buildOwner.isCurrent();
    const task: ISwapReviewPreloadWithBuild<B, T> = {
      key,
      build: buildOwner,
      isCurrent,
      cancelFee: () => {
        feeCurrent = false;
      },
      cancel: () => {
        feeCurrent = false;
        buildOwner.cancel();
      },
      promise: prepareFee(buildOwner.promise, isCurrent),
    };
    void task.promise.catch(() => {
      // A rejected fee preparation is also unsafe to adopt on the next Review.
      task.cancel();
    });
    candidate = task;
    return task;
  };
  return {
    preload,
    clearCandidate,
    claim: (...args: Parameters<typeof preload>) => {
      if (claimed?.key === args[0] && claimed.build.isCurrent()) return claimed;
      claimed?.cancel();
      claimed = undefined;
      const task = preload(...args);
      claimed = task;
      candidate = undefined;
      return task;
    },
    clear: () => {
      clearCandidate();
      claimed?.cancel();
      claimed = undefined;
    },
  };
}

export type ISwapReviewPreload<T> = {
  key: string;
  promise: Promise<T>;
  isCurrent: () => boolean;
  cancel: () => void;
};
