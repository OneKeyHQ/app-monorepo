import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CanceledError } from 'axios';
import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';
import { useThrottledCallback } from 'use-debounce';

import type { ITabPageProps } from '@onekeyhq/components';
import {
  useMedia,
  useOnRouterChange,
  useTabIsRefreshingFocused,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useFiatCrypto } from '@onekeyhq/kit/src/views/FiatCrypto/hooks';
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
import { useAccountData } from '../../../hooks/useAccountData';
import { useAllNetworkRequests } from '../../../hooks/useAllNetwork';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useManageToken } from '../../../hooks/useManageToken';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useReceiveToken } from '../../../hooks/useReceiveToken';
import { useAccountOverviewActions } from '../../../states/jotai/contexts/accountOverview';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useTokenListActions } from '../../../states/jotai/contexts/tokenList';
import { HomeTokenListProviderMirror } from '../components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { UrlAccountHomeTokenListProviderMirror } from '../components/HomeTokenListProvider/UrlAccountHomeTokenListProviderMirror';

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

  const { updateAccountWorth, updateAccountOverviewState } =
    useAccountOverviewActions().current;

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
          worth: accountWorth.toFixed(),
          createAtNetworkWorth: accountWorth.toFixed(),
          merge: false,
        });

        refreshTokenList({ keys: r.tokens.keys, tokens: r.tokens.data });
        refreshTokenListMap({
          tokens: r.tokens.map,
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
      allNetworkDataInit,
    }: {
      accountId: string;
      networkId: string;
      allNetworkDataInit?: boolean;
    }) => {
      const r = await backgroundApiProxy.serviceToken.fetchAccountTokens({
        networkId,
        accountId,
        flag: 'home-token-list',
        isAllNetworks: true,
        isManualRefresh: isAllNetworkManualRefresh.current,
        mergeTokens: true,
        allNetworksAccountId: account?.id,
        allNetworksNetworkId: network?.id,
        saveToLocal: true,
      });

      if (!allNetworkDataInit && r.isSameAllNetworksAccountData) {
        let accountWorth = new BigNumber(0);
        let createAtNetworkWorth = new BigNumber(0);
        accountWorth = accountWorth
          .plus(r.tokens.fiatValue ?? '0')
          .plus(r.riskTokens.fiatValue ?? '0')
          .plus(r.smallBalanceTokens.fiatValue ?? '0');

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
          worth: accountWorth.toFixed(),
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
    }: {
      accountId: string;
      networkId: string;
      xpub?: string;
      accountAddress: string;
    }) => {
      const localTokens =
        await backgroundApiProxy.serviceToken.getAccountLocalTokens({
          accountId,
          networkId,
          accountAddress,
          xpub,
        });

      const { tokenList, smallBalanceTokenList, riskyTokenList } = localTokens;

      if (
        isEmpty(tokenList) &&
        isEmpty(riskyTokenList) &&
        isEmpty(smallBalanceTokenList)
      ) {
        return null;
      }

      return localTokens;
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
      }[];
      accountId: string;
      networkId: string;
    }) => {
      const tokenList: IAccountToken[] = [];
      const riskyTokenList: IAccountToken[] = [];
      let tokenListMap: {
        [key: string]: ITokenFiat;
      } = {};
      let tokenListValue = new BigNumber(0);
      data.forEach((item) => {
        tokenList.push(...item.tokenList, ...item.smallBalanceTokenList);
        riskyTokenList.push(...item.riskyTokenList);
        tokenListMap = {
          ...tokenListMap,
          ...item.tokenListMap,
        };
        tokenListValue = tokenListValue.plus(item.tokenListValue ?? 0);
      });

      refreshTokenListMap({
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
          worth: tokenListValue.toFixed(),
        });
        updateAccountOverviewState({
          isRefreshing: false,
          initialized: true,
        });
        updateTokenListState({
          initialized: true,
          isRefreshing: false,
        });
      }
    },
    [
      account?.id,
      refreshAllTokenList,
      refreshAllTokenListMap,
      refreshRiskyTokenList,
      refreshRiskyTokenListMap,
      refreshTokenList,
      refreshTokenListMap,
      updateAccountOverviewState,
      updateAccountWorth,
      updateTokenListState,
    ],
  );

  const { run: runAllNetworksRequests, result: allNetworksResult } =
    useAllNetworkRequests<IFetchAccountTokensResp>({
      account,
      network,
      wallet,
      allNetworkRequests: handleAllNetworkRequests,
      allNetworkCacheRequests: handleAllNetworkCacheRequests,
      allNetworkCacheData: handleAllNetworkCacheData,
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
    let accountWorth = new BigNumber(0);
    let createAtNetworkWorth = new BigNumber(0);
    let smallBalanceTokensFiatValue = new BigNumber(0);

    if (allNetworksResult) {
      for (const r of allNetworksResult) {
        const mergeDeriveAssetsEnabled = (
          await backgroundApiProxy.serviceNetwork.getVaultSettings({
            networkId: r.networkId ?? '',
          })
        ).mergeDeriveAssetsEnabled;

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

        accountWorth = accountWorth
          .plus(r.tokens.fiatValue ?? '0')
          .plus(r.riskTokens.fiatValue ?? '0')
          .plus(r.smallBalanceTokens.fiatValue ?? '0');

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
        worth: accountWorth.toFixed(),
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
    }
  }, [
    account?.createAtNetwork,
    account?.id,
    allNetworksResult,
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
    const initTokenListState = async (accountId: string, networkId: string) => {
      updateSearchKey('');
      void backgroundApiProxy.serviceToken.updateCurrentAccount({
        networkId,
        accountId,
      });

      if (networkId === networkIdsMap.onekeyall) {
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

        updateAccountWorth({
          accountId,
          initialized: true,
          worth: tokenListValue,
          createAtNetworkWorth: tokenListValue,
          merge: false,
        });
        updateAccountOverviewState({
          isRefreshing: false,
          initialized: true,
        });

        updateTokenListState({
          initialized: true,
          isRefreshing: false,
        });
      }
    };

    if (account?.id && network?.id && wallet?.id) {
      void initTokenListState(account.id, network.id);
    }
  }, [
    account?.id,
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

  usePromiseResult(
    async () => {
      if (!account || !network) return;

      if (!network.isAllNetworks) return;

      const pendingTxs =
        await backgroundApiProxy.serviceHistory.getAllNetworksPendingTxs({
          accountId: account.id,
          networkId: network.id,
        });

      if (isEmpty(pendingTxs)) return;

      const r = await backgroundApiProxy.serviceHistory.fetchAccountHistory({
        accountId: account.id,
        networkId: network.id,
      });

      if (r.pendingTxsUpdated) {
        handleRefreshAllNetworkData();
      }
    },
    [account, handleRefreshAllNetworkData, network],
    {
      overrideIsFocused: (isPageFocused) => isPageFocused && isFocused,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_HISTORY,
    },
  );

  useEffect(() => {
    const refresh = () => {
      if (network?.isAllNetworks) {
        void handleRefreshAllNetworkData();
      } else {
        void run();
      }
    };

    const fn = () => {
      if (isFocused) {
        refresh();
      }
    };
    appEventBus.on(EAppEventBusNames.RefreshTokenList, refresh);
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.RefreshTokenList, refresh);
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, fn);
    };
  }, [
    handleRefreshAllNetworkData,
    isFocused,
    network?.isAllNetworks,
    run,
    runAllNetworksRequests,
  ]);

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
  const isUrlAccount = accountUtils.isUrlAccountFn({
    accountId: account?.id ?? '',
  });
  return isUrlAccount ? (
    <UrlAccountHomeTokenListProviderMirror>
      <TokenListContainer showWalletActions {...props} />
    </UrlAccountHomeTokenListProviderMirror>
  ) : (
    <HomeTokenListProviderMirror>
      <TokenListContainer showWalletActions {...props} />
    </HomeTokenListProviderMirror>
  );
});
TokenListContainerWithProvider.displayName = 'TokenListContainerWithProvider';

export { TokenListContainerWithProvider };
