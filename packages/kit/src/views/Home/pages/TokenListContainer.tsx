import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CanceledError } from 'axios';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil, uniqBy } from 'lodash';
import { useThrottledCallback } from 'use-debounce';

import type { ITabPageProps } from '@onekeyhq/components';
import {
  useMedia,
  useOnRouterChange,
  useTabIsRefreshingFocused,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useFiatCrypto } from '@onekeyhq/kit/src/views/FiatCrypto/hooks';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { ICustomTokenDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityCustomTokens';
import type { ISimpleDBLocalTokens } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityLocalTokens';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
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
import {
  EModalAssetDetailRoutes,
  EModalReceiveRoutes,
  EModalRoutes,
  EModalSendRoutes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import perfUtils, {
  EPerformanceTimerLogNames,
} from '@onekeyhq/shared/src/utils/debug/perfUtils';
import {
  getEmptyTokenData,
  mergeDeriveTokenList,
  mergeDeriveTokenListMap,
  sortTokensByFiatValue,
  sortTokensByOrder,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import { EHomeTab } from '@onekeyhq/shared/types';
import type {
  IAccountToken,
  IFetchAccountTokensResp,
  IToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { TokenListView } from '../../../components/TokenListView';
import { perfTokenListView } from '../../../components/TokenListView/perfTokenListView';
import { useAccountData } from '../../../hooks/useAccountData';
import { useAllNetworkRequests } from '../../../hooks/useAllNetwork';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useManageToken } from '../../../hooks/useManageToken';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useReceiveToken } from '../../../hooks/useReceiveToken';
import { useAccountOverviewActions } from '../../../states/jotai/contexts/accountOverview';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useTokenListActions } from '../../../states/jotai/contexts/tokenList';
import { HomeTokenListProviderMirrorWrapper } from '../components/HomeTokenListProvider';

const networkIdsMap = getNetworkIdsMap();

function TokenListContainer(props: ITabPageProps) {
  const { isFocused, isHeaderRefreshing, setIsHeaderRefreshing } =
    useTabIsRefreshingFocused();

  const {
    activeAccount: {
      account,
      network,
      wallet,
      indexedAccount,
      isOthersWallet,
      deriveInfo,
      deriveType,
    },
  } = useActiveAccount({ num: 0 });
  const [shouldAlwaysFetch, setShouldAlwaysFetch] = useState(false);
  const [allNetworkAccounts, setAllNetworkAccounts] = useState<
    IAllNetworkAccountInfo[] | undefined
  >(undefined);

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

  const { vaultSettings } = useAccountData({ networkId: network?.id ?? '' });

  const { handleFiatCrypto, isSupported } = useFiatCrypto({
    accountId: account?.id ?? '',
    networkId: network?.id ?? '',
    fiatCryptoType: 'buy',
  });
  const { handleOnReceive } = useReceiveToken({
    accountId: account?.id ?? '',
    networkId: network?.id ?? '',
    walletId: wallet?.id ?? '',
    deriveInfo,
    deriveType,
  });

  const { handleOnManageToken, manageTokenEnabled } = useManageToken({
    accountId: account?.id ?? '',
    networkId: network?.id ?? '',
    walletId: wallet?.id ?? '',
    deriveType,
    indexedAccountId: indexedAccount?.id,
    isOthersWallet,
  });

  const media = useMedia();
  const navigation = useAppNavigation();

  useOnRouterChange((state) => {
    const modalRoutes = state?.routes.find(
      ({ name }) => name === ERootRoutes.Modal,
    );

    if (
      // @ts-ignore
      (modalRoutes?.params?.screen === EModalRoutes.SendModal &&
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        modalRoutes?.params?.params?.screen ===
          EModalSendRoutes.SendSelectToken) ||
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
    updateTokenListState,
    updateSearchKey,
  } = useTokenListActions().current;

  const {
    updateAccountWorth,
    updateAccountOverviewState,
    updateAllNetworksState,
  } = useAccountOverviewActions().current;

  const { run } = usePromiseResult(
    async () => {
      try {
        if (!account || !network) return;

        if (network.isAllNetworks) return;

        appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
          isRefreshing: true,
          type: EHomeTab.TOKENS,
          accountId: account.id,
          networkId: network.id,
        });

        await backgroundApiProxy.serviceToken.abortFetchAccountTokens();
        const r = await backgroundApiProxy.serviceToken.fetchAccountTokens({
          accountId: account.id,
          mergeTokens: true,
          networkId: network.id,
          flag: 'home-token-list',
          saveToLocal: true,
        });

        let accountWorth = new BigNumber(0);
        accountWorth = accountWorth
          .plus(r.tokens.fiatValue ?? '0')
          .plus(r.riskTokens.fiatValue ?? '0')
          .plus(r.smallBalanceTokens.fiatValue ?? '0');

        updateAccountOverviewState({
          isRefreshing: false,
          initialized: true,
        });

        updateAccountWorth({
          accountId: account.id,
          initialized: true,
          worth: {
            [accountUtils.buildAccountValueKey({
              accountId: account.id,
              networkId: network.id,
            })]: accountWorth.toFixed(),
          },
          createAtNetworkWorth: accountWorth.toFixed(),
          merge: false,
        });

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
            accountId: account.id,
            networkId: network.id,
          });
        }
      } catch (e) {
        appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
          isRefreshing: false,
          type: EHomeTab.TOKENS,
          accountId: account?.id ?? '',
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
      refreshTokenList,
      refreshTokenListMap,
      refreshRiskyTokenList,
      refreshRiskyTokenListMap,
      refreshSmallBalanceTokenList,
      refreshSmallBalanceTokenListMap,
      refreshSmallBalanceTokensFiatValue,
      refreshAllTokenList,
      refreshAllTokenListMap,
      updateTokenListState,
      setIsHeaderRefreshing,
      updateAccountOverviewState,
      updateAccountWorth,
    ],
    {
      overrideIsFocused: (isPageFocused) =>
        (isPageFocused && isFocused) || shouldAlwaysFetch,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_TOKEN,
    },
  );

  const isAllNetworkManualRefresh = useRef(false);

  const updateAllNetworkData = useThrottledCallback(() => {
    refreshTokenList({
      keys: tokenListRef.current.keys,
      tokens: tokenListRef.current.tokens,
      merge: true,
      map: tokenListRef.current.map,
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
  }, 1000);

  const handleAllNetworkRequests = useCallback(
    async ({
      accountId,
      networkId,
      dbAccount,
      allNetworkDataInit,
      customTokensRawData,
    }: {
      accountId: string;
      networkId: string;
      dbAccount?: IDBAccount;
      allNetworkDataInit?: boolean;
      customTokensRawData?: ICustomTokenDBStruct;
    }) => {
      const r = await backgroundApiProxy.serviceToken.fetchAccountTokens({
        dbAccount,
        networkId,
        accountId,
        flag: 'home-token-list',
        isAllNetworks: true,
        isManualRefresh: isAllNetworkManualRefresh.current,
        mergeTokens: true,
        allNetworksAccountId: account?.id,
        allNetworksNetworkId: network?.id,
        saveToLocal: true,
        customTokensRawData,
      });

      if (!allNetworkDataInit && r.isSameAllNetworksAccountData) {
        let accountWorth = new BigNumber(0);
        let createAtNetworkWorth = new BigNumber(0);
        accountWorth = accountWorth
          .plus(r.tokens.fiatValue ?? '0')
          .plus(r.riskTokens.fiatValue ?? '0')
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
      network?.id,
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
    ({ accountId, networkId }: { accountId?: string; networkId?: string }) => {
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
    ({ accountId, networkId }: { accountId?: string; networkId?: string }) => {
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
      simpleDbLocalTokensRawData,
    }: {
      accountId: string;
      networkId: string;
      xpub?: string;
      accountAddress: string;
      simpleDbLocalTokensRawData?: ISimpleDBLocalTokens;
    }) => {
      const perf = perfUtils.createPerf({
        name: EPerformanceTimerLogNames.allNetwork__handleAllNetworkCacheRequests,
      });

      perf.markStart('getAccountLocalTokens', {
        networkId,
        accountAddress,
        rawDataExist: !!simpleDbLocalTokensRawData,
      });
      const localTokens =
        await backgroundApiProxy.serviceToken.getAccountLocalTokens({
          accountId,
          networkId,
          accountAddress,
          xpub,
          simpleDbLocalTokensRawData,
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
    ({
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

      const tokenList: IAccountToken[] = [];
      const riskyTokenList: IAccountToken[] = [];
      let tokenListMap: {
        [key: string]: ITokenFiat;
      } = {};
      let tokenListValue: Record<string, string> = {};
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
        map: tokenListMap,
        mergeDerive: true,
        split: true,
      });

      refreshRiskyTokenList({
        keys: `${accountId}_${networkId}_local_all`,
        riskyTokens: riskyTokenList,
        merge: true,
        map: tokenListMap,
        mergeDerive: true,
      });

      refreshAllTokenList({
        keys: `${accountId}_${networkId}_local_all`,
        tokens: [...tokenList, ...riskyTokenList],
        map: tokenListMap,
        merge: true,
        mergeDerive: true,
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

    if (allNetworksResult) {
      for (const r of allNetworksResult) {
        let mergeDeriveAssetsEnabled;

        try {
          mergeDeriveAssetsEnabled = (
            await backgroundApiProxy.serviceNetwork.getVaultSettings({
              networkId: r.networkId ?? '',
            })
          ).mergeDeriveAssetsEnabled;
        } catch (e) {
          mergeDeriveAssetsEnabled = false;
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

        const accountWorth = new BigNumber(r.tokens.fiatValue ?? '0')
          .plus(r.riskTokens.fiatValue ?? '0')
          .plus(r.smallBalanceTokens.fiatValue ?? '0');

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
            .plus(r.riskTokens.fiatValue ?? '0')
            .plus(r.smallBalanceTokens.fiatValue ?? '0');
        }
      }

      const mergeTokenListMap = {
        ...tokenListMap,
        ...smallBalanceTokenListMap,
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
        tokens: [...tokenList.tokens, ...riskyTokenList.riskyTokens],
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
    refreshAllTokenList,
    refreshAllTokenListMap,
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
    void updateAllNetworksTokenList();
  }, [updateAllNetworksTokenList]);

  useEffect(() => {
    if (isHeaderRefreshing) {
      void run();
    }
  }, [isHeaderRefreshing, run]);

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
        return;
      }
      const localTokens =
        await backgroundApiProxy.serviceToken.getAccountLocalTokens({
          accountId,
          networkId,
          accountAddress,
          xpub,
        });

      const {
        tokenList,
        smallBalanceTokenList,
        riskyTokenList,
        tokenListMap,
        tokenListValue,
      } = localTokens;

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
          accountId,
          initialized: true,
          worth: {
            [accountUtils.buildAccountValueKey({
              accountId,
              networkId,
            })]: tokenListValue,
          },
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

    if (account?.id && network?.id && wallet?.id) {
      void initTokenListData({
        accountId: account.id,
        networkId: network.id,
        accountAddress: account.address,
        // @ts-expect-error
        xpub: account.xpubSegwit || account.xpub,
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

  const handleOnPressToken = useCallback(
    (token: IToken) => {
      if (!account || !network || !wallet || !deriveInfo) return;
      navigation.pushModal(EModalRoutes.MainModal, {
        screen: EModalAssetDetailRoutes.TokenDetails,
        params: {
          accountId: token.accountId ?? account.id,
          networkId: token.networkId ?? network.id,
          walletId: wallet.id,
          deriveInfo,
          deriveType,
          tokenInfo: token,
          isAllNetworks: network.isAllNetworks,
        },
      });
    },
    [account, deriveInfo, deriveType, navigation, network, wallet],
  );

  const isBuyAndReceiveEnabled = useMemo(
    () =>
      !vaultSettings?.disabledSendAction &&
      wallet?.type !== WALLET_TYPE_WATCHING,
    [vaultSettings?.disabledSendAction, wallet?.type],
  );

  const handleRefreshAllNetworkData = useCallback(() => {
    isAllNetworkManualRefresh.current = true;
    void runAllNetworksRequests({ alwaysSetState: true });
  }, [runAllNetworksRequests]);

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

  return (
    <TokenListView
      withHeader
      withFooter
      withPrice
      inTabList
      hideValue
      withBuyAndReceive={isBuyAndReceiveEnabled}
      isBuyTokenSupported={isSupported}
      onBuyToken={handleFiatCrypto}
      onReceiveToken={handleOnReceive}
      manageTokenEnabled={manageTokenEnabled}
      onManageToken={handleOnManageToken}
      onPressToken={handleOnPressToken}
      isAllNetworks={network?.isAllNetworks}
      {...(media.gtLg && {
        tableLayout: true,
      })}
    />
  );
}

const TokenListContainerWithProvider = memo((props: ITabPageProps) => {
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });

  return (
    <HomeTokenListProviderMirrorWrapper accountId={account?.id ?? ''}>
      <TokenListContainer showWalletActions {...props} />
      {/* <TokenListContainerPerfTest showWalletActions {...props} /> */}
    </HomeTokenListProviderMirrorWrapper>
  );
});
TokenListContainerWithProvider.displayName = 'TokenListContainerWithProvider';

export { TokenListContainerWithProvider };
