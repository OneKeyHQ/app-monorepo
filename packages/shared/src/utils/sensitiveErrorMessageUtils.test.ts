import { getSwapErrorType } from './sensitiveErrorMessageUtils';

describe('getSwapErrorType', () => {
  it('prefers the OneKey error class name and keeps a numeric code', () => {
    expect(
      getSwapErrorType({
        className: 'OneKeyHardwareError',
        name: 'OneKeyError',
        code: 803,
        message: 'Device 0xabc rejected 1.5 ETH',
      }),
    ).toEqual({ errorName: 'OneKeyHardwareError', errorCode: '803' });
  });

  it('falls back to the native error name and a short string code', () => {
    const error = Object.assign(new TypeError('boom'), { code: 'ECONNRESET' });
    expect(getSwapErrorType(error)).toEqual({
      errorName: 'TypeError',
      errorCode: 'ECONNRESET',
    });
    expect(getSwapErrorType({ code: -32_000 })).toEqual({
      errorName: undefined,
      errorCode: '-32000',
    });
  });

  it('drops values that are not plain identifiers', () => {
    expect(
      getSwapErrorType({
        name: 'Error: send 0xabc failed',
        code: 'insufficient funds for 0.1 ETH',
      }),
    ).toEqual({ errorName: undefined, errorCode: undefined });
  });

  it('returns nothing for strings and empty input', () => {
    expect(getSwapErrorType('Request failed')).toEqual({});
    expect(getSwapErrorType(undefined)).toEqual({});
  });
});
