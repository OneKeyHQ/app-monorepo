import { EOneKeyErrorClassNames } from '../errors/types/errorTypes';

import { shouldClearKeylessOAuthSessionAfterError } from './keylessOAuthSessionUtils';

describe('shouldClearKeylessOAuthSessionAfterError', () => {
  test.each([
    { code: 'ETIMEDOUT' },
    { httpStatusCode: 503 },
    { name: 'AuthRetryableFetchError' },
  ])('preserves the session for a transient error: %p', (error) => {
    expect(shouldClearKeylessOAuthSessionAfterError(error)).toBe(false);
  });

  test('preserves the winning replacement session', () => {
    const error = {
      className:
        EOneKeyErrorClassNames.OneKeyErrorOneKeyIdKeylessSessionSlotReplaced,
    };
    expect(shouldClearKeylessOAuthSessionAfterError(error)).toBe(false);
  });

  test.each([
    { httpStatusCode: 401 },
    { name: 'AuthApiError', status: 400 },
    { code: 'oauth_identity_already_bound' },
    undefined,
  ])('clears the session after a definitive error: %p', (error) => {
    expect(shouldClearKeylessOAuthSessionAfterError(error)).toBe(true);
  });
});
