import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EStrk20ErrorCode,
  EStrk20ErrorRetry,
} from '@onekeyhq/shared/types/starknetPrivacy';

import {
  EStrk20ProvingErrorCode,
  mapStrk20Error,
  strk20Error,
} from './strk20ErrorUtils';

/*
yarn jest packages/shared/src/utils/strk20ErrorUtils.test.ts

Errors are built by shape, not by importing the SDK's classes, which is exactly
the contract mapStrk20Error relies on: the `name` and `code` fields.
*/

function provingError(code: number, message = 'prover said no', data?: string) {
  const error = new Error(data ? `${message}: ${data}` : message);
  Object.defineProperties(error, {
    name: { value: 'ProvingServiceError' },
    code: { value: code },
    data: { value: data },
  });
  return error;
}

function namedError(name: string, message = 'boom') {
  const error = new Error(message);
  Object.defineProperty(error, 'name', { value: name });
  return error;
}

function starkscanError(code: string) {
  const error = new Error('starkscan said no');
  Object.defineProperties(error, {
    name: { value: 'StarkscanProverError' },
    code: { value: code },
  });
  return error;
}

function httpError(status: number) {
  const error = new Error(`HTTP ${status}`);
  Object.defineProperties(error, {
    name: { value: 'ProvingServiceHttpError' },
    status: { value: status },
  });
  return error;
}

describe('mapStrk20Error starkscan and http', () => {
  it.each(['invalid_idempotency_key', 'idempotency_key_required'])(
    'classifies %s as an app request error without retrying a new job',
    (code) => {
      expect(mapStrk20Error(starkscanError(code))).toEqual({
        code: EStrk20ErrorCode.Internal,
        translationKey: ETranslations.send_engine_internal_error,
        retryable: EStrk20ErrorRetry.No,
      });
    },
  );
  const overloaded = {
    code: EStrk20ErrorCode.ServiceOverloaded,
    translationKey: ETranslations.keyless_deletion_service_unavailable__msg,
    retryable: EStrk20ErrorRetry.Yes,
  };
  const unauthorized = {
    code: EStrk20ErrorCode.ProvingUnauthorized,
    translationKey: ETranslations.send_engine_internal_error,
    retryable: EStrk20ErrorRetry.No,
  };

  it.each([
    'prover_queue_full',
    'prover_unavailable',
    'prover_key_concurrency',
    'http_503',
  ])('treats %s as overloaded and retryable', (code) => {
    expect(mapStrk20Error(starkscanError(code))).toEqual(overloaded);
  });

  it.each(['unauthorized', 'forbidden', 'http_401', 'http_403'])(
    'treats %s as unauthorized',
    (code) => {
      expect(mapStrk20Error(starkscanError(code))).toEqual(unauthorized);
    },
  );

  it('maps quota, delivery unknown and timeout', () => {
    expect(
      mapStrk20Error(starkscanError('prover_daily_budget_exhausted')),
    ).toEqual({
      code: EStrk20ErrorCode.ProvingQuota,
      translationKey: ETranslations.keyless_deletion_service_unavailable__msg,
      retryable: EStrk20ErrorRetry.No,
    });
    expect(mapStrk20Error(starkscanError('prover_delivery_unknown'))).toEqual({
      code: EStrk20ErrorCode.ProvingDeliveryUnknown,
      translationKey: ETranslations.privacy_error_build_failed__msg,
      retryable: EStrk20ErrorRetry.No,
    });
    expect(mapStrk20Error(starkscanError('poll_timeout'))).toEqual({
      code: EStrk20ErrorCode.ProvingTimeout,
      translationKey: ETranslations.hardware_third_party_operation_timeout,
      retryable: EStrk20ErrorRetry.No,
    });
  });

  it('maps an unknown starkscan code to unknown, not retryable', () => {
    expect(mapStrk20Error(starkscanError('something_else'))).toEqual({
      code: EStrk20ErrorCode.Unknown,
      translationKey: ETranslations.global_an_error_occurred,
      retryable: EStrk20ErrorRetry.No,
    });
  });

  it.each([429, 503])('treats JSON-RPC HTTP %s as overloaded', (status) => {
    expect(mapStrk20Error(httpError(status))).toEqual(overloaded);
  });

  it('treats other JSON-RPC HTTP statuses as unknown', () => {
    expect(mapStrk20Error(httpError(500))).toEqual({
      code: EStrk20ErrorCode.Unknown,
      translationKey: ETranslations.global_an_error_occurred,
      retryable: EStrk20ErrorRetry.No,
    });
  });
});

describe('mapStrk20Error', () => {
  it.each([
    [
      EStrk20ErrorCode.Unavailable,
      ETranslations.global_not_available,
      EStrk20ErrorRetry.No,
    ],
    [
      EStrk20ErrorCode.Locked,
      ETranslations.privacy_balance_verification_pending__msg,
      EStrk20ErrorRetry.Yes,
    ],
    [
      EStrk20ErrorCode.KeyMismatch,
      ETranslations.starknet_privacy_error_key_mismatch__msg,
      EStrk20ErrorRetry.No,
    ],
    [
      EStrk20ErrorCode.PoolPaused,
      ETranslations.starknet_privacy_error_pool_paused__msg,
      EStrk20ErrorRetry.No,
    ],
  ] as const)(
    'preserves the safe local error %s across the background bridge',
    (code, key, retryable) => {
      expect(
        mapStrk20Error({
          name: 'OneKeyLocalError',
          data: { starknetPrivacyErrorCode: code },
          message: 'translated copy changes independently',
        }),
      ).toEqual({ code, translationKey: key, retryable });
    },
  );
  it('uses confirming_wait copy with seconds when Waiting has estimatedSecondsRemaining, and falls back to waiting copy otherwise', () => {
    const dynamicErr = strk20Error(EStrk20ErrorCode.Waiting, {
      estimatedSecondsRemaining: 11.2,
    });
    expect(dynamicErr).toMatchObject({
      key: ETranslations.starknet_privacy_error_confirming_wait__msg,
      info: { seconds: 12 },
      data: {
        starknetPrivacyErrorCode: EStrk20ErrorCode.Waiting,
        estimatedSecondsRemaining: 12,
      },
    });
    expect(mapStrk20Error(dynamicErr)).toEqual({
      code: EStrk20ErrorCode.Waiting,
      translationKey: ETranslations.starknet_privacy_error_confirming_wait__msg,
      translationValues: { seconds: 12 },
      retryable: EStrk20ErrorRetry.Yes,
    });

    for (const estimatedSecondsRemaining of [undefined, 0, -5, Number.NaN]) {
      const fallbackErr = strk20Error(EStrk20ErrorCode.Waiting, {
        estimatedSecondsRemaining,
      });
      expect(fallbackErr).toMatchObject({
        key: ETranslations.starknet_privacy_error_waiting__msg,
        data: { starknetPrivacyErrorCode: EStrk20ErrorCode.Waiting },
      });
      expect(mapStrk20Error(fallbackErr)).toEqual({
        code: EStrk20ErrorCode.Waiting,
        translationKey: ETranslations.starknet_privacy_error_waiting__msg,
        retryable: EStrk20ErrorRetry.Yes,
      });
    }
  });

  it.each([
    [
      EStrk20ProvingErrorCode.BlockNotFound,
      EStrk20ErrorCode.ProvingBehind,
      ETranslations.keyless_deletion_service_unavailable__msg,
      EStrk20ErrorRetry.Yes,
    ],
    [
      EStrk20ProvingErrorCode.AccountValidationFailed,
      EStrk20ErrorCode.ProvingValidation,
      ETranslations.send_verification_failure,
      EStrk20ErrorRetry.Once,
    ],
    [
      EStrk20ProvingErrorCode.UnsupportedVersion,
      EStrk20ErrorCode.VersionMismatch,
      ETranslations.global_update_to_continue_desc_fallback,
      EStrk20ErrorRetry.No,
    ],
    [
      EStrk20ProvingErrorCode.InvalidInput,
      EStrk20ErrorCode.Internal,
      ETranslations.send_engine_internal_error,
      EStrk20ErrorRetry.No,
    ],
    [
      EStrk20ProvingErrorCode.Busy,
      EStrk20ErrorCode.ServiceBusy,
      ETranslations.keyless_deletion_service_unavailable__msg,
      EStrk20ErrorRetry.Yes,
    ],
    [
      EStrk20ProvingErrorCode.Rejected,
      EStrk20ErrorCode.RequestRejected,
      ETranslations.send_engine_internal_error,
      EStrk20ErrorRetry.No,
    ],
  ])('maps proving code %s', (code, errorCode, translationKey, retryable) => {
    expect(mapStrk20Error(provingError(code))).toEqual({
      code: errorCode,
      translationKey,
      retryable,
    });
  });

  it('never renders a bare code 10000 as a sanctions verdict', () => {
    const mapped = mapStrk20Error(
      provingError(
        EStrk20ProvingErrorCode.Rejected,
        'Transaction rejected',
        'undeposited_open_notes',
      ),
    );
    expect(mapped.translationKey).toBe(
      ETranslations.send_engine_internal_error,
    );
    expect(mapped.translationKey).not.toBe(
      ETranslations.starknet_privacy_error_screening_rejected__msg,
    );
  });

  it('reads a screening verdict off a bare code 10000 by its exact reason', () => {
    expect(
      mapStrk20Error(
        provingError(
          EStrk20ProvingErrorCode.Rejected,
          'Transaction rejected',
          'address_blocked',
        ),
      ),
    ).toEqual({
      code: EStrk20ErrorCode.ScreeningRejected,
      translationKey:
        ETranslations.starknet_privacy_error_screening_rejected__msg,
      retryable: EStrk20ErrorRetry.No,
    });
    for (const reason of [
      'screening_unavailable',
      'screening_policy_unavailable',
    ]) {
      expect(
        mapStrk20Error(
          provingError(
            EStrk20ProvingErrorCode.Rejected,
            'Transaction rejected',
            reason,
          ),
        ),
      ).toEqual({
        code: EStrk20ErrorCode.ScreeningUnavailable,
        translationKey: ETranslations.keyless_deletion_service_unavailable__msg,
        retryable: EStrk20ErrorRetry.Yes,
      });
    }
  });

  it('does not take a screening reason from the message text alone', () => {
    const error = provingError(EStrk20ProvingErrorCode.Rejected);
    error.message = 'Transaction rejected: address_blocked';
    expect(mapStrk20Error(error).translationKey).toBe(
      ETranslations.send_engine_internal_error,
    );
  });

  it('maps the typed screening errors by name too', () => {
    expect(mapStrk20Error(namedError('ScreeningRejected'))).toEqual({
      code: EStrk20ErrorCode.ScreeningRejected,
      translationKey:
        ETranslations.starknet_privacy_error_screening_rejected__msg,
      retryable: EStrk20ErrorRetry.No,
    });
    expect(mapStrk20Error(namedError('ScreeningUnavailable'))).toEqual({
      code: EStrk20ErrorCode.ScreeningUnavailable,
      translationKey: ETranslations.keyless_deletion_service_unavailable__msg,
      retryable: EStrk20ErrorRetry.Yes,
    });
    expect(mapStrk20Error(namedError('ReorgError'))).toEqual({
      code: EStrk20ErrorCode.Reorg,
      translationKey: ETranslations.global_sync_error,
      retryable: EStrk20ErrorRetry.Once,
    });
  });

  it.each(['PROOF_EXPIRED', 'INVALID_BASE_BLOCK_NUMBER'])(
    'treats the on-chain revert %s as rebuild-then-retry',
    (revert) => {
      expect(
        mapStrk20Error(new Error(`Transaction reverted: ${revert}`)),
      ).toEqual({
        code: EStrk20ErrorCode.ProofExpired,
        translationKey: ETranslations.privacy_error_review_expired__msg,
        retryable: EStrk20ErrorRetry.AfterRebuild,
      });
    },
  );

  it('separates the screening window from a screening verdict', () => {
    expect(
      mapStrk20Error(new Error('execution reverted: SCREENING_REQUIRED')),
    ).toEqual({
      code: EStrk20ErrorCode.ScreeningWindowExpired,
      translationKey: ETranslations.privacy_error_review_expired__msg,
      retryable: EStrk20ErrorRetry.AfterRebuild,
    });
  });

  it('maps a paused pool and falls back on anything else', () => {
    expect(mapStrk20Error(new Error('reverted: PAUSED')).translationKey).toBe(
      ETranslations.starknet_privacy_error_pool_paused__msg,
    );
    expect(mapStrk20Error(new Error('socket hang up'))).toEqual({
      code: EStrk20ErrorCode.Unknown,
      translationKey: ETranslations.global_an_error_occurred,
      retryable: EStrk20ErrorRetry.No,
    });
    expect(mapStrk20Error(undefined).translationKey).toBe(
      ETranslations.global_an_error_occurred,
    );
  });

  it.each([429, 503])(
    'uses Discovery HTTP %s independently of message text',
    (status) => {
      expect(
        mapStrk20Error({
          name: 'ServiceHttpError',
          status,
          message: 'translated transport failure',
        }),
      ).toEqual({
        code: EStrk20ErrorCode.ServiceOverloaded,
        translationKey: ETranslations.keyless_deletion_service_unavailable__msg,
        retryable: EStrk20ErrorRetry.Yes,
      });
    },
  );

  it.each([
    'UNPAUSED',
    'notPAUSEDlower',
    'NOT_PAUSED',
    'PROOF_EXPIRED_LATER',
    'failed (429)',
  ])(
    'does not classify a partial token or infer HTTP status from %s',
    (message) => {
      expect(mapStrk20Error(new Error(message)).code).toBe(
        EStrk20ErrorCode.Unknown,
      );
    },
  );

  it('does not guess a mapping from an unrecognised proving code', () => {
    expect(mapStrk20Error(provingError(42)).translationKey).toBe(
      ETranslations.global_an_error_occurred,
    );
  });
});

it.each(['constructor', 'toString', '__proto__'])(
  'does not accept inherited mapping properties: %s',
  (name) => {
    expect(mapStrk20Error({ name }).code).toBe(EStrk20ErrorCode.Unknown);
    expect(
      mapStrk20Error({ name: 'StarkscanProverError', code: name }).code,
    ).toBe(EStrk20ErrorCode.Unknown);
  },
);
