import {
  markOneKeyIdFailureServerLogged,
  toPlainErrorObject,
  wasOneKeyIdFailureServerLogged,
} from './errorUtils';

describe('OneKey ID failure server log marker', () => {
  it('survives plain error serialization for cross-runtime RPC', () => {
    const error = new Error('login failed');

    markOneKeyIdFailureServerLogged(error);
    const plainError = toPlainErrorObject(error);

    expect(wasOneKeyIdFailureServerLogged(error)).toBe(true);
    expect(plainError.$$oneKeyIdFailureServerLogged).toBe(true);
    expect(wasOneKeyIdFailureServerLogged(plainError)).toBe(true);
  });
});
