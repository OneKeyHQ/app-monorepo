import BigNumber from 'bignumber.js';
import { uniqBy } from 'lodash';

import { TOKEN_LIST_HIGH_VALUE_MAX } from '@onekeyhq/shared/src/consts/walletConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  flattenAggregateTokensMap,
  mergeAggregateTokenListMap,
  mergeDeriveTokenList,
  mergeDeriveTokenListMap,
  mergeNestedAggregateTokenMap,
  nestAggregateTokensMap,
  sortTokensByFiatValue,
  sortTokensByOrder,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  isUnavailableOrZeroFiatValue,
  sumFiatValuesFromTokens,
  sumTokenGroupsFiatValueIgnoringUnavailable,
} from '@onekeyhq/shared/src/utils/tokenValueUtils';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

/**
 * One all-network fetch round (a single network's `fetchAccountTokens`
 * response), narrowed to the fields the merge consumes. Mirrors the per-`r`
 * shape iterated by the original `updateAllNetworksTokenList`.
 */
export interface IAllNetworkSnapshotRound {
  networkId?: string;
  accountId?: string;
  tokens: {
    data: IAccountToken[];
    keys: string;
    map: Record<string, ITokenFiat>;
  };
  smallBalanceTokens: {
    data: IAccountToken[];
    keys: string;
    map: Record<string, ITokenFiat>;
  };
  riskTokens: {
    data: IAccountToken[];
    keys: string;
    map: Record<string, ITokenFiat>;
  };
  aggregateTokenListMap?: { [key: string]: { tokens: IAccountToken[] } };
  aggregateTokenMap?: Record<string, ITokenFiat>;
  /**
   * Per-round merge-derive flag. When defined it OVERRIDES the
   * `mergeDeriveAssetsByNetworkId[networkId]` lookup for THIS round. Required by
   * the cold-owner cache∪live merge: a cache round (already derive-merged →
   * `false`) and a live round (raw → the network's real flag) for the SAME
   * networkId can coexist during a partial-settle window, so the flag must live
   * on the round, not be looked up per-networkId.
   */
  mergeDeriveAssets?: boolean;
}

/**
 * The coherent FULL merged snapshot produced from a set of rounds — post
 * merge-derive, `$key` dedup, fiat-value sort, zero-balance re-sort, and
 * high/low split. This is the single source of merge truth consumed by both the
 * live all-network effect and the cold cache-seed.
 */
export interface IMergedAllNetworkSnapshot {
  orderedTokens: IAccountToken[];
  smallBalanceTokens: IAccountToken[];
  riskyTokens: IAccountToken[];
  mergeTokenListMap: Record<string, ITokenFiat>;
  riskyTokenListMap: Record<string, ITokenFiat>;
  aggregateTokenMap: Record<string, Record<string, ITokenFiat>>;
  aggregateTokenListMap: { [key: string]: { tokens: IAccountToken[] } };
  smallBalanceFiatValue: string;
  accountsWorth: Record<string, string>;
  createAtNetworkWorth: string;
  tokenKeys: string;
  smallBalanceKeys: string;
  riskyKeys: string;
}

/**
 * Pure merge of all-network fetch rounds into a coherent full snapshot.
 *
 * Extracted verbatim from `TokenListBlock.updateAllNetworksTokenList` (the merge
 * loop + post-loop dedup/sort/split, lines ~1522-1731 of the original) so the
 * live consumer and the cold cache-seed share one implementation. The only
 * structural change vs the original: the per-network `mergeDeriveAssetsEnabled`
 * (an `await serviceNetwork.getVaultSettings`) is resolved by the caller into
 * `mergeDeriveAssetsByNetworkId` and passed in — the lookups are independent and
 * deterministic, so results are identical while this function stays pure/sync.
 *
 * Side effects from the original (updateLocalAggregateTokenMap/ListMap,
 * updateAccountWorth, the filter-mode / owner-identity guards, the ingestRound
 * call) intentionally remain in the caller — this function only transforms data.
 */
export function buildMergedAllNetworkSnapshot({
  rounds,
  mergeDeriveAssetsByNetworkId,
  accountId,
  createAtNetwork,
}: {
  rounds: IAllNetworkSnapshotRound[];
  mergeDeriveAssetsByNetworkId: Record<string, boolean | undefined>;
  accountId?: string;
  createAtNetwork?: string;
}): IMergedAllNetworkSnapshot {
  const tokenList: { tokens: IAccountToken[]; keys: string } = {
    tokens: [],
    keys: '',
  };
  const smallBalanceTokenList: {
    smallBalanceTokens: IAccountToken[];
    keys: string;
  } = { smallBalanceTokens: [], keys: '' };
  const riskyTokenList: { riskyTokens: IAccountToken[]; keys: string } = {
    riskyTokens: [],
    keys: '',
  };

  let tokenListMap: Record<string, ITokenFiat> = {};
  let smallBalanceTokenListMap: Record<string, ITokenFiat> = {};
  let riskyTokenListMap: Record<string, ITokenFiat> = {};
  const accountsWorth: Record<string, string> = {};
  let createAtNetworkWorth = new BigNumber(0);
  let smallBalanceTokensFiatValue = new BigNumber(0);

  let aggregateTokenListMap: { [key: string]: { tokens: IAccountToken[] } } =
    {};
  let aggregateTokenMap: Record<string, Record<string, ITokenFiat>> = {};

  for (const r of rounds) {
    // Per-round flag wins (cache vs live can disagree for the same networkId);
    // fall back to the per-networkId map for callers that don't tag rounds.
    const mergeDeriveAssetsEnabled =
      r.mergeDeriveAssets ??
      (r.networkId ? mergeDeriveAssetsByNetworkId[r.networkId] : undefined);

    if (r.aggregateTokenListMap) {
      aggregateTokenListMap = mergeAggregateTokenListMap({
        sourceMap: r.aggregateTokenListMap,
        targetMap: aggregateTokenListMap,
      });
    }

    if (r.aggregateTokenMap) {
      const nestedAggregateTokenMap = nestAggregateTokensMap({
        aggregateTokenMap: r.aggregateTokenMap,
        networkId: r.networkId ?? '',
      });
      aggregateTokenMap = mergeNestedAggregateTokenMap({
        sourceMap: nestedAggregateTokenMap,
        targetMap: aggregateTokenMap,
      });
    }

    tokenList.tokens = mergeDeriveTokenList({
      sourceTokens: r.tokens.data,
      targetTokens: tokenList.tokens,
      mergeDeriveAssets: mergeDeriveAssetsEnabled,
    });

    tokenList.keys = `${tokenList.keys}_${r.tokens.keys}`;
    tokenListMap = mergeDeriveTokenListMap({
      sourceMap: r.tokens.map,
      targetMap: tokenListMap,
      mergeDeriveAssets: mergeDeriveAssetsEnabled,
    });

    smallBalanceTokenList.smallBalanceTokens = mergeDeriveTokenList({
      sourceTokens: r.smallBalanceTokens.data,
      targetTokens: smallBalanceTokenList.smallBalanceTokens,
      mergeDeriveAssets: mergeDeriveAssetsEnabled,
    });

    smallBalanceTokenList.keys = `${smallBalanceTokenList.keys}_${r.smallBalanceTokens.keys}`;

    smallBalanceTokenListMap = mergeDeriveTokenListMap({
      sourceMap: r.smallBalanceTokens.map,
      targetMap: smallBalanceTokenListMap,
      mergeDeriveAssets: mergeDeriveAssetsEnabled,
    });

    // Single derive-merge of the risky slice. The prior code re-`.concat`-ed
    // `r.riskTokens.data` after the merge, which under `mergeDeriveAssets:true`
    // kept BOTH the merged ($key `chain_suffix`) AND the raw per-derive rows
    // (deduped to one only when merge was off) — a value-level non-idempotency.
    riskyTokenList.riskyTokens = mergeDeriveTokenList({
      sourceTokens: r.riskTokens.data,
      targetTokens: riskyTokenList.riskyTokens,
      mergeDeriveAssets: mergeDeriveAssetsEnabled,
    });
    riskyTokenList.keys = `${riskyTokenList.keys}_${r.riskTokens.keys}`;

    riskyTokenListMap = mergeDeriveTokenListMap({
      sourceMap: r.riskTokens.map,
      targetMap: riskyTokenListMap,
      mergeDeriveAssets: mergeDeriveAssetsEnabled,
    });

    const accountWorth = sumTokenGroupsFiatValueIgnoringUnavailable(r);

    accountsWorth[
      accountUtils.buildAccountValueKey({
        accountId: r.accountId ?? '',
        networkId: r.networkId ?? '',
      })
    ] = accountWorth;

    if (
      accountId &&
      (!accountUtils.isOthersAccount({ accountId }) ||
        (accountUtils.isOthersAccount({ accountId }) &&
          createAtNetwork &&
          createAtNetwork === r.networkId))
    ) {
      createAtNetworkWorth = createAtNetworkWorth.plus(accountWorth);
    }
  }

  tokenList.tokens = uniqBy(tokenList.tokens, (item) => item.$key);
  smallBalanceTokenList.smallBalanceTokens = uniqBy(
    smallBalanceTokenList.smallBalanceTokens,
    (item) => item.$key,
  );
  riskyTokenList.riskyTokens = uniqBy(
    riskyTokenList.riskyTokens,
    (item) => item.$key,
  );

  const mergeTokenListMap = {
    ...tokenListMap,
    ...smallBalanceTokenListMap,
  };

  const flattenAggregateTokenMap = flattenAggregateTokensMap(aggregateTokenMap);

  let mergedTokens = sortTokensByFiatValue({
    tokens: [...tokenList.tokens, ...smallBalanceTokenList.smallBalanceTokens],
    map: {
      ...mergeTokenListMap,
      ...flattenAggregateTokenMap,
    },
  });

  const index = mergedTokens.findIndex((token) =>
    isUnavailableOrZeroFiatValue(mergeTokenListMap[token.$key]?.fiatValue),
  );

  if (index > -1) {
    const tokensWithBalance = mergedTokens.slice(0, index);
    let tokensWithZeroBalance = mergedTokens.slice(index);

    tokensWithZeroBalance = sortTokensByOrder({
      tokens: tokensWithZeroBalance,
    });

    mergedTokens = [...tokensWithBalance, ...tokensWithZeroBalance];
  }

  tokenList.tokens = mergedTokens.slice(0, TOKEN_LIST_HIGH_VALUE_MAX);

  smallBalanceTokenList.smallBalanceTokens = mergedTokens.slice(
    TOKEN_LIST_HIGH_VALUE_MAX,
  );

  smallBalanceTokensFiatValue = sumFiatValuesFromTokens(
    smallBalanceTokenList.smallBalanceTokens,
    mergeTokenListMap,
  );

  riskyTokenList.riskyTokens = sortTokensByFiatValue({
    tokens: riskyTokenList.riskyTokens,
    map: riskyTokenListMap,
  });

  return {
    orderedTokens: tokenList.tokens,
    smallBalanceTokens: smallBalanceTokenList.smallBalanceTokens,
    riskyTokens: riskyTokenList.riskyTokens,
    mergeTokenListMap,
    riskyTokenListMap,
    aggregateTokenMap,
    aggregateTokenListMap,
    smallBalanceFiatValue: smallBalanceTokensFiatValue.toFixed(),
    accountsWorth,
    createAtNetworkWorth: createAtNetworkWorth.toFixed(),
    tokenKeys: tokenList.keys,
    smallBalanceKeys: smallBalanceTokenList.keys,
    riskyKeys: riskyTokenList.keys,
  };
}
