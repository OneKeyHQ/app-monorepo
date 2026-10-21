import { ETranslationsMock } from '@onekeyhq/shared/src/locale';
import {
  EStrk20ErrorRetry,
  type IStrk20ErrorMapping,
} from '@onekeyhq/shared/types/starknetPrivacy';

/**
 * STRK20 error mapping. Branches on the SDK's stable `name` and `code` fields
 * rather than importing its classes, so the UI can run it on errors that
 * crossed the background bridge and it stays testable without the SDK.
 *
 * Restraint copied from upstream's screeningErrorFromProvingError: proving code
 * 10000 is overloaded and also carries multiple_screening_subjects,
 * unknown_delegated_depositor, undeposited_open_notes and
 * shadow_account_undetermined. None of those say anything about the address, so
 * a bare 10000 must never be rendered as a sanctions verdict.
 *
 * The SDK exports screeningErrorFromProvingError but never calls it, so a
 * verdict arrives here as a plain ProvingServiceError(10000, data) and is
 * classified below on the same exact `data` reasons.
 */

/** Proving-service JSON-RPC codes we branch on. */
export enum EStrk20ProvingErrorCode {
  BlockNotFound = 24,
  AccountValidationFailed = 55,
  UnsupportedVersion = 61,
  InvalidInput = 1000,
  Rejected = 10_000,
  /** Not a protocol code: the prover's "busy", already retried 3x inside the SDK. */
  Busy = -32_005,
}

/** Pool revert reasons that mean the build went stale rather than being wrong. */
const STALE_PROOF_REVERTS = [
  'PROOF_EXPIRED',
  'INVALID_BASE_BLOCK_NUMBER',
] as const;
const SCREENING_WINDOW_REVERT = 'SCREENING_REQUIRED';

/**
 * Discovery and OHTTP transport failures only carry the HTTP status in the
 * message (`... failed (429): ...`). The hosted discovery documents 429 and 503
 * as back-off-and-retry.
 */
const HTTP_FAILURE_STATUS = /failed \((\d{3})\)/;
const RETRYABLE_HTTP_STATUSES = new Set(['429', '503']);
const POOL_PAUSED_REVERT = 'PAUSED';

const SCREENING_BLOCKED_REASON = 'address_blocked';
const SCREENING_UNAVAILABLE_REASONS = new Set([
  'screening_unavailable',
  'screening_policy_unavailable',
]);

type IUnknownError = {
  name?: unknown;
  code?: unknown;
  message?: unknown;
  data?: unknown;
};

function readErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  const message = (error as IUnknownError | undefined)?.message;
  return typeof message === 'string' ? message : '';
}

function readErrorName(error: unknown): string {
  const name = (error as IUnknownError | undefined)?.name;
  return typeof name === 'string' ? name : '';
}

function readErrorStringCode(error: unknown): string {
  const code = (error as IUnknownError | undefined)?.code;
  return typeof code === 'string' ? code : '';
}

function readErrorStatus(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | undefined)?.status;
  return typeof status === 'number' ? status : undefined;
}

function readErrorCode(error: unknown): number | undefined {
  const code = (error as IUnknownError | undefined)?.code;
  return typeof code === 'number' ? code : undefined;
}

function readErrorData(error: unknown): string {
  const data = (error as IUnknownError | undefined)?.data;
  return typeof data === 'string' ? data : '';
}

const SCREENING_REJECTED: IStrk20ErrorMapping = {
  translationKey: ETranslationsMock.starknet_privacy_error_screening_rejected,
  retryable: EStrk20ErrorRetry.No,
};

const SCREENING_UNAVAILABLE: IStrk20ErrorMapping = {
  translationKey:
    ETranslationsMock.starknet_privacy_error_screening_unavailable,
  retryable: EStrk20ErrorRetry.Yes,
};

const BY_PROVING_CODE: Record<number, IStrk20ErrorMapping> = {
  [EStrk20ProvingErrorCode.BlockNotFound]: {
    translationKey: ETranslationsMock.starknet_privacy_error_proving_behind,
    retryable: EStrk20ErrorRetry.Yes,
  },
  [EStrk20ProvingErrorCode.AccountValidationFailed]: {
    translationKey: ETranslationsMock.starknet_privacy_error_proving_validation,
    // usually a stale pool nonce: invalidateProofNonceCache() then one retry
    retryable: EStrk20ErrorRetry.Once,
  },
  [EStrk20ProvingErrorCode.UnsupportedVersion]: {
    translationKey: ETranslationsMock.starknet_privacy_error_version_mismatch,
    retryable: EStrk20ErrorRetry.No,
  },
  [EStrk20ProvingErrorCode.InvalidInput]: {
    translationKey: ETranslationsMock.starknet_privacy_error_internal,
    retryable: EStrk20ErrorRetry.No,
  },
  [EStrk20ProvingErrorCode.Busy]: {
    translationKey: ETranslationsMock.starknet_privacy_error_service_busy,
    retryable: EStrk20ErrorRetry.Yes,
  },
  [EStrk20ProvingErrorCode.Rejected]: {
    translationKey: ETranslationsMock.starknet_privacy_error_request_rejected,
    retryable: EStrk20ErrorRetry.No,
  },
};

const BY_ERROR_NAME: Record<string, IStrk20ErrorMapping> = {
  ScreeningRejected: SCREENING_REJECTED,
  ScreeningUnavailable: SCREENING_UNAVAILABLE,
  ReorgError: {
    translationKey: ETranslationsMock.starknet_privacy_error_reorg,
    // the SDK self-heals once; a second reorg reaches us and is worth one retry
    retryable: EStrk20ErrorRetry.Once,
  },
};

const OVERLOADED: IStrk20ErrorMapping = {
  translationKey: ETranslationsMock.starknet_privacy_error_service_overloaded,
  retryable: EStrk20ErrorRetry.Yes,
};

const BY_STARKSCAN_CODE: Record<string, IStrk20ErrorMapping> = {
  prover_queue_full: OVERLOADED,
  prover_unavailable: OVERLOADED,
  prover_key_concurrency: OVERLOADED,
  http_503: OVERLOADED,
  prover_daily_budget_exhausted: {
    translationKey: ETranslationsMock.starknet_privacy_error_proving_quota,
    retryable: EStrk20ErrorRetry.No,
  },
  unauthorized: {
    translationKey:
      ETranslationsMock.starknet_privacy_error_proving_unauthorized,
    retryable: EStrk20ErrorRetry.No,
  },
  forbidden: {
    translationKey:
      ETranslationsMock.starknet_privacy_error_proving_unauthorized,
    retryable: EStrk20ErrorRetry.No,
  },
  http_401: {
    translationKey:
      ETranslationsMock.starknet_privacy_error_proving_unauthorized,
    retryable: EStrk20ErrorRetry.No,
  },
  http_403: {
    translationKey:
      ETranslationsMock.starknet_privacy_error_proving_unauthorized,
    retryable: EStrk20ErrorRetry.No,
  },
  prover_delivery_unknown: {
    translationKey:
      ETranslationsMock.starknet_privacy_error_proving_delivery_unknown,
    retryable: EStrk20ErrorRetry.No,
  },
  poll_timeout: {
    translationKey: ETranslationsMock.starknet_privacy_error_proving_timeout,
    retryable: EStrk20ErrorRetry.No,
  },
};

export function mapStrk20Error(error: unknown): IStrk20ErrorMapping {
  const name = readErrorName(error);
  if (name === 'StarkscanProverError') {
    return (
      BY_STARKSCAN_CODE[readErrorStringCode(error)] ?? {
        translationKey: ETranslationsMock.starknet_privacy_error_unknown,
        retryable: EStrk20ErrorRetry.No,
      }
    );
  }
  if (name === 'ProvingServiceHttpError') {
    const status = readErrorStatus(error);
    return status === 429 || status === 503
      ? OVERLOADED
      : {
          translationKey: ETranslationsMock.starknet_privacy_error_unknown,
          retryable: EStrk20ErrorRetry.No,
        };
  }
  const byName = BY_ERROR_NAME[name];
  if (byName) {
    return byName;
  }

  if (name === 'ProvingServiceError') {
    const code = readErrorCode(error);
    if (code === EStrk20ProvingErrorCode.Rejected) {
      const reason = readErrorData(error);
      if (reason === SCREENING_BLOCKED_REASON) {
        return SCREENING_REJECTED;
      }
      if (SCREENING_UNAVAILABLE_REASONS.has(reason)) {
        return SCREENING_UNAVAILABLE;
      }
    }
    const byCode = code === undefined ? undefined : BY_PROVING_CODE[code];
    if (byCode) {
      return byCode;
    }
  }

  const text = readErrorText(error);
  const httpStatus = HTTP_FAILURE_STATUS.exec(text)?.[1];
  if (httpStatus && RETRYABLE_HTTP_STATUSES.has(httpStatus)) {
    return {
      translationKey:
        ETranslationsMock.starknet_privacy_error_service_overloaded,
      retryable: EStrk20ErrorRetry.Yes,
    };
  }
  if (STALE_PROOF_REVERTS.some((revert) => text.includes(revert))) {
    return {
      translationKey: ETranslationsMock.starknet_privacy_error_proof_expired,
      retryable: EStrk20ErrorRetry.AfterRebuild,
    };
  }
  if (text.includes(SCREENING_WINDOW_REVERT)) {
    return {
      translationKey:
        ETranslationsMock.starknet_privacy_error_screening_window_expired,
      retryable: EStrk20ErrorRetry.AfterRebuild,
    };
  }
  if (text.includes(POOL_PAUSED_REVERT)) {
    return {
      translationKey: ETranslationsMock.starknet_privacy_error_pool_paused,
      retryable: EStrk20ErrorRetry.No,
    };
  }

  return {
    translationKey: ETranslationsMock.starknet_privacy_error_unknown,
    retryable: EStrk20ErrorRetry.No,
  };
}
