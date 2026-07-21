import { normalizeHomeStoreJson } from '../../model/store/homeStoreJson';

import type { IHomeSectionSourceRequestHandle } from '../../model/react/useHomeStoreSourcePublisher';
import type { IHomeSpotLegacyPayload } from '../../model/sections/spot/homeSpotSourceAdapter';
import type { IHomeStoreSectionSourceResult } from '../../model/store/homeStoreTypes';

type IHomePortfolioRequestRound = {
  handle: IHomeSectionSourceRequestHandle;
  identityKey: string;
  sequence: number;
};

class HomePortfolioRequestLifecycle {
  private activeRound: IHomePortfolioRequestRound | undefined;

  private sequence = 0;

  begin({
    beginRequest,
    identityKey,
  }: {
    beginRequest: () => IHomeSectionSourceRequestHandle;
    identityKey: string;
  }): IHomePortfolioRequestRound {
    this.sequence += 1;
    const round = {
      handle: beginRequest(),
      identityKey,
      sequence: this.sequence,
    };
    this.activeRound = round;
    return round;
  }

  complete({
    completeRequest,
    result,
    round,
  }: {
    completeRequest: (
      handle: IHomeSectionSourceRequestHandle,
      result: IHomeStoreSectionSourceResult,
    ) => void;
    result: IHomeStoreSectionSourceResult;
    round: IHomePortfolioRequestRound | undefined;
  }): boolean {
    if (!round || this.activeRound !== round) {
      return false;
    }
    this.activeRound = undefined;
    completeRequest(round.handle, result);
    return true;
  }

  invalidate(): void {
    this.activeRound = undefined;
  }

  getRequestCount(): number {
    return this.sequence;
  }

  getActiveRound(): IHomePortfolioRequestRound | undefined {
    return this.activeRound;
  }
}

function areIdsEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function reuseHomePortfolioPayload(
  previous: IHomeSpotLegacyPayload | undefined,
  next: IHomeSpotLegacyPayload,
): IHomeSpotLegacyPayload {
  if (
    previous &&
    previous.accountTokensValue === next.accountTokensValue &&
    previous.accountTokensWorthCurrency === next.accountTokensWorthCurrency &&
    previous.aggregateTokenListMap === next.aggregateTokenListMap &&
    previous.allAggregateTokenMap === next.allAggregateTokenMap &&
    areIdsEqual(previous.displayIds, next.displayIds) &&
    previous.generation === next.generation &&
    previous.homeDefaultTokenMap === next.homeDefaultTokenMap &&
    previous.isAllNetworkEmptyAccount === next.isAllNetworkEmptyAccount &&
    previous.isLpTokenSwitchLoading === next.isLpTokenSwitchLoading &&
    previous.mergeDeriveAddressData === next.mergeDeriveAddressData &&
    previous.networksMap === next.networksMap &&
    previous.ownerKey === next.ownerKey &&
    previous.scopedLpTokenList === next.scopedLpTokenList &&
    previous.scopedLpTokenListMap === next.scopedLpTokenListMap &&
    previous.scopedLpTokenListState === next.scopedLpTokenListState &&
    previous.showLpTokenFilterSwitch === next.showLpTokenFilterSwitch &&
    previous.showLpTokensOnly === next.showLpTokensOnly &&
    previous.tapTokenMap === next.tapTokenMap &&
    previous.tokenListMap === next.tokenListMap &&
    previous.tokens === next.tokens
  ) {
    return previous;
  }
  return next;
}

function buildHomePortfolioReadyResult(
  payload: IHomeSpotLegacyPayload,
): IHomeStoreSectionSourceResult {
  const data = normalizeHomeStoreJson(payload);
  if (data === undefined) {
    return { kind: 'error' };
  }
  return {
    kind: 'ready',
    data,
    freshness: 'live',
    refresh: 'idle',
    rowIds: payload.displayIds,
  };
}

export {
  HomePortfolioRequestLifecycle,
  buildHomePortfolioReadyResult,
  reuseHomePortfolioPayload,
};
export type { IHomePortfolioRequestRound };
