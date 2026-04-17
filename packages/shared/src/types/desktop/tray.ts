export interface IPendingTx {
  id: string;
  type: 'send' | 'swap' | 'contract' | 'approve';
  to: string;
  amount: string;
  // 'pending'  — tx still in mempool / awaiting confirmation
  // 'failed'   — tx resolved as failed (kept in list briefly so the main
  //              process can emit the "failed" notification via diffAndNotify;
  //              the panel filters it out from display)
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
  // Navigation data
  tokenAddress?: string;
  networkId?: string;
  isNative?: boolean;
  perpsCoin?: string;
}

export interface ITrayData {
  isLocked?: boolean;
  // When true, main-process IPC handler keeps the previous cachedTrayData so
  // the panel still shows last known good values during a transient gather
  // failure (avoids false "Transaction Confirmed" notifications too).
  isError?: boolean;
  // Resolved user locale. The tray renderer is a separate BrowserWindow that
  // CANNOT call backgroundApiProxy (DESKTOP_API_CALL is gated to the main
  // window only), so the main-window renderer assembles locale here and
  // pushes it through the TRAY_UPDATE pipeline.
  locale?: string;
  wallet: {
    name: string;
    emoji: string;
    avatarImg: string; // avatar image name e.g. 'rabbit', 'bear'
  };
  totalBalance: {
    amount: string;
    currency: string;
    change24h: number;
  };
  watchlist: ITrayWatchlistItem[];
  pendingTxs: IPendingTx[];
}

// Payload sent from the tray panel renderer to the main process via
// desktopApi.sendTrayAction; must match ALLOWED_TRAY_ACTION_TYPES in
// apps/desktop/app/tray/trayIpc.ts.
export interface ITrayAction {
  type: 'open-page' | 'market-detail-v2';
  route?: string;
  tokenAddress?: string;
  networkId?: string;
  isNative?: boolean;
  perpsCoin?: string;
}

// IPC channel constants (duplicated from config.ts for renderer access)
export const TRAY_IPC = {
  DATA_REQUEST: 'tray/dataRequest',
  DATA_RESPONSE: 'tray/dataResponse',
  UPDATE: 'tray/update',
  ACTION: 'tray/action',
} as const;
