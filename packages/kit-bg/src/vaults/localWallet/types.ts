// cspell:ignore Zodl
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBalanceStatus } from '@onekeyhq/shared/types/token';

import type { IRescanLocalWalletFrom } from '../types';

export type ILocalWalletAccount = {
  accountId: string;
  // Accounts sharing a runtimeKey are advanced by the same sync turn.
  runtimeKey: string;
  // Runtime-owned identity used to deduplicate repairs for aliases.
  accountRuntimeKey: string;
  syncEnabled: boolean;
  // Hiding an enabled account can pause scanning without releasing admission.
  slotEnabled?: boolean;
};

// Counts viewing identities across every wallet, including ones this session
// cannot see.
export type ILocalWalletSlotUsage = {
  used: number;
  max?: number;
  occupants: {
    accountId: string;
    accountName: string;
    walletName: string;
    // Visible accounts sharing this identity, and therefore its single slot.
    aliasCount: number;
  }[];
  // Slots held by accounts no visible wallet owns right now (e.g. a locked
  // passphrase wallet); they still count against the limit.
  hiddenCount: number;
};

export type ILocalWalletSyncProgress = {
  birthdayHeight: number | null;
  backfillScannedHeight: number | null;
  backfillTargetHeight: number | null;
  backfillProgress: number | null;
  backfillRemainingBlocks?: number;
  isBackfillComplete: boolean;
  tipScannedHeight: number | null;
  chainTip: number | null;
  tipLag: number | null;
  isTipCaughtUp: boolean;
  isSyncing: boolean;
};

// How a scheduler turn is composed from a step primitive (localWallet/syncTurn.ts).
export type ILocalWalletSyncTurnPolicy = {
  // Upper bound when the runtime sizes its own requests.
  stepBlocks: number;
  // Assumed step duration until one has been measured.
  expectedStepMs: number;
  // How long a turn keeps starting new steps, so one chain does not starve
  // the others; a slow step already in flight is allowed to finish.
  budgetMs: number;
};

export type ILocalWalletSyncPolicy = {
  // The scheduler's watchdog: a syncGroup call still running after this is
  // abandoned and its runtime quarantined until it settles.
  maxSyncDurationMs: number;
  // Present when the capability composes its turn from a step primitive
  // (Monero); absent when the runtime bounds its own turn internally (Zcash).
  turn?: ILocalWalletSyncTurnPolicy;
  foregroundBackfillDelayMs: number;
  backgroundBackfillDelayMs: {
    desktop: number;
    default: number;
  };
  // Sending is refused while this many blocks or more are left to scan
  // (backfill plus tip lag). Absent: the spendable balance alone decides.
  sendMaxBlocksLeft?: number;
};

// `key` is the value the vault expects back on the transfer (ITransferInfo
// source pool); the label and figures are presentation only.
export type ILocalWalletSendPool = {
  key: string;
  label: string;
  // False when this pool cannot pay the given recipient (e.g. a public-only
  // builder asked to pay a private address).
  eligible?: boolean;
  // Undefined means unavailable, distinct from a known zero.
  spendable?: string;
  spendableParsed?: string;
  // Full balance when it differs from spendable (unconfirmed, locked).
  total?: string;
  totalParsed?: string;
  isDefault?: boolean;
  hintId?: ETranslations;
};

export type ILocalWalletPoolKind = 'public' | 'private';

// Where a pool's data comes from; generic code dispatches on this, while
// `kind` only drives display and privacy semantics.
// - backend: OneKey backend only, handled like BTC. Readable without the
//   account opting in, may join All Networks and the shared history cache,
//   details come from the backend, custom nodes never apply.
// - localScan: the local runtime only. Never read before the account opts
//   in, kept out of All Networks and the shared history cache, details are
//   answered locally, and only these pools follow custom nodes.
export type ILocalWalletPoolSource = 'backend' | 'localScan';

// Declared once per chain in its vault settings; generic UI builds pool
// tabs, pickers and history filters from this list.
export type ILocalWalletPoolDescriptor = {
  // Runtime pool id, stable across releases (history rows carry it).
  id: number;
  key: string;
  kind: ILocalWalletPoolKind;
  source: ILocalWalletPoolSource;
  label: string;
  // The private pool new value lands in and that sends draw from by default.
  isDefaultPrivate?: boolean;
  // False for a legacy pool that still holds value but no longer receives.
  receivesFunds?: boolean;
};

export type ILocalWalletAccountState = {
  enabled: boolean;
  // Opted out after having been enabled, with the resume position still on
  // disk; distinct from never-enabled, which offers setup instead of resume.
  paused: boolean;
  pendingOperation?: 'enable' | 'disable';
  birthdayHeight?: number;
  birthdaySource?: string;
  birthdayTimestamp?: number;
  birthdayHintTimestamp?: number;
};

// Whether an account may use local scanning. 'unsupported': the network or
// the account's wallet type cannot scan. 'tempWallet': a wallet the user chose
// not to keep, whose viewing key and scan data must not land on disk.
export type ILocalWalletAccountSupport =
  | 'supported'
  | 'unsupported'
  | 'tempWallet';

// Why part of a balance cannot be spent yet; the chain says which reason and
// how much, the UI words it.
export type ILocalWalletFrozenReason =
  // Waiting for the confirmations a received output needs.
  | 'confirming'
  // Held by a send that is not confirmed yet, or its change.
  | 'pendingSend'
  // Cannot be shown unspent until the account's password confirms it.
  | 'needsPassword';

export type ILocalWalletFrozenPart = {
  reason: ILocalWalletFrozenReason;
  amountParsed: string;
};

export type ILocalWalletPoolBalance = {
  key: string;
  balanceStatus?: IBalanceStatus;
  total?: string;
  totalParsed?: string;
  spendable?: string;
  spendableParsed?: string;
  // Why value is not spendable goes in `frozen`, not here.
  hints: string[];
  frozen?: ILocalWalletFrozenPart[];
  // Public pool: shield (sweep into the default private pool). Private pool:
  // withdraw (everything spendable back to the public address).
  move?: {
    type: 'shield' | 'withdraw';
    amountParsed?: string;
    enabled: boolean;
  };
};

export type ILocalWalletAccountBalance = {
  balanceStatus?: IBalanceStatus;
  total?: string;
  totalParsed?: string;
  spendable?: string;
  pools: ILocalWalletPoolBalance[];
  frozen?: ILocalWalletFrozenPart[];
};

export type ILocalWalletAccountAddresses = {
  publicAddress: string;
  // Absent while paused: a paused account is no longer scanned, so anything
  // paid to its private address stays invisible.
  privateAddress?: string;
};

// What a transaction about to be signed pays, from the chain's own strict
// parse; amounts are base units.
export type ILocalWalletReviewedTransaction = {
  encodedTx: IEncodedTx;
  to: string;
  amount: string;
  fee: string;
};

export type ILocalWalletCapability = {
  // Zero-trust review before signing: throws when the transaction is
  // malformed or inconsistent, never sends it anywhere.
  reviewTransaction: (encodedTx: unknown) => ILocalWalletReviewedTransaction;
  getDebugAccountMeta?: (params: { accountId: string }) => Promise<unknown>;
  // Required whenever settings.localWallet.activation is 'account-opt-in'.
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
  // Undefined until the account is enabled and its viewing material exists.
  getAccountAddresses: (params: {
    accountId: string;
  }) => Promise<ILocalWalletAccountAddresses | undefined>;
  deleteAccountData: (params: { accountId: string }) => Promise<void>;
  // Rebuilds an HD account's viewing material from its mnemonic, for accounts
  // that arrived without it (Prime transfer, cloud restore).
  deriveViewingKey?: (params: {
    accountId: string;
    password: string;
  }) => Promise<string>;
  // Null when the account is enabled but the runtime cannot answer yet.
  getAccountBalance: (params: {
    accountId: string;
  }) => Promise<ILocalWalletAccountBalance | null>;

  // Undefined when the account has only one pool (no picker shown).
  listSendPools?: (params: {
    accountId: string;
    toAddress?: string;
  }) => Promise<ILocalWalletSendPool[] | undefined>;
  prewarmSend?: (params: {
    accountId: string;
    sourcePool: string;
    toAddress: string;
  }) => Promise<void>;
  syncPolicy: ILocalWalletSyncPolicy;
  listAccounts: () => Promise<{
    accounts: ILocalWalletAccount[];
    cleanupAccountIds: string[];
    // Accounts with data in the network's shared local database; defaults to
    // cleanupAccountIds. A pending App Reset wipe skips a network with any.
    storedAccountIds?: string[];
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
  // True only if settlement of syncGroup proves its writer has stopped;
  // RPC proxies that can time out independently must leave this false.
  syncCompletionIsAuthoritative?: boolean;
  // True only when the carrier can prove the timed-out execution was
  // terminated; otherwise quarantine requires authoritative sync completion.
  recoverFromTimeout: () => Promise<boolean>;
  // A user operation (a send) holds the runtime: the sync it delays is not
  // stuck, and recovering would kill the send.
  isUserOperationActive?: () => boolean;
  // `bytes` is null when the chain can be asked but has nothing on disk yet.
  getStorageUsage?: () => Promise<{ bytes: number | null }>;
  // Read-only: the node is picked via the app-wide custom-RPC setting.
  // `health` is what the scanner last observed, not a separate probe.
  getSyncEndpoint?: () => Promise<
    | {
        url: string;
        defaultUrl: string;
        health?: {
          ok: boolean;
          latencyMs: number | null;
          // Epoch ms, so the UI can say "as of" instead of implying live.
          atMs: number;
        };
      }
    | undefined
  >;
  // App reset: delete every client-side scan database for this network,
  // regardless of account state or safety gates.
  dropLocalData?: () => Promise<void>;
  // Settings "Clear pending transactions": drop this chain's local send locks
  // so their inputs can be spent again.
  clearPendingSends?: () => Promise<void>;
  // Whether this device may hold scan data for the network. App reset skips
  // loading the runtime when this is false. Omitted means assume it does.
  hasLocalData?: () => Promise<boolean>;
  // Settings "Reset storage": rebuild the network's scan database from
  // scratch, even one that can no longer be opened. Chains without it reset
  // account by account.
  resetStorage?: () => Promise<void>;
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
