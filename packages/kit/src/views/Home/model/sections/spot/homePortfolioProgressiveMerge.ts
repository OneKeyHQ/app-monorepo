import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { sortTokensByFiatValue } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import type { IHomeSpotLegacyPayload } from './homeSpotSourceAdapter';

function mergeTokenMap(
  base: Record<string, ITokenFiat>,
  incoming: Record<string, ITokenFiat>,
): Record<string, ITokenFiat> {
  return { ...base, ...incoming };
}

function mergeTokens({
  base,
  coveredAccountNetworkKeys,
  incoming,
  map,
}: {
  base: readonly IAccountToken[];
  coveredAccountNetworkKeys: ReadonlySet<string>;
  incoming: readonly IAccountToken[];
  map: Record<string, ITokenFiat>;
}): IAccountToken[] {
  const tokensByKey = new Map<string, IAccountToken>();
  base.forEach((token) => {
    const accountNetworkKey =
      token.accountId && token.networkId
        ? accountUtils.buildAccountValueKey({
            accountId: token.accountId,
            networkId: token.networkId,
          })
        : undefined;
    if (
      token.isAggregateToken ||
      !accountNetworkKey ||
      !coveredAccountNetworkKeys.has(accountNetworkKey)
    ) {
      tokensByKey.set(token.$key, token);
    }
  });
  incoming.forEach((token) => tokensByKey.set(token.$key, token));
  return sortTokensByFiatValue({
    tokens: Array.from(tokensByKey.values()),
    map,
  });
}

function pickTokenMap(
  tokens: readonly IAccountToken[],
  source: Record<string, ITokenFiat>,
): Record<string, ITokenFiat> {
  return Object.fromEntries(
    tokens.flatMap((token) => {
      const fiat = source[token.$key];
      return fiat ? [[token.$key, fiat] as const] : [];
    }),
  );
}

function mergeHomePortfolioProgressivePayload({
  base,
  incoming,
}: {
  base: IHomeSpotLegacyPayload;
  incoming: IHomeSpotLegacyPayload;
}): IHomeSpotLegacyPayload {
  if (
    incoming.showLpTokensOnly ||
    base.showLpTokensOnly !== incoming.showLpTokensOnly
  ) {
    return incoming;
  }
  const coveredAccountNetworkKeys = new Set(
    Object.keys(incoming.accountWorthByNetwork ?? {}),
  );
  const mergedTokenListMap = mergeTokenMap(
    base.tokenListMap,
    incoming.tokenListMap,
  );
  const mergedSmallBalanceMap = mergeTokenMap(
    base.smallBalanceMap,
    incoming.smallBalanceMap,
  );
  const mergedRiskMap = mergeTokenMap(base.riskMap, incoming.riskMap);
  const mergedScopedLpTokenListMap = mergeTokenMap(
    base.scopedLpTokenListMap,
    incoming.scopedLpTokenListMap,
  );
  const tokens = mergeTokens({
    base: base.tokens,
    coveredAccountNetworkKeys,
    incoming: incoming.tokens,
    map: mergedTokenListMap,
  });
  const smallBalanceTokens = mergeTokens({
    base: base.smallBalanceTokens,
    coveredAccountNetworkKeys,
    incoming: incoming.smallBalanceTokens,
    map: mergedSmallBalanceMap,
  });
  const riskTokens = mergeTokens({
    base: base.riskTokens,
    coveredAccountNetworkKeys,
    incoming: incoming.riskTokens,
    map: mergedRiskMap,
  });
  const scopedLpTokens = mergeTokens({
    base: base.scopedLpTokenList.tokens,
    coveredAccountNetworkKeys,
    incoming: incoming.scopedLpTokenList.tokens,
    map: mergedScopedLpTokenListMap,
  });
  const tokenListMap = pickTokenMap(tokens, mergedTokenListMap);
  const smallBalanceMap = pickTokenMap(
    smallBalanceTokens,
    mergedSmallBalanceMap,
  );
  const riskMap = pickTokenMap(riskTokens, mergedRiskMap);
  const scopedLpTokenListMap = pickTokenMap(
    scopedLpTokens,
    mergedScopedLpTokenListMap,
  );

  return {
    ...base,
    ...incoming,
    accountWorthByNetwork: {
      ...base.accountWorthByNetwork,
      ...incoming.accountWorthByNetwork,
    },
    aggregateTokenListMap: {
      ...base.aggregateTokenListMap,
      ...incoming.aggregateTokenListMap,
    },
    allAggregateTokenMap: {
      ...base.allAggregateTokenMap,
      ...incoming.allAggregateTokenMap,
    },
    displayIds: tokens.map((token) => token.$key),
    fundedIds: tokens.map((token) => token.$key),
    homeDefaultTokenMap: {
      ...base.homeDefaultTokenMap,
      ...incoming.homeDefaultTokenMap,
    },
    isAllNetworkEmptyAccount: tokens.length === 0,
    networksMap: { ...base.networksMap, ...incoming.networksMap },
    riskMap,
    riskTokenCount: riskTokens.length,
    riskTokens,
    scopedLpTokenList: {
      keys: incoming.scopedLpTokenList.keys,
      tokens: scopedLpTokens,
    },
    scopedLpTokenListMap,
    smallBalanceMap,
    smallBalanceTokenCount: smallBalanceTokens.length,
    smallBalanceTokens,
    tapTokenMap: { ...base.tapTokenMap, ...incoming.tapTokenMap },
    tokenListMap,
    tokens,
  };
}

export { mergeHomePortfolioProgressivePayload };
