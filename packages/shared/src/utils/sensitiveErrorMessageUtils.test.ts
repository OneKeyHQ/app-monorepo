import { ETranslations } from '../locale';
import { appLocale } from '../locale/appLocale';

import { getSafeErrorIdentifiers } from './sensitiveErrorMessageUtils';

describe('getSafeErrorIdentifiers', () => {
  beforeAll(() => {
    appLocale.setLocale('en-US', {
      [ETranslations.swap_page_recent_trade]: 'Recent trade',
    } as Parameters<typeof appLocale.setLocale>[1]);
  });

  it('keeps an allowlisted OneKey class name, numeric code and known key', () => {
    expect(
      getSafeErrorIdentifiers({
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

  it('falls back to a native error name and keeps integer codes only', () => {
    const error = Object.assign(new TypeError('boom'), { code: 'ECONNRESET' });
    expect(getSafeErrorIdentifiers(error)).toMatchObject({
      errorName: 'TypeError',
      errorCode: undefined,
    });
    expect(getSafeErrorIdentifiers({ code: -32_000 })).toMatchObject({
      errorCode: '-32000',
    });
  });

  it('drops key-, hash- and address-shaped values', () => {
    const privateKeyShaped = 'a'.repeat(1) + '0123456789abcdef'.repeat(4);
    expect(
      getSafeErrorIdentifiers({
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
      getSafeErrorIdentifiers({
        name: 'Error: send 0xabc failed',
        code: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      }),
    ).toEqual({
      errorName: undefined,
      errorCode: undefined,
      errorKey: undefined,
    });
    for (const code of [1_234_567, 'PRIVATE_KEY_1234567890ABCDEF']) {
      expect(getSafeErrorIdentifiers({ code })).toMatchObject({
        errorCode: undefined,
      });
    }
  });

  it('returns nothing for strings and empty input', () => {
    expect(getSafeErrorIdentifiers('Request failed')).toEqual({});
    expect(getSafeErrorIdentifiers(undefined)).toEqual({});
  });
});
