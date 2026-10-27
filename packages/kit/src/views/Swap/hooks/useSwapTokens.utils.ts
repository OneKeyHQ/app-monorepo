import BigNumber from 'bignumber.js';

import type { IFuseResult } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { isTokenContractAddressKeywords } from '@onekeyhq/shared/src/utils/tokenSelectorCrossNetworkUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
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

// All-network results get balances from the all-network wallet list, since
// the all-network request carries no account address. That list may be a
// cold-start snapshot or stale, so a contract address search (pasted to find
// a held token) refreshes it; name searches reuse it to avoid reloading every
// network per keystroke. `forceRefresh` covers balance-changing events such
// as a finished swap.
export function shouldLoadSwapAllNetworkTokenList({
  networkId,
  keywords,
  isTokenFetchAllNetworks,
  allNetworkTokenListReady,
  forceRefresh = false,
}: {
  networkId?: string;
  keywords?: string;
  isTokenFetchAllNetworks: boolean;
  allNetworkTokenListReady: boolean;
  forceRefresh?: boolean;
}) {
  return (
    Boolean(networkId) &&
    isTokenFetchAllNetworks &&
    allNetworkTokenListReady &&
    (forceRefresh || !keywords || isTokenContractAddressKeywords(keywords))
  );
}

// The search result and the wallet list may spell the same EVM contract in
// checksum and lowercase forms, so match per network without case.
export function findSwapWalletBalanceToken(
  walletTokens: ISwapToken[],
  searchToken: ISwapToken,
) {
  return walletTokens.find((walletToken) =>
    equalTokenNoCaseSensitive({ token1: walletToken, token2: searchToken }),
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
