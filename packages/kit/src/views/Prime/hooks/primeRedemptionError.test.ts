import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getPrimeRedemptionErrorPresentation } from './primeRedemptionError';

describe('getPrimeRedemptionErrorPresentation', () => {
  it('prefers translated server copy and a numeric error code', () => {
    expect(
      getPrimeRedemptionErrorPresentation({
        error: {
          code: 90_506,
          data: {
            code: 90_506,
            message: 'server-message',
            translatedMessage: 'translated-message',
          },
        },
        fallbackMessage: 'fallback',
      }),
    ).toEqual({
      errorCode: 90_506,
      isExpiredSession: false,
      message: 'translated-message',
    });
  });

  it('marks an expired OneKey ID session without using the toast copy inline', () => {
    expect(
      getPrimeRedemptionErrorPresentation({
        error: {
          key: ETranslations.id_login_expired_description,
          message: '用户认证失败，请重试登录。',
        },
        fallbackMessage: 'fallback',
      }),
    ).toEqual({
      errorCode: undefined,
      isExpiredSession: true,
      message: '用户认证失败，请重试登录。',
    });
  });

  it('falls back when the error has no usable message', () => {
    expect(
      getPrimeRedemptionErrorPresentation({
        error: { code: 'not-a-number' },
        fallbackMessage: 'fallback',
      }),
    ).toEqual({
      errorCode: undefined,
      isExpiredSession: false,
      message: 'fallback',
    });
  });
});
