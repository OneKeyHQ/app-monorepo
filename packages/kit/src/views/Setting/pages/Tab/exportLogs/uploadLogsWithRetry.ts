import { uploadLogBundle } from '.';

import pRetry, { AbortError } from 'p-retry';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { ILogDigest } from '@onekeyhq/shared/src/logger/types';
import { sanitizeSniDiagnosticText } from '@onekeyhq/shared/src/request/helpers/sniLogRedaction';

import {
  LOG_UPLOAD_MAX_RETRIES,
  invalidateUploadTokenCacheAfterError,
  isRetryableLogUploadError,
  isUploadTokenReusable,
  normalizeTokenExpiresAtMs,
} from './logUploadUtils';

import type { ILogUploadTokenCache } from './logUploadUtils';

const LOG_UPLOAD_TOKEN_RATE_LIMIT_CODE = 12_001;

export function resolveLogUploadError(error: unknown): Error {
  const candidate = error as { originalError?: unknown; message?: unknown };
  if (candidate?.originalError) {
    return resolveLogUploadError(candidate.originalError);
  }
  if (error instanceof Error) {
    return error;
  }
  if (typeof candidate?.message === 'string') {
    return new Error(candidate.message);
  }
  return new Error(String(error));
}

// The token endpoint allows a few uploads per install every five minutes.
export function isLogUploadRateLimitError(error: unknown) {
  const code = (resolveLogUploadError(error) as { code?: unknown }).code;
  return Number(code) === LOG_UPLOAD_TOKEN_RATE_LIMIT_CODE;
}

/**
 * Uploads one archive with a silent retry for transient failures and returns
 * its object key. The archive is collected once and kept in `state` so the
 * caller can dispose it or reuse it (browser export fallback): a fresh archive
 * changes sha256, which would force a new token on each retry and trip the
 * token endpoint's rate limit.
 */
export async function uploadLogsWithRetry({
  state,
  collectDigest,
  onProgress,
}: {
  state: { digest?: ILogDigest };
  collectDigest: () => Promise<ILogDigest>;
  onProgress?: (progressPercent: number | undefined) => void;
}): Promise<string> {
  let tokenCache: ILogUploadTokenCache | undefined;
  let attempt = 0;
  let tokenReused = false;

  const getUploadToken = async (digest: ILogDigest) => {
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
    let uploadDispatched = false;
    try {
      state.digest ??= await collectDigest();
      const uploadToken = await getUploadToken(state.digest);
      uploadDispatched = true;
      const { result } = await uploadLogBundle({
        uploadToken,
        digest: state.digest,
        onProgress,
      });
      return result.objectKey;
    } catch (error) {
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
    }
  };

  return pRetry(() => attemptUpload(), { retries: LOG_UPLOAD_MAX_RETRIES });
}
