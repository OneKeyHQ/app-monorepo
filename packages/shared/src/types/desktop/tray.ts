export interface IPendingTx {
  id: string;
  type: 'send' | 'swap' | 'contract';
  to: string;
  amount: string;
  status: string;
  confirmations?: string;
}

export interface ITrayData {
  wallet: {
    name: string;
    avatar: string;
  };
  totalBalance: {
    amount: string;
    currency: string;
    change24h: number;
  };
  watchlist: Array<{
    symbol: string;
    name: string;
    icon: string;
    price: string;
    change24h: number;
  }>;
  pendingTxs: IPendingTx[];
}

// IPC channel constants (duplicated from config.ts for renderer access)
export const TRAY_IPC = {
  DATA_REQUEST: 'tray/dataRequest',
  DATA_RESPONSE: 'tray/dataResponse',
  UPDATE: 'tray/update',
  ACTION: 'tray/action',
} as const;
