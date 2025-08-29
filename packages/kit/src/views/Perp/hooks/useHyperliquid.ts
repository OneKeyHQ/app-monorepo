import { useCallback, useEffect, useState } from 'react';
import { useAtom } from 'jotai';

import { useActiveAccount, useSelectedAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import {
  EAppEventBusNames,
  appEventBus
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IHLActiveAssetData, IHLHex, IHLWsActiveAssetCtx, IHLWsAllMids, IHLWsWebData2 } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  allMidsAtom,
  activeAssetCtxAtom,
  activeAssetDataAtom,
  connectionStateAtom,
  currentTokenAtom,
  currentUserAtom,
  subscriptionActiveAtom,
  useWebData2Atom,
  currentAccountAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/index';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ZeroAddress } from 'ethersV6';

export function useHyperliquidEventBusListener() {
  const actions = useHyperliquidActions();

  useEffect(() => {
    const handleDataUpdate = (payload: unknown) => {
      const eventPayload = payload as {
        type: 'market' | 'account';
        subType: string;
        data: any;
        metadata: {
          timestamp: number;
          source: string;
          key?: string;
          coin?: string;
          userId?: string;
          interval?: string;
        };
      };
      const { type, subType, data, metadata } = eventPayload;

      try {
        switch (subType) {
          case 'allMids':
            void actions.current.updateAllMids(data as IHLWsAllMids);
            break;

          case 'activeAssetCtx':
            void actions.current.updateActiveAssetCtx(data as IHLWsActiveAssetCtx);
            break;

          case 'webData2':
            void actions.current.updateWebData2(data as IHLWsWebData2);
            break;

          case 'activeAssetData':
            void actions.current.updateActiveAssetData(data as IHLActiveAssetData);
            break;

          case 'l2Book':
            break;

          case 'bbo':
            break;

          case 'candles':
            break;

          case 'trades':
            console.log('Trades data received:', { coin: metadata.coin, data });
            break;

          case 'userEvents':
            break;

          default:
        }
      } catch (error) {
        console.error('Failed to process data update:', error);
      }
    };

    const handleConnectionChange = (payload: unknown) => {
      const eventPayload = payload as {
        type: 'connection';
        subType: string;
        data: {
          status: 'connected' | 'disconnected';
          lastConnected: number;
          service: string;
          activeSubscriptions: number;
        };
        metadata: {
          timestamp: number;
          source: string;
        };
      };
      const { data } = eventPayload;

      try {
        void actions.current.updateConnectionState({
          isConnected: data.status === 'connected',
        });
      } catch (error) {
        console.error('Failed to process connection change:', error);
      }
    };

    appEventBus.on(EAppEventBusNames.HyperliquidDataUpdate, handleDataUpdate);
    appEventBus.on(EAppEventBusNames.HyperliquidConnectionChange, handleConnectionChange);

    return () => {
      appEventBus.off(EAppEventBusNames.HyperliquidDataUpdate, handleDataUpdate);
      appEventBus.off(EAppEventBusNames.HyperliquidConnectionChange, handleConnectionChange);
    };
  }, [actions]);
}

export function useHyperliquidSession() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const actions = useHyperliquidActions();
  const [subscriptionActive] = useAtom(subscriptionActiveAtom());
  const [connectionState] = useAtom(connectionStateAtom());

  useHyperliquidEventBusListener();

  const { result: ethAccountData } = usePromiseResult(
    async () => {
      if (!activeAccount?.account?.id) return null;

      const ethNetworkId = 'evm--1';
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId: activeAccount.account.id,
        networkId: ethNetworkId,
      });

      return account;
    },
    [activeAccount?.account?.id],
  );
  let userAddress = ethAccountData?.address as IHLHex | undefined;
  useEffect(() => {
    if (userAddress?.startsWith('0x')) {
      void actions.current.setCurrentUser(userAddress);
      void actions.current.setCurrentAccount(activeAccount.account!.id);
    }
  }, [userAddress, actions]);

  useEffect(() => {
    if (!subscriptionActive) {
      void actions.current.setCurrentToken('ETH');
    }
  }, [subscriptionActive, actions]);

  useListenTabFocusState(
    ETabRoutes.Perp,
    (isFocus: boolean, isHiddenByModal: boolean) => {
      if (isFocus && !isHiddenByModal) {
      } else {
      }
    }
  );

  useEffect(() => {
    return () => {
      void actions.current.clearAllData();
    };
  }, [actions]);

  return {
    userAddress: activeAccount?.account?.address as IHLHex | undefined,
    isConnected: connectionState.isConnected,
    isActive: subscriptionActive,
  };
}

export function useHyperliquidMarket() {
  const [allMids] = useAtom(allMidsAtom());
  const [currentToken] = useAtom(currentTokenAtom());
  const [activeAssetCtx] = useAtom(activeAssetCtxAtom());
  const [connectionState] = useAtom(connectionStateAtom());

  const currentAssetCtx = activeAssetCtx;

  return {
    allMids,
    currentToken,
    currentAssetCtx,
    isConnected: connectionState.isConnected,
    hasMarketData: !!allMids,
  };
}

export function useHyperliquidAccount() {
  const [webData2] = useWebData2Atom();
  const currentUser = webData2?.user === ZeroAddress ? null : webData2?.user;
  const userPositions = webData2?.clearinghouseState.assetPositions || [];

  const accountSummary = {
    accountValue: webData2?.clearinghouseState.marginSummary.accountValue,
    totalMarginUsed: webData2?.clearinghouseState.marginSummary.totalMarginUsed,
    totalNtlPos: webData2?.clearinghouseState.marginSummary.totalNtlPos,
    totalRawUsd: webData2?.clearinghouseState.marginSummary.totalRawUsd,
    withdrawable: webData2?.clearinghouseState.withdrawable,
  };

  const [activeAssetData] = useAtom(activeAssetDataAtom());

  const userWebData2 = webData2;
  const hasUserData = !!currentUser && !!userWebData2;

  return {
    currentUser,
    userWebData2,
    userPositions,
    accountSummary,
    activeAssetData,
    hasUserData,
    isLoggedIn: !!currentUser,
  };
}

export function useHyperliquidTrading() {
  const { currentUser, hasUserData } = useHyperliquidAccount();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const currentAccount = activeAccount?.account?.id;
  const [loading, setLoading] = useState(true);
  const [canTrade, setCanTrade] = useState(false);

  const checkWalletStatus = useCallback(async () => {
    if (!currentUser) {
      throw new Error('No user address available');
    }

    return await backgroundApiProxy.serviceHyperliquid.checkWalletStatus({
      userAddress: currentUser as IHLHex,
    });
  }, [currentUser]);

  const checkAndApproveWallet = useCallback(async () => {
    if (!currentAccount) return;
    const { maxBuilderFee, extraAgents } = await checkWalletStatus();
    let needApproveAgent = true;

    const proxyWalletAddress = await backgroundApiProxy.serviceHyperliquidWallet.getProxyWalletAddress({
      userAddress: currentUser as IHLHex,
    });
    if (extraAgents.length > 0) {
      extraAgents.forEach(agent => {
        if (agent.address.toLowerCase() === proxyWalletAddress.toLowerCase()) needApproveAgent = false;
      });
    }
    if (!maxBuilderFee || needApproveAgent) {
      await backgroundApiProxy.serviceHyperliquid.enableTrading({
        userAccountId: currentAccount,
        userAddress: currentUser as IHLHex,
        approveAgent: needApproveAgent,
        approveBuilderFee: !maxBuilderFee,
      });
    } else {
      await backgroundApiProxy.serviceHyperliquidExchange.setup({
        userAddress: currentUser as IHLHex,
        userAccountId: currentAccount,
      });
    }
  }, [currentUser, currentAccount]);

  useEffect(() => {
    if (currentUser && !canTrade) {
      setLoading(true);
      void checkAndApproveWallet().finally(() => {
        setLoading(false);
      });
      setCanTrade(true);
    }

  }, [currentUser]);


  return {
    loading,
    canTrade,
    currentUser,
    hasUserData,
    checkWalletStatus,
    checkAndApproveWallet,
  };
}

export function useHyperliquidConnectionStatus() {
  const [connectionState] = useAtom(connectionStateAtom());
  const [subscriptionActive] = useAtom(subscriptionActiveAtom());
  const actions = useHyperliquidActions();

  const reconnect = useCallback(() => {
    void actions.current.reconnectSubscriptions();
  }, [actions]);

  return {
    isConnected: connectionState.isConnected,
    isActive: subscriptionActive,
    lastConnected: connectionState.lastConnected,
    reconnectCount: connectionState.reconnectCount,
    reconnect,
  };
}
