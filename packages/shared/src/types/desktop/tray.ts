import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IMarketStockInfo } from '@onekeyhq/shared/types/marketV2';

export interface IPendingTx {
  id: string;
  historyId?: string;
  accountId?: string;
  networkId?: string;
  historyTx?: IAccountHistoryTx;
  type: 'send' | 'swap' | 'contract' | 'approve';
  to: string;
  amount: string;
  createdAt?: number;
  updatedAt?: number;
  // Failed is kept briefly so diffAndNotify can emit the "failed"
  // notification; the panel filters it out from display.
  status: 'pending' | 'failed';
  confirmations?: string;
}

export interface ITrayWatchlistItem {
  symbol: string;
  name: string;
  icon: string;
  iconUrls?: string[];
  networkIcon?: string;
  price: string;
  change24h: number;
  type: 'spot' | 'perps';
  tokenAddress?: string;
  networkId?: string;
  isNative?: boolean;
  perpsCoin?: string;
  maxLeverage?: number;
  subtitle?: string;
  communityRecognized?: boolean;
  stock?: IMarketStockInfo;
}

export interface ITrayWalletAvatarInfo {
  img?: string;
  emoji?: string;
  bgColor?: string;
}

export interface ITrayAccountAvatarInfo {
  address?: string;
  indexedAccount?: {
    id?: string;
    idHash?: string;
  };
  account?: {
    id?: string;
    address?: string;
  };
  dbAccount?: {
    id?: string;
    address?: string;
    connectionInfo?: unknown;
  };
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
    id?: string;
    name: string;
    emoji: string;
    avatarImg: string;
    avatarInfo?: ITrayWalletAvatarInfo;
    type?: string;
    passphraseState?: string;
    firmwareTypeAtCreated?: unknown;
  };
  account: {
    name: string;
    avatar?: ITrayAccountAvatarInfo;
  };
  totalBalance: {
    amount: string;
    currency: string;
    // Resolved from currencyMap so unknown currencies don't collapse to '$'.
    symbol: string;
    // Undefined when no 24h feed; UI hides the badge instead of showing 0.00% (OK-53612).
    change24h?: number;
  };
  watchlist: ITrayWatchlistItem[];
  pendingTxs: IPendingTx[];
}

// Must stay in sync with ALLOWED_TRAY_ACTION_TYPES in trayIpc.ts.
export interface ITrayAction {
  type:
    | 'open-page'
    | 'market-detail-v2'
    | 'view-all-transactions'
    | 'transaction-detail';
  route?: string;
  txid?: string;
  historyId?: string;
  accountId?: string;
  networkId?: string;
  tokenAddress?: string;
  isNative?: boolean;
  perpsCoin?: string;
}

// Mirror of ipcMessageKeys.TRAY_* in apps/desktop/app/config.ts.
export const TRAY_IPC = {
  DATA_REQUEST: 'tray/dataRequest',
  DATA_RESPONSE: 'tray/dataResponse',
  UPDATE: 'tray/update',
  ACTION: 'tray/action',
  // Tray renderer → main: listener is attached, safe to push TRAY_UPDATE.
  READY: 'tray/ready',
} as const;
