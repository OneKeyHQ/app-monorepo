import type {
  ETranslations,
  ETranslationsMock,
} from '@onekeyhq/shared/src/locale';

/**
 * STRK20 (starknet-privacy) shared contract.
 *
 * `packages/kit` may not depend on the bg-only vendored privacy SDK (kit-bg `sdkStarknet/privacy`),
 * so every enum the UI needs is re-declared here and kept numerically identical
 * to the SDK's own. The viewing key never appears in this file: it exists only
 * inside `bg` and is never part of a `@backgroundMethod()` return value.
 */

/** Identifies one opt-in subject. The pool address is resolved from config. */
export type IStrk20AccountKey = {
  networkId: string;
  accountId: string;
};

/**
 * There is deliberately no gateway URL here. The SDK builds its OHTTP client
 * from the discovery or proving base URL it is already talking to
 * (`IndexerDiscoveryProvider` passes its own `apiUrl` as the gateway), so a
 * separate gateway host cannot be configured and must not look configurable.
 */
export type IStrk20OhttpConfig = {
  enabled: boolean;
  /** Encapsulated requests go here instead of the gateway when set. */
  relayUrl?: string;
  /**
   * Pinned key config, hex. Required whenever the feature is enabled: without
   * it the SDK fetches `/ohttp-keys` trust-on-first-use, which is exactly what
   * an active network attacker needs.
   */
  publicKeyConfig?: string;
};

export type IStrk20ProvingKind = 'jsonRpc' | 'starkscan';

/**
 * Built into the app; the server can only switch the feature off, through the
 * network list's `extensions.localWallet.privacyDisabled`.
 */
export type IStrk20PrivacyNetworkConfig = {
  networkId: string;
  poolAddress: string;
  discoveryUrl: string;
  /** JSON-RPC prover url; unused, and may be empty, for `starkscan`. */
  provingUrl: string;
  /**
   * Wire shape of the proving service. Defaults to `jsonRpc`. `starkscan` is
   * Starkscan's job API through the wallet proxy (route `prover`), where the
   * backend adds the API key.
   */
  provingKind?: IStrk20ProvingKind;
  ohttp?: IStrk20OhttpConfig;
  auditorPublicKey: string;
  /** Lowest RPC spec version that carries `proof` on addInvokeTransaction. */
  minRpcSpecVersion: string;
};

export enum EStrk20OptInStatus {
  None = 'none',
  /** Consent recorded locally, register tx not built or not submitted yet. */
  Consented = 'consented',
  RegisterPending = 'registerPending',
  Registered = 'registered',
  /** On-chain key differs from this device's derivation; never re-register. */
  Mismatch = 'mismatch',
}

export type IStrk20OptInStatusValue = `${EStrk20OptInStatus}`;

export type IStrk20SubmittedTransfer = {
  txid: string;
  kind: IStrk20TransferKind;
  status: 'pending' | 'confirmed' | 'failed';
  submittedAt: number;
  provingBlockId?: number;
};

/**
 * One persisted record per `${networkId}_${accountId}_${poolAddress}`. Every
 * field is public: the SNIP persistence section allows exactly this set.
 */
export type IStrk20AccountPrivacyState = {
  profileId: 'account-leaf-v1';
  version: 1;
  /** Repeated from the record key so removal and enumeration need no parsing. */
  networkId: string;
  accountId: string;
  chainId: string;
  accountAddress: string;
  poolAddress: string;
  keyIndex: number;
  accountKeyScheme: string;
  /** Hash of the account PUBLIC key only, per the SNIP. */
  accountKeyFingerprint: string;
  accountDerivationPath?: string;
  /** Read back from the pool's `get_public_key`; absent until registered. */
  registeredPublicKey?: string;
  optInStatus: IStrk20OptInStatusValue;
  consentAcceptedAt?: number;
  registerTxid?: string;
  /** When the register tx reached the node; a missing receipt remains pending until expired. */
  registerSubmittedAt?: number;
  /** Proving block recorded at submission so dropped registrations can expire after validityWindow. */
  registerProvingBlockId?: number;
  /** Only an explicit failed receipt or expired dropped tx permits another registration attempt. */
  registerTxFailed?: boolean;
  /** First-use deployment is submitted through the ordinary confirmation flow. */
  activationTxid?: string;
  /** Public transaction identity only; no amount, recipient, notes or viewing key. */
  lastTransfer?: IStrk20SubmittedTransfer;
  /** Last block a tx the proof will read landed in; drives the 10-block gate. */
  lastTxBlockNumber?: number;
  lastRefreshAt?: number;
};

export enum EStrk20SequencingStatus {
  ActivationRequired = 'activationRequired',
  Ready = 'ready',
  Waiting = 'waiting',
  Unavailable = 'unavailable',
}

export type IStrk20SequencingState = {
  status: `${EStrk20SequencingStatus}`;
  latestBlock: number;
  lastTxBlockNumber?: number;
  blocksRemaining: number;
  estimatedSecondsRemaining: number;
  /** `latest - 9`, set only when ready. Proofs never use a block tag. */
  provingBlockId?: number;
};

export enum EStrk20WarningCode {
  /** One tx opens more than one channel, linking the recipients. */
  UserLinkage = 'USER_LINKAGE',
}

export type IStrk20Warning = {
  code: `${EStrk20WarningCode}`;
  message: string;
};

export type IStrk20HistoryChannelKind =
  | 'incoming'
  | 'outgoing'
  | 'self_channel';

/**
 * Opaque handle to a bg-owned `HistoryCursor`. Channel keys stay inside
 * `ServiceStarknetPrivacy` and never cross the bg/main IPC boundary.
 */
export type IStrk20HistoryCursor = {
  cursorId: string;
};

export type IStrk20PrivateBalances = {
  /** token address (hex, lowercased) -> pooled amount in base units */
  byToken: Record<string, string>;
  noteCount: number;
  /** Block the notes were discovered against. */
  blockNumber: number;
};

export enum EStrk20ErrorRetry {
  No = 'no',
  Yes = 'yes',
  /** Retry once after the SDK's own single self-heal. */
  Once = 'once',
  /** Retryable only after rebuilding the proof, which re-arms the block gate. */
  AfterRebuild = 'afterRebuild',
}

/** Stable error identity; translated copy is display-only. */
export enum EStrk20ErrorCode {
  ScreeningRejected = 'screening_rejected',
  ScreeningUnavailable = 'screening_unavailable',
  ProvingBehind = 'proving_behind',
  ProvingValidation = 'proving_validation',
  VersionMismatch = 'version_mismatch',
  Internal = 'internal',
  ServiceBusy = 'service_busy',
  RequestRejected = 'request_rejected',
  Reorg = 'reorg',
  ServiceOverloaded = 'service_overloaded',
  ProvingQuota = 'proving_quota',
  ProvingUnauthorized = 'proving_unauthorized',
  ProvingDeliveryUnknown = 'proving_delivery_unknown',
  ProvingTimeout = 'proving_timeout',
  Unavailable = 'unavailable',
  Locked = 'locked',
  KeyMismatch = 'key_mismatch',
  PoolPaused = 'pool_paused',
  Waiting = 'waiting',
  ScreeningWindowExpired = 'screening_window_expired',
  ProofExpired = 'proof_expired',
  InvalidAmount = 'invalid_amount',
  RecipientNotRegistered = 'recipient_not_registered',
  Unknown = 'unknown',
  History = 'history',
}

export type IStrk20ErrorMapping = {
  code: EStrk20ErrorCode;
  translationKey: ETranslations | ETranslationsMock;
  translationValues?: Record<string, string | number>;
  /**
   * The enum itself, not a `${EStrk20ErrorRetry}` string union: this value is
   * computed and never persisted or serialized, so there is no reason to widen
   * it, and the UI keeps it in state typed as the enum.
   */
  retryable: EStrk20ErrorRetry;
};

export type EStrk20PrivateTxKind =
  | 'register'
  | 'deposit'
  | 'withdraw'
  | 'transfer';

/** The kinds a user can build from the send form; `register` has its own entry. */
export type IStrk20TransferKind = Exclude<EStrk20PrivateTxKind, 'register'>;

export interface IDecodedTxExtraStarknet {
  accountDeployment?: true;
  // Set only when this tx also deploys the account. Fee is a decimal string in FRI.
  deployAccountFee?: string;
  // tx hash of the counterfactual DEPLOY_ACCOUNT broadcast alongside the invoke
  deployAccountTxId?: string;
  /**
   * STRK20 intent, copied out of `encodedTx.privacy` by `buildDecodedTx`. The
   * confirm screen reads this rather than the encodedTx, and it deliberately
   * omits `proof`, `proofFacts`, `provingBlockId` and `builtAt`: none of those
   * are display data.
   */
  privacy?: IDecodedTxPrivacyStarknet;
}

export type IDecodedTxPrivacyStarknet = {
  kind: EStrk20PrivateTxKind;
  poolAddress: string;
  tokenAddress?: string;
  /** Base units, decimal string — same unit as IStrk20PrivateBalances.byToken. */
  amount?: string;
  recipient?: string;
  /** STRK base units, decimal string. */
  protocolFee?: string;
  warnings?: IStrk20Warning[];
};

/**
 * Mutually exclusive account privacy lifecycle phases (single source of truth).
 * Derived in background by PrivacyLifecycleStore; UI renders strictly from this
 * phase instead of combining overlapping booleans.
 */
export enum EStrk20AccountPhase {
  Unavailable = 'unavailable',
  ActivationRequired = 'activation_required',
  Activating = 'activating',
  NotOptedIn = 'not_opted_in',
  Registering = 'registering',
  KeyLocked = 'key_locked',
  KeyMismatch = 'key_mismatch',
  Ready = 'ready',
}

/**
 * Orthogonal transaction gate state, active only when `phase === Ready`.
 */
export enum EStrk20TxGateStatus {
  Idle = 'idle',
  Submitting = 'submitting',
  PendingTx = 'pending_tx',
  Cooldown = 'cooldown',
}

export type IStrk20TxGateState = {
  status: EStrk20TxGateStatus;
  latestBlock: number;
  lastTxBlockNumber?: number;
  blocksRemaining: number;
  estimatedSecondsRemaining: number;
  provingBlockId?: number;
  pendingTx?: IStrk20SubmittedTransfer;
};

export type IStrk20AccountPrivacySnapshot = {
  phase: EStrk20AccountPhase;
  txGate: IStrk20TxGateState;
  state?: IStrk20AccountPrivacyState;
  sequencing?: IStrk20SequencingState;
  hasConsented: boolean;
  registerTxFailed: boolean;
};
