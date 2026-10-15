export type IZcashRuntimeSelfTestStage =
  | 'worker'
  | 'wasm'
  | 'storage'
  | 'network';

export type IZcashRuntimeSelfTestResult = {
  stage: IZcashRuntimeSelfTestStage;
  chainTip?: number;
};

/* cspell:ignore Ufvks */

export type IZcashNetwork = 'main' | 'test';

// ---- keys side (works on every carrier, no sync/threads needed) ----

export type IZcashGetChainTipParams = {
  network: IZcashNetwork;
  lightwalletdUrl: string;
};

export type IZcashDeriveAccountParams = {
  network: IZcashNetwork;
  // BIP39 64-byte seed (JSON-safe wire format); enters only the keys wasm to derive USK -> UFVK.
  // Must never be logged or persisted — the wallet runtime receives only the viewing-level result.
  seedHex: string;
  hdIndex: number;
  // Full wallet carriers use this to query the chain tip; keys-only carriers derive addresses offline and return a null tip.
  lightwalletdUrl: string;
};

export type IZcashDeriveAccountResult = {
  ufvk: string; // encoded UnifiedFullViewingKey (viewing capability, like xpub)
  seedFingerprintHex: string;
  unifiedAddress: string;
  transparentAddress: string; // t1... derived from the UFVK
  // Chain tip at derivation time; callers persist it as a fixed birthday for freshly created accounts (null if the tip fetch failed/offline).
  chainTip: number | null;
};

// Derive display addresses from a UFVK without a seed or password.
export type IZcashDeriveAddressFromUfvkParams = {
  network: IZcashNetwork;
  ufvk: string;
  lightwalletdUrl: string;
};

export type IZcashDeriveAddressFromUfvkResult = {
  unifiedAddress: string;
  transparentAddress: string;
};

export type IZcashDeriveTransparentXpubFromUfvkParams = {
  network: IZcashNetwork;
  ufvk: string;
  hdIndex: number;
};

export type IZcashCombinePcztParams = {
  // Full local copy (created by createPczt).
  originalPcztHex: string;
  // Redacted copy returned by an external signer (hardware): signatures
  // present, private fields absent.
  signedPcztHex: string;
};

export type IZcashSignPcztParams = {
  network: IZcashNetwork;
  seedHex: string; // re-derives USK inside the wasm at sign time, then discarded
  hdIndex: number;
  pcztHex: string;
  review: IZcashPcztReviewRequest;
};

export type IZcashPcztReviewRequest = {
  network: IZcashNetwork;
  ufvk: string;
  toAddress: string;
  amountZat: string;
  feeZat: string;
  spendSource: 'orchard' | 'ironwood';
  isMaxSend: boolean;
  memoHex?: string;
};

export type IZcashTransparentOutpoint = {
  txid: string;
  vout: number;
};

export type IZcashTransparentUtxo = IZcashTransparentOutpoint & {
  valueZat: string;
  scriptPubKey: string;
  isCoinbase: boolean;
  confirmations: number;
  derivationPath: string;
};

export type IZcashTransparentTxRequest = {
  network: 'main';
  accountIndex: number;
  targetHeight: number;
  expiryHeight: number;
  utxos: IZcashTransparentUtxo[];
  selectedOutpoints: IZcashTransparentOutpoint[];
  recipients: { address: string; amountZat?: string; memoHex?: string }[];
  sendMax: boolean;
  change?: { address: string; derivationPath: string };
};

export type IZcashParseTransparentTransactionsParams = {
  transactions: { txid: string; rawTx: string }[];
};

export type IZcashParsedTransparentTransaction = {
  txid: string;
  isCoinbase: boolean;
  outputs: { valueZat: string; scriptPubKey: string }[];
};

export type IZcashTransparentTxQuote = {
  feeZat: string;
  inputTotalZat: string;
  sendAmountZat: string;
  changeZat: string;
  expiryHeight: number;
  spentOutpoints: IZcashTransparentOutpoint[];
};

export type IZcashTransparentTxBuildResult = {
  rawTx: string;
  txid: string;
  feeZat: string;
  expiryHeight: number;
  spentOutpoints: IZcashTransparentOutpoint[];
};

export type IZcashTransparentHardwareCreateParams = {
  request: IZcashTransparentTxRequest;
  accountXpub: string;
  seedFingerprintHex: string;
};

export type IZcashTransparentHardwareFinalizeParams = {
  request: IZcashTransparentTxRequest;
  accountXpub: string;
  originalPcztHex: string;
  signedPcztHex: string;
};

export type IZcashPcztReservation = {
  pcztHex: string;
  // Fee of the exact locked proposal represented by pcztHex.
  feeZat: string;
  // Owner token for the inputs this PCZT locked; not a secret.
  // Callers must carry it through to send or cancellation to release the lock.
  reservationId: string;
};

export type IZcashSendResult = {
  txid: string;
  broadcastState: 'accepted' | 'unknown' | 'rejected';
  broadcastError?: {
    code: string;
    params: Record<string, unknown>;
    detail?: string;
  };
};

// ---- wallet side (watch-only via UFVK; sync needs COI/threads) ----

// Identifies one watch-only wallet account inside the carrier's wallet pool.
export type IZcashWalletAccount = {
  network: IZcashNetwork;
  lightwalletdUrl: string;
  ufvk: string;
  seedFingerprintHex: string;
  hdIndex: number;
  birthdayHeight?: number;
};

export type IZcashSyncResult = {
  // False when a bounded pass made no wallet-state mutation; callers can skip serialization/UI refresh.
  stateChanged: boolean;
  chainTip: number | null;
  fullyScanned: number | null;
  // True when the step budget ran out with historic ranges still queued; the next sync continues the backfill.
  backfillRemaining?: boolean;
  // Node-confirmed rejections from retrying stored unmined transactions; the host persists these as Failed.
  // Network failures are excluded — their outcome remains unknown/Pending, not Failed.
  rebroadcastRejectedTxids?: string[];
  rebroadcastAcceptedTxids?: string[];
};

export type IZcashSyncProgress = {
  // The birthday lane is the authoritative wallet-completeness indicator.
  birthdayHeight: number | null;
  backfillScannedHeight: number | null;
  backfillTargetHeight: number | null;
  backfillProgress: number | null;
  backfillRemainingBlocks?: number;
  isBackfillComplete: boolean;
  // The tip lane may be ahead while older history is still being repaired.
  tipScannedHeight: number | null;
  chainTip: number | null;
  tipLag: number | null;
  isTipCaughtUp: boolean;
  isSyncing: boolean;
};

export type IZcashDatabaseDiagnostics = {
  backend: 'sqlite-wasm-opfs-sahpool';
  databaseName: string;
  databaseExists: boolean;
  openedAndMigrated: boolean;
  accountPresent: boolean | null;
  accountScanState: {
    birthdayHeight: number;
    chainTip: number | null;
    scannedToHeight: number | null;
    remainingBlocks: number;
    isComplete: boolean;
  } | null;
  location: {
    carrier:
      | 'desktop-sdk-runtime'
      | 'extension-offscreen'
      | 'extension-background'
      | 'mobile-webembed'
      | 'web-page'
      | 'unknown-web-runtime';
    origin: string | null;
    description: string;
    exactPhysicalPathAvailable: false;
  };
  browserStorage: {
    persisted: boolean | null;
    originUsageBytes: number | null;
    originQuotaBytes: number | null;
    estimateError: string | null;
  };
  health: {
    quickCheck: {
      ok: boolean;
      messages: string[];
    };
    foreignKeyViolations: number;
    schema: {
      tables: number;
      views: number;
      indexes: number;
    };
    versions: Record<string, string>;
  } | null;
  storageStats: {
    sqlite: {
      pageSize: number;
      pageCount: number;
      freePages: number;
      logicalBytes: number;
    };
    scan: {
      minHeight: number | null;
      maxHeight: number | null;
      blockRows: number;
      rangeRows: number;
    };
    trees: Record<
      'sapling' | 'orchard' | 'ironwood',
      {
        shards: number;
        shardBytes: number;
        checkpoints: number;
        retained: number;
        marksRemoved: number;
      }
    >;
    wallet: {
      accounts: number;
      addresses: number;
      transactions: number;
      rawTxBytes: number;
      notes: number;
      memoBytes: number;
      transparentOutputs: number;
    };
    transient: {
      nullifiers: number;
      locators: number;
      retrievalQueue: number;
      spendSearchQueue: number;
    };
    poolMigration: {
      runs: number;
      transactions: number;
      pcztBytes: number;
    };
  } | null;
};

// Pool labels must match how they're computed: maturing = pendingChange + pendingSpendable, locked = reserved by an in-flight send.
// IZcashSpendSource restricts note selection to one pool; the runtime never crosses pools — a shortfall is INSUFFICIENT_FUNDS, not a fallback.
export type IZcashSpendSource = 'orchard' | 'ironwood';

export type IZcashPoolDetail = {
  spendable: string;
  pendingChange: string;
  pendingSpendable: string;
  locked: string;
  total: string;
};

export type IZcashBalance = {
  // True only when this account's backfill is complete.
  isComplete: boolean;
  // zatoshi strings (1 ZEC = 1e8 zatoshi); bigint-safe across the bridge
  shielded: string; // orchard + ironwood pools, summed
  // What a send can draw on right now (this build's spend policy + confirmation thresholds).
  // A "max" button must use this, not `shielded` — it's produced by the same layer that validates a proposal, so the two can't disagree.
  spendable: string;
  pendingChange: string;
  pendingSpendable: string;
  // Per-pool breakdown for TokenDetails; kept separate from `shielded` since Orchard and Ironwood have different spend behavior.
  orchardBalance: string;
  ironwoodBalance: string;
  // Spendable portion of the SHIELDED pools only (confirmation thresholds applied) — the withdraw ceiling.
  // `spendable` is the aggregate policy figure; a shielded-to-transparent withdraw must still use this shielded-only ceiling.
  shieldedSpendable: string;
  // Per-pool composition for the pool UI; shielded pools only — the public half is backend-owned and intentionally absent (would be a stale zero).
  poolsDetail: {
    orchard: IZcashPoolDetail;
    ironwood: IZcashPoolDetail;
  };
};

// The fee a send will pay, from the real proposal, before anything is built or locked.
export type IZcashSendQuote = {
  feeZat: string;
};

export type IZcashTxDetails = {
  // this account's notes/UTXOs consumed by the tx
  spent: { value: string; pool: string; address: string | null }[];
  // this account's notes/UTXOs created by the tx
  received: {
    value: string;
    pool: string;
    internal: boolean;
    memo: string | null;
    // Full ZIP 302 field and its hash, including for text memos.
    memoBinary: { hex: string; hash: string } | null;
    address: string | null;
  }[];
  // outputs we sent to external recipients (real addresses; own sends only)
  external: {
    address: string;
    value: string;
    pool: string;
    memo?: string | null;
    memoBinary?: { hex: string; hash: string } | null;
  }[];
  feeZat: string | null;
};

export type IZcashHistoryItem = {
  txid: string;
  minedHeight: number | null;
  timestamp: number | null;
  valueZat: string; // signed: negative = outgoing
  fee: string | null;
  broadcastOutcomeUnknown?: boolean;
  pending: boolean;
  expired: boolean;
  txType: 'received' | 'sent' | 'shielded';
  recipient: string | null;
  // Exact upstream pool identifiers touched by the tx; pool 0 is transparent, each shielded pool keeps its own ID.
  poolIds: number[];
  // Signed balance delta per touched pool, in zatoshi; string keys preserve exact runtime pool IDs (including future ones and 0).
  perPoolBalanceDeltaZat: Record<string, string>;
};

// Host uses this to hide actions it can't complete, rather than let them fail mid-pipeline.
// A send failing at the proving step has already locked notes and asked the user for their password.
export type IZcashCapabilities = {
  scan: boolean;
  balance: boolean;
  history: boolean;
  // Spending requires proving AND signing for the bundle actually used; post-NU6.3 unified-address payments use Ironwood.
  spend: boolean;
  shieldTransparent: boolean;
  withdrawToTransparent: boolean;
  // Machine-readable reasons, keyed by capability, for logs and support.
  unsupportedReasons: Record<string, string>;
};

export type IZcashSdkApi = {
  // Tears down a wedged carrier so the next call starts clean (desktop: terminates the Worker; in-thread: swaps the lease).
  resetCarrier: () => Promise<void>;

  // Perf tracing for slow reads; off by default — during a boost these fire several times/sec, enough to itself slow a console-attached page.
  setPerfTrace: (params: { enabled: boolean }) => Promise<void>;
  // Public circuit parameters only: no proposal, reservation, seed, or storage.
  prewarmPczt: (params: {
    network: IZcashNetwork;
    targetHeight: number;
  }) => Promise<void>;
  // Reports what this build can do. Cheap, no network, no wallet database.
  capabilities: () => Promise<IZcashCapabilities>;

  runRuntimeSelfTest: (params: {
    stage: IZcashRuntimeSelfTestStage;
  }) => Promise<IZcashRuntimeSelfTestResult>;

  // No keys/wallet needed; anchors a birthday before derivation and backs the manual rescan-from-earlier repair. Returns null (not throw) on failure.
  getChainTip: (params: IZcashGetChainTipParams) => Promise<number | null>;

  // Stateless recipient decoding; does not open scan storage or use the network.
  validateAddress: (params: {
    network: IZcashNetwork;
    address: string;
  }) => Promise<boolean>;

  // keys side
  deriveAccount: (
    params: IZcashDeriveAccountParams,
  ) => Promise<IZcashDeriveAccountResult>;
  deriveAddressFromUfvk: (
    params: IZcashDeriveAddressFromUfvkParams,
  ) => Promise<IZcashDeriveAddressFromUfvkResult>;
  signPczt: (params: IZcashSignPcztParams) => Promise<{ pcztHex: string }>;
  verifyPcztReview: (params: {
    pcztHex: string;
    review: IZcashPcztReviewRequest;
  }) => Promise<void>;
  // BIP44 account xpub (m/44'/133'/hdIndex') rebuilt from the UFVK's transparent FVK; lets a hardware account skip a second device call.
  deriveTransparentXpubFromUfvk: (
    params: IZcashDeriveTransparentXpubFromUfvkParams,
  ) => Promise<{ xpub: string }>;
  // Merges an externally signed (redacted) PCZT back into the local copy; stateless, no wallet database.
  combinePczt: (
    params: IZcashCombinePcztParams,
  ) => Promise<{ pcztHex: string }>;
  parseTransparentTransactions: (
    params: IZcashParseTransparentTransactionsParams,
  ) => Promise<IZcashParsedTransparentTransaction[]>;
  quoteTransparentTx: (
    params: IZcashTransparentTxRequest,
  ) => Promise<IZcashTransparentTxQuote>;
  buildTransparentTxWithSeed: (
    params: IZcashTransparentTxRequest & { seedHex: string },
  ) => Promise<IZcashTransparentTxBuildResult>;
  buildTransparentTxWithAccountXprv: (
    params: IZcashTransparentTxRequest & { accountXprvHex: string },
  ) => Promise<IZcashTransparentTxBuildResult>;
  createTransparentHardwarePczt: (
    params: IZcashTransparentHardwareCreateParams,
  ) => Promise<{ pcztHex: string }>;
  finalizeTransparentHardwarePczt: (
    params: IZcashTransparentHardwareFinalizeParams,
  ) => Promise<IZcashTransparentTxBuildResult>;
  redactPcztForHardwareSigner: (params: {
    pcztHex: string;
  }) => Promise<{ pcztHex: string }>;

  // wallet side (watch-only)
  prepareWalletAccounts: (
    accounts: IZcashWalletAccount[],
    options?: { retainedUfvks: string[] },
  ) => Promise<void>;
  syncWallet: (
    account: IZcashWalletAccount,
    options: { activeUfvks: string[]; chainTip?: number | null },
  ) => Promise<IZcashSyncResult>;
  queueRescanFrom: (
    account: IZcashWalletAccount,
    params: { fromHeight: number },
  ) => Promise<{ queued: boolean; fromHeight: number; toHeight: number }>;
  getSyncProgress: (
    account: IZcashWalletAccount,
  ) => Promise<IZcashSyncProgress>;
  // What the scanner last observed about its node; not a probe — reading costs nothing, adds no traffic.
  getEndpointHealth: () => Promise<
    | { url: string; ok: boolean; latencyMs: number | null; atMs: number }
    | undefined
  >;
  // Developer diagnostics for the real persisted database; checks existence first so an empty test run never creates one.
  diagnoseWalletDatabase: (params: {
    network: IZcashNetwork;
    account?: IZcashWalletAccount;
  }) => Promise<IZcashDatabaseDiagnostics>;
  getBalance: (account: IZcashWalletAccount) => Promise<IZcashBalance>;
  getHistory: (
    account: IZcashWalletAccount,
    pagination?: { limit?: number; offset?: number },
  ) => Promise<IZcashHistoryItem[]>;
  getTxDetails: (
    account: IZcashWalletAccount,
    params: { txid: string },
  ) => Promise<IZcashTxDetails>;
  getPendingBroadcasts: (account: IZcashWalletAccount) => Promise<string[]>;
  // Spends only the given shielded pool; an insufficient balance fails with the shortfall so the host can report how much is missing.
  createPczt: (
    account: IZcashWalletAccount,
    params: {
      toAddress: string;
      valueZat: string;
      spendSource: IZcashSpendSource;
      memoHex?: string;
      reservationId?: string;
    },
  ) => Promise<IZcashPcztReservation>;
  // Exact ZIP-317 fee for a transfer: proposal only, no PCZT built.
  quotePczt: (
    account: IZcashWalletAccount,
    params: {
      toAddress: string;
      valueZat: string;
      spendSource: IZcashSpendSource;
      memoHex?: string;
    },
  ) => Promise<IZcashSendQuote>;
  provePczt: (
    account: IZcashWalletAccount,
    params: { pcztHex: string },
  ) => Promise<{ pcztHex: string }>;
  // Broadcasts, then records unless the node explicitly rejected it.
  submitPczt: (
    account: IZcashWalletAccount,
    params: { pcztHex: string; reservationId: string },
  ) => Promise<IZcashSendResult>;
  releasePczt: (
    account: IZcashWalletAccount,
    params: { reservationId: string },
  ) => Promise<void>;
  // drop the in-memory wallet and its persisted db cache (account removed)
  purgeWallet: (
    account: IZcashWalletAccount,
    options?: { accountDeleted?: boolean },
  ) => Promise<void>;
  // Deletes the whole per-network database (app reset); every account's decrypted scan state goes with it.
  dropWalletDatabase: (network: IZcashNetwork) => Promise<void>;
};

export type IGetZcashApi = () => Promise<IZcashSdkApi>;
export type IEnsureSDKReady = () => Promise<boolean>;

export interface IZcashSdk {
  getZcashApi: IGetZcashApi;
  ensureSDKReady: IEnsureSDKReady;
}
