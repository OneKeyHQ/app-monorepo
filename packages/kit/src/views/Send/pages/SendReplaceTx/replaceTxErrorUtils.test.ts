import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';

import { shouldCloseReplaceTxOnError } from './replaceTxErrorUtils';

describe('terminal replacement errors', () => {
  it.each([
    { className: EOneKeyErrorClassNames.ReplaceTxNonceConsumed },
    { className: EOneKeyErrorClassNames.InfiniReplacementUnavailable },
    { className: EOneKeyErrorClassNames.InfiniReplacementExpired },
  ])('dismisses terminal errors after bridge serialization: %j', (error) => {
    expect(shouldCloseReplaceTxOnError(JSON.parse(JSON.stringify(error)))).toBe(
      true,
    );
  });

  it.each([
    undefined,
    null,
    'network failure',
    new Error('Request timeout'),
    { className: 'UserCancel' },
    { data: { paymentValidationFailure: 'quoteValidityTooShort' } },
    { className: EOneKeyErrorClassNames.OneKeyAppError },
  ])('keeps retryable or unrelated failures open: %j', (error) => {
    expect(shouldCloseReplaceTxOnError(error)).toBe(false);
  });
});
