import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { promiseAllSettledEnhanced } from '@onekeyhq/shared/src/utils/promiseUtils';
import { filterTokenSelectorTokensByBackendIndexedNetworks } from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import type {
  IAccountToken,
  IFetchAccountTokensParams,
  IFetchAccountTokensResp,
  IToken,
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
  onlyBackendIndexedNetworks?: boolean;
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

function isValidIndexedAccountId(indexedAccountId: string | undefined) {
  if (!indexedAccountId) {
    return false;
  }
  const { walletId, index } = accountUtils.parseIndexedAccountId({
    indexedAccountId,
  });
  return Boolean(walletId) && Number.isFinite(index);
}

function getIndexedAccountIdForAllNetworks({
  accountId,
  indexedAccountId,
}: {
  accountId: string;
  indexedAccountId: string | undefined;
}) {
  if (isValidIndexedAccountId(indexedAccountId)) {
    return indexedAccountId;
  }

  if (isValidIndexedAccountId(accountId)) {
    return accountId;
  }

  const resolvedIndexedAccountId =
    accountUtils.buildAllNetworkIndexedAccountIdFromAccountId({
      accountId,
    });
  return isValidIndexedAccountId(resolvedIndexedAccountId)
    ? resolvedIndexedAccountId
    : indexedAccountId;
}

async function normalizeAllNetworksOwner({
  accountId,
  indexedAccountId,
  isAllNetworks,
}: {
  accountId: string;
  indexedAccountId: string | undefined;
  isAllNetworks: boolean | undefined;
}) {
  if (!isAllNetworks || accountUtils.isOthersAccount({ accountId })) {
    return { accountId, indexedAccountId };
  }

  const allNetworksIndexedAccountId = getIndexedAccountIdForAllNetworks({
    accountId,
    indexedAccountId,
  });
  if (!allNetworksIndexedAccountId) {
    return { accountId, indexedAccountId };
  }

  const allNetworksAccount =
    await backgroundApiProxy.serviceAccount.getMockedAllNetworkAccount({
      indexedAccountId: allNetworksIndexedAccountId,
    });

  return {
    accountId: allNetworksAccount.id,
    indexedAccountId: allNetworksIndexedAccountId,
  };
}

export async function filterTokenSelectorSearchTokensByBackendIndexedNetworks<
  T extends IToken,
>({ tokens }: { tokens: T[] }) {
  const networkIds = Array.from(
    new Set(
      tokens
        .map((token) => token.networkId)
        .filter((networkId): networkId is string => Boolean(networkId)),
    ),
  );

  if (!networkIds.length) {
    return [];
  }

  const { networks } = await backgroundApiProxy.serviceNetwork.getNetworksByIds(
    {
      networkIds,
    },
  );

  return filterTokenSelectorTokensByBackendIndexedNetworks({
    tokens,
    backendIndexedNetworkIds: networks
      .filter((network) => network.backendIndex === true)
      .map((network) => network.id),
  });
}

export async function fetchFilteredTokenSelectorTokens({
  accountId,
  networkId,
  indexedAccountId,
  isAllNetworks,
  mergeDeriveAddressData,
  onlyBackendIndexedNetworks,
  tokenSelectorFilterParams,
}: IFetchFilteredTokenSelectorTokensParams) {
  if (isAllNetworks) {
    const {
      accountId: allNetworksAccountId,
      indexedAccountId: allNetworksIndexedAccountId,
    } = await normalizeAllNetworksOwner({
      accountId,
      indexedAccountId,
      isAllNetworks,
    });

    const { accountsInfo, accountsInfoBackendIndexed } =
      await backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
        accountId: allNetworksAccountId,
        networkId,
        indexedAccountId: allNetworksIndexedAccountId,
        excludeTestNetwork: true,
        networksEnabledOnly: !accountUtils.isOthersAccount({
          accountId: allNetworksAccountId,
        }),
      });

    const filteredAccountsInfo = onlyBackendIndexedNetworks
      ? accountsInfoBackendIndexed
      : accountsInfo;
    // DeFi-token mode aggregates per-network token-list responses on the client.
    // The wallet API returns dApp-only tokens only when each child request stays single-network.
    const shouldFetchAsAllNetworks =
      !tokenSelectorFilterParams.withoutWalletToken;

    const requestFactories = filteredAccountsInfo.map(
      ({ accountId: itemAccountId, networkId: itemNetworkId, dbAccount }) =>
        () =>
          backgroundApiProxy.serviceToken.fetchAccountTokens({
            accountId: itemAccountId,
            networkId: itemNetworkId,
            dbAccount,
            indexedAccountId: allNetworksIndexedAccountId,
            flag: 'token-selector',
            isAllNetworks: shouldFetchAsAllNetworks,
            allNetworksAccountId,
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
