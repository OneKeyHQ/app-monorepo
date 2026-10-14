import type {
  ISolanaTxDiagnosticContext,
  ISolanaTxDiagnosticEvent,
} from '../../types/solanaTxDiagnostics';

const STAGES = new Set([
  'built',
  'blockhashFetch',
  'auth',
  'refresh',
  'sign',
  'qrShowRequested',
  'qrRenderReady',
  'qrScanStarted',
  'qrScanAccepted',
  'qrResponse',
  'rpcSelected',
  'broadcastRequest',
  'broadcast',
  'finished',
]);
const REASONS = new Set([
  'blockhashAcquisitionUnobserved',
  'signOnly',
  'unparseable',
  'multipleSigners',
  'alreadySigned',
  'durableNonce',
  'fetchFailed',
  'externalAccount',
  'alwaysSignOnlySendTx',
  'stage',
  'legacy',
  'superseded',
  'cancelled',
]);
const STATUSES = new Set([
  'started',
  'succeeded',
  'failed',
  'skipped',
  'cancelled',
]);

function nonnegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

// Project fields explicitly: neither extra tx fields nor arbitrary error data may
// cross the local logger boundary, including values supplied across a JS bridge.
export function sanitizeSolanaTxDiagnosticEvent(
  params: ISolanaTxDiagnosticEvent,
): ISolanaTxDiagnosticEvent | undefined {
  try {
    if (
      typeof params.correlationId !== 'string' ||
      typeof params.timestamp !== 'string' ||
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(
        params.correlationId,
      ) ||
      !STAGES.has(params.stage) ||
      !STATUSES.has(params.status) ||
      nonnegativeNumber(params.startedAt) === undefined ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(params.timestamp)
    ) {
      return undefined;
    }
    return {
      correlationId: params.correlationId,
      startedAt: params.startedAt,
      timestamp: params.timestamp,
      elapsedMs: nonnegativeNumber(params.elapsedMs),
      stage: params.stage,
      status: params.status,
      runtime: params.runtime === 'main' ? 'main' : 'bg',
      reason:
        params.reason && REASONS.has(params.reason) ? params.reason : undefined,
      recentBlockhash:
        typeof params.recentBlockhash === 'string' &&
        /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(params.recentBlockhash)
          ? params.recentBlockhash
          : undefined,
      lastValidBlockHeight: nonnegativeNumber(params.lastValidBlockHeight),
      contextSlot: nonnegativeNumber(params.contextSlot),
      commitment: params.commitment === 'confirmed' ? 'confirmed' : undefined,
      blockhashFetchedAt: nonnegativeNumber(params.blockhashFetchedAt),
      blockhashFetchAttempts: nonnegativeNumber(params.blockhashFetchAttempts),
      blockhashFetchDurationMs: nonnegativeNumber(
        params.blockhashFetchDurationMs,
      ),
      transactionVersion:
        params.transactionVersion === 'legacy' ||
        params.transactionVersion === 'versioned'
          ? params.transactionVersion
          : undefined,
      requiredSignatures: nonnegativeNumber(params.requiredSignatures),
      hasExistingSignatures:
        typeof params.hasExistingSignatures === 'boolean'
          ? params.hasExistingSignatures
          : undefined,
      durableNonce:
        typeof params.durableNonce === 'boolean'
          ? params.durableNonce
          : undefined,
      signOnly:
        typeof params.signOnly === 'boolean' ? params.signOnly : undefined,
      rpcMode:
        params.rpcMode === 'default' || params.rpcMode === 'custom'
          ? params.rpcMode
          : undefined,
      preflightCommitment:
        params.preflightCommitment === 'confirmed' ? 'confirmed' : undefined,
      reportingOnly:
        typeof params.reportingOnly === 'boolean'
          ? params.reportingOnly
          : undefined,
      attempt: nonnegativeNumber(params.attempt),
      attempts: nonnegativeNumber(params.attempts),
      durationMs: nonnegativeNumber(params.durationMs),
      httpRequestId:
        typeof params.httpRequestId === 'string' &&
        /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(
          params.httpRequestId,
        )
          ? params.httpRequestId
          : undefined,
      httpStatus:
        typeof params.httpStatus === 'number' &&
        Number.isInteger(params.httpStatus) &&
        params.httpStatus >= 100 &&
        params.httpStatus <= 599
          ? params.httpStatus
          : undefined,
      errorCode:
        params.errorCode === 40_028 || params.errorCode === 40_034
          ? params.errorCode
          : undefined,
      errorCategory:
        params.errorCategory === 'blockhashNotFound' ||
        params.errorCategory === 'executionFailed' ||
        params.errorCategory === 'cancelled' ||
        params.errorCategory === 'timeout' ||
        params.errorCategory === 'network' ||
        params.errorCategory === 'invalidQrOrSignature' ||
        params.errorCategory === 'unknown'
          ? params.errorCategory
          : undefined,
    };
  } catch {
    return undefined;
  }
}

export function getSolanaDiagnosticError(error: unknown): {
  httpRequestId?: string;
  httpStatus?: number;
  errorCode?: 40_028 | 40_034;
  errorCategory:
    | 'blockhashNotFound'
    | 'executionFailed'
    | 'cancelled'
    | 'timeout'
    | 'network'
    | 'invalidQrOrSignature'
    | 'unknown';
} {
  try {
    const value = error as
      | {
          code?: unknown;
          name?: unknown;
          className?: unknown;
          requestId?: unknown;
          httpStatusCode?: unknown;
          constructor?: { name?: unknown };
        }
      | undefined;
    const code = value?.code;
    const errorClasses = [
      value?.className,
      value?.constructor?.name,
      value?.name,
    ];
    const hasClass = (names: string[]) =>
      errorClasses.some(
        (name) => typeof name === 'string' && names.includes(name),
      );
    // This is the interceptor's random HTTP request UUID, not a QR/sign request.
    const requestId = hasClass(['OneKeyServerApiError'])
      ? value?.requestId
      : undefined;
    const httpStatus = hasClass(['OneKeyServerApiError'])
      ? value?.httpStatusCode
      : undefined;
    const http = {
      httpRequestId:
        typeof requestId === 'string' &&
        /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(requestId)
          ? requestId
          : undefined,
      httpStatus:
        typeof httpStatus === 'number' &&
        Number.isInteger(httpStatus) &&
        httpStatus >= 100 &&
        httpStatus <= 599
          ? httpStatus
          : undefined,
    };
    if (code === 40_028 || code === '40028')
      return { ...http, errorCode: 40_028, errorCategory: 'blockhashNotFound' };
    if (code === 40_034 || code === '40034')
      return { ...http, errorCode: 40_034, errorCategory: 'executionFailed' };
    if (
      [
        'UserCancel',
        'UserCancelFromOutside',
        'HardwareUserCancelFromOutside',
        'OneKeyErrorScanQrCodeCancel',
        'SecureQRCodeDialogCancel',
        'PasswordPromptDialogCancel',
        'AxiosAbortCancelError',
      ].some((name) => hasClass([name]))
    ) {
      return { ...http, errorCategory: 'cancelled' };
    }
    if (
      (typeof code === 'string' &&
        ['ECONNABORTED', 'ETIMEDOUT'].includes(code)) ||
      [
        'DeviceMethodCallTimeout',
        'BridgeTimeoutError',
        'BridgeTimeoutErrorForDesktop',
        'ConnectTimeoutError',
        'ThirdPartyOperationTimeout',
        'ThirdPartyBlePairingTimeout',
      ].some((name) => hasClass([name]))
    ) {
      return { ...http, errorCategory: 'timeout' };
    }
    if (
      (typeof code === 'string' &&
        ['ERR_NETWORK', 'ENOTFOUND', 'ECONNRESET', 'ECONNREFUSED'].includes(
          code,
        )) ||
      hasClass(['AxiosNetworkError'])
    ) {
      return { ...http, errorCategory: 'network' };
    }
    if (hasClass(['OneKeyErrorAirGapInvalidQrCode']))
      return { ...http, errorCategory: 'invalidQrOrSignature' };
    return { ...http, errorCategory: 'unknown' };
  } catch {
    // A hostile or malformed error object must not change signing behavior.
  }
  return { errorCategory: 'unknown' };
}

export function getSolanaDiagnosticElapsed(
  context: ISolanaTxDiagnosticContext,
  now: number,
): number | undefined {
  // main/bg share the device wall clock, not a performance clock or JS heap.
  // A clock adjustment is unknown time rather than a fabricated zero duration.
  return nonnegativeNumber(now - context.startedAt);
}
