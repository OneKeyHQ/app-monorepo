import { uploadLogBundle } from '.';

import pRetry, { AbortError } from 'p-retry';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ELogUploadStage } from '@onekeyhq/shared/src/logger/types';
import type { ILogDigest } from '@onekeyhq/shared/src/logger/types';
import { sanitizeSniDiagnosticText } from '@onekeyhq/shared/src/request/helpers/sniLogRedaction';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import {
  LOG_UPLOAD_MAX_RETRIES,
  invalidateUploadTokenCacheAfterError,
  isRetryableLogUploadError,
  isUploadTokenReusable,
  normalizeTokenExpiresAtMs,
} from './logUploadUtils';

import type { ILogUploadTokenCache } from './logUploadUtils';

const LOG_UPLOAD_TOKEN_RATE_LIMIT_CODE = 12_001;

function withErrorCode(error: Error, code: unknown) {
  if (code !== undefined && (error as { code?: unknown }).code === undefined) {
    (error as { code?: unknown }).code = code;
  }
  return error;
}

// A background-bridge error often arrives as a plain object. Keep `code` so
// a rate-limit (12001) is still recognizable after it becomes an Error.
export function resolveLogUploadError(error: unknown): Error {
  const candidate = error as {
    originalError?: unknown;
    message?: unknown;
    code?: unknown;
  };
  if (candidate?.originalError) {
    return resolveLogUploadError(candidate.originalError);
  }
  if (error instanceof Error) {
    return withErrorCode(error, candidate?.code);
  }
  const resolved =
    typeof candidate?.message === 'string'
      ? new Error(candidate.message)
      : new Error(String(error));
  return withErrorCode(resolved, candidate?.code);
}

// The token endpoint allows a few uploads per install every five minutes.
export function isLogUploadRateLimitError(error: unknown) {
  const code = (resolveLogUploadError(error) as { code?: unknown }).code;
  return Number(code) === LOG_UPLOAD_TOKEN_RATE_LIMIT_CODE;
}

// Progress is broadcast app-wide; each transport tags it with the request ID
// of its attempt, so an attempt reports only its own bytes.
function watchAttemptProgress(
  requestId: string,
  onProgress: (progressPercent: number) => void,
) {
  let reported = -1;
  const handleProgress = ({
    stage,
    requestId: progressRequestId,
    bytesSent,
    totalBytes,
    progressPercent,
  }: IAppEventBusPayload[EAppEventBusNames.ClientLogUploadProgress]) => {
    if (
      stage !== ELogUploadStage.Uploading ||
      progressRequestId !== requestId
    ) {
      return;
    }
    if (bytesSent === 0) return;
    const percent =
      typeof bytesSent === 'number' &&
      typeof totalBytes === 'number' &&
      totalBytes > 0
        ? Math.floor((bytesSent / totalBytes) * 100)
        : progressPercent;
    if (typeof percent !== 'number' || !Number.isFinite(percent)) return;
    const next = Math.min(100, Math.max(0, percent));
    if (next <= reported) return;
    reported = next;
    onProgress(next);
  };
  appEventBus.on(EAppEventBusNames.ClientLogUploadProgress, handleProgress);
  return () =>
    appEventBus.off(EAppEventBusNames.ClientLogUploadProgress, handleProgress);
}

/**
 * Uploads one archive with a silent retry for transient failures and returns
 * its object key. The archive is collected once and kept in `state` so the
 * caller can dispose it or reuse it (browser export fallback): a fresh archive
 * changes sha256, which would force a new token on each retry and trip the
 * token endpoint's rate limit.
 *
 * `onProgress` gets the share of bytes sent, 0–100; at 100 the server is still
 * storing the file. It gets `undefined` when a retry starts over.
 *
 * `isCancelled` is checked before a token request and before the upload
 * request. A cancel stops retries; it does not abort bytes already on the wire.
 */
export async function uploadLogsWithRetry({
  state,
  collectDigest,
  onProgress,
  isCancelled,
}: {
  state: { digest?: ILogDigest };
  collectDigest: () => Promise<ILogDigest>;
  onProgress?: (progressPercent: number | undefined) => void;
  isCancelled?: () => boolean;
}): Promise<string> {
  let tokenCache: ILogUploadTokenCache | undefined;
  let attempt = 0;
  let tokenReused = false;

  const stopIfCancelled = () => {
    if (isCancelled?.()) throw new OneKeyLocalError('Log upload cancelled');
  };

  const getUploadToken = async (digest: ILogDigest) => {
    stopIfCancelled();
    if (isUploadTokenReusable(tokenCache, digest, Date.now())) {
      tokenReused = true;
      return tokenCache.uploadToken;
    }
    tokenReused = false;
    const issuedAtMs = Date.now();
    const token = await backgroundApiProxy.serviceLogger.requestUploadToken({
      sizeBytes: digest.sizeBytes,
      sha256: digest.sha256,
    });
    tokenCache = {
      uploadToken: token.uploadToken,
      expiresAtMs: normalizeTokenExpiresAtMs(token.expiresAt, issuedAtMs),
      sha256: digest.sha256,
      sizeBytes: digest.sizeBytes,
      consumed: false,
    };
    return token.uploadToken;
  };

  const attemptUpload = async () => {
    attempt += 1;
    if (attempt > 1) onProgress?.(undefined);
    const requestId = generateUUID();
    const stopWatchingProgress = onProgress
      ? watchAttemptProgress(requestId, onProgress)
      : undefined;
    let uploadDispatched = false;
    try {
      stopIfCancelled();
      state.digest ??= await collectDigest();
      const uploadToken = await getUploadToken(state.digest);
      stopIfCancelled();
      uploadDispatched = true;
      const { result } = await uploadLogBundle({
        uploadToken,
        digest: state.digest,
        requestId,
      });
      return result.objectKey;
    } catch (error) {
      if (isCancelled?.()) {
        throw new AbortError(
          error instanceof Error
            ? error
            : new OneKeyLocalError('Log upload cancelled'),
        );
      }
      if (uploadDispatched) {
        tokenCache = invalidateUploadTokenCacheAfterError(tokenCache, error);
      }
      const retryable = isRetryableLogUploadError(error);
      const resolvedError = resolveLogUploadError(error);
      defaultLogger.setting.logUpload.attemptFailed({
        attempt,
        tokenReused,
        retryable,
        errorCode: (error as { code?: unknown } | undefined)?.code?.toString(),
        errorMessage: sanitizeSniDiagnosticText(resolvedError.message),
      });
      if (!retryable) {
        throw new AbortError(resolvedError);
      }
      throw error;
    } finally {
      stopWatchingProgress?.();
    }
  };

  return pRetry(() => attemptUpload(), { retries: LOG_UPLOAD_MAX_RETRIES });
}
