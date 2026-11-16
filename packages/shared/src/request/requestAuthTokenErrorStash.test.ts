import {
  readRequestAuthTokenHeader,
  stashRequestAuthTokenOfError,
  takeRequestAuthContextOfError,
} from './requestAuthTokenErrorStash';

describe('request auth context', () => {
  it('keeps the token and request path off the error and consumes them once', () => {
    const error = {};
    stashRequestAuthTokenOfError({
      error,
      requestAuthToken: 'test-token',
      requestUrl: '/prime/v1/account/identities/oauth/bind',
    });
    expect(JSON.stringify(error)).toBe('{}');
    expect(takeRequestAuthContextOfError(error)).toEqual({
      requestAuthToken: 'test-token',
      requestUrl: '/prime/v1/account/identities/oauth/bind',
    });
    expect(takeRequestAuthContextOfError(error)).toEqual({
      requestAuthToken: '',
    });
  });

  test.each([
    [
      {
        get: (name: string) =>
          name === 'X-Onekey-Request-Token' ? 't1' : undefined,
      },
      't1',
    ],
    [{ 'X-Onekey-Request-Token': 't2' }, 't2'],
    [{ 'x-onekey-request-token': 't3' }, 't3'],
    [{}, ''],
    [undefined, ''],
  ])('reads the request token header from %j', (headers, expected) => {
    expect(readRequestAuthTokenHeader(headers)).toBe(expected);
  });
});
