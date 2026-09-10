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

// Report returned by the WebZjs smoke test — proves a given carrier
// (offscreen / desktop bg / webembed) can actually load and run the wasm.
export type IZcashSmokeParams = {
  lightwalletdUrl: string;
  mnemonic: string;
  // scan this many blocks back from the chain tip (keep small for a smoke run)
  birthdayOffset?: number;
};

export type IZcashSmokeResult = {
  crossOriginIsolated: boolean;
  hasSharedArrayBuffer: boolean;
  // 'started' | 'skipped (no COI)' | 'error: ...'
  threadPool: string;
  walletWasmLoaded: boolean;
  keysWasmLoaded: boolean;
  chainTip: number | null;
  unifiedAddress: string | null;
  transparentAddress: string | null;
  // sync is only attempted when crossOriginIsolated (threads available)
  syncMs: number | null;
  fullyScanned: number | null;
  balances: unknown;
  historyLength: number | null;
  // keys module: spending-key derivation + PCZT signing availability
  pcztSignAvailable: boolean;
  uskDerived: boolean;
  error?: string;
  errorStack?: string | null;
};

export type IZcashNetwork = 'main' | 'test';

// ---- keys side (works on every carrier, no sync/threads needed) ----

export type IZcashGetChainTipParams = {
  network: IZcashNetwork;
  lightwalletdUrl: string;
};

export type IZcashDeriveAccountParams = {
  network: IZcashNetwork;
  // BIP39 64-byte seed in the JSON-safe carrier wire format. It enters only
  // the keys wasm to derive USK -> UFVK and must never be logged or persisted;
  // the wallet runtime receives only the viewing-level result.
  seedHex: string;
  hdIndex: number;
  // Used by full wallet carriers to query the chain tip. Keys-only carriers
  // derive both display addresses offline and return a null chain tip.
  lightwalletdUrl: string;
};

export type IZcashDeriveAccountResult = {
  ufvk: string; // encoded UnifiedFullViewingKey (viewing capability, like xpub)
  seedFingerprintHex: string;
  unifiedAddress: string;
  transparentAddress: string; // t1... derived from the UFVK
  // chain tip at derivation time — callers persist a fixed birthday from it for
  // freshly created accounts (null when the tip fetch failed / offline)
  chainTip: number | null;
};

// Re-derive display addresses from the persisted UFVK — used by the
// addressSchemeVersion lazy self-heal; needs no seed and no password.
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
  // Full local copy (created by createPczt/shieldFunds).
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
  recipients: { address: string; amountZat?: string }[];
  sendMax: boolean;
  change?: { address: string; derivationPath: string };
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

export type IZcashPcztReservation = {
  pcztHex: string;
  // Fee of the exact locked proposal represented by pcztHex.
  feeZat: string;
  // Opaque 32-byte owner token (hex) for the inputs selected by this PCZT.
  // It is not a secret; callers must carry it until send or cancellation.
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
  synced: boolean; // false when the carrier has no threads (no COI)
  // false when a bounded pass observes no wallet-state mutation; callers can
  // skip serialization, UI refreshes, and other expensive follow-up work
  stateChanged: boolean;
  chainTip: number | null;
  fullyScanned: number | null;
  // true when the bounded step budget ran out with historic ranges still
  // queued -- the next sync invocation continues the backfill
  backfillRemaining?: boolean;
  // false when the transparent UTXO refresh was attempted and failed. Block
  // scanning only yields shielded notes; transparent balance comes from a
  // separate address query, so a failure there leaves the transparent side
  // stale while everything else looks current. Reported rather than swallowed
  // because that staleness is otherwise invisible.
  transparentCurrent?: boolean;
  // Definite node rejections observed while retrying locally stored unmined
  // transactions. The host persists these as Failed; network failures are not
  // included because their outcome remains unknown/Pending.
  rebroadcastRejectedTxids?: string[];
  rebroadcastAcceptedTxids?: string[];
  // Recorded transactions that are already mined or expired and no longer
  // need a network retry.
  rebroadcastSettledTxids?: string[];
};

export type IZcashSyncProgress = {
  // The birthday lane is the authoritative wallet-completeness indicator.
  birthdayHeight: number | null;
  backfillScannedHeight: number | null;
  backfillTargetHeight: number | null;
  backfillProgress: number | null;
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

export type IZcashStorageBenchmarkBackend = 'relaxedIdb' | 'opfsSahpool';

export type IZcashStorageBenchmarkCase =
  | 'capability'
  | 'crud'
  | 'reopen'
  | 'crashRecovery'
  | 'concurrentAccess'
  | 'largeDatabase'
  | 'cleanup';

export type IZcashStorageBenchmarkPreset = 'quick' | 'stress';

export type IZcashStorageBenchmarkRuntimeResult = {
  backend: IZcashStorageBenchmarkBackend;
  action: 'probe' | 'replace' | 'append' | 'verify' | 'mutate' | 'cleanup';
  databaseName: string;
  supported: boolean;
  vfsName: string;
  totalMs: number;
  timingsMs: Record<string, number>;
  memoryBytes: {
    start: number;
    afterOpen?: number;
    afterAction: number;
  };
  workload?: {
    requestedRows: number;
    payloadBytes: number;
    batchSize: number;
    writerId: number;
  };
  actionMetrics?: {
    batchLatencyMs?: {
      count: number;
      p50: number;
      p95: number;
      max: number;
    };
    rowsPerSecond?: number;
    payloadMiBPerSecond?: number;
    updatedRows?: number;
    deletedRows?: number;
  };
  sampleMetrics?: {
    checkedRows: number;
    mismatches: number;
    readLatencyMs: {
      count: number;
      p50: number;
      p95: number;
      max: number;
    };
  };
  data?: {
    rowCount: number;
    payloadBytes: number;
    checksumSum: number;
    generationSum: number;
    writerCount: number;
  };
  integrity?: {
    quickCheckOk: boolean;
    messages: string[];
    foreignKeyViolations: number;
  };
  sqlite?: {
    pageSize: number;
    pageCount: number;
    freePages: number;
    logicalBytes: number;
    journalMode: string;
    synchronous: number;
  };
  deleted?: boolean;
  error?: {
    code: string;
    params: Record<string, unknown>;
    detail: string | null;
  };
};

export type IZcashStorageBenchmarkAssertion = {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
};

export type IZcashStorageBenchmarkPhaseError = {
  error: {
    name: string;
    message: string;
    code?: string;
    params?: unknown;
    detail?: string;
    stack?: string;
  };
};

export type IZcashStorageBenchmarkBackendResult = {
  backend: IZcashStorageBenchmarkBackend;
  status: 'passed' | 'failed' | 'unsupported';
  verdict: string;
  assertions: IZcashStorageBenchmarkAssertion[];
  phases: Record<
    string,
    IZcashStorageBenchmarkRuntimeResult | IZcashStorageBenchmarkPhaseError
  >;
};

export type IZcashStorageBenchmarkResult = {
  testCase: IZcashStorageBenchmarkCase;
  preset: IZcashStorageBenchmarkPreset;
  databaseName: string | null;
  isolatedFromWalletData: true;
  execution: {
    runtimeScope: 'dedicated-benchmark-worker';
    storageOwnership: {
      relaxedIdb: 'origin-shared-indexeddb';
      opfsSahpool: 'exclusive-opfs-sync-access-handles';
    };
    origin: string | null;
    persisted: boolean | null;
    originUsageBeforeBytes: number | null;
    originUsageAfterBytes: number | null;
    originQuotaBytes: number | null;
    storageEstimateError: string | null;
  };
  workload: {
    rowCount: number;
    payloadBytes: number;
    batchSize: number;
    settleMs: number;
  } | null;
  backends: Record<
    IZcashStorageBenchmarkBackend,
    IZcashStorageBenchmarkBackendResult
  >;
  durationMs: number;
};

// Per-pool composition, string zatoshi. The labels next to the numbers must
// match how the numbers are computed (a lesson taken from Ledger's
// balance-eligibility code, which refuses total-minus-spendable for exactly this
// reason): maturing = pendingChange + pendingSpendable, locked = reserved by
// an in-flight send. Never present a lump the UI then has to guess about.
// Restricts note selection to one shielded pool. Used by per-pool withdraw so
// "move my Orchard balance out" cannot quietly spend Ironwood, and vice versa.
// The runtime never crosses pools when this is set: a shortfall is
// INSUFFICIENT_FUNDS, not a fallback to the other pool.
export type IZcashSpendSource = 'orchard' | 'ironwood';

export type IZcashPoolDetail = {
  spendable: string;
  pendingChange: string;
  pendingSpendable: string;
  locked: string;
  total: string;
};

export type IZcashBalance = {
  // zatoshi strings (1 ZEC = 1e8 zatoshi); bigint-safe across the bridge
  shielded: string; // orchard + ironwood pools, summed
  transparent: string; // unshielded
  // What a send can actually draw on right now, under this build's spend
  // policy and confirmation thresholds. This -- not `total`, not
  // `shielded + transparent` -- is the figure a "max" button must use: it is
  // produced by the same layer that decides what a proposal will accept, so
  // the two cannot disagree.
  spendable: string;
  pendingChange: string;
  pendingSpendable: string;
  total: string;
  // Per-pool breakdown for TokenDetails -- kept separate from `shielded`
  // because Orchard and Ironwood have different spend behavior.
  orchardBalance: string;
  ironwoodBalance: string;
  transparentBalance: string;
  // Spendable portion of the SHIELDED pools only (confirmation thresholds
  // applied). This is the withdraw ceiling:
  // `spendable` is aggregate policy output; a shielded-to-transparent
  // withdraw must still use this shielded-only ceiling.
  shieldedSpendable: string;
  // Per-pool composition for the pool UI (see IZcashPoolDetail).
  poolsDetail: {
    orchard: IZcashPoolDetail;
    ironwood: IZcashPoolDetail;
    transparentRegular: IZcashPoolDetail;
    transparentCoinbase: IZcashPoolDetail;
  };
  // Transparent split. Coinbase cannot be shielded by this runtime
  // (propose_shielding_coinbase unimplemented), so the Shield button must
  // gate on `transparentRegularBalance`, not on the merged figure -- a
  // coinbase-only account would confirm, enter a password, and then fail.
  transparentRegularBalance: string;
  transparentCoinbaseBalance: string;
};

// What a send will actually do, taken from the real proposal before anything is
// built or locked -- so the host can disclose it while the user can still change
// their mind.
//
// Sends draw on transparent UTXOs when they are there. The wallet does not
// refuse that: the funds are the user's and the chain accepts the transaction.
// It reports what will happen instead.
export type IZcashSendQuote = {
  feeZat: string;
  // Which pools fund this send, in zatoshi.
  sourceTransparentZat: string;
  sourceShieldedZat: string;
  // True when this transaction spends transparent AND shielded inputs together,
  // which puts the t-address and a shielded spend on chain in the same
  // transaction and links them. This is the only *new* exposure from spending
  // transparent funds -- a transparent-only spend looks like shielding from
  // outside -- so it is the case that deserves a warning rather than a note.
  linksTransparentToShielded: boolean;
  // What this send would cost using shielded funds only, when that is possible
  // at all (null when the shielded balance cannot cover it). Transparent inputs
  // each count as a ZIP-317 logical action, so spending them is measurably more
  // expensive -- 20000 vs 10000 zatoshi for the same payment in testing.
  //
  // Offered so the host can show the price of the choice, not so it can make
  // the choice: a wallet that silently picked the cheaper source would be
  // deciding the user's privacy for them in the other direction.
  shieldedOnlyFeeZat: string | null;
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
    address: string | null;
  }[];
  // outputs we sent to external recipients (real addresses; own sends only)
  external: { address: string; value: string; pool: string }[];
  feeZat: string | null;
};

export type IZcashHistoryItem = {
  txid: string;
  minedHeight: number | null;
  timestamp: number | null;
  valueZat: string; // signed: negative = outgoing
  fee: string | null;
  pending: boolean;
  expired: boolean;
  txType: 'received' | 'sent' | 'shielded';
  recipient: string | null;
  // Exact upstream identifiers for every account-owned pool touched by the
  // transaction. Pool 0 is transparent; every shielded pool keeps its own ID.
  poolIds: number[];
  // Signed account balance delta per touched pool, in zatoshi. String keys
  // preserve exact runtime pool identifiers, including future pools and 0.
  perPoolBalanceDeltaZat: Record<string, string>;
};

// What the runtime can actually do right now. The host uses this to hide
// actions it cannot complete, instead of letting them fail mid-pipeline —
// a send that fails at the proving step has already locked notes and already
// asked the user for their password.
export type IZcashCapabilities = {
  scan: boolean;
  balance: boolean;
  history: boolean;
  // Spending requires proving AND signing support for the bundle the payment
  // actually uses. Post-NU6.3 payments to a unified address use Ironwood.
  spend: boolean;
  shieldTransparent: boolean;
  withdrawToTransparent: boolean;
  // Machine-readable reasons, keyed by capability, for logs and support.
  unsupportedReasons: Record<string, string>;
};

export type IZcashSdkApi = {
  // Tears down a wedged carrier so the next call starts clean. Desktop
  // terminates the Worker; in-thread carriers swap the lease and drop the
  // cached module handles (best effort -- a busy-wedged wasm instance stays
  // unusable until reload, but new state is at least reachable again).
  resetCarrier: () => Promise<void>;

  // Performance tracing for "why did that read feel slow". Off by default:
  // during a boost these fire several times a second, and that volume is
  // itself enough to make a console-attached page crawl -- the thing being
  // measured must not be created by the measurement.
  setPerfTrace: (params: { enabled: boolean }) => Promise<void>;
  // Reports what this build can do. Cheap, no network, no wallet database.
  capabilities: () => Promise<IZcashCapabilities>;

  runRuntimeSelfTest: (params: {
    stage: IZcashRuntimeSelfTestStage;
  }) => Promise<IZcashRuntimeSelfTestResult>;

  // Legacy carrier load and network probe; does not scan or sign transactions.
  smokeTest: (params: IZcashSmokeParams) => Promise<IZcashSmokeResult>;

  // No keys/wallet needed -- used to anchor a birthday BEFORE derivation is
  // attempted (see KeyringHd.zcashDeriveAndSaveOneAccountMeta's pending-
  // birthday capture) and for the manual rescan-from-earlier repair. Returns
  // null on failure (offline etc) rather than throwing.
  getChainTip: (params: IZcashGetChainTipParams) => Promise<number | null>;
  // Build-time dependency versions; `zcash_client_sqlite` is the storage
  // schema the host must remember to detect an incompatible runtime swap.
  getRuntimeVersions: () => Promise<Record<string, string>>;

  // keys side
  deriveAccount: (
    params: IZcashDeriveAccountParams,
  ) => Promise<IZcashDeriveAccountResult>;
  deriveAddressFromUfvk: (
    params: IZcashDeriveAddressFromUfvkParams,
  ) => Promise<IZcashDeriveAddressFromUfvkResult>;
  signPczt: (params: IZcashSignPcztParams) => Promise<{ pcztHex: string }>;
  // BIP44 account xpub (m/44'/133'/hdIndex') rebuilt from the UFVK's
  // transparent FVK; lets a hardware account skip a second device call.
  deriveTransparentXpubFromUfvk: (
    params: IZcashDeriveTransparentXpubFromUfvkParams,
  ) => Promise<{ xpub: string }>;
  // Merges an externally signed (redacted) PCZT back into the local copy.
  // Stateless: no wallet database involved.
  combinePczt: (
    params: IZcashCombinePcztParams,
  ) => Promise<{ pcztHex: string }>;
  quoteTransparentTx: (
    params: IZcashTransparentTxRequest,
  ) => Promise<IZcashTransparentTxQuote>;
  buildTransparentTxWithSeed: (
    params: IZcashTransparentTxRequest & { seedHex: string },
  ) => Promise<IZcashTransparentTxBuildResult>;
  buildTransparentTxWithAccountXprv: (
    params: IZcashTransparentTxRequest & { accountXprvHex: string },
  ) => Promise<IZcashTransparentTxBuildResult>;

  // wallet side (watch-only)
  prepareWalletAccounts: (accounts: IZcashWalletAccount[]) => Promise<void>;
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
  // Developer diagnostics for the real persisted network database. It first
  // checks existence so an empty test run never creates a database.
  diagnoseWalletDatabase: (params: {
    network: IZcashNetwork;
    account?: IZcashWalletAccount;
  }) => Promise<IZcashDatabaseDiagnostics>;
  // Developer-only synthetic storage comparison. Every operation runs in a
  // fresh Worker and uses benchmark-only VFS namespaces/database names.
  runStorageBenchmark: (params: {
    testCase: IZcashStorageBenchmarkCase;
    preset: IZcashStorageBenchmarkPreset;
  }) => Promise<IZcashStorageBenchmarkResult>;
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
  // When spendTransparent is enabled, transparent inputs are selected before
  // the permitted shielded pool. Call `quotePczt` first with the same policy:
  // its funding breakdown is what this send will really do.
  //
  // When the funds genuinely are not there, the failure carries the whole
  // picture -- shielded available, transparent available, and the shortfall --
  // so the host can tell the user what to do instead of just "insufficient
  // funds" against a balance they can see.
  createPczt: (
    account: IZcashWalletAccount,
    params: {
      toAddress: string;
      valueZat: string;
      spendSource: IZcashSpendSource;
      reservationId?: string;
      spendTransparent?: boolean;
    },
  ) => Promise<IZcashPcztReservation>;
  // Shields the whole transparent balance. No destination, no amount.
  shieldFunds: (
    account: IZcashWalletAccount,
    params?: { reservationId?: string },
  ) => Promise<IZcashPcztReservation>;
  // Exact ZIP-317 fee for the transparent sweep proposal, without locking.
  quoteShieldFunds: (
    account: IZcashWalletAccount,
  ) => Promise<{ feeZat: string }>;
  // Exact ZIP-317 fee for a transfer: proposal only, no PCZT built.
  quotePczt: (
    account: IZcashWalletAccount,
    params: {
      toAddress: string;
      valueZat: string;
      spendSource: IZcashSpendSource;
      spendTransparent?: boolean;
    },
  ) => Promise<IZcashSendQuote>;
  provePczt: (
    account: IZcashWalletAccount,
    params: { pcztHex: string },
  ) => Promise<{ pcztHex: string }>;
  finalizePczt: (
    account: IZcashWalletAccount,
    params: { pcztHex: string; reservationId: string },
  ) => Promise<{ txid: string }>;
  broadcastPczt: (
    account: IZcashWalletAccount,
    params: { txid: string },
  ) => Promise<IZcashSendResult>;
  releasePczt: (
    account: IZcashWalletAccount,
    params: { reservationId: string },
  ) => Promise<void>;
  // drop the in-memory wallet and its persisted db cache (account removed)
  purgeWallet: (account: IZcashWalletAccount) => Promise<void>;
  // delete the whole per-network database (app reset); every account's
  // decrypted scan state goes with it
  dropWalletDatabase: (network: IZcashNetwork) => Promise<void>;
};

export type IGetZcashApi = () => Promise<IZcashSdkApi>;
export type IEnsureSDKReady = () => Promise<boolean>;

export interface IZcashSdk {
  getZcashApi: IGetZcashApi;
  ensureSDKReady: IEnsureSDKReady;
}
