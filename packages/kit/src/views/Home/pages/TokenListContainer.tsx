import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CanceledError } from 'axios';
import BigNumber from 'bignumber.js';

import type { ITabPageProps } from '@onekeyhq/components';
import {
  Portal,
  useMedia,
  useOnRouterChange,
  useTabIsRefreshingFocused,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_TOKEN,
} from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAssetSelectorRoutes,
  EModalAssetDetailRoutes,
  EModalRoutes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  getEmptyTokenData,
  mergeDeriveTokenList,
  mergeDeriveTokenListMap,
  sortTokensByFiatValue,
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
import { useBuyToken } from '../../../hooks/useBuyToken';
import { useManageToken } from '../../../hooks/useManageToken';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useReceiveToken } from '../../../hooks/useReceiveToken';
import { useAccountOverviewActions } from '../../../states/jotai/contexts/accountOverview';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useTokenListActions } from '../../../states/jotai/contexts/tokenList';
import { HomeTokenListProviderMirror } from '../components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { UrlAccountHomeTokenListProviderMirror } from '../components/HomeTokenListProvider/UrlAccountHomeTokenListProviderMirror';
import { WalletActions } from '../components/WalletActions';

const networkIdsMap = getNetworkIdsMap();

function TokenListContainer({ showWalletActions = false }: ITabPageProps) {
  const { isFocused, isHeaderRefreshing, setIsHeaderRefreshing } =
    useTabIsRefreshingFocused();

  const {
    activeAccount: {
      account,
      allNetworkDbAccounts,
      network,
      wallet,
      indexedAccount,
      isOthersWallet,
      deriveInfo,
      deriveType,
    },
  } = useActiveAccount({ num: 0 });
  const [shouldAlwaysFetch, setShouldAlwaysFetch] = useState(false);

  const { vaultSettings } = useAccountData({ networkId: network?.id ?? '' });

  const { handleOnBuy, isSupported } = useBuyToken({
    accountId: account?.id ?? '',
    networkId: network?.id ?? '',
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

  const refreshAllNetworksTokenList = useRef(false);

  const media = useMedia();
  const navigation = useAppNavigation();

  useOnRouterChange((state) => {
    const modalRoutes = state?.routes.find(
      ({ name }) => name === ERootRoutes.Modal,
    );

    if (
      // @ts-ignore
      modalRoutes?.params?.screen === EModalRoutes.AssetSelectorModal &&
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      modalRoutes?.params?.params?.screen === EAssetSelectorRoutes.TokenSelector
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
        });

        await backgroundApiProxy.serviceToken.abortFetchAccountTokens();
        const r = await backgroundApiProxy.serviceToken.fetchAccountTokens({
          accountId: account.id,
          mergeTokens: true,
          networkId: network.id,
          flag: 'home-token-list',
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
        refreshSmallBalanceTokensFiatValue(
          r.smallBalanceTokens.fiatValue ?? '0',
        );

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
          appEventBus.emit(EAppEventBusNames.TokenListUpdate, {
            tokens: mergedTokens,
            keys: r.allTokens.keys,
            map: r.allTokens.map,
          });
          updateTokenListState({
            initialized: true,
            isRefreshing: false,
          });
          appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
            isRefreshing: false,
            type: EHomeTab.TOKENS,
          });
        }
      } catch (e) {
        appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
          isRefreshing: false,
          type: EHomeTab.TOKENS,
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
    ],
    {
      overrideIsFocused: (isPageFocused) =>
        (isPageFocused && isFocused) || shouldAlwaysFetch,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_TOKEN,
    },
  );

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
        mergeTokens: true,
      });

      if (
        !allNetworkDataInit &&
        !refreshAllNetworksTokenList.current &&
        r.networkId === networkIdsMap.onekeyall
      ) {
        let accountWorth = new BigNumber(0);
        accountWorth = accountWorth
          .plus(r.tokens.fiatValue ?? '0')
          .plus(r.riskTokens.fiatValue ?? '0')
          .plus(r.smallBalanceTokens.fiatValue ?? '0');

        const mergeDeriveAssetsEnabled = !!(
          await backgroundApiProxy.serviceNetwork.getVaultSettings({
            networkId,
          })
        ).mergeDeriveAssetsEnabled;

        updateAccountOverviewState({
          isRefreshing: false,
          initialized: true,
        });

        updateAccountWorth({
          worth: accountWorth.toFixed(),
          merge: true,
        });

        refreshTokenListMap({
          tokens: r.tokens.map,
          merge: true,
          mergeDerive: mergeDeriveAssetsEnabled,
        });
        refreshTokenList({
          keys: r.tokens.keys,
          tokens: r.tokens.data,
          merge: true,
          map: r.tokens.map,
          mergeDerive: mergeDeriveAssetsEnabled,
        });

        refreshSmallBalanceTokenListMap({
          tokens: r.smallBalanceTokens.map,
          merge: true,
          mergeDerive: mergeDeriveAssetsEnabled,
        });
        refreshSmallBalanceTokenList({
          keys: r.smallBalanceTokens.keys,
          smallBalanceTokens: r.smallBalanceTokens.data,
          merge: true,
          map: r.smallBalanceTokens.map,
          mergeDerive: mergeDeriveAssetsEnabled,
        });

        refreshRiskyTokenListMap({
          tokens: r.riskTokens.map,
          merge: true,
          mergeDerive: mergeDeriveAssetsEnabled,
        });
        refreshRiskyTokenList({
          keys: r.riskTokens.keys,
          riskyTokens: r.riskTokens.data,
          merge: true,
          map: r.riskTokens.map,
          mergeDerive: mergeDeriveAssetsEnabled,
        });

        updateTokenListState({
          initialized: true,
          isRefreshing: false,
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

          appEventBus.emit(EAppEventBusNames.TokenListUpdate, {
            tokens: r.allTokens.data,
            keys: r.allTokens.keys,
            map: r.allTokens.map,
            merge: true,
          });
        }
      }

      return r;
    },
    [
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
      updateTokenListState,
    ],
  );

  const handleClearAllNetworkData = useCallback(() => {
    const emptyTokens = getEmptyTokenData();

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
    refreshTokenList,
    refreshTokenListMap,
  ]);

  const handleAllNetworkRequestsFinished = useCallback(() => {
    appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
      isRefreshing: false,
      type: EHomeTab.TOKENS,
    });
  }, []);

  const handleAllNetworkRequestsStarted = useCallback(() => {
    appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
      isRefreshing: true,
      type: EHomeTab.TOKENS,
    });
  }, []);

  const { run: runAllNetworksRequests, result: allNetworksResult } =
    useAllNetworkRequests<IFetchAccountTokensResp>({
      allNetworkDbAccounts,
      network,
      wallet,
      allNetworkRequests: handleAllNetworkRequests,
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

    if (refreshAllNetworksTokenList.current && allNetworksResult) {
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
      }

      tokenList.tokens = sortTokensByFiatValue({
        tokens: tokenList.tokens,
        map: tokenListMap,
      });

      smallBalanceTokenList.smallBalanceTokens = sortTokensByFiatValue({
        tokens: smallBalanceTokenList.smallBalanceTokens,
        map: smallBalanceTokenListMap,
      });

      riskyTokenList.riskyTokens = sortTokensByFiatValue({
        tokens: riskyTokenList.riskyTokens,
        map: riskyTokenListMap,
      });

      updateAccountWorth({ worth: accountWorth.toFixed() });

      refreshTokenList(tokenList);
      refreshTokenListMap({
        tokens: tokenListMap,
      });

      refreshSmallBalanceTokenList(smallBalanceTokenList);
      refreshSmallBalanceTokenListMap({
        tokens: smallBalanceTokenListMap,
      });

      refreshRiskyTokenList(riskyTokenList);
      refreshRiskyTokenListMap({
        tokens: riskyTokenListMap,
      });
    }
  }, [
    allNetworksResult,
    refreshRiskyTokenList,
    refreshRiskyTokenListMap,
    refreshSmallBalanceTokenList,
    refreshSmallBalanceTokenListMap,
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
    if (account?.id && network?.id && wallet?.id) {
      updateTokenListState({
        initialized: false,
        isRefreshing: true,
      });
      updateSearchKey('');
      refreshAllNetworksTokenList.current = false;
      void backgroundApiProxy.serviceToken.updateCurrentNetworkId({
        networkId: network.id,
      });
      if (network.id !== networkIdsMap.onekeyall) {
        handleClearAllNetworkData();
      }
    }
  }, [
    account?.id,
    handleClearAllNetworkData,
    network?.id,
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
    refreshAllNetworksTokenList.current = true;
    void runAllNetworksRequests();
  }, [runAllNetworksRequests]);

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
    <>
      {showWalletActions ? (
        <Portal.Body container={Portal.Constant.WALLET_ACTIONS}>
          <WalletActions
            pt="$5"
            $gtLg={{
              pt: 0,
            }}
          />
        </Portal.Body>
      ) : null}
      <TokenListView
        withHeader
        withFooter
        withPrice
        inTabList
        withBuyAndReceive={isBuyAndReceiveEnabled}
        isBuyTokenSupported={isSupported}
        onBuyToken={handleOnBuy}
        onReceiveToken={handleOnReceive}
        manageTokenEnabled={manageTokenEnabled}
        onManageToken={handleOnManageToken}
        onPressToken={handleOnPressToken}
        isAllNetworks={network?.isAllNetworks}
        {...(media.gtLg && {
          tableLayout: true,
        })}
      />
    </>
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
