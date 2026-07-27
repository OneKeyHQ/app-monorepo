import { getPrimeInfiniPaymentSafeError } from './primeInfiniPaymentLogger';

describe('getPrimeInfiniPaymentSafeError', () => {
  it('keeps diagnostic identifiers without leaking messages or payloads', () => {
    const error = Object.assign(new Error('account 0x1234 failed'), {
      code: 4001,
      requestId: 'request-1',
      httpStatusCode: 503,
      data: {
        address: '0x1234',
      },
    });

    expect(getPrimeInfiniPaymentSafeError(error)).toEqual({
      errorName: 'Error',
      errorCode: '4001',
      requestId: 'request-1',
      httpStatusCode: 503,
    });
  });

  it('normalizes empty and non-primitive metadata', () => {
    expect(
      getPrimeInfiniPaymentSafeError({
        name: '',
        code: { nested: true },
        requestId: 123,
        httpStatusCode: Number.NaN,
      }),
    ).toEqual({
      errorName: undefined,
      errorCode: undefined,
      requestId: '123',
      httpStatusCode: undefined,
    });
  });
});
