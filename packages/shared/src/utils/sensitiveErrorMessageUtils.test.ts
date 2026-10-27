import { ETranslations } from '../locale';

import { getSwapErrorType } from './sensitiveErrorMessageUtils';

describe('getSwapErrorType', () => {
  it('keeps an allowlisted OneKey class name, numeric code and known key', () => {
    expect(
      getSwapErrorType({
        className: 'OneKeyHardwareError',
        name: 'OneKeyError',
        code: 803,
        key: ETranslations.swap_page_recent_trade,
        message: 'Device 0xabc rejected 1.5 ETH',
      }),
    ).toEqual({
      errorName: 'OneKeyHardwareError',
      errorCode: '803',
      errorKey: ETranslations.swap_page_recent_trade,
    });
  });

  it('falls back to a native error name and keeps constant or RPC codes', () => {
    const error = Object.assign(new TypeError('boom'), { code: 'ECONNRESET' });
    expect(getSwapErrorType(error)).toMatchObject({
      errorName: 'TypeError',
      errorCode: 'ECONNRESET',
    });
    expect(getSwapErrorType({ code: -32_000 })).toMatchObject({
      errorCode: '-32000',
    });
  });

  it('drops key-, hash- and address-shaped values', () => {
    const privateKeyShaped = 'a'.repeat(1) + '0123456789abcdef'.repeat(4);
    expect(
      getSwapErrorType({
        className: 'NotARealOneKeyErrorClass',
        name: privateKeyShaped,
        code: 'DEADBEEF0123',
        key: privateKeyShaped,
      }),
    ).toEqual({
      errorName: undefined,
      errorCode: undefined,
      errorKey: undefined,
    });
    expect(
      getSwapErrorType({
        name: 'Error: send 0xabc failed',
        code: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      }),
    ).toEqual({
      errorName: undefined,
      errorCode: undefined,
      errorKey: undefined,
    });
    expect(getSwapErrorType({ code: 1_234_567 })).toMatchObject({
      errorCode: undefined,
    });
  });

  it('returns nothing for strings and empty input', () => {
    expect(getSwapErrorType('Request failed')).toEqual({});
    expect(getSwapErrorType(undefined)).toEqual({});
  });
});
