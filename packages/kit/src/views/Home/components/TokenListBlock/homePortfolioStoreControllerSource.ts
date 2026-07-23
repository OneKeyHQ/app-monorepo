import BigNumber from 'bignumber.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { isTokenSelectorDappToken } from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { normalizeHomeStoreJson } from '../../model/store/homeStoreJson';

import type { IHomeSectionSourceRequestHandle } from '../../model/react/useHomeStoreSourcePublisher';
import type { IHomeSpotLegacyPayload } from '../../model/sections/spot/homeSpotSourceAdapter';
import type { IHomeStoreSectionSourceResult } from '../../model/store/homeStoreTypes';

type IHomePortfolioRequestRound = {
  handle: IHomeSectionSourceRequestHandle;
  identityKey: string;
  sequence: number;
};

type IHomePortfolioValuationReceipt = {
  ownerKey: string;
  valuationVersion: number;
};

type IHomePortfolioTerminalEvidence = 'complete' | 'confirmedCache' | 'error';

function requireHomePortfolioValuationReceipt({
  ownerKey,
  receipt,
}: {
  ownerKey: string;
  receipt: IHomePortfolioValuationReceipt | undefined;
}): IHomePortfolioValuationReceipt {
  if (
    receipt?.ownerKey !== ownerKey ||
    !Number.isSafeInteger(receipt.valuationVersion) ||
    receipt.valuationVersion < 0
  ) {
    throw new OneKeyLocalError('Invalid Home portfolio valuation receipt');
  }
  return receipt;
}

function isHomePortfolioValuationReceiptApplied({
  applied,
  expected,
}: {
  applied: IHomePortfolioValuationReceipt | undefined;
  expected: IHomePortfolioValuationReceipt | undefined;
}): boolean {
  return (
    !!expected &&
    applied?.ownerKey === expected.ownerKey &&
    applied.valuationVersion >= expected.valuationVersion
  );
}

function resolveHomePortfolioTerminalEvidence({
  displayCount,
  terminal,
}: {
  displayCount: number;
  terminal: 'complete' | 'error' | 'partial';
}): IHomePortfolioTerminalEvidence {
  if (terminal === 'complete') {
    return 'complete';
  }
  return displayCount > 0 ? 'confirmedCache' : 'error';
}

function filterHomePortfolioSmallBalanceTokens({
  hideDappTokens,
  hideZeroBalanceTokens,
  nonZeroIds,
  tokens,
}: {
  hideDappTokens: boolean;
  hideZeroBalanceTokens: boolean;
  nonZeroIds: readonly string[];
  tokens: IAccountToken[];
}): IAccountToken[] {
  const nonZeroIdSet = new Set(nonZeroIds);
  return tokens.filter(
    (token) =>
      (!hideZeroBalanceTokens || nonZeroIdSet.has(token.$key)) &&
      (!hideDappTokens || !isTokenSelectorDappToken(token)),
  );
}

function filterHomePortfolioRiskTokens({
  hideZeroBalanceTokens,
  map,
  tokens,
}: {
  hideZeroBalanceTokens: boolean;
  map: Record<string, Pick<ITokenFiat, 'balance'>>;
  tokens: IAccountToken[];
}): IAccountToken[] {
  if (!hideZeroBalanceTokens) {
    return tokens;
  }
  return tokens.filter((token) =>
    new BigNumber(map[token.$key]?.balance ?? 0).gt(0),
  );
}

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
    previous.blockedRiskTokenCount === next.blockedRiskTokenCount &&
    areIdsEqual(previous.displayIds, next.displayIds) &&
    previous.generation === next.generation &&
    previous.homeDefaultTokenMap === next.homeDefaultTokenMap &&
    previous.isAllNetworkEmptyAccount === next.isAllNetworkEmptyAccount &&
    previous.isLpTokenSwitchLoading === next.isLpTokenSwitchLoading &&
    previous.mergeDeriveAddressData === next.mergeDeriveAddressData &&
    previous.networksMap === next.networksMap &&
    previous.ownerKey === next.ownerKey &&
    previous.riskMap === next.riskMap &&
    previous.riskTokens === next.riskTokens &&
    previous.scopedLpTokenList === next.scopedLpTokenList &&
    previous.scopedLpTokenListMap === next.scopedLpTokenListMap &&
    previous.scopedLpTokenListState === next.scopedLpTokenListState &&
    previous.showLpTokenFilterSwitch === next.showLpTokenFilterSwitch &&
    previous.showLpTokensOnly === next.showLpTokensOnly &&
    previous.smallBalanceFiatValue === next.smallBalanceFiatValue &&
    previous.smallBalanceMap === next.smallBalanceMap &&
    previous.smallBalanceTokens === next.smallBalanceTokens &&
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
  filterHomePortfolioRiskTokens,
  filterHomePortfolioSmallBalanceTokens,
  HomePortfolioRequestLifecycle,
  buildHomePortfolioReadyResult,
  isHomePortfolioValuationReceiptApplied,
  requireHomePortfolioValuationReceipt,
  resolveHomePortfolioTerminalEvidence,
  reuseHomePortfolioPayload,
};
export type {
  IHomePortfolioRequestRound,
  IHomePortfolioTerminalEvidence,
  IHomePortfolioValuationReceipt,
};
