import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { promiseAllSettledEnhanced } from '@onekeyhq/shared/src/utils/promiseUtils';
import type {
  IAccountToken,
  IFetchAccountTokensParams,
  IFetchAccountTokensResp,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

type ITokenSelectorFilterParams = Pick<
  IFetchAccountTokensParams,
  'withoutDappToken' | 'withoutWalletToken'
>;

type IFetchFilteredTokenSelectorTokensParams = {
  accountId: string;
  networkId: string;
  indexedAccountId?: string;
  isAllNetworks?: boolean;
  mergeDeriveAddressData?: boolean;
  tokenSelectorFilterParams: ITokenSelectorFilterParams;
};

export type IScopedActiveTokenList = {
  tokens: IAccountToken[];
  keys: string;
};

export type IScopedActiveTokenListState = {
  isRefreshing: boolean;
  initialized: boolean;
};

export async function fetchFilteredTokenSelectorTokens({
  accountId,
  networkId,
  indexedAccountId,
  isAllNetworks,
  mergeDeriveAddressData,
  tokenSelectorFilterParams,
}: IFetchFilteredTokenSelectorTokensParams) {
  if (isAllNetworks) {
    const { accountsInfo } =
      await backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
        accountId,
        networkId,
        indexedAccountId,
        excludeTestNetwork: true,
        networksEnabledOnly: !accountUtils.isOthersAccount({ accountId }),
      });

    const requestFactories = accountsInfo.map(
      ({ accountId: itemAccountId, networkId: itemNetworkId, dbAccount }) =>
        () =>
          backgroundApiProxy.serviceToken.fetchAccountTokens({
            accountId: itemAccountId,
            networkId: itemNetworkId,
            dbAccount,
            indexedAccountId,
            flag: 'token-selector',
            isAllNetworks: true,
            allNetworksAccountId: accountId,
            allNetworksNetworkId: networkId,
            saveToLocal: false,
            ...tokenSelectorFilterParams,
          }),
    );

    return (
      await promiseAllSettledEnhanced(requestFactories, {
        continueOnError: true,
        concurrency: 10,
      })
    ).filter((item): item is IFetchAccountTokensResp => Boolean(item));
  }

  if (mergeDeriveAddressData) {
    const { networkAccounts } =
      await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
        {
          networkId,
          indexedAccountId: indexedAccountId ?? '',
          excludeEmptyAccount: true,
        },
      );

    const requestFactories = networkAccounts.map((networkAccount) => {
      const itemAccountId = networkAccount.account?.id;
      return () =>
        itemAccountId
          ? backgroundApiProxy.serviceToken.fetchAccountTokens({
              accountId: itemAccountId,
              networkId,
              indexedAccountId,
              flag: 'token-selector',
              saveToLocal: false,
              ...tokenSelectorFilterParams,
            })
          : Promise.resolve(undefined);
    });

    return (
      await promiseAllSettledEnhanced(requestFactories, {
        continueOnError: true,
        concurrency: 10,
      })
    ).filter((item): item is IFetchAccountTokensResp => Boolean(item));
  }

  const r = await backgroundApiProxy.serviceToken.fetchAccountTokens({
    accountId,
    networkId,
    indexedAccountId,
    flag: 'token-selector',
    saveToLocal: false,
    ...tokenSelectorFilterParams,
  });
  return [r];
}

export function buildScopedActiveTokenListFromResponses({
  responses,
  keySuffix,
}: {
  responses: IFetchAccountTokensResp[];
  keySuffix: string;
}) {
  const tokens: IAccountToken[] = [];
  let tokenListMap: Record<string, ITokenFiat> = {};

  for (const r of responses) {
    tokens.push(...r.tokens.data, ...r.smallBalanceTokens.data);
    tokenListMap = {
      ...tokenListMap,
      ...r.tokens.map,
      ...r.smallBalanceTokens.map,
    };
  }

  return {
    tokenList: {
      tokens,
      keys: `${responses
        .map((r) => `${r.tokens.keys}_${r.smallBalanceTokens.keys}`)
        .join('_')}_${keySuffix}`,
    },
    tokenListMap,
  };
}
