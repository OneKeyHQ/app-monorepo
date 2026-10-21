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

export type IStrk20PrivacyNetworkConfig = {
  networkId: string;
  /** Master switch. A missing or malformed remote config must never enable it. */
  enabled: boolean;
  poolAddress: string;
  discoveryUrl: string;
  provingUrl: string;
  /** Wire shape of the proving service. Defaults to `jsonRpc`. */
  provingKind?: IStrk20ProvingKind;
  /**
   * Operator-issued key sent as `X-Starkscan-Api-Key`. Distributed via remote
   * config, so it is extractable from any client and only guards Starkscan's
   * per-key quota, not user funds.
   */
  provingApiKey?: string;
  ohttp?: IStrk20OhttpConfig;
  auditorPublicKey: string;
  /** Lowest RPC spec version that carries `proof` on addInvokeTransaction. */
  minRpcSpecVersion: string;
};

export type IStrk20PrivacyConfigEnvelope = {
  version: number;
  updatedAt: number;
  configs: Record<string, IStrk20PrivacyNetworkConfig>;
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
  /** Last block a tx the proof will read landed in; drives the 10-block gate. */
  lastTxBlockNumber?: number;
  lastRefreshAt?: number;
};

export enum EStrk20SequencingStatus {
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

/** Mirrors the SDK's `SetupRequirement`; the numeric values must not drift. */
export enum EStrk20SetupRequirement {
  Register = 0,
  SetupChannel = 1,
  SetupToken = 2,
  Ready = 3,
}

export type IStrk20HistoryChannelKind =
  | 'incoming'
  | 'outgoing'
  | 'self_channel';

export type IStrk20HistorySubchannelCursor = {
  channelKey: string;
  token: string;
  channelKind: IStrk20HistoryChannelKind;
  counterparty: string;
  nextIndex?: number;
};

/**
 * The SDK's `HistoryCursor` with every bigint rendered as hex: a cursor round
 * trips through the UI, and bigint does not survive the bg/main boundary.
 */
export type IStrk20HistoryCursor = {
  subchannels: IStrk20HistorySubchannelCursor[];
  beginBlockNumber?: number;
  historyComplete: boolean;
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

export type IStrk20ErrorMapping = {
  translationKey: ETranslations | ETranslationsMock;
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
