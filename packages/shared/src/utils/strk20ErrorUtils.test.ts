import { ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { EStrk20ErrorRetry } from '@onekeyhq/shared/types/starknetPrivacy';

import { EStrk20ProvingErrorCode, mapStrk20Error } from './strk20ErrorUtils';

/*
yarn jest packages/kit-bg/src/services/ServiceStarknetPrivacy/strk20Errors.test.ts

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
  const overloaded = {
    translationKey: ETranslationsMock.starknet_privacy_error_service_overloaded,
    retryable: EStrk20ErrorRetry.Yes,
  };
  const unauthorized = {
    translationKey:
      ETranslationsMock.starknet_privacy_error_proving_unauthorized,
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
      translationKey: ETranslationsMock.starknet_privacy_error_proving_quota,
      retryable: EStrk20ErrorRetry.No,
    });
    expect(mapStrk20Error(starkscanError('prover_delivery_unknown'))).toEqual({
      translationKey:
        ETranslationsMock.starknet_privacy_error_proving_delivery_unknown,
      retryable: EStrk20ErrorRetry.No,
    });
    expect(mapStrk20Error(starkscanError('poll_timeout'))).toEqual({
      translationKey: ETranslationsMock.starknet_privacy_error_proving_timeout,
      retryable: EStrk20ErrorRetry.No,
    });
  });

  it('maps an unknown starkscan code to unknown, not retryable', () => {
    expect(mapStrk20Error(starkscanError('something_else'))).toEqual({
      translationKey: ETranslationsMock.starknet_privacy_error_unknown,
      retryable: EStrk20ErrorRetry.No,
    });
  });

  it.each([429, 503])('treats JSON-RPC HTTP %s as overloaded', (status) => {
    expect(mapStrk20Error(httpError(status))).toEqual(overloaded);
  });

  it('treats other JSON-RPC HTTP statuses as unknown', () => {
    expect(mapStrk20Error(httpError(500))).toEqual({
      translationKey: ETranslationsMock.starknet_privacy_error_unknown,
      retryable: EStrk20ErrorRetry.No,
    });
  });
});

describe('mapStrk20Error', () => {
  it.each([
    [
      EStrk20ProvingErrorCode.BlockNotFound,
      ETranslationsMock.starknet_privacy_error_proving_behind,
      EStrk20ErrorRetry.Yes,
    ],
    [
      EStrk20ProvingErrorCode.AccountValidationFailed,
      ETranslationsMock.starknet_privacy_error_proving_validation,
      EStrk20ErrorRetry.Once,
    ],
    [
      EStrk20ProvingErrorCode.UnsupportedVersion,
      ETranslationsMock.starknet_privacy_error_version_mismatch,
      EStrk20ErrorRetry.No,
    ],
    [
      EStrk20ProvingErrorCode.InvalidInput,
      ETranslationsMock.starknet_privacy_error_internal,
      EStrk20ErrorRetry.No,
    ],
    [
      EStrk20ProvingErrorCode.Busy,
      ETranslationsMock.starknet_privacy_error_service_busy,
      EStrk20ErrorRetry.Yes,
    ],
    [
      EStrk20ProvingErrorCode.Rejected,
      ETranslationsMock.starknet_privacy_error_request_rejected,
      EStrk20ErrorRetry.No,
    ],
  ])('maps proving code %s', (code, translationKey, retryable) => {
    expect(mapStrk20Error(provingError(code))).toEqual({
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
      ETranslationsMock.starknet_privacy_error_request_rejected,
    );
    expect(mapped.translationKey).not.toBe(
      ETranslationsMock.starknet_privacy_error_screening_rejected,
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
      translationKey:
        ETranslationsMock.starknet_privacy_error_screening_rejected,
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
        translationKey:
          ETranslationsMock.starknet_privacy_error_screening_unavailable,
        retryable: EStrk20ErrorRetry.Yes,
      });
    }
  });

  it('does not take a screening reason from the message text alone', () => {
    const error = provingError(EStrk20ProvingErrorCode.Rejected);
    error.message = 'Transaction rejected: address_blocked';
    expect(mapStrk20Error(error).translationKey).toBe(
      ETranslationsMock.starknet_privacy_error_request_rejected,
    );
  });

  it('maps the typed screening errors by name too', () => {
    expect(mapStrk20Error(namedError('ScreeningRejected'))).toEqual({
      translationKey:
        ETranslationsMock.starknet_privacy_error_screening_rejected,
      retryable: EStrk20ErrorRetry.No,
    });
    expect(mapStrk20Error(namedError('ScreeningUnavailable'))).toEqual({
      translationKey:
        ETranslationsMock.starknet_privacy_error_screening_unavailable,
      retryable: EStrk20ErrorRetry.Yes,
    });
    expect(mapStrk20Error(namedError('ReorgError'))).toEqual({
      translationKey: ETranslationsMock.starknet_privacy_error_reorg,
      retryable: EStrk20ErrorRetry.Once,
    });
  });

  it.each(['PROOF_EXPIRED', 'INVALID_BASE_BLOCK_NUMBER'])(
    'treats the on-chain revert %s as rebuild-then-retry',
    (revert) => {
      expect(
        mapStrk20Error(new Error(`Transaction reverted: ${revert}`)),
      ).toEqual({
        translationKey: ETranslationsMock.starknet_privacy_error_proof_expired,
        retryable: EStrk20ErrorRetry.AfterRebuild,
      });
    },
  );

  it('separates the screening window from a screening verdict', () => {
    expect(
      mapStrk20Error(new Error('execution reverted: SCREENING_REQUIRED')),
    ).toEqual({
      translationKey:
        ETranslationsMock.starknet_privacy_error_screening_window_expired,
      retryable: EStrk20ErrorRetry.AfterRebuild,
    });
  });

  it('maps a paused pool and falls back on anything else', () => {
    expect(mapStrk20Error(new Error('reverted: PAUSED')).translationKey).toBe(
      ETranslationsMock.starknet_privacy_error_pool_paused,
    );
    expect(mapStrk20Error(new Error('socket hang up'))).toEqual({
      translationKey: ETranslationsMock.starknet_privacy_error_unknown,
      retryable: EStrk20ErrorRetry.No,
    });
    expect(mapStrk20Error(undefined).translationKey).toBe(
      ETranslationsMock.starknet_privacy_error_unknown,
    );
  });

  it.each([
    'Indexer API /v1/sync/notes failed (429): rate limited',
    'OHTTP request /v1/sync/notes failed (503): SERVICE_UNAVAILABLE',
    'OHTTP inner response /v1/sync/notes failed (503): RPC_UNAVAILABLE',
  ])('treats a discovery 429/503 as retryable: %s', (message) => {
    expect(mapStrk20Error(new Error(message))).toEqual({
      translationKey:
        ETranslationsMock.starknet_privacy_error_service_overloaded,
      retryable: EStrk20ErrorRetry.Yes,
    });
  });

  it('does not treat other discovery statuses as retryable', () => {
    expect(
      mapStrk20Error(new Error('Indexer API /v1/sync/notes failed (500): x')),
    ).toEqual({
      translationKey: ETranslationsMock.starknet_privacy_error_unknown,
      retryable: EStrk20ErrorRetry.No,
    });
  });

  it('does not guess a mapping from an unrecognised proving code', () => {
    expect(mapStrk20Error(provingError(42)).translationKey).toBe(
      ETranslationsMock.starknet_privacy_error_unknown,
    );
  });
});
