import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CanceledError } from 'axios';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil, uniqBy } from 'lodash';
import { useIntl } from 'react-intl';
import { useThrottledCallback } from 'use-debounce';

import {
  IconButton,
  Skeleton,
  Stack,
  useOnRouterChange,
  useTabIsRefreshingFocused,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EmptyAccount } from '@onekeyhq/kit/src/components/Empty';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { TokenListView } from '@onekeyhq/kit/src/components/TokenListView';
import { perfTokenListView } from '@onekeyhq/kit/src/components/TokenListView/perfTokenListView';
import { useAllNetworkRequests } from '@onekeyhq/kit/src/hooks/useAllNetwork';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useManageToken } from '@onekeyhq/kit/src/hooks/useManageToken';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useAccountOverviewActions,
  useAccountWorthAtom,
  useAllNetworksStateStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAggregateTokensListMapAtom,
  useTokenListActions,
  useTokenListMapAtom,
  useTokenListStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { ISimpleDBAggregateToken } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAggregateToken';
import type { ICustomTokenDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityCustomTokens';
import type { ISimpleDBLocalTokens } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityLocalTokens';
import type { IRiskTokenManagementDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityRiskTokenManagement';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_HISTORY,
  POLLING_INTERVAL_FOR_TOKEN,
  TOKEN_LIST_HIGH_VALUE_MAX,
} from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalAssetDetailRoutes,
  EModalReceiveRoutes,
  EModalRoutes,
  EModalSignatureConfirmRoutes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import perfUtils, {
  EPerformanceTimerLogNames,
} from '@onekeyhq/shared/src/utils/debug/perfUtils';
import {
  buildAggregateTokenListData,
  buildLocalAggregateTokenMapKey,
  calculateAccountTokensValue,
  getEmptyTokenData,
  getMergedDeriveTokenData,
  getMergedTokenData,
  mergeAggregateTokenListMap,
  mergeAggregateTokenMap,
  mergeDeriveTokenList,
  mergeDeriveTokenListMap,
  sortTokensByFiatValue,
  sortTokensByOrder,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import { EHomeTab } from '@onekeyhq/shared/types';
import type {
  IAccountToken,
  IFetchAccountTokensResp,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { RichBlock } from '../RichBlock/RichBlock';

const networkIdsMap = getNetworkIdsMap();

function TokenListBlock({ tableLayout }: { tableLayout?: boolean }) {
  const [settings] = useSettingsPersistAtom();

  const { isFocused, isHeaderRefreshing, setIsHeaderRefreshing } =
    useTabIsRefreshingFocused();

  const {
    activeAccount: {
      account,
      accountName,
      network,
      wallet,
      indexedAccount,
      isOthersWallet,
      deriveInfo,
      deriveType,
      deriveInfoItems,
      vaultSettings,
    },
  } = useActiveAccount({ num: 0 });
  const [shouldAlwaysFetch, setShouldAlwaysFetch] = useState(false);
  const [tokenListState] = useTokenListStateAtom();
  const [allNetworkAccounts, setAllNetworkAccounts] = useState<
    IAllNetworkAccountInfo[] | undefined
  >(undefined);
  const intl = useIntl();

  const mergeDeriveAddressData =
    vaultSettings?.mergeDeriveAssetsEnabled &&
    !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' }) &&
    deriveInfoItems.length > 1;

  const [accountTokensWorth] = useAccountWorthAtom();

  const accountTokensValue = useMemo(() => {
    return calculateAccountTokensValue({
      accountId: account?.id ?? '',
      networkId: network?.id ?? '',
      tokensWorth: accountTokensWorth,
      mergeDeriveAssetsEnabled: !!vaultSettings?.mergeDeriveAssetsEnabled,
    });
  }, [
    account?.id,
    network?.id,
    accountTokensWorth,
    vaultSettings?.mergeDeriveAssetsEnabled,
  ]);

  const tokenListRef = useRef<{
    keys: string;
    tokens: IAccountToken[];
    map: { [key: string]: ITokenFiat };
  }>({
    keys: '',
    tokens: [],
    map: {},
  });

  const riskyTokenListRef = useRef<{
    keys: string;
    tokens: IAccountToken[];
    map: { [key: string]: ITokenFiat };
  }>({
    keys: '',
    tokens: [],
    map: {},
  });

  const aggregateTokenMapRef = useRef<{
    [key: string]: ITokenFiat;
  }>({});

  const riskTokenManagementRawData = useRef<IRiskTokenManagementDBStruct>({
    unblockedTokens: {},
    blockedTokens: {},
  });

  const customTokensRawData = useRef<ICustomTokenDBStruct | undefined>(
    undefined,
  );

  const localTokensRawData = useRef<ISimpleDBLocalTokens | undefined>(
    undefined,
  );

  const aggregateTokenRawData = useRef<ISimpleDBAggregateToken | undefined>(
    undefined,
  );

  const { handleOnManageToken, manageTokenEnabled } = useManageToken({
    accountId: account?.id ?? '',
    networkId: network?.id ?? '',
    walletId: wallet?.id ?? '',
    deriveType,
    indexedAccountId: indexedAccount?.id,
    isOthersWallet,
  });

  const navigation = useAppNavigation();

  useOnRouterChange((state) => {
    const modalRoutes = state?.routes.find(
      ({ name }) => name === ERootRoutes.Modal,
    );

    if (
      // @ts-ignore
      (modalRoutes?.params?.screen === EModalRoutes.SignatureConfirmModal &&
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        modalRoutes?.params?.params?.screen ===
          EModalSignatureConfirmRoutes.TxSelectToken) ||
      // @ts-ignore
      (modalRoutes?.params?.screen === EModalRoutes.ReceiveModal &&
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        modalRoutes?.params?.params?.screen ===
          EModalReceiveRoutes.ReceiveSelectToken)
    ) {
      setShouldAlwaysFetch(true);
    } else {
      setShouldAlwaysFetch(false);
    }
  });

  const {
    refreshAllTokenList,
    refreshAllTokenListMap,
    refreshTokenList,
    refreshTokenListMap,
    refreshRiskyTokenList,
    refreshRiskyTokenListMap,
    refreshSmallBalanceTokenList,
    refreshSmallBalanceTokenListMap,
    refreshSmallBalanceTokensFiatValue,
    refreshAggregateTokensListMap,
    refreshAggregateTokensMap,
    updateTokenListState,
    updateSearchKey,
  } = useTokenListActions().current;

  const [aggregateTokenListMapAtom] = useAggregateTokensListMapAtom();
  const [tokenListMapAtom] = useTokenListMapAtom();
  const {
    updateAccountWorth,
    updateAccountOverviewState,
    updateAllNetworksState,
  } = useAccountOverviewActions().current;

  const { result: homeDefaultTokenMap } = usePromiseResult(async () => {
    const r = await backgroundApiProxy.serviceToken.getHomeDefaultTokenMap();
    return r;
  }, []);

  const { run } = usePromiseResult(
    async () => {
      let accountId = account?.id ?? '';
      try {
        if (!network) return;

        if (!mergeDeriveAddressData) {
          if (!account) return;
        } else {
          accountId = indexedAccount?.id ?? '';
        }

        if (network.isAllNetworks) return;

        appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
          isRefreshing: true,
          type: EHomeTab.TOKENS,
          accountId,
          networkId: network.id,
        });

        await backgroundApiProxy.serviceToken.abortFetchAccountTokens();

        let r: IFetchAccountTokensResp = getEmptyTokenData();

        if (mergeDeriveAddressData) {
          const { networkAccounts } =
            await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
              {
                networkId: network.id,
                indexedAccountId: indexedAccount?.id ?? '',
                excludeEmptyAccount: true,
              },
            );

          const resp = await Promise.all(
            networkAccounts.map((networkAccount) =>
              backgroundApiProxy.serviceToken.fetchAccountTokens({
                accountId: networkAccount.account?.id ?? '',
                mergeTokens: true,
                networkId: network.id,
                flag: 'home-token-list',
                saveToLocal: true,
                indexedAccountId: indexedAccount?.id,
              }),
            ),
          );

          const {
            tokenList,
            smallBalanceTokenList,
            riskyTokenList,
            tokenListMap,
            smallBalanceTokenListMap,
            riskyTokenListMap,
            allTokenList,
            allTokenListMap,
          } = getMergedDeriveTokenData({
            data: resp,
            mergeDeriveAssetsEnabled: true,
          });

          r.tokens = {
            data: tokenList.tokens,
            keys: tokenList.keys,
            fiatValue: tokenList.fiatValue,
            map: tokenListMap,
          };
          r.smallBalanceTokens = {
            data: smallBalanceTokenList.smallBalanceTokens,
            keys: smallBalanceTokenList.keys,
            fiatValue: smallBalanceTokenList.fiatValue,
            map: smallBalanceTokenListMap,
          };
          r.riskTokens = {
            data: riskyTokenList.riskyTokens,
            keys: riskyTokenList.keys,
            fiatValue: riskyTokenList.fiatValue,
            map: riskyTokenListMap,
          };
          r.allTokens = {
            data: allTokenList.tokens,
            keys: allTokenList.keys,
            fiatValue: allTokenList.fiatValue,
            map: allTokenListMap,
          };

          const accountWorth: Record<string, string> = {};

          resp.forEach((item) => {
            if (item.accountId && item.networkId) {
              let accountWorthValue = new BigNumber(0);
              accountWorthValue = accountWorthValue
                .plus(item.tokens.fiatValue ?? '0')
                .plus(item.smallBalanceTokens.fiatValue ?? '0');

              accountWorth[
                accountUtils.buildAccountValueKey({
                  accountId: item.accountId,
                  networkId: item.networkId,
                })
              ] = accountWorthValue.toFixed();
            }
          });

          updateAccountOverviewState({
            isRefreshing: false,
            initialized: true,
          });

          updateAccountWorth({
            accountId,
            initialized: true,
            worth: accountWorth,
            createAtNetworkWorth: '0',
            merge: false,
          });
        } else {
          r = await backgroundApiProxy.serviceToken.fetchAccountTokens({
            accountId,
            mergeTokens: true,
            networkId: network.id,
            flag: 'home-token-list',
            saveToLocal: true,
            indexedAccountId: indexedAccount?.id,
          });

          let accountWorth = new BigNumber(0);
          accountWorth = accountWorth
            .plus(r.tokens.fiatValue ?? '0')
            .plus(r.smallBalanceTokens.fiatValue ?? '0');

          updateAccountOverviewState({
            isRefreshing: false,
            initialized: true,
          });

          updateAccountWorth({
            accountId,
            initialized: true,
            worth: {
              [accountUtils.buildAccountValueKey({
                accountId,
                networkId: network.id,
              })]: accountWorth.toFixed(),
            },
            createAtNetworkWorth: accountWorth.toFixed(),
            merge: false,
          });
        }

        refreshTokenList({ keys: r.tokens.keys, tokens: r.tokens.data });
        // can search all tokens in token list
        refreshTokenListMap({
          tokens: {
            ...r.tokens.map,
            ...r.smallBalanceTokens.map,
            ...r.riskTokens.map,
          },
        });
        refreshRiskyTokenList({
          keys: r.riskTokens.keys,
          riskyTokens: r.riskTokens.data,
        });
        refreshRiskyTokenListMap({
          tokens: r.riskTokens.map,
        });
        refreshSmallBalanceTokenList({
          keys: r.smallBalanceTokens.keys,
          smallBalanceTokens: r.smallBalanceTokens.data,
        });
        refreshSmallBalanceTokenListMap({
          tokens: r.smallBalanceTokens.map,
        });
        refreshSmallBalanceTokensFiatValue({
          value: r.smallBalanceTokens.fiatValue ?? '0',
        });

        if (r.allTokens) {
          refreshAllTokenList({
            keys: r.allTokens?.keys,
            tokens: r.allTokens?.data,
            accountId: account?.id,
            networkId: network?.id,
          });
          refreshAllTokenListMap({
            tokens: r.allTokens.map,
          });
          const mergedTokens = r.allTokens.data;
          if (mergedTokens && mergedTokens.length) {
            void backgroundApiProxy.serviceToken.updateLocalTokens({
              networkId: network.id,
              tokens: mergedTokens,
            });
          }

          perfTokenListView.markEnd(
            'tokenListRefreshing_tokenListContainerRefreshList',
          );
          updateTokenListState({
            initialized: true,
            isRefreshing: false,
          });

          appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
            isRefreshing: false,
            type: EHomeTab.TOKENS,
            accountId,
            networkId: network.id,
          });
        }
      } catch (e) {
        appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
          isRefreshing: false,
          type: EHomeTab.TOKENS,
          accountId,
          networkId: network?.id ?? '',
        });
        if (e instanceof CanceledError) {
          console.log('fetchAccountTokens canceled');
        } else {
          throw e;
        }
      } finally {
        setIsHeaderRefreshing(false);
      }
    },
    [
      account,
      network,
      mergeDeriveAddressData,
      updateAccountOverviewState,
      updateAccountWorth,
      refreshTokenList,
      refreshTokenListMap,
      refreshRiskyTokenList,
      refreshRiskyTokenListMap,
      refreshSmallBalanceTokenList,
      refreshSmallBalanceTokenListMap,
      refreshSmallBalanceTokensFiatValue,
      indexedAccount?.id,
      refreshAllTokenList,
      refreshAllTokenListMap,
      updateTokenListState,
      setIsHeaderRefreshing,
    ],
    {
      overrideIsFocused: (isPageFocused) =>
        (isPageFocused && isFocused) || shouldAlwaysFetch,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_TOKEN,
    },
  );

  const { result: allAggregateTokenInfo } = usePromiseResult(
    async () => backgroundApiProxy.serviceToken.getAllAggregateTokenInfo(),
    [],
  );

  const { allAggregateTokenMap } = allAggregateTokenInfo ?? {};

  const isAllNetworkManualRefresh = useRef(false);

  const updateAllNetworkData = useThrottledCallback(() => {
    refreshTokenList({
      keys: tokenListRef.current.keys,
      tokens: tokenListRef.current.tokens,
      merge: true,
      map: {
        ...tokenListRef.current.map,
        ...aggregateTokenMapRef.current,
      },
      mergeDerive: true,
      split: true,
    });

    refreshRiskyTokenList({
      keys: riskyTokenListRef.current.keys,
      riskyTokens: riskyTokenListRef.current.tokens,
      merge: true,
      map: riskyTokenListRef.current.map,
      mergeDerive: true,
    });

    tokenListRef.current.tokens = [];
    tokenListRef.current.keys = '';
    tokenListRef.current.map = {};

    riskyTokenListRef.current.tokens = [];
    riskyTokenListRef.current.keys = '';
    riskyTokenListRef.current.map = {};

    aggregateTokenMapRef.current = {};
  }, 1000);

  const handleAllNetworkRequests = useCallback(
    async ({
      accountId,
      networkId,
      dbAccount,
      allNetworkDataInit,
    }: {
      accountId: string;
      networkId: string;
      dbAccount?: IDBAccount;
      allNetworkDataInit?: boolean;
    }) => {
      const r = await backgroundApiProxy.serviceToken.fetchAccountTokens({
        dbAccount,
        networkId,
        accountId,
        indexedAccountId: indexedAccount?.id,
        flag: 'home-token-list',
        isAllNetworks: true,
        isManualRefresh: isAllNetworkManualRefresh.current,
        allNetworksAccountId: account?.id,
        allNetworksNetworkId: network?.id,
        saveToLocal: true,
        customTokensRawData: customTokensRawData.current,
        blockedTokensRawData: riskTokenManagementRawData.current.blockedTokens,
        unblockedTokensRawData:
          riskTokenManagementRawData.current.unblockedTokens,
      });

      const aggregateTokenConfigMapRawData =
        aggregateTokenRawData.current?.aggregateTokenConfigMap;

      let aggregateTokenListMap: Record<
        string,
        {
          commonToken: IAccountToken;
          tokens: IAccountToken[];
        }
      > = {};
      let aggregateTokenMap: Record<string, ITokenFiat> = {};

      const [tokenNetwork, tokenVaultSettings] = await Promise.all([
        backgroundApiProxy.serviceNetwork.getNetwork({
          networkId,
        }),
        backgroundApiProxy.serviceNetwork.getVaultSettings({
          networkId,
        }),
      ]);

      if (aggregateTokenConfigMapRawData) {
        r.tokens.data = r.tokens.data
          .map((token) => {
            const data = buildAggregateTokenListData({
              networkId,
              accountId,
              token,
              tokenMap: r.tokens.map,
              aggregateTokenListMap,
              aggregateTokenMap,
              aggregateTokenConfigMapRawData,
              networkName: tokenNetwork?.name ?? '',
            });

            if (data.isAggregateToken) {
              aggregateTokenListMap = data.aggregateTokenListMap;
              aggregateTokenMap = data.aggregateTokenMap;
              return null;
            }

            return token;
          })
          .filter(Boolean);

        r.smallBalanceTokens.data = r.smallBalanceTokens.data
          .map((token) => {
            const data = buildAggregateTokenListData({
              networkId,
              accountId,
              token,
              tokenMap: r.smallBalanceTokens.map,
              aggregateTokenListMap,
              aggregateTokenMap,
              aggregateTokenConfigMapRawData,
              networkName: tokenNetwork?.name ?? '',
            });

            if (data.isAggregateToken) {
              aggregateTokenListMap = data.aggregateTokenListMap;
              aggregateTokenMap = data.aggregateTokenMap;
              return null;
            }

            return token;
          })
          .filter(Boolean);

        const aggregateTokenList = Object.values(aggregateTokenListMap).map(
          (item) => item.commonToken,
        );

        r.tokens.data = [...r.tokens.data, ...aggregateTokenList];
        r.aggregateTokenListMap = aggregateTokenListMap;
        r.aggregateTokenMap = aggregateTokenMap;
      }

      const { tokens, riskTokens, smallBalanceTokens } = r;

      const { allTokens } = getMergedTokenData({
        tokens,
        riskTokens,
        smallBalanceTokens,
      });

      if (allTokens) {
        allTokens.data = allTokens.data.map((token) => ({
          ...token,
          accountId,
          networkId,
          networkName: tokenNetwork?.name,
          mergeAssets: tokenVaultSettings.mergeDeriveAssetsEnabled,
        }));
      }
      r.allTokens = allTokens;

      if (!allNetworkDataInit && r.isSameAllNetworksAccountData) {
        let accountWorth = new BigNumber(0);
        let createAtNetworkWorth = new BigNumber(0);

        accountWorth = accountWorth
          .plus(r.tokens.fiatValue ?? '0')
          .plus(r.smallBalanceTokens.fiatValue ?? '0');

        perfTokenListView.markEnd('tokenListRefreshing_allNetworkRequests');
        updateTokenListState({
          initialized: true,
          isRefreshing: false,
        });

        updateAccountOverviewState({
          isRefreshing: false,
          initialized: true,
        });

        if (
          account?.id &&
          (!accountUtils.isOthersAccount({ accountId: account.id }) ||
            (accountUtils.isOthersAccount({ accountId: account.id }) &&
              account?.createAtNetwork &&
              account.createAtNetwork === networkId))
        ) {
          createAtNetworkWorth = accountWorth;
        }

        updateAccountWorth({
          accountId: account?.id ?? '',
          initialized: true,
          worth: {
            [accountUtils.buildAccountValueKey({
              accountId,
              networkId,
            })]: accountWorth.toFixed(),
          },
          createAtNetworkWorth: createAtNetworkWorth.toFixed(),
          merge: true,
        });

        const mergeDeriveAssetsEnabled = !!(
          await backgroundApiProxy.serviceNetwork.getVaultSettings({
            networkId,
          })
        ).mergeDeriveAssetsEnabled;

        tokenListRef.current.tokens = tokenListRef.current.tokens.concat([
          ...r.tokens.data,
          ...r.smallBalanceTokens.data,
        ]);

        tokenListRef.current.keys = `${tokenListRef.current.keys}_${r.tokens.keys}`;

        const mergedMap = {
          ...r.tokens.map,
          ...r.smallBalanceTokens.map,
        };

        tokenListRef.current.map = {
          ...mergedMap,
          ...tokenListRef.current.map,
        };

        riskyTokenListRef.current.tokens =
          riskyTokenListRef.current.tokens.concat([...r.riskTokens.data]);

        riskyTokenListRef.current.keys = `${riskyTokenListRef.current.keys}_${r.riskTokens.keys}`;

        riskyTokenListRef.current.map = {
          ...r.riskTokens.map,
          ...riskyTokenListRef.current.map,
        };

        if (r.aggregateTokenListMap) {
          refreshAggregateTokensListMap({
            tokens: r.aggregateTokenListMap,
            merge: true,
          });
        }

        if (r.aggregateTokenMap) {
          aggregateTokenMapRef.current = mergeAggregateTokenMap({
            sourceMap: r.aggregateTokenMap,
            targetMap: aggregateTokenMapRef.current,
          });
          refreshAggregateTokensMap({
            tokens: aggregateTokenMapRef.current,
          });
        }

        refreshTokenListMap({
          tokens: mergedMap,
          merge: true,
          mergeDerive: mergeDeriveAssetsEnabled,
        });

        refreshSmallBalanceTokenListMap({
          tokens: mergedMap,
          merge: true,
          mergeDerive: mergeDeriveAssetsEnabled,
        });

        refreshRiskyTokenListMap({
          tokens: r.riskTokens.map,
          merge: true,
          mergeDerive: mergeDeriveAssetsEnabled,
        });

        if (r.allTokens) {
          refreshAllTokenListMap({
            tokens: r.allTokens.map,
            merge: true,
            mergeDerive: mergeDeriveAssetsEnabled,
          });
          refreshAllTokenList({
            keys: r.allTokens.keys,
            tokens: r.allTokens.data,
            map: r.allTokens.map,
            merge: true,
            mergeDerive: mergeDeriveAssetsEnabled,
            accountId: account?.id,
            networkId: network?.id,
          });
        }

        updateAllNetworkData();
      }

      isAllNetworkManualRefresh.current = false;
      return r;
    },
    [
      account?.createAtNetwork,
      account?.id,
      indexedAccount?.id,
      network?.id,
      refreshAggregateTokensListMap,
      refreshAggregateTokensMap,
      refreshAllTokenList,
      refreshAllTokenListMap,
      refreshRiskyTokenListMap,
      refreshSmallBalanceTokenListMap,
      refreshTokenListMap,
      updateAccountOverviewState,
      updateAccountWorth,
      updateAllNetworkData,
      updateTokenListState,
    ],
  );

  const handleClearAllNetworkData = useCallback(() => {
    const emptyTokens = getEmptyTokenData();

    refreshSmallBalanceTokensFiatValue({
      value: '0',
    });

    refreshAllTokenList({
      tokens: emptyTokens.allTokens.data,
      keys: emptyTokens.allTokens.keys,
      accountId: account?.id,
      networkId: network?.id,
    });
    refreshAllTokenListMap({
      tokens: emptyTokens.allTokens.map,
    });

    refreshTokenList({
      tokens: emptyTokens.tokens.data,
      keys: emptyTokens.tokens.keys,
    });
    refreshTokenListMap({
      tokens: emptyTokens.tokens.map,
    });

    refreshSmallBalanceTokenList({
      smallBalanceTokens: emptyTokens.smallBalanceTokens.data,
      keys: emptyTokens.smallBalanceTokens.keys,
    });
    refreshSmallBalanceTokenListMap({
      tokens: emptyTokens.smallBalanceTokens.map,
    });

    refreshRiskyTokenList({
      riskyTokens: emptyTokens.riskTokens.data,
      keys: emptyTokens.riskTokens.keys,
    });

    refreshRiskyTokenListMap({
      tokens: emptyTokens.riskTokens.map,
    });
  }, [
    account?.id,
    network?.id,
    refreshAllTokenList,
    refreshAllTokenListMap,
    refreshRiskyTokenList,
    refreshRiskyTokenListMap,
    refreshSmallBalanceTokenList,
    refreshSmallBalanceTokenListMap,
    refreshSmallBalanceTokensFiatValue,
    refreshTokenList,
    refreshTokenListMap,
  ]);

  const handleAllNetworkRequestsFinished = useCallback(
    async ({
      accountId,
      networkId,
    }: {
      accountId?: string;
      networkId?: string;
    }) => {
      appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
        isRefreshing: false,
        type: EHomeTab.TOKENS,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
      });
    },
    [],
  );

  const handleAllNetworkRequestsStarted = useCallback(
    async ({
      accountId,
      networkId,
    }: {
      accountId?: string;
      networkId?: string;
    }) => {
      perfTokenListView.markStart('allNetworkRequestsStarted_getRawData');

      let [c, r, l, a] = await Promise.all([
        backgroundApiProxy.simpleDb.customTokens.getRawData(),
        backgroundApiProxy.simpleDb.riskTokenManagement.getRawData(),
        backgroundApiProxy.simpleDb.localTokens.getRawData(),
        backgroundApiProxy.simpleDb.aggregateToken.getRawData(),
      ]);

      perfTokenListView.markEnd('allNetworkRequestsStarted_getRawData');

      if (!a?.aggregateTokenConfigMap) {
        await backgroundApiProxy.serviceSetting.syncWalletConfig();
        a = await backgroundApiProxy.simpleDb.aggregateToken.getRawData();
      }

      customTokensRawData.current = c ?? undefined;
      riskTokenManagementRawData.current = {
        unblockedTokens: r?.unblockedTokens ?? {},
        blockedTokens: r?.blockedTokens ?? {},
      };
      localTokensRawData.current = l ?? undefined;
      aggregateTokenRawData.current = a ?? undefined;

      appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
        isRefreshing: true,
        type: EHomeTab.TOKENS,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
      });
    },
    [],
  );

  const handleAllNetworkCacheRequests = useCallback(
    async ({
      accountId,
      networkId,
      xpub,
      accountAddress,
    }: {
      accountId: string;
      networkId: string;
      xpub?: string;
      accountAddress: string;
    }) => {
      const perf = perfUtils.createPerf({
        name: EPerformanceTimerLogNames.allNetwork__handleAllNetworkCacheRequests,
      });

      perf.markStart('getAccountLocalTokens', {
        networkId,
        accountAddress,
        rawDataExist: !!localTokensRawData.current,
      });
      const localTokens =
        await backgroundApiProxy.serviceToken.getAccountLocalTokens({
          accountId,
          networkId,
          accountAddress,
          xpub,
          simpleDbLocalTokensRawData: localTokensRawData.current,
        });
      perf.markEnd('getAccountLocalTokens');

      const { tokenList, smallBalanceTokenList, riskyTokenList } = localTokens;

      perf.done();
      if (
        isEmpty(tokenList) &&
        isEmpty(riskyTokenList) &&
        isEmpty(smallBalanceTokenList)
      ) {
        return null;
      }

      return {
        ...localTokens,
        tokenList,
        smallBalanceTokenList,
        riskyTokenList,
        accountId,
        networkId,
      };
    },
    [],
  );

  const handleAllNetworkCacheData = useCallback(
    async ({
      data,
      accountId,
      networkId,
    }: {
      data: {
        tokenList: IAccountToken[];
        smallBalanceTokenList: IAccountToken[];
        riskyTokenList: IAccountToken[];
        tokenListMap: {
          [key: string]: ITokenFiat;
        };
        tokenListValue: string;
        networkId: string;
        accountId: string;
      }[];
      accountId: string;
      networkId: string;
    }) => {
      perfTokenListView.markStart('handleAllNetworkCacheData');

      aggregateTokenRawData.current =
        (await backgroundApiProxy.simpleDb.aggregateToken.getRawData()) ??
        undefined;

      const key = buildLocalAggregateTokenMapKey({
        networkId,
        accountId,
      });

      const localAggregateTokenMap =
        aggregateTokenRawData.current?.aggregateTokenMap?.[key] ?? {};
      const localAggregateTokenListMap =
        aggregateTokenRawData.current?.aggregateTokenListMap?.[key] ?? {};
      const aggregateTokenConfigMap =
        aggregateTokenRawData.current?.aggregateTokenConfigMap ?? {};

      let tokenList: IAccountToken[] = [];
      const riskyTokenList: IAccountToken[] = [];
      let tokenListMap: {
        [key: string]: ITokenFiat;
      } = {};
      let tokenListValue: Record<string, string> = {};
      let aggregateTokenListMap: Record<
        string,
        {
          commonToken: IAccountToken;
          tokens: IAccountToken[];
        }
      > = {};
      let aggregateTokenMap: {
        [key: string]: ITokenFiat;
      } = {};
      data.forEach((item) => {
        tokenList.push(...item.tokenList, ...item.smallBalanceTokenList);
        riskyTokenList.push(...item.riskyTokenList);
        tokenListMap = {
          ...tokenListMap,
          ...item.tokenListMap,
        };
        tokenListValue = {
          ...tokenListValue,
          [accountUtils.buildAccountValueKey({
            accountId: item.accountId,
            networkId: item.networkId,
          })]: item.tokenListValue,
        };
      });

      if (aggregateTokenConfigMap) {
        tokenList = tokenList
          .map((token) => {
            const aggregateTokenData = buildAggregateTokenListData({
              networkId: token.networkId ?? '',
              accountId: token.accountId ?? '',
              token,
              tokenMap: tokenListMap,
              aggregateTokenListMap,
              aggregateTokenMap,
              aggregateTokenConfigMapRawData: aggregateTokenConfigMap,
              networkName: '',
            });

            if (aggregateTokenData.isAggregateToken) {
              aggregateTokenListMap = aggregateTokenData.aggregateTokenListMap;
              aggregateTokenMap = aggregateTokenData.aggregateTokenMap;
              return null;
            }

            return token;
          })
          .filter(Boolean);

        const aggregateTokenList = Object.values(aggregateTokenListMap).map(
          (item) => item.commonToken,
        );

        tokenList = [...tokenList, ...aggregateTokenList];
      }

      refreshAggregateTokensMap({
        tokens: localAggregateTokenMap,
      });

      refreshAggregateTokensListMap({
        tokens: localAggregateTokenListMap,
      });

      refreshTokenListMap({
        tokens: tokenListMap,
        merge: true,
        mergeDerive: true,
      });

      refreshSmallBalanceTokenListMap({
        tokens: tokenListMap,
        merge: true,
        mergeDerive: true,
      });

      refreshRiskyTokenListMap({
        tokens: tokenListMap,
        merge: true,
        mergeDerive: true,
      });

      refreshAllTokenListMap({
        tokens: tokenListMap,
        merge: true,
        mergeDerive: true,
      });

      refreshTokenList({
        keys: `${accountId}_${networkId}_local_all`,
        tokens: tokenList,
        merge: true,
        map: {
          ...tokenListMap,
          ...localAggregateTokenMap,
        },
        mergeDerive: true,
        split: true,
      });

      refreshRiskyTokenList({
        keys: `${accountId}_${networkId}_local_all`,
        riskyTokens: riskyTokenList,
        merge: true,
        map: {
          ...tokenListMap,
          ...localAggregateTokenMap,
        },
        mergeDerive: true,
      });

      refreshAllTokenList({
        keys: `${accountId}_${networkId}_local_all`,
        tokens: [...tokenList, ...riskyTokenList],
        map: {
          ...tokenListMap,
          ...localAggregateTokenMap,
        },
        merge: true,
        mergeDerive: true,
        accountId: account?.id,
        networkId: network?.id,
      });

      if (!isEmpty(tokenList) || !isEmpty(riskyTokenList)) {
        updateAccountWorth({
          accountId: account?.id ?? '',
          initialized: true,
          worth: tokenListValue,
          createAtNetworkWorth:
            tokenListValue[
              accountUtils.buildAccountValueKey({
                accountId: account?.id ?? '',
                networkId: account?.createAtNetwork ?? '',
              })
            ],
          updateAll: true,
        });
        updateAccountOverviewState({
          isRefreshing: false,
          initialized: true,
        });
        perfTokenListView.markEnd('tokenListRefreshing_allNetworkCacheData');
        updateTokenListState({
          initialized: true,
          isRefreshing: false,
        });

        perfTokenListView.markEnd('handleAllNetworkCacheData');
      }
    },
    [
      account?.createAtNetwork,
      account?.id,
      network?.id,
      refreshAggregateTokensListMap,
      refreshAggregateTokensMap,
      refreshAllTokenList,
      refreshAllTokenListMap,
      refreshRiskyTokenList,
      refreshRiskyTokenListMap,
      refreshSmallBalanceTokenListMap,
      refreshTokenList,
      refreshTokenListMap,
      updateAccountOverviewState,
      updateAccountWorth,
      updateTokenListState,
    ],
  );

  const handleAllNetworkAccountsData = useCallback(
    ({
      accounts,
      allAccounts,
    }: {
      accounts: IAllNetworkAccountInfo[];
      allAccounts: IAllNetworkAccountInfo[];
    }) => {
      updateAllNetworksState({
        visibleCount: uniqBy(allAccounts, 'networkId').length,
      });
      setAllNetworkAccounts(accounts);
    },
    [updateAllNetworksState],
  );

  const {
    run: runAllNetworksRequests,
    result: allNetworksResult,
    isEmptyAccount,
  } = useAllNetworkRequests<IFetchAccountTokensResp>({
    accountId: account?.id,
    networkId: network?.id,
    walletId: wallet?.id,
    isAllNetworks: network?.isAllNetworks,
    allNetworkRequests: handleAllNetworkRequests,
    allNetworkCacheRequests: handleAllNetworkCacheRequests,
    allNetworkCacheData: handleAllNetworkCacheData,
    allNetworkAccountsData: handleAllNetworkAccountsData,
    clearAllNetworkData: handleClearAllNetworkData,
    onStarted: handleAllNetworkRequestsStarted,
    onFinished: handleAllNetworkRequestsFinished,
    interval: 200,
    shouldAlwaysFetch,
  });

  const updateAllNetworksTokenList = useCallback(async () => {
    const tokenList: {
      tokens: IAccountToken[];
      keys: string;
    } = {
      tokens: [],
      keys: '',
    };

    const smallBalanceTokenList: {
      smallBalanceTokens: IAccountToken[];
      keys: string;
    } = {
      smallBalanceTokens: [],
      keys: '',
    };

    const riskyTokenList: {
      riskyTokens: IAccountToken[];
      keys: string;
    } = {
      riskyTokens: [],
      keys: '',
    };

    let tokenListMap: {
      [key: string]: ITokenFiat;
    } = {};

    let smallBalanceTokenListMap: {
      [key: string]: ITokenFiat;
    } = {};

    let riskyTokenListMap: {
      [key: string]: ITokenFiat;
    } = {};
    let accountsWorth: Record<string, string> = {};
    let createAtNetworkWorth = new BigNumber(0);
    let smallBalanceTokensFiatValue = new BigNumber(0);

    let aggregateTokenListMap: {
      [key: string]: {
        tokens: IAccountToken[];
      };
    } = {};

    let aggregateTokenMap: {
      [key: string]: ITokenFiat;
    } = {};

    if (allNetworksResult) {
      for (const r of allNetworksResult) {
        let mergeDeriveAssetsEnabled;

        try {
          if (r.networkId) {
            mergeDeriveAssetsEnabled = (
              await backgroundApiProxy.serviceNetwork.getVaultSettings({
                networkId: r.networkId ?? '',
              })
            ).mergeDeriveAssetsEnabled;
          }
        } catch (e) {
          mergeDeriveAssetsEnabled = false;
        }

        if (r.aggregateTokenListMap) {
          aggregateTokenListMap = mergeAggregateTokenListMap({
            sourceMap: r.aggregateTokenListMap,
            targetMap: aggregateTokenListMap,
          });
        }

        if (r.aggregateTokenMap) {
          aggregateTokenMap = mergeAggregateTokenMap({
            sourceMap: r.aggregateTokenMap,
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

        riskyTokenList.riskyTokens = mergeDeriveTokenList({
          sourceTokens: r.riskTokens.data,
          targetTokens: riskyTokenList.riskyTokens,
          mergeDeriveAssets: mergeDeriveAssetsEnabled,
        });

        riskyTokenList.riskyTokens = riskyTokenList.riskyTokens.concat(
          r.riskTokens.data,
        );
        riskyTokenList.keys = `${riskyTokenList.keys}_${r.riskTokens.keys}`;

        riskyTokenListMap = mergeDeriveTokenListMap({
          sourceMap: r.riskTokens.map,
          targetMap: riskyTokenListMap,
          mergeDeriveAssets: mergeDeriveAssetsEnabled,
        });

        const accountWorth = new BigNumber(r.tokens.fiatValue ?? '0').plus(
          r.smallBalanceTokens.fiatValue ?? '0',
        );

        accountsWorth = {
          ...accountsWorth,
          [accountUtils.buildAccountValueKey({
            accountId: r.accountId ?? '',
            networkId: r.networkId ?? '',
          })]: accountWorth.toFixed(),
        };

        if (
          account?.id &&
          (!accountUtils.isOthersAccount({ accountId: account.id }) ||
            (accountUtils.isOthersAccount({ accountId: account.id }) &&
              account?.createAtNetwork &&
              account.createAtNetwork === r.networkId))
        ) {
          createAtNetworkWorth = createAtNetworkWorth
            .plus(r.tokens.fiatValue ?? '0')
            .plus(r.smallBalanceTokens.fiatValue ?? '0');
        }
      }

      void backgroundApiProxy.serviceToken.updateLocalAggregateTokenMap({
        networkId: network?.id ?? '',
        accountId: account?.id ?? '',
        aggregateTokenMap,
      });

      void backgroundApiProxy.serviceToken.updateLocalAggregateTokenListMap({
        networkId: network?.id ?? '',
        accountId: account?.id ?? '',
        aggregateTokenListMap,
      });

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
        ...aggregateTokenMap,
      };

      let mergedTokens = sortTokensByFiatValue({
        tokens: [
          ...tokenList.tokens,
          ...smallBalanceTokenList.smallBalanceTokens,
        ],
        map: mergeTokenListMap,
      });

      const index = mergedTokens.findIndex((token) =>
        new BigNumber(mergeTokenListMap[token.$key]?.fiatValue ?? 0).isZero(),
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

      smallBalanceTokensFiatValue =
        smallBalanceTokenList.smallBalanceTokens.reduce(
          (acc, token) =>
            acc.plus(mergeTokenListMap[token.$key].fiatValue ?? '0'),
          new BigNumber(0),
        );

      riskyTokenList.riskyTokens = sortTokensByFiatValue({
        tokens: riskyTokenList.riskyTokens,
        map: riskyTokenListMap,
      });

      updateAccountWorth({
        accountId: account?.id ?? '',
        initialized: true,
        updateAll: true,
        worth: accountsWorth,
        createAtNetworkWorth: createAtNetworkWorth.toFixed(),
      });

      refreshAggregateTokensListMap({
        tokens: aggregateTokenListMap,
      });

      refreshAggregateTokensMap({
        tokens: aggregateTokenMap,
      });

      refreshTokenList(tokenList);

      refreshTokenListMap({
        tokens: mergeTokenListMap,
      });

      refreshSmallBalanceTokenList(smallBalanceTokenList);
      refreshSmallBalanceTokenListMap({
        tokens: mergeTokenListMap,
      });
      refreshSmallBalanceTokensFiatValue({
        value: smallBalanceTokensFiatValue.toFixed(),
      });

      refreshRiskyTokenList(riskyTokenList);
      refreshRiskyTokenListMap({
        tokens: riskyTokenListMap,
      });
      refreshAllTokenList({
        keys: `${tokenList.keys}_${smallBalanceTokenList.keys}_${riskyTokenList.keys}`,
        tokens: [...mergedTokens, ...riskyTokenList.riskyTokens],
        accountId: account?.id,
        networkId: network?.id,
      });
      refreshAllTokenListMap({
        tokens: {
          ...mergeTokenListMap,
          ...riskyTokenListMap,
        },
      });
    }
  }, [
    account?.createAtNetwork,
    account?.id,
    allNetworksResult,
    network?.id,
    refreshAllTokenList,
    refreshAllTokenListMap,
    refreshAggregateTokensListMap,
    refreshAggregateTokensMap,
    refreshRiskyTokenList,
    refreshRiskyTokenListMap,
    refreshSmallBalanceTokenList,
    refreshSmallBalanceTokenListMap,
    refreshSmallBalanceTokensFiatValue,
    refreshTokenList,
    refreshTokenListMap,
    updateAccountWorth,
  ]);

  useEffect(() => {
    const initTokenListData = async ({
      accountId,
      networkId,
      accountAddress,
      xpub,
    }: {
      accountId: string;
      networkId: string;
      accountAddress: string;
      xpub: string;
    }) => {
      updateSearchKey('');
      void backgroundApiProxy.serviceToken.updateCurrentAccount({
        networkId,
        accountId,
      });

      if (networkId === networkIdsMap.onekeyall) {
        perfTokenListView.markStart('tokenListRefreshing_1');
        updateTokenListState({
          initialized: false,
          isRefreshing: true,
        });
        updateAccountOverviewState({
          initialized: false,
          isRefreshing: true,
        });
        handleClearAllNetworkData();
        return;
      }

      let tokenList: IAccountToken[] = [];
      let smallBalanceTokenList: IAccountToken[] = [];
      let riskyTokenList: IAccountToken[] = [];
      let tokenListMap: Record<string, ITokenFiat> = {};
      let tokenListValue = '0';
      let tokenListWorth: Record<string, string> = {};

      if (mergeDeriveAddressData) {
        const { networkAccounts } =
          await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
            {
              networkId,
              indexedAccountId: indexedAccount?.id ?? '',
              excludeEmptyAccount: true,
            },
          );

        const resp = await Promise.all(
          networkAccounts.map((networkAccount) =>
            backgroundApiProxy.serviceToken.getAccountLocalTokens({
              accountId: networkAccount.account?.id ?? '',
              networkId,
              accountAddress: networkAccount.account?.address ?? '',
              xpub:
                // @ts-expect-error
                networkAccount.account?.xpubSegwit ||
                // @ts-expect-error
                networkAccount.account?.xpub,
            }),
          ),
        );

        const params = resp.map((r) => {
          if (r.accountId && r.networkId) {
            tokenListWorth = {
              ...tokenListWorth,
              [accountUtils.buildAccountValueKey({
                accountId: r.accountId,
                networkId: r.networkId,
              })]: r.tokenListValue,
            };
          }
          tokenListValue = new BigNumber(tokenListValue)
            .plus(r.tokenListValue ?? '0')
            .toFixed();
          return {
            tokens: {
              data: r.tokenList,
              keys: '',
              map: r.tokenListMap,
            },
            smallBalanceTokens: {
              data: r.smallBalanceTokenList,
              keys: '',
              map: r.tokenListMap,
            },
            riskTokens: {
              data: r.riskyTokenList,
              keys: '',
              map: r.tokenListMap,
            },
          };
        });

        const tokenListData = getMergedDeriveTokenData({
          data: params,
          mergeDeriveAssetsEnabled: true,
        });

        tokenList = tokenListData.tokenList.tokens;
        smallBalanceTokenList =
          tokenListData.smallBalanceTokenList.smallBalanceTokens;
        riskyTokenList = tokenListData.riskyTokenList.riskyTokens;
        tokenListMap = tokenListData.allTokenListMap;
      } else {
        const localTokens =
          await backgroundApiProxy.serviceToken.getAccountLocalTokens({
            accountId,
            networkId,
            accountAddress,
            xpub,
          });

        tokenList = localTokens.tokenList;
        smallBalanceTokenList = localTokens.smallBalanceTokenList;
        riskyTokenList = localTokens.riskyTokenList;
        tokenListMap = localTokens.tokenListMap;
        tokenListValue = localTokens.tokenListValue;
        tokenListWorth = {
          [accountUtils.buildAccountValueKey({
            accountId,
            networkId,
          })]: localTokens.tokenListValue,
        };
      }

      if (
        isEmpty(tokenList) &&
        isEmpty(smallBalanceTokenList) &&
        isEmpty(riskyTokenList)
      ) {
        perfTokenListView.markStart('tokenListRefreshing_2');
        updateTokenListState({
          initialized: false,
          isRefreshing: true,
        });
        updateAccountOverviewState({
          initialized: false,
          isRefreshing: true,
        });
        if (networkId !== networkIdsMap.onekeyall) {
          handleClearAllNetworkData();
        }
      } else {
        updateAccountWorth({
          accountId: mergeDeriveAddressData
            ? indexedAccount?.id ?? ''
            : account?.id ?? '',
          initialized: true,
          worth: tokenListWorth,
          createAtNetworkWorth: tokenListValue,
          merge: false,
        });
        refreshTokenList({
          tokens: tokenList,
          keys: `${accountId}_${networkId}_local`,
        });
        refreshTokenListMap({
          tokens: tokenListMap,
        });

        refreshSmallBalanceTokenList({
          smallBalanceTokens: smallBalanceTokenList,
          keys: `${accountId}_${networkId}_local`,
        });
        refreshSmallBalanceTokenListMap({
          tokens: tokenListMap,
        });

        refreshRiskyTokenList({
          riskyTokens: riskyTokenList,
          keys: `${accountId}_${networkId}_local`,
        });
        refreshRiskyTokenListMap({
          tokens: tokenListMap,
        });

        refreshAllTokenList({
          keys: `${accountId}_${networkId}_local`,
          tokens: [...tokenList, ...smallBalanceTokenList, ...riskyTokenList],
          accountId: account?.id,
          networkId: network?.id,
        });
        refreshAllTokenListMap({
          tokens: tokenListMap,
        });

        updateAccountOverviewState({
          isRefreshing: false,
          initialized: true,
        });

        perfTokenListView.markEnd('tokenListRefreshing_initTokenListData');
        updateTokenListState({
          initialized: true,
          isRefreshing: false,
        });

        appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
          isRefreshing: true,
          type: EHomeTab.TOKENS,
          accountId,
          networkId,
        });
      }
    };

    if ((account?.id || mergeDeriveAddressData) && network?.id && wallet?.id) {
      void initTokenListData({
        accountId: account?.id ?? '',
        networkId: network.id,
        accountAddress: account?.address ?? '',
        // @ts-expect-error
        xpub: account?.xpubSegwit || account?.xpub,
      });
    }
  }, [
    account?.address,
    account?.id,
    // @ts-expect-error
    account?.xpub,
    // @ts-expect-error
    account?.xpubSegwit,
    handleClearAllNetworkData,
    indexedAccount?.id,
    mergeDeriveAddressData,
    network?.id,
    refreshAllTokenList,
    refreshAllTokenListMap,
    refreshRiskyTokenList,
    refreshRiskyTokenListMap,
    refreshSmallBalanceTokenList,
    refreshSmallBalanceTokenListMap,
    refreshTokenList,
    refreshTokenListMap,
    updateAccountOverviewState,
    updateAccountWorth,
    updateSearchKey,
    updateTokenListState,
    wallet?.id,
  ]);

  useEffect(() => {
    void updateAllNetworksTokenList();
  }, [updateAllNetworksTokenList]);

  useEffect(() => {
    if (isHeaderRefreshing) {
      void run();
    }
  }, [isHeaderRefreshing, run]);

  const handleOnPressToken = useCallback(
    (token: IAccountToken) => {
      if (!network || !wallet || !deriveInfo || !deriveType) return;

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
          aggregateTokens: aggregateTokenListMapAtom[token.$key]?.tokens ?? [],
          tokenMap: tokenListMapAtom,
        },
      });
    },
    [
      account?.address,
      account?.id,
      aggregateTokenListMapAtom,
      deriveInfo,
      deriveType,
      indexedAccount?.id,
      navigation,
      network,
      tokenListMapAtom,
      wallet,
    ],
  );

  const handleRefreshAllNetworkData = useCallback(() => {
    isAllNetworkManualRefresh.current = true;
    void runAllNetworksRequests({ alwaysSetState: true });
  }, [runAllNetworksRequests]);

  useEffect(() => {
    const fn = () => {
      if (network?.isAllNetworks) {
        void runAllNetworksRequests({ alwaysSetState: true });
      }
    };
    appEventBus.on(EAppEventBusNames.AddDBAccountsToWallet, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.AddDBAccountsToWallet, fn);
    };
  }, [network?.isAllNetworks, runAllNetworksRequests]);

  const handleRefreshAllNetworkDataByAccounts = useCallback(
    async (accounts: { accountId: string; networkId: string }[]) => {
      for (const { accountId, networkId } of accounts) {
        await handleAllNetworkRequests({
          accountId,
          networkId,
          allNetworkDataInit: false,
        });
      }
    },
    [handleAllNetworkRequests],
  );

  usePromiseResult(
    async () => {
      if (!account || !network) return;

      if (!network.isAllNetworks) return;

      if (isNil(allNetworkAccounts)) return;

      const pendingTxs =
        await backgroundApiProxy.serviceHistory.getAllNetworksPendingTxs({
          accountId: account.id,
          networkId: network.id,
          allNetworkAccounts,
        });

      if (isEmpty(pendingTxs)) return;

      const r = await backgroundApiProxy.serviceHistory.fetchAccountHistory({
        accountId: account.id,
        networkId: network.id,
      });

      if (r.accountsWithChangedPendingTxs.length > 0) {
        void handleRefreshAllNetworkDataByAccounts(
          r.accountsWithChangedPendingTxs,
        );
      }
    },
    [
      account,
      allNetworkAccounts,
      handleRefreshAllNetworkDataByAccounts,
      network,
    ],
    {
      overrideIsFocused: (isPageFocused) => isPageFocused && isFocused,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_HISTORY,
    },
  );

  useEffect(() => {
    const refresh = (
      params:
        | {
            accounts: { accountId: string; networkId: string }[];
          }
        | undefined,
    ) => {
      if (network?.isAllNetworks) {
        if (params?.accounts) {
          void handleRefreshAllNetworkDataByAccounts(params.accounts);
        } else {
          void handleRefreshAllNetworkData();
        }
      } else {
        void run();
      }
    };

    const fn = () => {
      if (isFocused) {
        refresh(undefined);
      }
    };
    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, fn);
    appEventBus.on(EAppEventBusNames.RefreshTokenList, refresh);
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.RefreshTokenList, refresh);
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, fn);
      appEventBus.off(EAppEventBusNames.NetworkDeriveTypeChanged, fn);
    };
  }, [
    handleRefreshAllNetworkData,
    handleRefreshAllNetworkDataByAccounts,
    isFocused,
    network?.isAllNetworks,
    run,
    runAllNetworksRequests,
  ]);

  useEffect(() => {
    if (isEmptyAccount) {
      perfTokenListView.markEnd('tokenListRefreshing_emptyAccount');
      updateTokenListState({
        initialized: true,
        isRefreshing: false,
      });
      updateAccountOverviewState({
        initialized: true,
        isRefreshing: false,
      });
    }
  }, [isEmptyAccount, updateAccountOverviewState, updateTokenListState]);

  const [allNetworksState] = useAllNetworksStateStateAtom();
  const isAllNetworkEmptyAccount = useMemo(() => {
    if (network?.isAllNetworks) {
      return allNetworksState.visibleCount === 0;
    }
    return false;
  }, [allNetworksState.visibleCount, network?.isAllNetworks]);

  const renderSubTitle = useCallback(() => {
    if (tableLayout) {
      if (!tokenListState.initialized && tokenListState.isRefreshing) {
        return <Skeleton.HeadingLg />;
      }

      return (
        <NumberSizeableTextWrapper
          hideValue
          size="$headingLg"
          color="$textSubdued"
          formatter="value"
          formatterOptions={{
            currency: settings.currencyInfo.symbol,
          }}
        >
          {accountTokensValue}
        </NumberSizeableTextWrapper>
      );
    }

    return null;
  }, [
    tableLayout,
    settings.currencyInfo.symbol,
    accountTokensValue,
    tokenListState.initialized,
    tokenListState.isRefreshing,
  ]);

  const renderHeaderActions = useCallback(() => {
    if (manageTokenEnabled && tableLayout) {
      return (
        <IconButton
          title={intl.formatMessage({
            id: ETranslations.manage_token_title,
          })}
          variant="tertiary"
          icon="SliderHorOutline"
          onPress={handleOnManageToken}
          size="small"
        />
      );
    }

    return null;
  }, [tableLayout, intl, manageTokenEnabled, handleOnManageToken]);

  const renderContent = useCallback(() => {
    return (
      <TokenListView
        limit={6}
        plainMode
        withHeader
        withFooter
        withPrice
        inTabList
        hideValue
        withSwapAction
        accountId={account?.id ?? ''}
        networkId={network?.id ?? ''}
        indexedAccountId={indexedAccount?.id ?? ''}
        allAggregateTokenMap={allAggregateTokenMap}
        showNetworkIcon={!!network?.isAllNetworks}
        hideZeroBalanceTokens={!!network?.isAllNetworks}
        manageTokenEnabled={manageTokenEnabled}
        onManageToken={handleOnManageToken}
        onPressToken={handleOnPressToken}
        isAllNetworks={network?.isAllNetworks}
        homeDefaultTokenMap={homeDefaultTokenMap}
        tableLayout={tableLayout}
        emptyAccountView={
          isAllNetworkEmptyAccount ? (
            <Stack py="$20">
              <EmptyAccount
                createAllDeriveTypes
                createAllEnabledNetworks
                autoCreateAddress={false}
                name={accountName}
                chain={network?.name ?? ''}
                type={
                  (deriveInfo?.labelKey
                    ? intl.formatMessage({
                        id: deriveInfo?.labelKey,
                      })
                    : deriveInfo?.label) ?? ''
                }
              />
            </Stack>
          ) : null
        }
        listViewStyleProps={{
          ListHeaderComponentStyle: {
            pt: '$3',
          },
        }}
      />
    );
  }, [
    account?.id,
    accountName,
    allAggregateTokenMap,
    tableLayout,
    deriveInfo?.label,
    deriveInfo?.labelKey,
    handleOnManageToken,
    handleOnPressToken,
    homeDefaultTokenMap,
    indexedAccount?.id,
    intl,
    isAllNetworkEmptyAccount,
    manageTokenEnabled,
    network?.id,
    network?.isAllNetworks,
    network?.name,
  ]);

  return (
    <RichBlock
      withTitleSeparator
      title={intl.formatMessage({
        id: ETranslations.global_universal_search_tabs_tokens,
      })}
      subTitle={renderSubTitle()}
      headerActions={renderHeaderActions()}
      content={renderContent()}
      plainContentContainer={!tableLayout}
    />
  );
}

export { TokenListBlock };
