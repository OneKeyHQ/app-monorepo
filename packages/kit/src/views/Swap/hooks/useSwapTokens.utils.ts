import BigNumber from 'bignumber.js';

import type { IFuseResult } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

export function isSwapSupportAllAccountsRequestCurrent({
  isCancelled,
  requestGeneration,
  currentGeneration,
}: {
  isCancelled: boolean;
  requestGeneration: number;
  currentGeneration: number;
}) {
  return !isCancelled && requestGeneration === currentGeneration;
}

export function releaseSwapTokenListFetchEffectKey({
  effectKey,
  latestEffectKey,
}: {
  effectKey: string;
  latestEffectKey: string;
}) {
  return latestEffectKey === effectKey ? '' : latestEffectKey;
}

// The server also matches aliases that are not present in the display fields.
// Fuse enriches those rows with highlights but must not decide membership.
export function buildServerAuthoritativeSearchResults<T>(
  tokens: T[],
  matchesByToken?: Map<T, IFuseResult<T>['matches']>,
): IFuseResult<T>[] {
  return tokens.map((item, refIndex) => {
    const matches = matchesByToken?.get(item);
    return matches ? { item, refIndex, matches } : { item, refIndex };
  });
}

// All-network results get balances from the cached all-network token list,
// since the all-network request carries no account address. A keyword search
// (e.g. a pasted address widened to All Networks) loads that list once when
// it is missing, so held tokens still show balances; empty-keyword lists keep
// reloading on every fetch as before. `forceRefresh` (balance-changing events
// such as a finished swap) always reloads so cached balances are not reused.
export function shouldLoadSwapAllNetworkTokenList({
  networkId,
  keywords,
  isTokenFetchAllNetworks,
  allNetworkTokenListReady,
  hasAllNetworkTokenList,
  forceRefresh = false,
}: {
  networkId?: string;
  keywords?: string;
  isTokenFetchAllNetworks: boolean;
  allNetworkTokenListReady: boolean;
  hasAllNetworkTokenList: boolean;
  forceRefresh?: boolean;
}) {
  return (
    Boolean(networkId) &&
    isTokenFetchAllNetworks &&
    allNetworkTokenListReady &&
    (forceRefresh || !keywords || !hasAllNetworkTokenList)
  );
}

// Search results carry fresh token metadata (price, riskLevel, security
// flags); the cached wallet list only contributes account-owned fields, so a
// newly flagged risky token is never masked by a stale cached copy.
export function mergeSwapSearchTokenBalance(
  searchToken: ISwapToken,
  balanceToken: ISwapToken,
): ISwapToken {
  // Price the cached balance with the fresh search price so the fiat value
  // agrees with the displayed price; keep the cached value otherwise.
  const freshFiatValue = new BigNumber(
    balanceToken.balanceParsed ?? 'NaN',
  ).times(searchToken.price ?? 'NaN');
  return {
    ...searchToken,
    balanceParsed: balanceToken.balanceParsed,
    fiatValue: freshFiatValue.isFinite()
      ? freshFiatValue.toFixed()
      : balanceToken.fiatValue,
    accountAddress: balanceToken.accountAddress,
    reservationValue: balanceToken.reservationValue,
    networkLogoURI: searchToken.networkLogoURI ?? balanceToken.networkLogoURI,
    subtitles: searchToken.subtitles ?? balanceToken.subtitles,
  };
}
