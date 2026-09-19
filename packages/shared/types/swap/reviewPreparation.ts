/* eslint-disable @typescript-eslint/naming-convention */

export const SWAP_REVIEW_PREPARATION_CAPABILITY_VERSION = 1 as const;

export type ESwapReviewEntrySource =
  | 'swap'
  | 'bridge'
  | 'market'
  | 'defi'
  | 'privateSend'
  | 'limit'
  | 'cow'
  | 'fusion'
  | 'perp'
  | 'unknown';

export type ESwapReviewPreparationMode =
  | 'readOnlyPrebuild'
  | 'serverPrepare'
  | 'confirmOnly';

export type ESwapReviewPreparationOutputKind =
  | 'rawTx'
  | 'utxo'
  | 'cell'
  | 'objectTx'
  | 'signedOrder'
  | 'depositOrder'
  | 'depositChannel'
  | 'wrapped'
  | 'unknown';

export type ISwapReviewPreparationDeclaration = {
  version: typeof SWAP_REVIEW_PREPARATION_CAPABILITY_VERSION;
  mode: Exclude<ESwapReviewPreparationMode, 'confirmOnly'>;
  outputKind: Exclude<ESwapReviewPreparationOutputKind, 'unknown'>;
  safeBeforeReview: boolean;
  sideEffectFree: boolean;
  canReuseEncodedTx: boolean;
  expiresInMs?: number;
  reusableUntilMs?: number;
  requiresFreshBuildAtConfirm?: boolean;
  requiresFreshFeeAtConfirm?: boolean;
  requiresFreshNonceOrSequence?: boolean;
  requiresFreshBlockOrLedger?: boolean;
  requiresFreshUtxoOrObject?: boolean;
  requiresFreshResourceState?: boolean;
  createsOneKeyOrder?: boolean;
  createsThirdPartyOrder?: boolean;
  createsDepositAddressOrChannel?: boolean;
};

export type ISwapReviewSessionIdentityFields = {
  entrySource: ESwapReviewEntrySource;
  accountId?: string;
  receivingAccountId?: string;
  fromNetworkId?: string;
  toNetworkId?: string;
  fromTokenId?: string;
  toTokenId?: string;
  implementation?: string;
  fromAmount?: string;
  toAmount?: string;
  receiver?: string;
  provider?: string;
  quoteId?: string;
  eventId?: string;
  quoteGeneration?: number;
  protocol?: string;
  outputKind?: ESwapReviewPreparationOutputKind;
  slippage?: number;
  approvalMode?: string;
  feeMode?: string;
  walletType?: string;
  customRpcFingerprint?: string;
  gasAccountMode?: string;
  marketVariant?: string;
  tradeSource?: string;
  quoteContextFingerprint?: string;
  routeFingerprint?: string;
};

export type ISwapReviewSession = ISwapReviewSessionIdentityFields & {
  sessionId: string;
  revision: number;
};

export type ISwapReviewPreparationCapability = {
  implementation: string;
  provider?: string;
  outputKind: ESwapReviewPreparationOutputKind;
  preparationMode: ESwapReviewPreparationMode;
  canPrepareBeforeReview: boolean;
  canReuseEncodedTx: boolean;
  requiresFreshBuildAtConfirm: boolean;
  requiresFreshFeeAtConfirm: boolean;
  requiresFreshNonceOrSequence: boolean;
  requiresFreshBlockOrLedger: boolean;
  requiresFreshUtxoOrObject: boolean;
  requiresFreshResourceState: boolean;
  createsOneKeyOrder: boolean;
  createsThirdPartyOrder: boolean;
  createsDepositAddressOrChannel: boolean;
  expiresInMs?: number;
  reusableUntilMs?: number;
  reason:
    | 'explicit-contract'
    | 'missing-contract'
    | 'unsafe-output'
    | 'side-effectful-contract'
    | 'missing-prepare-contract'
    | 'missing-implementation'
    | 'invalid-contract';
};

export type ISwapReviewPreparationArtifact = {
  sessionId: string;
  revision: number;
  identityFingerprint: string;
  artifactId: string;
  preparationMode: Exclude<ESwapReviewPreparationMode, 'confirmOnly'>;
  outputKind: Exclude<ESwapReviewPreparationOutputKind, 'unknown'>;
  createdAt: number;
  expiresAt?: number;
  reusableUntil?: number;
  requiresFreshBuildAtConfirm: boolean;
  requiresFreshFeeAtConfirm: boolean;
  freshnessFingerprint?: string;
};
