export interface IPendingTx {
  id: string;
  type: 'send' | 'swap' | 'contract' | 'approve';
  to: string;
  amount: string;
  status: string;
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

// IPC channel constants (duplicated from config.ts for renderer access)
export const TRAY_IPC = {
  DATA_REQUEST: 'tray/dataRequest',
  DATA_RESPONSE: 'tray/dataResponse',
  UPDATE: 'tray/update',
  ACTION: 'tray/action',
} as const;
