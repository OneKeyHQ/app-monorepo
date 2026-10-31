import {
  stashOneKeyIdRequestContext,
  stashRequestAuthTokenOfError,
  takeOneKeyIdRequestContext,
  takeRequestAuthTokenOfError,
} from './requestAuthTokenErrorStash';

describe('request auth context', () => {
  it('transfers the captured identity to the error privately and consumes it once', () => {
    const config = {};
    const error = {};
    const context = {
      onekeyUserId: 'user-a',
      authStateGeneration: 7,
      requestUrl: '/prime/v1/account/identities/oauth/bind',
    };
    stashOneKeyIdRequestContext(config, context);
    stashRequestAuthTokenOfError({
      error,
      requestAuthToken: 'test-token',
      requestConfig: config,
    });
    expect(JSON.stringify(error)).toBe('{}');
    expect(takeOneKeyIdRequestContext(config)).toBeUndefined();
    expect(takeOneKeyIdRequestContext(error)).toEqual(context);
    expect(takeOneKeyIdRequestContext(error)).toBeUndefined();
    expect(takeRequestAuthTokenOfError(error)).toBe('test-token');
    expect(takeRequestAuthTokenOfError(error)).toBe('');
  });
});
