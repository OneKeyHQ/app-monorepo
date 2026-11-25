import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
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
  translationKey: ETranslations.starknet_privacy_error_screening_rejected__msg,
  retryable: EStrk20ErrorRetry.No,
};

const SCREENING_UNAVAILABLE: IStrk20ErrorMapping = {
  code: EStrk20ErrorCode.ScreeningUnavailable,
  translationKey: ETranslations.keyless_deletion_service_unavailable__msg,
  retryable: EStrk20ErrorRetry.Yes,
};

const BY_PROVING_CODE: Record<number, IStrk20ErrorMapping> = {
  [EStrk20ProvingErrorCode.BlockNotFound]: {
    code: EStrk20ErrorCode.ProvingBehind,
    translationKey: ETranslations.keyless_deletion_service_unavailable__msg,
    retryable: EStrk20ErrorRetry.Yes,
  },
  [EStrk20ProvingErrorCode.AccountValidationFailed]: {
    code: EStrk20ErrorCode.ProvingValidation,
    translationKey: ETranslations.send_verification_failure,
    // usually a stale pool nonce: invalidateProofNonceCache() then one retry
    retryable: EStrk20ErrorRetry.Once,
  },
  [EStrk20ProvingErrorCode.UnsupportedVersion]: {
    code: EStrk20ErrorCode.VersionMismatch,
    translationKey: ETranslations.global_update_to_continue_desc_fallback,
    retryable: EStrk20ErrorRetry.No,
  },
  [EStrk20ProvingErrorCode.InvalidInput]: {
    code: EStrk20ErrorCode.Internal,
    translationKey: ETranslations.send_engine_internal_error,
    retryable: EStrk20ErrorRetry.No,
  },
  [EStrk20ProvingErrorCode.Busy]: {
    code: EStrk20ErrorCode.ServiceBusy,
    translationKey: ETranslations.keyless_deletion_service_unavailable__msg,
    retryable: EStrk20ErrorRetry.Yes,
  },
  [EStrk20ProvingErrorCode.Rejected]: {
    code: EStrk20ErrorCode.RequestRejected,
    translationKey: ETranslations.send_engine_internal_error,
    retryable: EStrk20ErrorRetry.No,
  },
};

const BY_ERROR_NAME: Record<string, IStrk20ErrorMapping> = {
  ScreeningRejected: SCREENING_REJECTED,
  ScreeningUnavailable: SCREENING_UNAVAILABLE,
  ReorgError: {
    code: EStrk20ErrorCode.Reorg,
    translationKey: ETranslations.global_sync_error,
    retryable: EStrk20ErrorRetry.Once,
  },
};

const OVERLOADED: IStrk20ErrorMapping = {
  code: EStrk20ErrorCode.ServiceOverloaded,
  translationKey: ETranslations.keyless_deletion_service_unavailable__msg,
  retryable: EStrk20ErrorRetry.Yes,
};

const BY_STARKSCAN_CODE: Record<string, IStrk20ErrorMapping> = {
  invalid_idempotency_key: {
    code: EStrk20ErrorCode.Internal,
    translationKey: ETranslations.send_engine_internal_error,
    retryable: EStrk20ErrorRetry.No,
  },
  idempotency_key_required: {
    code: EStrk20ErrorCode.Internal,
    translationKey: ETranslations.send_engine_internal_error,
    retryable: EStrk20ErrorRetry.No,
  },
  prover_queue_full: OVERLOADED,
  prover_unavailable: OVERLOADED,
  prover_key_concurrency: OVERLOADED,
  http_503: OVERLOADED,
  prover_daily_budget_exhausted: {
    code: EStrk20ErrorCode.ProvingQuota,
    translationKey: ETranslations.keyless_deletion_service_unavailable__msg,
    retryable: EStrk20ErrorRetry.No,
  },
  unauthorized: {
    code: EStrk20ErrorCode.ProvingUnauthorized,
    translationKey: ETranslations.send_engine_internal_error,
    retryable: EStrk20ErrorRetry.No,
  },
  forbidden: {
    code: EStrk20ErrorCode.ProvingUnauthorized,
    translationKey: ETranslations.send_engine_internal_error,
    retryable: EStrk20ErrorRetry.No,
  },
  http_401: {
    code: EStrk20ErrorCode.ProvingUnauthorized,
    translationKey: ETranslations.send_engine_internal_error,
    retryable: EStrk20ErrorRetry.No,
  },
  http_403: {
    code: EStrk20ErrorCode.ProvingUnauthorized,
    translationKey: ETranslations.send_engine_internal_error,
    retryable: EStrk20ErrorRetry.No,
  },
  prover_delivery_unknown: {
    code: EStrk20ErrorCode.ProvingDeliveryUnknown,
    translationKey: ETranslations.privacy_error_build_failed__msg,
    retryable: EStrk20ErrorRetry.No,
  },
  poll_timeout: {
    code: EStrk20ErrorCode.ProvingTimeout,
    translationKey: ETranslations.hardware_third_party_operation_timeout,
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
    translationKey: ETranslations.global_not_available,
    retryable: EStrk20ErrorRetry.No,
  },
  [EStrk20ErrorCode.Locked]: {
    code: EStrk20ErrorCode.Locked,
    translationKey: ETranslations.privacy_balance_verification_pending__msg,
    retryable: EStrk20ErrorRetry.Yes,
  },
  [EStrk20ErrorCode.KeyMismatch]: {
    code: EStrk20ErrorCode.KeyMismatch,
    translationKey: ETranslations.starknet_privacy_error_key_mismatch__msg,
    retryable: EStrk20ErrorRetry.No,
  },
  [EStrk20ErrorCode.PoolPaused]: {
    code: EStrk20ErrorCode.PoolPaused,
    translationKey: ETranslations.starknet_privacy_error_pool_paused__msg,
    retryable: EStrk20ErrorRetry.No,
  },
  [EStrk20ErrorCode.Waiting]: {
    code: EStrk20ErrorCode.Waiting,
    translationKey: ETranslations.starknet_privacy_error_waiting__msg,
    retryable: EStrk20ErrorRetry.Yes,
  },
  [EStrk20ErrorCode.ScreeningWindowExpired]: {
    code: EStrk20ErrorCode.ScreeningWindowExpired,
    translationKey: ETranslations.privacy_error_review_expired__msg,
    retryable: EStrk20ErrorRetry.AfterRebuild,
  },
  [EStrk20ErrorCode.ProofExpired]: {
    code: EStrk20ErrorCode.ProofExpired,
    translationKey: ETranslations.privacy_error_review_expired__msg,
    retryable: EStrk20ErrorRetry.AfterRebuild,
  },
  [EStrk20ErrorCode.InvalidAmount]: {
    code: EStrk20ErrorCode.InvalidAmount,
    translationKey: ETranslations.defi_action_invalid_amount__msg,
    retryable: EStrk20ErrorRetry.Yes,
  },
  [EStrk20ErrorCode.RecipientNotRegistered]: {
    code: EStrk20ErrorCode.RecipientNotRegistered,
    translationKey:
      ETranslations.starknet_privacy_error_recipient_not_registered__msg,
    retryable: EStrk20ErrorRetry.No,
  },
  [EStrk20ErrorCode.History]: {
    code: EStrk20ErrorCode.History,
    translationKey: ETranslations.global_sync_error,
    retryable: EStrk20ErrorRetry.No,
  },
} satisfies Partial<Record<EStrk20ErrorCode, IStrk20ErrorMapping>>;

function normalizeEstimatedSeconds(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.max(1, Math.ceil(value));
}

/**
 * `new OneKeyLocalError({ key })` alone is not translated — it surfaces the raw
 * key string — so background errors have to carry a formatted message.
 */
export function strk20Error(
  code: keyof typeof STRK20_LOCAL_ERRORS,
  options?: { estimatedSecondsRemaining?: number },
): OneKeyLocalError {
  const mapping = STRK20_LOCAL_ERRORS[code];
  const seconds =
    code === EStrk20ErrorCode.Waiting
      ? normalizeEstimatedSeconds(options?.estimatedSecondsRemaining)
      : undefined;
  if (seconds !== undefined) {
    const key = ETranslations.starknet_privacy_error_confirming_wait__msg;
    const info = { seconds };
    return new OneKeyLocalError({
      key,
      info,
      message: appLocale.intl.formatMessage({ id: key }, info),
      data: {
        starknetPrivacyErrorCode: code,
        estimatedSecondsRemaining: seconds,
      },
    });
  }
  return new OneKeyLocalError({
    key: mapping.translationKey,
    message: appLocale.intl.formatMessage({ id: mapping.translationKey }),
    data: { starknetPrivacyErrorCode: code },
  });
}

export function mapStrk20Error(error: unknown): IStrk20ErrorMapping {
  const localErr = error as
    | { key?: unknown; info?: Record<string, string | number> }
    | undefined;
  if (localErr?.key === ETranslations.send_error_insufficient_balance) {
    return {
      code: EStrk20ErrorCode.InvalidAmount,
      translationKey: ETranslations.send_error_insufficient_balance,
      ...(localErr.info ? { translationValues: localErr.info } : {}),
      retryable: EStrk20ErrorRetry.Yes,
    };
  }
  const data = (error as IUnknownError | undefined)?.data;
  const localData = data as
    | {
        starknetPrivacyErrorCode?: unknown;
        estimatedSecondsRemaining?: unknown;
      }
    | undefined;
  const localCode = localData?.starknetPrivacyErrorCode;
  if (
    typeof localCode === 'string' &&
    Object.prototype.hasOwnProperty.call(STRK20_LOCAL_ERRORS, localCode)
  ) {
    if (localCode === EStrk20ErrorCode.Waiting) {
      const seconds = normalizeEstimatedSeconds(
        localData?.estimatedSecondsRemaining,
      );
      if (seconds !== undefined) {
        return {
          code: EStrk20ErrorCode.Waiting,
          translationKey:
            ETranslations.starknet_privacy_error_confirming_wait__msg,
          translationValues: { seconds },
          retryable: EStrk20ErrorRetry.Yes,
        };
      }
    }
    return STRK20_LOCAL_ERRORS[localCode as keyof typeof STRK20_LOCAL_ERRORS];
  }
  const name = readErrorName(error);
  if (name === 'StarkscanProverError') {
    return (
      readOwnMapping(BY_STARKSCAN_CODE, readErrorStringCode(error)) ?? {
        code: EStrk20ErrorCode.Unknown,
        translationKey: ETranslations.global_an_error_occurred,
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
          translationKey: ETranslations.global_an_error_occurred,
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
    return STRK20_LOCAL_ERRORS[EStrk20ErrorCode.ProofExpired];
  }
  if (reverts.has('SCREENING_REQUIRED')) {
    return STRK20_LOCAL_ERRORS[EStrk20ErrorCode.ScreeningWindowExpired];
  }
  if (reverts.has('PAUSED')) {
    return {
      code: EStrk20ErrorCode.PoolPaused,
      translationKey: ETranslations.starknet_privacy_error_pool_paused__msg,
      retryable: EStrk20ErrorRetry.No,
    };
  }

  return {
    code: EStrk20ErrorCode.Unknown,
    translationKey: ETranslations.global_an_error_occurred,
    retryable: EStrk20ErrorRetry.No,
  };
}
