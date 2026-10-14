// Diagnostic metadata is never part of the signed transaction or a server request.
export type ISolanaBlockhashDiagnostic = {
  recentBlockhash?: string;
  lastValidBlockHeight?: number;
  contextSlot?: number;
  commitment?: 'confirmed';
  /** Device wall-clock time when getLatestBlockhash returned, not hash generation. */
  blockhashFetchedAt?: number;
  blockhashFetchAttempts?: number;
  blockhashFetchDurationMs?: number;
};

export type ISolanaTxDiagnosticContext = ISolanaBlockhashDiagnostic & {
  correlationId: string;
  startedAt: number;
};

export type ISolanaTxDiagnosticStage =
  | 'built'
  | 'blockhashFetch'
  | 'auth'
  | 'refresh'
  | 'sign'
  | 'qrShowRequested'
  | 'qrRenderReady'
  | 'qrScanStarted'
  | 'qrScanAccepted'
  | 'qrResponse'
  | 'rpcSelected'
  | 'broadcastRequest'
  | 'broadcast'
  | 'finished';

export type ISolanaTxDiagnosticReason =
  | 'blockhashAcquisitionUnobserved'
  | 'signOnly'
  | 'unparseable'
  | 'multipleSigners'
  | 'alreadySigned'
  | 'durableNonce'
  | 'fetchFailed'
  | 'externalAccount'
  | 'alwaysSignOnlySendTx'
  | 'stage'
  | 'legacy'
  | 'superseded'
  | 'cancelled';

export type ISolanaTxDiagnosticDetails = {
  stage: ISolanaTxDiagnosticStage;
  status: 'started' | 'succeeded' | 'failed' | 'skipped' | 'cancelled';
  runtime?: 'main' | 'bg';
  reason?: ISolanaTxDiagnosticReason;
  transactionVersion?: 'legacy' | 'versioned';
  requiredSignatures?: number;
  hasExistingSignatures?: boolean;
  durableNonce?: boolean;
  signOnly?: boolean;
  rpcMode?: 'default' | 'custom';
  preflightCommitment?: 'confirmed';
  reportingOnly?: boolean;
  attempt?: number;
  attempts?: number;
  durationMs?: number;
  httpRequestId?: string;
  httpStatus?: number;
  errorCode?: 40_028 | 40_034;
  errorCategory?:
    | 'blockhashNotFound'
    | 'executionFailed'
    | 'cancelled'
    | 'timeout'
    | 'network'
    | 'invalidQrOrSignature'
    | 'unknown';
};

export type ISolanaTxDiagnosticEvent = ISolanaTxDiagnosticContext &
  ISolanaTxDiagnosticDetails & {
    timestamp: string;
    elapsedMs?: number;
  };
