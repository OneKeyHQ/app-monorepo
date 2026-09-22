import type { IIngestRoundParams } from '@onekeyhq/kit-bg/src/services/ServiceTokenViewModel';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { sumFiatValuesFromTokens } from '@onekeyhq/shared/src/utils/tokenValueUtils';
import type {
  IAccountToken,
  ICustomTokenItem,
  IHomeDefaultToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

function buildTokenKeys(tokens: IAccountToken[]): string {
  return tokens.map((token) => token.$key).join(',');
}

export function buildHomeTokenListCacheIngestRound({
  ownerKey,
  accountId,
  networkId,
  tokenList,
  smallBalanceTokenList,
  riskyTokenList,
  tokenListMap,
  smallBalanceTokenListMap = {},
  riskyTokenListMap = {},
  keepDefault,
  homeDefaultTokenMap,
  customTokens,
  source,
}: {
  ownerKey: string;
  accountId?: string;
  networkId?: string;
  tokenList: IAccountToken[];
  smallBalanceTokenList: IAccountToken[];
  riskyTokenList: IAccountToken[];
  tokenListMap: Record<string, ITokenFiat>;
  smallBalanceTokenListMap?: Record<string, ITokenFiat>;
  riskyTokenListMap?: Record<string, ITokenFiat>;
  keepDefault?: boolean;
  homeDefaultTokenMap?: Record<string, IHomeDefaultToken>;
  customTokens?: ICustomTokenItem[];
  source: IIngestRoundParams['source'];
}): IIngestRoundParams {
  const visibleTokenListMap = {
    ...tokenListMap,
    ...smallBalanceTokenListMap,
  };
  const rawKeys = [
    buildTokenKeys(tokenList),
    buildTokenKeys(smallBalanceTokenList),
    buildTokenKeys(riskyTokenList),
  ].join('_');

  return {
    ownerKey,
    orderedTokens: tokenList,
    smallBalanceTokens: smallBalanceTokenList,
    tokenListMap: visibleTokenListMap,
    aggregateTokensMap: {},
    ownedAggregateTokenListMap: {},
    // Shared helper so shared-balance rows (Arc, OK-63633) flagged in the
    // cached fiat map are skipped exactly like the live rounds do.
    smallBalanceFiatValue: sumFiatValuesFromTokens(
      smallBalanceTokenList,
      visibleTokenListMap,
    ).toFixed(),
    storeData: { storeName: EJotaiContextStoreNames.homeTokenList },
    keepDefault,
    homeDefaultTokenMap,
    customTokens,
    riskyTokens: riskyTokenList,
    riskyMap: {
      ...riskyTokenListMap,
    },
    accountId,
    networkId,
    rawKeys,
    source,
  };
}

// Read only existing local data for a target owner before it becomes active.
// No remote token request or active-account effect is required by this path.
export async function loadHomeTokenListCache(
  target: import('../../../../states/jotai/contexts/accountSelector').IAccountSelectorActiveAccountInfo,
  ownerKey: string,
) {
  const { default: backgroundApiProxy } =
    await import('../../../../background/instance/backgroundApiProxy');
  const { default: accountUtils } =
    await import('@onekeyhq/shared/src/utils/accountUtils');
  const { buildAggregateTokenListData, getMergedDeriveTokenData } =
    await import('@onekeyhq/shared/src/utils/tokenUtils');
  const { buildMergedAllNetworkSnapshot } =
    await import('./buildMergedAllNetworkSnapshot');
  const {
    account,
    network,
    wallet,
    indexedAccount,
    vaultSettings,
    deriveInfoItems,
  } = target;
  if (!account || !network || !wallet) return undefined;
  const mergeDerive =
    !!vaultSettings?.mergeDeriveAssetsEnabled &&
    !accountUtils.isOthersWallet({ walletId: wallet.id }) &&
    deriveInfoItems.length > 1;
  let accounts: { accountId: string; networkId: string }[];
  if (network.isAllNetworks) {
    const result =
      await backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
        accountId: account.id,
        networkId: network.id,
        deriveType: undefined,
        nftEnabledOnly: false,
        DeFiEnabledOnly: false,
        excludeTestNetwork: true,
        networksEnabledOnly: !accountUtils.isOthersAccount({
          accountId: account.id,
        }),
      });
    accounts = result.accountsInfo;
  } else if (mergeDerive) {
    const result =
      await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
        {
          networkId: network.id,
          indexedAccountId: indexedAccount?.id ?? '',
          excludeEmptyAccount: true,
        },
      );
    accounts = result.networkAccounts.flatMap((item) =>
      item.account
        ? [{ accountId: item.account.id, networkId: network.id }]
        : [],
    );
  } else {
    accounts = [{ accountId: account.id, networkId: network.id }];
  }
  const results = await Promise.allSettled(
    accounts.map((item) =>
      backgroundApiProxy.serviceToken.getAccountLocalTokens(item),
    ),
  );
  const cached = results.flatMap((item, index) =>
    item.status === 'fulfilled' && item.value.hasCache
      ? [{ ...item.value, ...accounts[index] }]
      : [],
  );
  if (!cached.length) return undefined;
  const complete = cached.length === accounts.length;
  const worth = Object.fromEntries(
    cached.map((item) => [
      accountUtils.buildAccountValueKey(item),
      item.tokenListValue,
    ]),
  );
  const asRound = (item: (typeof cached)[number]) => ({
    accountId: item.accountId,
    networkId: item.networkId,
    tokens: { data: item.tokenList, keys: '', map: item.tokenListMap },
    smallBalanceTokens: {
      data: item.smallBalanceTokenList,
      keys: '',
      map: item.tokenListMap,
    },
    riskTokens: { data: item.riskyTokenList, keys: '', map: item.tokenListMap },
    accountWorth: item.tokenListValue,
    mergeDeriveAssets: [...item.tokenList, ...item.smallBalanceTokenList].some(
      (token) => token.mergeAssets,
    ),
  });
  if (network.isAllNetworks) {
    const aggregateConfig = (
      await backgroundApiProxy.simpleDb.aggregateToken.getRawData()
    )?.aggregateTokenConfigMap;
    const rounds = cached.map((item) => {
      let aggregateTokenListMap: Record<
        string,
        { commonToken: IAccountToken; tokens: IAccountToken[] }
      > = {};
      let aggregateTokenMap: Record<string, ITokenFiat> = {};
      const pick = (token: IAccountToken) => {
        if (!aggregateConfig) return token;
        const result = buildAggregateTokenListData({
          networkId: item.networkId,
          accountId: item.accountId,
          token,
          tokenMap: item.tokenListMap,
          aggregateTokenListMap,
          aggregateTokenMap,
          aggregateTokenConfigMapRawData: aggregateConfig,
          networkName: token.networkName ?? '',
        });
        aggregateTokenListMap = result.aggregateTokenListMap;
        aggregateTokenMap = result.aggregateTokenMap;
        return result.isAggregateToken ? undefined : token;
      };
      const tokens = item.tokenList
        .map(pick)
        .filter((token): token is IAccountToken => !!token);
      const small = item.smallBalanceTokenList
        .map(pick)
        .filter((token): token is IAccountToken => !!token);
      const round = asRound(item);
      return {
        ...round,
        tokens: {
          ...round.tokens,
          data: [
            ...tokens,
            ...Object.values(aggregateTokenListMap).map(
              (entry) => entry.commonToken,
            ),
          ],
        },
        smallBalanceTokens: { ...round.smallBalanceTokens, data: small },
        aggregateTokenListMap,
        aggregateTokenMap,
      };
    });
    const merged = buildMergedAllNetworkSnapshot({
      rounds,
      mergeDeriveAssetsByNetworkId: {},
      accountId: account.id,
      createAtNetwork: account.createAtNetwork,
    });
    const ingest: IIngestRoundParams = {
      ownerKey,
      accountId: account.id,
      networkId: network.id,
      orderedTokens: merged.orderedTokens,
      smallBalanceTokens: merged.smallBalanceTokens,
      tokenListMap: merged.mergeTokenListMap,
      aggregateTokensMap: merged.aggregateTokenMap,
      ownedAggregateTokenListMap: merged.aggregateTokenListMap,
      smallBalanceFiatValue: merged.smallBalanceFiatValue,
      riskyTokens: merged.riskyTokens,
      riskyMap: merged.riskyTokenListMap,
      storeData: { storeName: EJotaiContextStoreNames.homeTokenList },
      source: 'cacheSeed',
    };
    return { ingest, complete, worth, currency: cached[0].currency };
  }
  const merged = getMergedDeriveTokenData({
    data: cached.map(asRound),
    mergeDeriveAssetsEnabled: mergeDerive,
  });
  return {
    complete,
    worth,
    currency: cached[0].currency,
    ingest: buildHomeTokenListCacheIngestRound({
      ownerKey,
      accountId: account.id,
      networkId: network.id,
      tokenList: merged.tokenList.tokens,
      smallBalanceTokenList: merged.smallBalanceTokenList.smallBalanceTokens,
      riskyTokenList: merged.riskyTokenList.riskyTokens,
      tokenListMap: merged.tokenListMap,
      smallBalanceTokenListMap: merged.smallBalanceTokenListMap,
      riskyTokenListMap: merged.riskyTokenListMap,
      source: 'singleCacheSeed',
    }),
  };
}
