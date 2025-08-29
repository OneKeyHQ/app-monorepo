import { useMemo } from 'react';

import {
  useCurrentTokenAtom,
  useCurrentUserAtom,
  useConnectionStateAtom,
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

  // Simplified actions for demo - in real app would use proper actions
  const connect = async () => {
    console.log('Connect to Hyperliquid...');
    // TODO: Implement proper connection
  };

  const disconnect = async () => {
    console.log('Disconnect from Hyperliquid...');
    // TODO: Implement proper disconnection
  };

  const switchToken = async (token: string) => {
    console.log('Switch to token:', token);
    // TODO: Implement proper token switching
  };

  const setUser = async (user: string | null) => {
    console.log('Set user:', user);
    // TODO: Implement proper user setting
  };

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