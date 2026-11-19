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

  it.each(['error', 'load-error', 'timeout'])(
    'preserves a six-digit error code on %s across bridge transports',
    (status) => {
      const message = { ...valid, status, code: '400021' };
      for (const data of [message, JSON.stringify(message)]) {
        expect(parseCaptchaMessage(data, valid.requestId)).toEqual({
          type: valid.type,
          requestId: valid.requestId,
          status,
          token: undefined,
          code: '400021',
        });
      }
    },
  );

  it.each([undefined, null, 400_021, {}, '400021 ', '40002', '4000210'])(
    'drops an invalid error code without promoting it to a terminal failure: %p',
    (code) => {
      expect(
        parseCaptchaMessage(
          { ...valid, status: 'error', code },
          valid.requestId,
        ),
      ).toEqual({
        type: valid.type,
        requestId: valid.requestId,
        status: 'error',
        token: undefined,
      });
    },
  );

  it.each(['ready', 'expired', 'success'])(
    'drops an error code attached to %s',
    (status) => {
      expect(
        parseCaptchaMessage(
          { ...valid, status, code: '400021' },
          valid.requestId,
        ),
      ).not.toHaveProperty('code');
    },
  );

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
