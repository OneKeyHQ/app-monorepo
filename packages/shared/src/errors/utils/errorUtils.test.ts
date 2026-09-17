import { CanceledError } from 'axios';

import {
  isRequestCanceledError,
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

describe('isRequestCanceledError', () => {
  it('detects a live axios CanceledError', () => {
    expect(isRequestCanceledError(new CanceledError('canceled'))).toBe(true);
  });

  it('detects a cancel error rebuilt from its serialized RPC form', () => {
    const plain = toPlainErrorObject(new CanceledError('canceled'));
    const rebuilt = Object.assign(new Error(plain.message), {
      name: plain.name,
      code: plain.code,
    });

    expect(rebuilt).not.toBeInstanceOf(CanceledError);
    expect(isRequestCanceledError(rebuilt)).toBe(true);
    expect(isRequestCanceledError({ code: 'ERR_CANCELED' })).toBe(true);
  });

  it('ignores other errors and non-objects', () => {
    expect(isRequestCanceledError(new Error('boom'))).toBe(false);
    expect(isRequestCanceledError(undefined)).toBe(false);
    expect(isRequestCanceledError('canceled')).toBe(false);
  });
});
