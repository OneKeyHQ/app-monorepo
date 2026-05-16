import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { uniqBy } from 'lodash';
import { useIntl } from 'react-intl';

import type { IHomeNativeRow, IHomeNativeTokenRow } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAggregateTokensListMapAtom,
  useSmallBalanceTokenListAtom,
  useTokenListActions,
  useTokenListAtom,
  useTokenListMapAtom,
  useTokenListStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import {
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { TOKEN_LIST_HIGH_VALUE_MAX } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalAssetDetailRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  PROMISE_CONCURRENCY_LIMIT,
  promiseAllSettledEnhanced,
} from '@onekeyhq/shared/src/utils/promiseUtils';
import {
  getMergedDeriveTokenData,
  sortTokensByFiatValue,
  sortTokensByOrder,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import { EHomeTab } from '@onekeyhq/shared/types';
import type {
  IAccountToken,
  IFetchAccountTokensResp,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

const NATIVE_TOKEN_ROW_PREFIX = 'portfolio:token:';
const NATIVE_TOKEN_ROW_LIMIT = 50;

type INativeTokenData = {
  keys: string;
  tokens: IAccountToken[];
  smallBalanceTokens: IAccountToken[];
  riskyTokens: IAccountToken[];
  tokenMap: Record<string, ITokenFiat>;
  aggregateTokensListMap?: Record<
    string,
    {
      tokens: IAccountToken[];
    }
  >;
};

function buildNativeTokenRow({
  token,
  tokenFiat,
  currencySymbol,
  hideValue,
}: {
  token: IAccountToken;
  tokenFiat?: ITokenFiat;
  currencySymbol: string;
  hideValue: boolean;
}): IHomeNativeTokenRow {
  const priceChange = new BigNumber(tokenFiat?.price24h ?? 0);
  let priceChangeColor: IHomeNativeTokenRow['change24hColor'] = 'neutral';
  if (priceChange.isPositive()) {
    priceChangeColor = 'positive';
  } else if (priceChange.isNegative()) {
    priceChangeColor = 'negative';
  }

  return {
    type: 'token',
    key: `${NATIVE_TOKEN_ROW_PREFIX}${token.$key}`,
    tokenKey: token.$key,
    symbol: token.symbol,
    name: token.name,
    iconUri: token.logoURI,
    balance: hideValue
      ? `**** ${token.symbol}`
      : numberFormat(tokenFiat?.balanceParsed ?? '0', {
          formatter: 'balance',
          formatterOptions: {
            tokenSymbol: token.symbol,
          },
        }),
    fiatValue: hideValue
      ? '****'
      : numberFormat(tokenFiat?.fiatValue ?? '0', {
          formatter: 'value',
          formatterOptions: {
            currency: currencySymbol,
          },
        }),
    price:
      hideValue || tokenFiat?.price === undefined
        ? undefined
        : numberFormat(String(tokenFiat.price), {
            formatter: 'price',
            formatterOptions: {
              currency: currencySymbol,
            },
          }),
    change24h:
      hideValue || tokenFiat?.price24h === undefined
        ? undefined
        : numberFormat(String(tokenFiat.price24h), {
            formatter: 'priceChange',
            formatterOptions: {
              showPlusMinusSigns: true,
            },
          }),
    change24hColor: priceChangeColor,
    networkName: token.networkName,
    estimatedHeight: 64,
  };
}

function getTokenKeyFromNativeRowKey(rowKey: string) {
  return rowKey.startsWith(NATIVE_TOKEN_ROW_PREFIX)
    ? rowKey.slice(NATIVE_TOKEN_ROW_PREFIX.length)
    : '';
}

function isTokenResponse(
  response: IFetchAccountTokensResp | null,
): response is IFetchAccountTokensResp {
  return !!response;
}

function addTokenOwner({
  response,
  accountId,
  networkId,
  networkName,
}: {
  response: IFetchAccountTokensResp;
  accountId: string;
  networkId: string;
  networkName?: string;
}): IFetchAccountTokensResp {
  const addOwner = (token: IAccountToken): IAccountToken => ({
    ...token,
    accountId: token.accountId ?? accountId,
    networkId: token.networkId ?? networkId,
    networkName: token.networkName ?? networkName,
  });

  return {
    ...response,
    accountId: response.accountId ?? accountId,
    networkId: response.networkId ?? networkId,
    tokens: {
      ...response.tokens,
      data: response.tokens.data.map(addOwner),
    },
    smallBalanceTokens: {
      ...response.smallBalanceTokens,
      data: response.smallBalanceTokens.data.map(addOwner),
    },
    riskTokens: {
      ...response.riskTokens,
      data: response.riskTokens.data.map(addOwner),
    },
  };
}

function buildTokenDataFromResponses(
  responses: IFetchAccountTokensResp[],
): INativeTokenData {
  const merged = getMergedDeriveTokenData({
    data: responses,
    mergeDeriveAssetsEnabled: true,
  });

  const tokenMap = merged.allTokenListMap;
  let mergedTokens = sortTokensByFiatValue({
    tokens: [
      ...merged.tokenList.tokens,
      ...merged.smallBalanceTokenList.smallBalanceTokens,
    ],
    map: tokenMap,
  });
  const zeroBalanceIndex = mergedTokens.findIndex((token) =>
    new BigNumber(tokenMap[token.$key]?.fiatValue ?? 0).isZero(),
  );
  if (zeroBalanceIndex > -1) {
    mergedTokens = [
      ...mergedTokens.slice(0, zeroBalanceIndex),
      ...sortTokensByOrder({
        tokens: mergedTokens.slice(zeroBalanceIndex),
      }),
    ];
  }

  return {
    keys: merged.allTokenList.keys,
    tokens: mergedTokens.slice(0, TOKEN_LIST_HIGH_VALUE_MAX),
    smallBalanceTokens: mergedTokens.slice(TOKEN_LIST_HIGH_VALUE_MAX),
    riskyTokens: uniqBy(merged.riskyTokenList.riskyTokens, '$key'),
    tokenMap,
    aggregateTokensListMap: merged.aggregateTokenListMap,
  };
}

function buildLocalTokenResponse({
  accountId,
  networkId,
  networkName,
  localTokens,
}: {
  accountId: string;
  networkId: string;
  networkName?: string;
  localTokens: {
    tokenList: IAccountToken[];
    smallBalanceTokenList: IAccountToken[];
    riskyTokenList: IAccountToken[];
    tokenListMap: Record<string, ITokenFiat>;
    tokenListValue?: string;
  };
}): IFetchAccountTokensResp {
  const addOwner = (token: IAccountToken): IAccountToken => ({
    ...token,
    accountId: token.accountId ?? accountId,
    networkId: token.networkId ?? networkId,
    networkName: token.networkName ?? networkName,
  });
  const keys = `${accountId}_${networkId}_native_local`;
  return {
    accountId,
    networkId,
    tokens: {
      data: localTokens.tokenList.map(addOwner),
      keys,
      map: localTokens.tokenListMap,
      fiatValue: localTokens.tokenListValue,
    },
    smallBalanceTokens: {
      data: localTokens.smallBalanceTokenList.map(addOwner),
      keys,
      map: localTokens.tokenListMap,
    },
    riskTokens: {
      data: localTokens.riskyTokenList.map(addOwner),
      keys,
      map: localTokens.tokenListMap,
    },
  };
}

export function useHomeNativeTokenRows() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [settings] = useSettingsPersistAtom();
  const [settingsValue] = useSettingsValuePersistAtom();
  const [tokenList] = useTokenListAtom();
  const [smallBalanceTokenList] = useSmallBalanceTokenListAtom();
  const [tokenListMap] = useTokenListMapAtom();
  const [tokenListState] = useTokenListStateAtom();
  const [aggregateTokenListMap] = useAggregateTokensListMapAtom();
  const tokenListActions = useTokenListActions().current;
  const [isLocalHydrating, setIsLocalHydrating] = useState(false);
  const requestIdRef = useRef(0);
  const tokenListInitializedRef = useRef(tokenListState.initialized);

  useEffect(() => {
    tokenListInitializedRef.current = tokenListState.initialized;
  }, [tokenListState.initialized]);

  const {
    activeAccount: {
      account,
      network,
      wallet,
      indexedAccount,
      deriveInfoItems,
      vaultSettings,
    },
  } = useActiveAccount({ num: 0 });

  const isNativeTokenListSupported = !!(
    account?.id &&
    network?.id &&
    wallet?.id
  );
  const mergeDeriveAddressData = !!(
    vaultSettings?.mergeDeriveAssetsEnabled &&
    !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' }) &&
    deriveInfoItems.length > 1
  );

  const ownerKey = `${account?.id ?? ''}__${network?.id ?? ''}`;

  const applyTokenData = useCallback(
    ({
      keys,
      tokens,
      smallBalanceTokens,
      riskyTokens,
      tokenMap,
      aggregateTokensListMap,
      initialized,
      isRefreshing,
    }: {
      keys: string;
      tokens: IAccountToken[];
      smallBalanceTokens: IAccountToken[];
      riskyTokens: IAccountToken[];
      tokenMap: Record<string, ITokenFiat>;
      aggregateTokensListMap?: Record<
        string,
        {
          tokens: IAccountToken[];
        }
      >;
      initialized: boolean;
      isRefreshing: boolean;
    }) => {
      if (aggregateTokensListMap) {
        tokenListActions.refreshAggregateTokensListMap({
          tokens: aggregateTokensListMap,
        });
      }
      tokenListActions.refreshTokenList({ keys, tokens });
      tokenListActions.refreshTokenListMap({ tokens: tokenMap });
      tokenListActions.refreshSmallBalanceTokenList({
        keys,
        smallBalanceTokens,
      });
      tokenListActions.refreshSmallBalanceTokenListMap({ tokens: tokenMap });
      tokenListActions.refreshRiskyTokenList({
        keys,
        riskyTokens,
      });
      tokenListActions.refreshRiskyTokenListMap({ tokens: tokenMap });
      tokenListActions.refreshAllTokenList({
        keys,
        tokens: [...tokens, ...smallBalanceTokens, ...riskyTokens],
        accountId: account?.id,
        networkId: network?.id,
      });
      tokenListActions.refreshAllTokenListMap({ tokens: tokenMap });
      tokenListActions.updateTokenListState({
        initialized,
        isRefreshing,
      });
    },
    [account?.id, network?.id, tokenListActions],
  );

  const getAllNetworkAccounts = useCallback(async () => {
    if (!account?.id || !network?.id) {
      return [] as IAllNetworkAccountInfo[];
    }
    const result =
      await backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
        accountId: account.id,
        networkId: network.id,
        deriveType: undefined,
        excludeTestNetwork: true,
        networksEnabledOnly: !accountUtils.isOthersAccount({
          accountId: account.id,
        }),
      });
    return result.accountsInfo;
  }, [account?.id, network?.id]);

  const getNetworkNameMap = useCallback(async () => {
    const { networks } = await backgroundApiProxy.serviceNetwork.getAllNetworks(
      {
        excludeAllNetworkItem: true,
        excludeTestNetwork: true,
      },
    );
    return networks.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = item.name;
      return acc;
    }, {});
  }, []);

  const fetchMergeDeriveTokens = useCallback(async () => {
    if (!account?.id || !network?.id || !indexedAccount?.id) {
      return undefined;
    }
    const { networkAccounts } =
      await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
        {
          networkId: network.id,
          indexedAccountId: indexedAccount.id,
          excludeEmptyAccount: true,
        },
      );
    const responses = (
      await promiseAllSettledEnhanced(
        networkAccounts.map((networkAccount) => async () => {
          const networkAccountId = networkAccount.account?.id ?? '';
          if (!networkAccountId) {
            return null;
          }
          const response =
            await backgroundApiProxy.serviceToken.fetchAccountTokens({
              accountId: networkAccountId,
              networkId: network.id,
              indexedAccountId: indexedAccount.id,
              mergeTokens: true,
              flag: 'home-native-token-list',
              saveToLocal: true,
            });
          return addTokenOwner({
            response,
            accountId: networkAccountId,
            networkId: network.id,
            networkName: network.name,
          });
        }),
        {
          continueOnError: true,
          concurrency: PROMISE_CONCURRENCY_LIMIT,
        },
      )
    ).filter(isTokenResponse);

    return buildTokenDataFromResponses(responses);
  }, [account?.id, indexedAccount?.id, network?.id, network?.name]);

  const fetchAllNetworkTokens = useCallback(async () => {
    if (!account?.id || !network?.id) {
      return undefined;
    }
    const [allNetworkAccounts, networkNameMap] = await Promise.all([
      getAllNetworkAccounts(),
      getNetworkNameMap(),
    ]);
    const responses = (
      await promiseAllSettledEnhanced(
        allNetworkAccounts.map((networkAccount) => async () => {
          const response =
            await backgroundApiProxy.serviceToken.fetchAccountTokens({
              accountId: networkAccount.accountId,
              networkId: networkAccount.networkId,
              indexedAccountId: indexedAccount?.id,
              mergeTokens: true,
              flag: 'home-native-token-list',
              isAllNetworks: true,
              allNetworksAccountId: account.id,
              allNetworksNetworkId: network.id,
              saveToLocal: true,
            });
          return addTokenOwner({
            response,
            accountId: networkAccount.accountId,
            networkId: networkAccount.networkId,
            networkName: networkNameMap[networkAccount.networkId],
          });
        }),
        {
          continueOnError: true,
          concurrency: PROMISE_CONCURRENCY_LIMIT,
        },
      )
    ).filter(isTokenResponse);
    return buildTokenDataFromResponses(responses);
  }, [
    account?.id,
    getAllNetworkAccounts,
    getNetworkNameMap,
    indexedAccount?.id,
    network?.id,
  ]);

  const hydrateMergeDeriveLocalTokens = useCallback(async () => {
    if (!network?.id || !indexedAccount?.id) {
      return undefined;
    }
    const { networkAccounts } =
      await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
        {
          networkId: network.id,
          indexedAccountId: indexedAccount.id,
          excludeEmptyAccount: true,
        },
      );
    const responses = (
      await promiseAllSettledEnhanced(
        networkAccounts.map((networkAccount) => async () => {
          const networkAccountId = networkAccount.account?.id ?? '';
          if (!networkAccountId) {
            return null;
          }
          const networkAccountXpub = networkAccount.account as
            | {
                xpub?: string;
                xpubSegwit?: string;
              }
            | undefined;
          const localTokens =
            await backgroundApiProxy.serviceToken.getAccountLocalTokens({
              accountId: networkAccountId,
              networkId: network.id,
              accountAddress: networkAccount.account?.address ?? '',
              xpub: networkAccountXpub?.xpubSegwit ?? networkAccountXpub?.xpub,
            });
          return localTokens.hasCache
            ? buildLocalTokenResponse({
                accountId: networkAccountId,
                networkId: network.id,
                networkName: network.name,
                localTokens,
              })
            : null;
        }),
        {
          continueOnError: true,
          concurrency: PROMISE_CONCURRENCY_LIMIT,
        },
      )
    ).filter(isTokenResponse);
    return responses.length
      ? buildTokenDataFromResponses(responses)
      : undefined;
  }, [indexedAccount?.id, network?.id, network?.name]);

  const hydrateAllNetworkLocalTokens = useCallback(async () => {
    if (!account?.id || !network?.id) {
      return undefined;
    }
    const [allNetworkAccounts, networkNameMap] = await Promise.all([
      getAllNetworkAccounts(),
      getNetworkNameMap(),
    ]);
    const responses = (
      await promiseAllSettledEnhanced(
        allNetworkAccounts.map((networkAccount) => async () => {
          const localTokens =
            await backgroundApiProxy.serviceToken.getAccountLocalTokens({
              accountId: networkAccount.accountId,
              networkId: networkAccount.networkId,
              accountAddress: networkAccount.apiAddress,
              xpub: networkAccount.accountXpub,
            });
          return localTokens.hasCache
            ? buildLocalTokenResponse({
                accountId: networkAccount.accountId,
                networkId: networkAccount.networkId,
                networkName: networkNameMap[networkAccount.networkId],
                localTokens,
              })
            : null;
        }),
        {
          continueOnError: true,
          concurrency: PROMISE_CONCURRENCY_LIMIT,
        },
      )
    ).filter(isTokenResponse);
    return responses.length
      ? buildTokenDataFromResponses(responses)
      : undefined;
  }, [account?.id, getAllNetworkAccounts, getNetworkNameMap, network?.id]);

  const refreshNativeTokens = useCallback(async () => {
    if (!isNativeTokenListSupported || !account?.id || !network?.id) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
      isRefreshing: true,
      type: EHomeTab.TOKENS,
      accountId: account.id,
      networkId: network.id,
    });
    tokenListActions.updateTokenListState({
      initialized: tokenListInitializedRef.current,
      isRefreshing: true,
    });

    try {
      await backgroundApiProxy.serviceToken.abortFetchAccountTokens();
      let tokenData: INativeTokenData | undefined;
      if (network.isAllNetworks) {
        tokenData = await fetchAllNetworkTokens();
      } else if (mergeDeriveAddressData) {
        tokenData = await fetchMergeDeriveTokens();
      } else {
        const response =
          await backgroundApiProxy.serviceToken.fetchAccountTokens({
            accountId: account.id,
            networkId: network.id,
            indexedAccountId: indexedAccount?.id,
            mergeTokens: true,
            flag: 'home-native-token-list',
            saveToLocal: true,
          });

        tokenData = {
          keys: response.tokens.keys,
          tokens: response.tokens.data,
          smallBalanceTokens: response.smallBalanceTokens.data,
          riskyTokens: response.riskTokens.data,
          tokenMap: {
            ...response.tokens.map,
            ...response.smallBalanceTokens.map,
            ...response.riskTokens.map,
          },
          aggregateTokensListMap: response.aggregateTokenListMap,
        };
      }

      if (requestIdRef.current !== requestId || !tokenData) {
        return;
      }

      applyTokenData({
        ...tokenData,
        initialized: true,
        isRefreshing: false,
      });
    } catch (error) {
      console.error(error);
      tokenListActions.updateTokenListState({
        initialized: true,
        isRefreshing: false,
      });
    } finally {
      appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
        isRefreshing: false,
        type: EHomeTab.TOKENS,
        accountId: account.id,
        networkId: network.id,
      });
    }
  }, [
    account?.id,
    applyTokenData,
    fetchAllNetworkTokens,
    fetchMergeDeriveTokens,
    indexedAccount?.id,
    isNativeTokenListSupported,
    mergeDeriveAddressData,
    network?.id,
    network?.isAllNetworks,
    tokenListActions,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (!isNativeTokenListSupported || !account?.id || !network?.id) {
      tokenListActions.updateTokenListState({
        initialized: true,
        isRefreshing: false,
      });
      return undefined;
    }

    const hydrateLocalTokens = async () => {
      setIsLocalHydrating(true);
      tokenListActions.updateTokenListState({
        initialized: false,
        isRefreshing: true,
      });

      try {
        let tokenData: INativeTokenData | undefined;
        let hasCache = false;

        if (network.isAllNetworks) {
          tokenData = await hydrateAllNetworkLocalTokens();
          hasCache = !!tokenData;
        } else if (mergeDeriveAddressData) {
          tokenData = await hydrateMergeDeriveLocalTokens();
          hasCache = !!tokenData;
        } else {
          const localTokens =
            await backgroundApiProxy.serviceToken.getAccountLocalTokens({
              accountId: account.id,
              networkId: network.id,
            });
          hasCache = !!localTokens.hasCache;
          tokenData = {
            keys: `${account.id}_${network.id}_native_local`,
            tokens: localTokens.tokenList,
            smallBalanceTokens: localTokens.smallBalanceTokenList,
            riskyTokens: localTokens.riskyTokenList,
            tokenMap: localTokens.tokenListMap ?? {},
          };
        }

        if (cancelled) {
          return;
        }

        if (tokenData) {
          applyTokenData({
            ...tokenData,
            initialized: hasCache,
            isRefreshing: !hasCache,
          });
        } else {
          tokenListActions.updateTokenListState({
            initialized: false,
            isRefreshing: true,
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          tokenListActions.updateTokenListState({
            initialized: true,
            isRefreshing: false,
          });
        }
      } finally {
        if (!cancelled) {
          setIsLocalHydrating(false);
          void refreshNativeTokens();
        }
      }
    };

    void hydrateLocalTokens();

    return () => {
      cancelled = true;
    };
  }, [
    account?.id,
    applyTokenData,
    hydrateAllNetworkLocalTokens,
    hydrateMergeDeriveLocalTokens,
    isNativeTokenListSupported,
    mergeDeriveAddressData,
    network?.id,
    network?.isAllNetworks,
    ownerKey,
    refreshNativeTokens,
    tokenListActions,
  ]);

  const visibleTokens = useMemo(
    () => tokenList.tokens.slice(0, NATIVE_TOKEN_ROW_LIMIT),
    [tokenList.tokens],
  );

  const tokenRows = useMemo<IHomeNativeRow[]>(() => {
    const titleRow: IHomeNativeRow = {
      type: 'sectionHeader',
      key: 'portfolio:tokens:title',
      title: intl.formatMessage({
        id: ETranslations.global_universal_search_tabs_tokens,
      }),
    };

    if (!isNativeTokenListSupported) {
      return [
        titleRow,
        {
          type: 'empty',
          key: 'portfolio:tokens:no-wallet',
          title: intl.formatMessage({ id: ETranslations.global_no_wallet }),
          estimatedHeight: 88,
        },
      ];
    }

    if (
      (isLocalHydrating || tokenListState.isRefreshing) &&
      visibleTokens.length === 0
    ) {
      return [
        titleRow,
        {
          type: 'loading',
          key: 'portfolio:tokens:loading',
          rows: 6,
          estimatedHeight: 72,
        },
      ];
    }

    if (visibleTokens.length === 0) {
      return [
        titleRow,
        {
          type: 'empty',
          key: 'portfolio:tokens:empty',
          title: intl.formatMessage({ id: ETranslations.global_no_data }),
          estimatedHeight: 88,
        },
      ];
    }

    return [
      titleRow,
      ...visibleTokens.map((token) =>
        buildNativeTokenRow({
          token,
          tokenFiat: tokenListMap[token.$key],
          currencySymbol: settings.currencyInfo.symbol,
          hideValue: settingsValue.hideValue,
        }),
      ),
      ...(smallBalanceTokenList.smallBalanceTokens.length > 0
        ? [
            {
              type: 'text' as const,
              key: 'portfolio:tokens:low-value-summary',
              title: intl.formatMessage({ id: ETranslations.low_value_assets }),
              subtitle: `${smallBalanceTokenList.smallBalanceTokens.length}`,
              estimatedHeight: 56,
            },
          ]
        : []),
    ];
  }, [
    intl,
    isLocalHydrating,
    isNativeTokenListSupported,
    settings.currencyInfo.symbol,
    settingsValue.hideValue,
    smallBalanceTokenList.smallBalanceTokens.length,
    tokenListMap,
    tokenListState.isRefreshing,
    visibleTokens,
  ]);

  const tokenByKey = useMemo(() => {
    const result: Record<string, IAccountToken> = {};
    for (const token of visibleTokens) {
      result[token.$key] = token;
    }
    return result;
  }, [visibleTokens]);

  const handleTokenRowPress = useCallback(
    (rowKey: string) => {
      const tokenKey = getTokenKeyFromNativeRowKey(rowKey);
      const token = tokenByKey[tokenKey];

      if (!token || !network || !wallet) {
        return;
      }

      navigation.pushModal(EModalRoutes.MainModal, {
        screen: EModalAssetDetailRoutes.TokenDetails,
        params: {
          accountId: token.accountId ?? account?.id ?? '',
          networkId: token.networkId ?? network.id,
          accountAddress: account?.address ?? '',
          walletId: wallet.id,
          isAllNetworks: network.isAllNetworks,
          indexedAccountId: indexedAccount?.id ?? '',
          tokenInfo: token,
          aggregateTokens: aggregateTokenListMap[token.$key]?.tokens ?? [],
          tokenMap: tokenListMap,
        },
      });
    },
    [
      account?.address,
      account?.id,
      aggregateTokenListMap,
      indexedAccount?.id,
      navigation,
      network,
      tokenByKey,
      tokenListMap,
      wallet,
    ],
  );

  return {
    isRefreshing: isLocalHydrating || tokenListState.isRefreshing,
    refreshNativeTokens,
    tokenRows,
    handleTokenRowPress,
  };
}
