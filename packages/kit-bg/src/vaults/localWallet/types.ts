import type { IRescanLocalWalletFrom } from '../types';

export type ILocalWalletAccount = {
  accountId: string;
  // Physical scanner/database group. Accounts with the same runtimeKey are
  // advanced by one sync turn.
  runtimeKey: string;
  // Runtime-owned account identity used to deduplicate repairs for aliases.
  accountRuntimeKey: string;
  syncEnabled: boolean;
};

export type ILocalWalletSyncProgress = {
  birthdayHeight: number | null;
  backfillScannedHeight: number | null;
  backfillTargetHeight: number | null;
  backfillProgress: number | null;
  isBackfillComplete: boolean;
  tipScannedHeight: number | null;
  chainTip: number | null;
  tipLag: number | null;
  isTipCaughtUp: boolean;
  isSyncing: boolean;
};

export type ILocalWalletSyncPolicy = {
  maxSyncDurationMs: number;
  foregroundBackfillDelayMs: number;
  backgroundBackfillDelayMs: {
    desktop: number;
    default: number;
  };
  autoBoostMinRemainingBlocks: number;
};

// One spendable pool the send flow can draw on. `key` is the value the vault
// expects back on the transfer (ITransferInfo source pool); the label and
// figures are presentation only.
export type ILocalWalletSendPool = {
  key: string;
  label: string;
  // False when this pool cannot pay the given recipient (e.g. a public-only
  // builder asked to pay a private address). Listed for balance display,
  // hidden from the picker.
  eligible?: boolean;
  // Smallest unit, and its decimal-shifted form for the amount page.
  spendable: string;
  spendableParsed: string;
  // Full balance when it differs from spendable (unconfirmed, locked).
  total?: string;
  totalParsed?: string;
  isDefault?: boolean;
};

export type ILocalWalletPoolKind = 'public' | 'private';

// Declared once per chain in its vault settings. Generic UI builds pool tabs,
// send-pool pickers and history filters from this list; it never learns pool
// names from chain code.
export type ILocalWalletPoolDescriptor = {
  // Runtime pool id, stable across releases (history rows carry it).
  id: number;
  // Send-pool / spend-source key understood by the chain's vault.
  key: string;
  kind: ILocalWalletPoolKind;
  label: string;
  // The private pool new value lands in and that sends draw from by default.
  isDefaultPrivate?: boolean;
  // False for a legacy pool that still holds value but no longer receives.
  receivesFunds?: boolean;
};

export type ILocalWalletAccountState = {
  // Opted in and not mid-operation.
  enabled: boolean;
  pendingOperation?: 'enable' | 'disable';
  // Prefer spending public funds even when a private pool could pay.
  preferPublicSends: boolean;
  birthdayHeight?: number;
  birthdaySource?: string;
  birthdayTimestamp?: number;
  birthdayHintTimestamp?: number;
};

// One pool's balance as the generic UI shows it. Hints and the move action
// are decided by the chain vault (thresholds, confirmation rules, legacy
// pools); the UI only renders them.
export type ILocalWalletPoolBalance = {
  key: string;
  total: string;
  totalParsed: string;
  spendable: string;
  spendableParsed: string;
  hints: string[];
  // Public pool: shield (sweep into the default private pool). Private pool:
  // withdraw (everything spendable back to the public address).
  move?: {
    type: 'shield' | 'withdraw';
    amountParsed?: string;
    enabled: boolean;
  };
};

export type ILocalWalletAccountBalance = {
  total: string;
  totalParsed: string;
  spendable: string;
  pools: ILocalWalletPoolBalance[];
};

export type ILocalWalletAccountAddresses = {
  publicAddress: string;
  // Absent while the account is not enabled: a paused account is no longer
  // scanned, so anything paid to its private address stays invisible.
  privateAddress?: string;
};

export type ILocalWalletCapability = {
  // Per-account opt-in lifecycle. Required whenever settings.localWallet
  // .activation is 'account-opt-in'.
  getAccountState: (params: {
    accountId: string;
  }) => Promise<ILocalWalletAccountState>;
  enableAccount: (params: {
    accountId: string;
    birthdayHeight?: number;
    birthdayTimestamp?: number;
  }) => Promise<void>;
  disableAccount: (params: { accountId: string }) => Promise<void>;
  retryAccountSetup: (params: { accountId: string }) => Promise<void>;
  setAccountSendPreference: (params: {
    accountId: string;
    preferPublic: boolean;
  }) => Promise<void>;
  // Undefined until the account is enabled and its viewing material exists.
  getAccountAddresses: (params: {
    accountId: string;
  }) => Promise<ILocalWalletAccountAddresses | undefined>;
  deleteAccountData: (params: { accountId: string }) => Promise<void>;
  // Null when the account is enabled but the runtime cannot answer yet.
  getAccountBalance: (params: {
    accountId: string;
  }) => Promise<ILocalWalletAccountBalance | null>;

  // Pools a send may spend from, or undefined when the account has only one
  // (the send flow then shows no picker).
  listSendPools?: (params: {
    accountId: string;
    toAddress?: string;
  }) => Promise<ILocalWalletSendPool[] | undefined>;
  syncPolicy: ILocalWalletSyncPolicy;
  listAccounts: () => Promise<{
    accounts: ILocalWalletAccount[];
    cleanupAccountIds: string[];
  }>;
  getAccountAliases: (params: { accountId: string }) => Promise<string[]>;
  getChainTip: () => Promise<number | null>;
  onWalletCreated: (params: {
    walletId: string;
    isFreshlyGeneratedMnemonic: boolean;
    createdAt: number;
  }) => Promise<void>;
  resumePendingOperations: () => Promise<void>;
  gcWalletState: (params: { liveWalletIds: string[] }) => Promise<void>;
  assertCanRemoveAccount?: (params: { accountId: string }) => Promise<void>;
  syncGroup: (params: {
    accountIds: string[];
    rescanFrom?: { accountId: string; fromHeight: number };
    chainTip?: number | null;
  }) => Promise<{
    synced: boolean;
    stateChanged?: boolean;
    chainTip?: number | null;
    backfillRemaining?: boolean;
  }>;
  reset: (params: {
    accountId: string;
    scope: 'cache' | 'all';
  }) => Promise<void>;
  // True only if settlement of syncGroup proves its writer has stopped.
  // RPC proxies that can time out independently must leave this false.
  syncCompletionIsAuthoritative?: boolean;
  // Returns true only when the carrier can prove the timed-out execution was
  // terminated. Otherwise quarantine requires authoritative sync completion.
  recoverFromTimeout: () => Promise<boolean>;
  // App reset: delete every client-side scan database for this network,
  // regardless of account state or safety gates.
  dropLocalData?: () => Promise<void>;
  setDiagnosticsEnabled?: (params: { enabled: boolean }) => Promise<void>;
  getSyncProgress: (params: {
    accountId: string;
  }) => Promise<ILocalWalletSyncProgress | undefined>;
  rescan: (params: {
    accountId: string;
    from: IRescanLocalWalletFrom;
    dryRun?: boolean;
  }) => Promise<{ fromHeight: number }>;
};
