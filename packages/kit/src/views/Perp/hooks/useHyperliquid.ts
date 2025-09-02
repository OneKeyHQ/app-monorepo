import { useCallback, useEffect, useState } from 'react';

import { useAtom } from 'jotai';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  activeAssetCtxAtom,
  allMidsAtom,
  connectionStateAtom,
  currentTokenAtom,
  subscriptionActiveAtom,
  useAccountPanelDataAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import type {
  IActiveAssetData,
  IBook,
  IHex,
  IWsActiveAssetCtx,
  IWsAllMids,
  IWsWebData2,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

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
      const { subType, data, metadata } = eventPayload;

      try {
        switch (subType) {
          case 'allMids':
            void actions.current.updateAllMids(data as IWsAllMids);
            break;

          case 'activeAssetCtx':
            void actions.current.updateActiveAssetCtx(
              data as IWsActiveAssetCtx,
            );
            break;

          case 'webData2':
            void actions.current.updateWebData2(data as IWsWebData2);
            break;

          case 'activeAssetData':
            void actions.current.updateActiveAssetData(
              data as IActiveAssetData,
            );
            break;

          case 'l2Book':
            void actions.current.updateL2Book(data as IBook);
            break;

          case 'bbo':
            break;

          case 'candles':
            if (metadata.coin && metadata.interval) {
              void actions.current.updateCandles({
                coin: metadata.coin,
                interval: metadata.interval,
                candle: data,
              });
            }
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
    appEventBus.on(
      EAppEventBusNames.HyperliquidConnectionChange,
      handleConnectionChange,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.HyperliquidDataUpdate,
        handleDataUpdate,
      );
      appEventBus.off(
        EAppEventBusNames.HyperliquidConnectionChange,
        handleConnectionChange,
      );
    };
  }, [actions]);
}

export function useHyperliquidSession() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const actions = useHyperliquidActions();
  const [subscriptionActive] = useAtom(subscriptionActiveAtom());
  const [connectionState] = useAtom(connectionStateAtom());

  useHyperliquidEventBusListener();

  const { result: ethAccountData } = usePromiseResult(async () => {
    if (!activeAccount?.account?.id) return null;

    const ethNetworkId = 'evm--1';
    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId: activeAccount.account.id,
      networkId: ethNetworkId,
    });

    return account;
  }, [activeAccount?.account?.id]);
  const userAddress = ethAccountData?.address as IHex | undefined;
  useEffect(() => {
    if (typeof userAddress === 'string' && userAddress.startsWith('0x')) {
      void actions.current.setCurrentUser(userAddress);
      void actions.current.setCurrentAccount(activeAccount.account!.id);
    }
  }, [userAddress, actions, activeAccount.account]);

  useEffect(() => {
    if (!subscriptionActive) {
      void actions.current.setCurrentToken('ETH');
    }
  }, [subscriptionActive, actions]);

  useListenTabFocusState(
    ETabRoutes.Perp,
    (isFocus: boolean, isHiddenByModal: boolean) => {
      if (isFocus && !isHiddenByModal) {
        // Handle tab focus
      } else {
        // Handle tab unfocus
      }
    },
  );

  useEffect(() => {
    const actionsRef = actions.current;
    return () => {
      void actionsRef.clearAllData();
    };
  }, [actions]);

  return {
    userAddress: activeAccount?.account?.address as IHex | undefined,
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
  const [accountData] = useAccountPanelDataAtom();

  return accountData;
}

export function useHyperliquidTrading() {
  const { currentUser, hasUserData } = useHyperliquidAccount();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const currentAccount = activeAccount?.account?.id;
  const [loading, setLoading] = useState(true);
  const [canTrade, setCanTrade] = useState(false);

  const checkWalletStatus = useCallback(async () => {
    if (!currentUser) {
      throw new OneKeyLocalError({
        message: 'No user address available',
      });
    }

    return backgroundApiProxy.serviceHyperliquid.checkWalletStatus({
      userAddress: currentUser,
    });
  }, [currentUser]);

  const checkAndApproveWallet = useCallback(async () => {
    if (!currentAccount) return;
    const { maxBuilderFee, extraAgents } = await checkWalletStatus();
    let needApproveAgent = true;

    const proxyWalletAddress =
      await backgroundApiProxy.serviceHyperliquidWallet.getProxyWalletAddress({
        userAddress: currentUser as IHex,
      });
    if (extraAgents.length > 0) {
      extraAgents.forEach((agent: any) => {
        try {
          const agentObj = agent as { address?: string };
          if (
            agentObj &&
            typeof agentObj === 'object' &&
            'address' in agentObj &&
            typeof agentObj.address === 'string'
          ) {
            const agentAddress = agentObj.address.toLowerCase();
            if (agentAddress === proxyWalletAddress.toLowerCase()) {
              needApproveAgent = false;
            }
          }
        } catch (error) {
          // Ignore invalid agent objects
        }
      });
    }
    if (!maxBuilderFee || needApproveAgent) {
      await backgroundApiProxy.serviceHyperliquid.enableTrading({
        userAccountId: currentAccount,
        userAddress: currentUser as IHex,
        approveAgent: needApproveAgent,
        approveBuilderFee: !maxBuilderFee,
      });
    } else {
      await backgroundApiProxy.serviceHyperliquidExchange.setup({
        userAddress: currentUser as IHex,
        userAccountId: currentAccount,
      });
    }
  }, [currentUser, currentAccount, checkWalletStatus]);

  useEffect(() => {
    if (currentUser && !canTrade) {
      setLoading(true);
      void checkAndApproveWallet().finally(() => {
        setLoading(false);
      });
      setCanTrade(true);
    }
  }, [currentUser, canTrade, checkAndApproveWallet]);

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
