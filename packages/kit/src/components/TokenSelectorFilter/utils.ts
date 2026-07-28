import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
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

export type IFetchFilteredTokenSelectorTokensResult = {
  /** The SUCCESSFUL child responses (failures are dropped by continue-on-error). */
  responses: IFetchAccountTokensResp[];
  /**
   * How many child requests the fan-out ATTEMPTED, BEFORE continue-on-error
   * dropped any failures. For the all-networks fan-out this is the enabled
   * network count; callers compare it against `responses.length` to detect a
   * PARTIAL failure (a silently-dropped network) so they don't commit an
   * incomplete list as an authoritative snapshot. Single-network and
   * derive-merge paths attempt exactly one request per account.
   */
  expectedResponseCount: number;
};

export type IScopedActiveTokenList = {
  tokens: IAccountToken[];
  keys: string;
};

export type IScopedActiveTokenListState = {
  isRefreshing: boolean;
  initialized: boolean;
};

export type ISpecifiedTokenSelectorTarget = {
  networkId: string;
  contractAddress: string;
};

export type IFetchSpecifiedTokenSelectorTokensResult = {
  responsesByNetworkId: Record<string, IFetchAccountTokensResp>;
  expectedResponseCount: number;
};

type ITokenSelectorAccountTokensParams = IFetchAccountTokensParams & {
  dbAccount?: IAllNetworkAccountInfo['dbAccount'];
};

export async function fetchTokenSelectorAccountTokens(
  params: ITokenSelectorAccountTokensParams,
) {
  return backgroundApiProxy.serviceToken.fetchAccountTokens({
    ...params,
    flag: 'token-selector',
  });
}

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
}: IFetchFilteredTokenSelectorTokensParams): Promise<IFetchFilteredTokenSelectorTokensResult> {
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
          fetchTokenSelectorAccountTokens({
            accountId: itemAccountId,
            networkId: itemNetworkId,
            dbAccount,
            indexedAccountId: allNetworksIndexedAccountId,
            isAllNetworks: shouldFetchAsAllNetworks,
            allNetworksAccountId,
            allNetworksNetworkId: networkId,
            saveToLocal: false,
            ...tokenSelectorFilterParams,
          }),
    );

    const responses = (
      await promiseAllSettledEnhanced(requestFactories, {
        continueOnError: true,
        concurrency: 10,
      })
    ).filter((item): item is IFetchAccountTokensResp => Boolean(item));
    // `requestFactories.length` is the enabled-network count; a shorter
    // `responses` array means a network was silently dropped (continue-on-error).
    return { responses, expectedResponseCount: requestFactories.length };
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
          ? fetchTokenSelectorAccountTokens({
              accountId: itemAccountId,
              networkId,
              indexedAccountId,
              saveToLocal: false,
              ...tokenSelectorFilterParams,
            })
          : Promise.resolve(undefined);
    });

    const responses = (
      await promiseAllSettledEnhanced(requestFactories, {
        continueOnError: true,
        concurrency: 10,
      })
    ).filter((item): item is IFetchAccountTokensResp => Boolean(item));
    return { responses, expectedResponseCount: requestFactories.length };
  }

  const r = await fetchTokenSelectorAccountTokens({
    accountId,
    networkId,
    indexedAccountId,
    saveToLocal: false,
    ...tokenSelectorFilterParams,
  });
  return { responses: [r], expectedResponseCount: 1 };
}

export async function fetchSpecifiedTokenSelectorTokens({
  accountId,
  networkId,
  indexedAccountId,
  targets,
}: {
  accountId: string;
  networkId: string;
  indexedAccountId?: string;
  targets: ISpecifiedTokenSelectorTarget[];
}): Promise<IFetchSpecifiedTokenSelectorTokensResult> {
  const contractListByNetwork = new Map<string, string[]>();
  targets.forEach((target) => {
    const contractList = contractListByNetwork.get(target.networkId) ?? [];
    if (!contractList.includes(target.contractAddress)) {
      contractList.push(target.contractAddress);
    }
    contractListByNetwork.set(target.networkId, contractList);
  });

  const expectedResponseCount = contractListByNetwork.size;
  if (!expectedResponseCount) {
    return {
      responsesByNetworkId: {},
      expectedResponseCount: 0,
    };
  }

  const accountInfoByNetwork = new Map<
    string,
    Pick<IAllNetworkAccountInfo, 'accountId' | 'dbAccount'>
  >();
  accountInfoByNetwork.set(networkId, { accountId, dbAccount: undefined });

  if (contractListByNetwork.size > 1 || !contractListByNetwork.has(networkId)) {
    const { accountsInfo } =
      await backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
        accountId,
        networkId,
        indexedAccountId,
        fetchAllNetworkAccounts: true,
        networksEnabledOnly: false,
        excludeTestNetwork: false,
        excludeIncompatibleWithWalletAccounts: true,
      });
    accountsInfo.forEach((accountInfo) => {
      if (
        accountInfo.accountId &&
        contractListByNetwork.has(accountInfo.networkId) &&
        !accountInfoByNetwork.has(accountInfo.networkId)
      ) {
        accountInfoByNetwork.set(accountInfo.networkId, {
          accountId: accountInfo.accountId,
          dbAccount: accountInfo.dbAccount,
        });
      }
    });
  }

  const requestFactories = Array.from(contractListByNetwork.entries()).flatMap(
    ([targetNetworkId, contractList]) => {
      const accountInfo = accountInfoByNetwork.get(targetNetworkId);
      if (!accountInfo?.accountId) {
        return [];
      }
      return [
        async () => ({
          networkId: targetNetworkId,
          response: await fetchTokenSelectorAccountTokens({
            accountId: accountInfo.accountId,
            networkId: targetNetworkId,
            indexedAccountId,
            dbAccount: accountInfo.dbAccount,
            contractList,
            saveToLocal: false,
          }),
        }),
      ];
    },
  );

  const responseEntries = (
    await promiseAllSettledEnhanced(requestFactories, {
      continueOnError: true,
      concurrency: 10,
    })
  ).filter(
    (
      item,
    ): item is {
      networkId: string;
      response: IFetchAccountTokensResp;
    } => Boolean(item),
  );

  return {
    responsesByNetworkId: Object.fromEntries(
      responseEntries.map(({ networkId: targetNetworkId, response }) => [
        targetNetworkId,
        response,
      ]),
    ),
    expectedResponseCount,
  };
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
