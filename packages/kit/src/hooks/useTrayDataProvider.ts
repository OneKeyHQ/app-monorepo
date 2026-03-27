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
    // Scaffold data — replace with actual store reads
    const trayData = {
      wallet: {
        name: 'My Wallet',
        avatar: '',
      },
      totalBalance: {
        amount: '0.00',
        currency: 'USD',
        change24h: 0,
      },
      watchlist: [],
      pendingTxs: [],
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
