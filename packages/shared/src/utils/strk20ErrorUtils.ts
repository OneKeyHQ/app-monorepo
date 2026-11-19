import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import {
  EStrk20ErrorCode,
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

const SCREENING_BLOCKED_REASON = 'address_blocked';
const SCREENING_UNAVAILABLE_REASONS = new Set([
  'screening_unavailable',
  'screening_policy_unavailable',
]);

type IUnknownError = {
  data?: unknown;
  name?: unknown;
  code?: unknown;
  message?: unknown;
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
  code: EStrk20ErrorCode.ScreeningRejected,
  translationKey: ETranslationsMock.starknet_privacy_error_screening_rejected,
  retryable: EStrk20ErrorRetry.No,
};

const SCREENING_UNAVAILABLE: IStrk20ErrorMapping = {
  code: EStrk20ErrorCode.ScreeningUnavailable,
  translationKey:
    ETranslationsMock.starknet_privacy_error_screening_unavailable,
  retryable: EStrk20ErrorRetry.Yes,
};

const BY_PROVING_CODE: Record<number, IStrk20ErrorMapping> = {
  [EStrk20ProvingErrorCode.BlockNotFound]: {
    code: EStrk20ErrorCode.ProvingBehind,
    translationKey: ETranslationsMock.starknet_privacy_error_proving_behind,
    retryable: EStrk20ErrorRetry.Yes,
  },
  [EStrk20ProvingErrorCode.AccountValidationFailed]: {
    code: EStrk20ErrorCode.ProvingValidation,
    translationKey: ETranslationsMock.starknet_privacy_error_proving_validation,
    // usually a stale pool nonce: invalidateProofNonceCache() then one retry
    retryable: EStrk20ErrorRetry.Once,
  },
  [EStrk20ProvingErrorCode.UnsupportedVersion]: {
    code: EStrk20ErrorCode.VersionMismatch,
    translationKey: ETranslationsMock.starknet_privacy_error_version_mismatch,
    retryable: EStrk20ErrorRetry.No,
  },
  [EStrk20ProvingErrorCode.InvalidInput]: {
    code: EStrk20ErrorCode.Internal,
    translationKey: ETranslationsMock.starknet_privacy_error_internal,
    retryable: EStrk20ErrorRetry.No,
  },
  [EStrk20ProvingErrorCode.Busy]: {
    code: EStrk20ErrorCode.ServiceBusy,
    translationKey: ETranslationsMock.starknet_privacy_error_service_busy,
    retryable: EStrk20ErrorRetry.Yes,
  },
  [EStrk20ProvingErrorCode.Rejected]: {
    code: EStrk20ErrorCode.RequestRejected,
    translationKey: ETranslationsMock.starknet_privacy_error_request_rejected,
    retryable: EStrk20ErrorRetry.No,
  },
};

const BY_ERROR_NAME: Record<string, IStrk20ErrorMapping> = {
  ScreeningRejected: SCREENING_REJECTED,
  ScreeningUnavailable: SCREENING_UNAVAILABLE,
  ReorgError: {
    code: EStrk20ErrorCode.Reorg,
    translationKey: ETranslationsMock.starknet_privacy_error_reorg,
    // the SDK self-heals once; a second reorg reaches us and is worth one retry
    retryable: EStrk20ErrorRetry.Once,
  },
};

const OVERLOADED: IStrk20ErrorMapping = {
  code: EStrk20ErrorCode.ServiceOverloaded,
  translationKey: ETranslationsMock.starknet_privacy_error_service_overloaded,
  retryable: EStrk20ErrorRetry.Yes,
};

const BY_STARKSCAN_CODE: Record<string, IStrk20ErrorMapping> = {
  invalid_idempotency_key: {
    code: EStrk20ErrorCode.Internal,
    translationKey: ETranslationsMock.starknet_privacy_error_internal,
    retryable: EStrk20ErrorRetry.No,
  },
  idempotency_key_required: {
    code: EStrk20ErrorCode.Internal,
    translationKey: ETranslationsMock.starknet_privacy_error_internal,
    retryable: EStrk20ErrorRetry.No,
  },
  prover_queue_full: OVERLOADED,
  prover_unavailable: OVERLOADED,
  prover_key_concurrency: OVERLOADED,
  http_503: OVERLOADED,
  prover_daily_budget_exhausted: {
    code: EStrk20ErrorCode.ProvingQuota,
    translationKey: ETranslationsMock.starknet_privacy_error_proving_quota,
    retryable: EStrk20ErrorRetry.No,
  },
  unauthorized: {
    code: EStrk20ErrorCode.ProvingUnauthorized,
    translationKey:
      ETranslationsMock.starknet_privacy_error_proving_unauthorized,
    retryable: EStrk20ErrorRetry.No,
  },
  forbidden: {
    code: EStrk20ErrorCode.ProvingUnauthorized,
    translationKey:
      ETranslationsMock.starknet_privacy_error_proving_unauthorized,
    retryable: EStrk20ErrorRetry.No,
  },
  http_401: {
    code: EStrk20ErrorCode.ProvingUnauthorized,
    translationKey:
      ETranslationsMock.starknet_privacy_error_proving_unauthorized,
    retryable: EStrk20ErrorRetry.No,
  },
  http_403: {
    code: EStrk20ErrorCode.ProvingUnauthorized,
    translationKey:
      ETranslationsMock.starknet_privacy_error_proving_unauthorized,
    retryable: EStrk20ErrorRetry.No,
  },
  prover_delivery_unknown: {
    code: EStrk20ErrorCode.ProvingDeliveryUnknown,
    translationKey:
      ETranslationsMock.starknet_privacy_error_proving_delivery_unknown,
    retryable: EStrk20ErrorRetry.No,
  },
  poll_timeout: {
    code: EStrk20ErrorCode.ProvingTimeout,
    translationKey: ETranslationsMock.starknet_privacy_error_proving_timeout,
    retryable: EStrk20ErrorRetry.No,
  },
};

function readOwnMapping(
  mappings: Record<string, IStrk20ErrorMapping>,
  key: string,
): IStrk20ErrorMapping | undefined {
  return Object.prototype.hasOwnProperty.call(mappings, key)
    ? mappings[key]
    : undefined;
}

export const STRK20_LOCAL_ERRORS = {
  [EStrk20ErrorCode.Unavailable]: {
    code: EStrk20ErrorCode.Unavailable,
    translationKey: ETranslationsMock.starknet_privacy_error_unavailable,
    retryable: EStrk20ErrorRetry.No,
  },
  [EStrk20ErrorCode.Locked]: {
    code: EStrk20ErrorCode.Locked,
    translationKey: ETranslations.privacy_balance_verification_pending__msg,
    retryable: EStrk20ErrorRetry.Yes,
  },
  [EStrk20ErrorCode.KeyMismatch]: {
    code: EStrk20ErrorCode.KeyMismatch,
    translationKey: ETranslationsMock.starknet_privacy_error_key_mismatch,
    retryable: EStrk20ErrorRetry.No,
  },
  [EStrk20ErrorCode.PoolPaused]: {
    code: EStrk20ErrorCode.PoolPaused,
    translationKey: ETranslationsMock.starknet_privacy_error_pool_paused,
    retryable: EStrk20ErrorRetry.No,
  },
  [EStrk20ErrorCode.Waiting]: {
    code: EStrk20ErrorCode.Waiting,
    translationKey: ETranslationsMock.starknet_privacy_error_waiting,
    retryable: EStrk20ErrorRetry.Yes,
  },
  [EStrk20ErrorCode.ScreeningWindowExpired]: {
    code: EStrk20ErrorCode.ScreeningWindowExpired,
    translationKey:
      ETranslationsMock.starknet_privacy_error_screening_window_expired,
    retryable: EStrk20ErrorRetry.AfterRebuild,
  },
  [EStrk20ErrorCode.ProofExpired]: {
    code: EStrk20ErrorCode.ProofExpired,
    translationKey: ETranslationsMock.starknet_privacy_error_proof_expired,
    retryable: EStrk20ErrorRetry.AfterRebuild,
  },
  [EStrk20ErrorCode.InvalidAmount]: {
    code: EStrk20ErrorCode.InvalidAmount,
    translationKey: ETranslationsMock.starknet_privacy_error_invalid_amount,
    retryable: EStrk20ErrorRetry.Yes,
  },
  [EStrk20ErrorCode.RecipientNotRegistered]: {
    code: EStrk20ErrorCode.RecipientNotRegistered,
    translationKey:
      ETranslationsMock.starknet_privacy_error_recipient_not_registered,
    retryable: EStrk20ErrorRetry.No,
  },
  [EStrk20ErrorCode.History]: {
    code: EStrk20ErrorCode.History,
    translationKey: ETranslationsMock.starknet_privacy_error_history,
    retryable: EStrk20ErrorRetry.No,
  },
} satisfies Partial<Record<EStrk20ErrorCode, IStrk20ErrorMapping>>;

export function mapStrk20Error(error: unknown): IStrk20ErrorMapping {
  const data = (error as IUnknownError | undefined)?.data;
  const localCode = (data as { starknetPrivacyErrorCode?: unknown } | undefined)
    ?.starknetPrivacyErrorCode;
  if (
    typeof localCode === 'string' &&
    Object.prototype.hasOwnProperty.call(STRK20_LOCAL_ERRORS, localCode)
  ) {
    return STRK20_LOCAL_ERRORS[localCode as keyof typeof STRK20_LOCAL_ERRORS];
  }
  const name = readErrorName(error);
  if (name === 'StarkscanProverError') {
    return (
      readOwnMapping(BY_STARKSCAN_CODE, readErrorStringCode(error)) ?? {
        code: EStrk20ErrorCode.Unknown,
        translationKey: ETranslationsMock.starknet_privacy_error_unknown,
        retryable: EStrk20ErrorRetry.No,
      }
    );
  }
  if (name === 'ProvingServiceHttpError' || name === 'ServiceHttpError') {
    const status = readErrorStatus(error);
    return status === 429 || status === 503
      ? OVERLOADED
      : {
          code: EStrk20ErrorCode.Unknown,
          translationKey: ETranslationsMock.starknet_privacy_error_unknown,
          retryable: EStrk20ErrorRetry.No,
        };
  }
  const byName = readOwnMapping(BY_ERROR_NAME, name);
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
  // RPC revert reasons are protocol identifiers, matched as whole tokens only.
  const reverts = new Set(text.match(/\b[A-Z][A-Z0-9_]+\b/g) ?? []);
  if (STALE_PROOF_REVERTS.some((revert) => reverts.has(revert))) {
    return {
      code: EStrk20ErrorCode.ProofExpired,
      translationKey: ETranslationsMock.starknet_privacy_error_proof_expired,
      retryable: EStrk20ErrorRetry.AfterRebuild,
    };
  }
  if (reverts.has('SCREENING_REQUIRED')) {
    return {
      code: EStrk20ErrorCode.ScreeningWindowExpired,
      translationKey:
        ETranslationsMock.starknet_privacy_error_screening_window_expired,
      retryable: EStrk20ErrorRetry.AfterRebuild,
    };
  }
  if (reverts.has('PAUSED')) {
    return {
      code: EStrk20ErrorCode.PoolPaused,
      translationKey: ETranslationsMock.starknet_privacy_error_pool_paused,
      retryable: EStrk20ErrorRetry.No,
    };
  }

  return {
    code: EStrk20ErrorCode.Unknown,
    translationKey: ETranslationsMock.starknet_privacy_error_unknown,
    retryable: EStrk20ErrorRetry.No,
  };
}
