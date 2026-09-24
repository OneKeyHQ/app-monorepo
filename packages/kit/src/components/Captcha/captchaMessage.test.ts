import { parseCaptchaMessage } from './captchaMessage';

describe('CAPTCHA message boundary', () => {
  const valid = {
    type: 'onekey-test-captcha',
    requestId: 'current-challenge',
    status: 'success',
    token: 'test-token',
  };

  it('accepts web messages and serialized native WebView messages', () => {
    expect(parseCaptchaMessage(valid, valid.requestId)).toEqual(valid);
    expect(parseCaptchaMessage(JSON.stringify(valid), valid.requestId)).toEqual(
      valid,
    );
  });

  it('rejects responses from a previous challenge after reset', () => {
    expect(parseCaptchaMessage(valid, 'new-challenge')).toBeUndefined();
  });

  it.each([
    null,
    [],
    '{',
    {},
    { ...valid, type: 'other' },
    { ...valid, status: 'unknown' },
    { ...valid, token: '' },
    { ...valid, token: 12 },
    { ...valid, token: 'x'.repeat(2049) },
  ])('rejects malformed messages: %p', (value) => {
    expect(parseCaptchaMessage(value, valid.requestId)).toBeUndefined();
  });

  it.each(['ready', 'expired', 'timeout', 'error', 'load-error'])(
    'does not forward tokens on %s',
    (status) => {
      expect(
        parseCaptchaMessage({ ...valid, status }, valid.requestId),
      ).toEqual({
        type: valid.type,
        requestId: valid.requestId,
        status,
        token: undefined,
      });
    },
  );
});
