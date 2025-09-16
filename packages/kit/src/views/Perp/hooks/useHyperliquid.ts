import { useCallback, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  useAccountPanelDataAtom,
  useActiveAssetCtxAtom,
  useAllMidsAtom,
  useConnectionStateAtom,
  useCurrentTokenAtom,
  useSubscriptionActiveAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export function useHyperliquidMarket() {
  const [allMids] = useAllMidsAtom();
  const [currentToken] = useCurrentTokenAtom();
  const [activeAssetCtx] = useActiveAssetCtxAtom();
  const [connectionState] = useConnectionStateAtom();

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
  // const currentUser = userAddress;
  const { activeAccount } = useActiveAccount({ num: 0 });
  const currentAccount = activeAccount?.account?.id;
  const [loading, setLoading] = useState(false);
  const [canTrade, setCanTrade] = useState(false);

  return {
    loading,
    canTrade: Boolean(canTrade && currentUser),
    currentUser,
    hasUserData,
  };
}

export function useHyperliquidConnectionStatus() {
  const [connectionState] = useConnectionStateAtom();
  const [subscriptionActive] = useSubscriptionActiveAtom();
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
