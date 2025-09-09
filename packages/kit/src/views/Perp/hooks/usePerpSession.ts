import { useCallback, useMemo } from 'react';

import {
  useConnectionStateAtom,
  useCurrentTokenAtom,
  useCurrentUserAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

export interface IPerpSessionReturn {
  // Connection state
  isConnected: boolean;
  hasError: boolean;
  reconnectCount: number;
  lastConnected: number | null;

  // Current session
  currentToken: string;
  currentUser: string | null;

  // Session actions - simplified for demo
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchToken: (token: string) => Promise<void>;
  setUser: (user: string | null) => Promise<void>;

  // Session status helpers
  isReady: boolean;
  needsWalletConnection: boolean;
}

export function usePerpSession(): IPerpSessionReturn {
  const [connectionState] = useConnectionStateAtom();
  const [currentToken] = useCurrentTokenAtom();
  const [currentUser] = useCurrentUserAtom();

  const sessionInfo = useMemo(() => {
    const isConnected = connectionState.isConnected;
    const hasError = connectionState.reconnectCount > 3;
    const needsWalletConnection = !currentUser;
    const isReady = isConnected && !hasError;

    return {
      isConnected,
      hasError,
      needsWalletConnection,
      isReady,
    };
  }, [connectionState, currentUser]);

  const connect = useCallback(async () => {
    // TODO: Implement proper connection
  }, []);

  const disconnect = useCallback(async () => {
    // TODO: Implement proper disconnection
  }, []);

  const switchToken = useCallback(async (_token: string) => {
    // TODO: Implement proper token switching
  }, []);

  const setUser = useCallback(async (_user: string | null) => {
    // TODO: Implement proper user setting
  }, []);

  return {
    // Connection state
    isConnected: sessionInfo.isConnected,
    hasError: sessionInfo.hasError,
    reconnectCount: connectionState.reconnectCount,
    lastConnected: connectionState.lastConnected,

    // Current session
    currentToken,
    currentUser: currentUser || null,

    // Session actions
    connect,
    disconnect,
    switchToken,
    setUser,

    // Session status helpers
    isReady: sessionInfo.isReady,
    needsWalletConnection: sessionInfo.needsWalletConnection,
  };
}
