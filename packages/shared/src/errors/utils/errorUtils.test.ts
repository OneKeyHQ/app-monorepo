import {
  markOneKeyIdFailureServerLogged,
  toPlainErrorObject,
  wasOneKeyIdFailureServerLogged,
} from './errorUtils';

describe('OneKey ID failure server log marker', () => {
  it('survives cross-runtime RPC through the existing error data field', () => {
    const error = Object.assign(new Error('login failed'), {
      data: { stage: 'verifyOtp' },
    });

    markOneKeyIdFailureServerLogged(error);
    const plainError = toPlainErrorObject(error);

    expect(wasOneKeyIdFailureServerLogged(error)).toBe(true);
    expect(plainError.data).toEqual({
      stage: 'verifyOtp',
      $$oneKeyIdFailureServerLogged: true,
    });
    expect(wasOneKeyIdFailureServerLogged(plainError)).toBe(true);
  });

  it('does not replace non-object error data', () => {
    const error = Object.assign(new Error('login failed'), { data: 42 });

    markOneKeyIdFailureServerLogged(error);

    expect(error.data).toBe(42);
    expect(wasOneKeyIdFailureServerLogged(error)).toBe(false);
  });
});
