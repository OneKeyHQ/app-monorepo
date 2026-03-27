import { useEffect, useCallback } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

/**
 * This hook runs in the MAIN WINDOW renderer only (desktop platform).
 * It listens for data requests from the tray main process
 * and responds with current data from the Jotai store.
 *
 * TODO: Wire up actual data sources:
 * - Wallet name/avatar: from active wallet atom
 * - Total balance: from activeAccountValueAtom
 * - Watchlist: from market favorites atoms
 * - Pending transactions: from transaction history atoms
 */
export function useTrayDataProvider() {
  const handleTrayDataRequest = useCallback(() => {
    // Mock data for UI verification — replace with actual store reads
    const trayData = {
      wallet: {
        name: 'My Wallet',
        avatar: '',
      },
      totalBalance: {
        amount: '12,345.67',
        currency: 'USD',
        change24h: 2.34,
      },
      watchlist: [
        { symbol: 'BTC', name: 'Bitcoin', icon: '', price: '$104,230', change24h: 1.82 },
        { symbol: 'ETH', name: 'Ethereum', icon: '', price: '$3,456', change24h: -0.45 },
        { symbol: 'SOL', name: 'Solana', icon: '', price: '$178.90', change24h: 5.12 },
      ],
      pendingTxs: [
        { id: 'tx1', type: 'send' as const, to: '0x1234...abcd', amount: '0.5 ETH', status: 'pending' },
      ],
    };

    (globalThis as any).desktopApi?.sendTrayData(trayData);
  }, []);

  useEffect(() => {
    if (!platformEnv.isDesktop) return;

    window.addEventListener('onekey-tray-data-request', handleTrayDataRequest);
    return () => {
      window.removeEventListener(
        'onekey-tray-data-request',
        handleTrayDataRequest,
      );
    };
  }, [handleTrayDataRequest]);
}
