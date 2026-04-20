export interface IPendingTx {
  id: string;
  type: 'send' | 'swap' | 'contract' | 'approve';
  to: string;
  amount: string;
  // Failed is kept briefly so diffAndNotify can emit the "failed"
  // notification; the panel filters it out from display.
  status: 'pending' | 'failed';
  confirmations?: string;
}

export interface ITrayWatchlistItem {
  symbol: string;
  name: string;
  icon: string;
  price: string;
  change24h: number;
  type: 'spot' | 'perps';
  tokenAddress?: string;
  networkId?: string;
  isNative?: boolean;
  perpsCoin?: string;
}

export interface ITrayData {
  isLocked?: boolean;
  // When true, main keeps previous cachedTrayData so the panel still shows
  // last known good values and skips the pending-tx diff.
  isError?: boolean;
  // One-shot hint from the main renderer that pending txs were cleared by
  // user action, so disappearance must not be treated as confirmation.
  pendingTxsCleared?: boolean;
  // Tray renderer can't call backgroundApiProxy, so locale is assembled
  // on the main window side and pushed through TRAY_UPDATE.
  locale?: string;
  // Notification diff uses this to reset the pending-tx baseline on
  // wallet switch; without it, old-account txs would look "confirmed".
  accountId?: string;
  wallet: {
    name: string;
    emoji: string;
    avatarImg: string;
  };
  totalBalance: {
    amount: string;
    currency: string;
    // Resolved from currencyMap so unknown currencies don't collapse to '$'.
    symbol: string;
    change24h: number;
  };
  watchlist: ITrayWatchlistItem[];
  pendingTxs: IPendingTx[];
}

// Must stay in sync with ALLOWED_TRAY_ACTION_TYPES in trayIpc.ts.
export interface ITrayAction {
  type: 'open-page' | 'market-detail-v2' | 'view-all-transactions';
  route?: string;
  tokenAddress?: string;
  networkId?: string;
  isNative?: boolean;
  perpsCoin?: string;
}

// Mirror of ipcMessageKeys.TRAY_* in apps/desktop/app/config.ts.
export const TRAY_IPC = {
  DATA_REQUEST: 'tray/dataRequest',
  DATA_RESPONSE: 'tray/dataResponse',
  UPDATE: 'tray/update',
  ACTION: 'tray/action',
} as const;
