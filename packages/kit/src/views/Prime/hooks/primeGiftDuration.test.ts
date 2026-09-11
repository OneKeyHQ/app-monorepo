import { createIntl } from 'react-intl';

import enMessages from '@onekeyhq/shared/src/locale/json/en_US.json';
import ruMessages from '@onekeyhq/shared/src/locale/json/ru.json';
import zhMessages from '@onekeyhq/shared/src/locale/json/zh_CN.json';

import { getPrimeGiftDurationText } from './primeGiftDuration';

const zhTranslations: Record<string, string> = zhMessages;
const enTranslations: Record<string, string> = enMessages;
const ruTranslations: Record<string, string> = ruMessages;
const zhIntl = createIntl({ locale: 'zh-CN', messages: zhTranslations });
const enIntl = createIntl({ locale: 'en-US', messages: enTranslations });
const ruIntl = createIntl({ locale: 'ru', messages: ruTranslations });

describe('getPrimeGiftDurationText', () => {
  it('prefers the server month duration when it is positive', () => {
    expect(
      getPrimeGiftDurationText({ giftMonths: 6, giftDays: 180 }, zhIntl),
    ).toBe('6 个月');
  });

  it.each([undefined, null, '', 0] as const)(
    'uses the server day duration when giftMonths is %j',
    (giftMonths) => {
      expect(
        getPrimeGiftDurationText({ giftMonths, giftDays: 45 }, zhIntl),
      ).toBe('45 天');
    },
  );

  it('does not fabricate a duration while data is unavailable', () => {
    expect(getPrimeGiftDurationText({}, zhIntl)).toBe('');
    expect(
      getPrimeGiftDurationText({ giftMonths: 0, giftDays: 0 }, zhIntl),
    ).toBe('');
  });

  it.each([
    [enIntl, 1, '1 month', '1 day'],
    [enIntl, 6, '6 months', '6 days'],
    [ruIntl, 1, '1 месяц', '1 день'],
    [ruIntl, 2, '2 месяца', '2 дня'],
    [ruIntl, 5, '5 месяцев', '5 дней'],
    [ruIntl, 21, '21 месяц', '21 день'],
  ] as const)(
    'formats localized plural durations in case %#',
    (intl, count, months, days) => {
      expect(getPrimeGiftDurationText({ giftMonths: count }, intl)).toBe(
        months,
      );
      expect(getPrimeGiftDurationText({ giftDays: count }, intl)).toBe(days);
    },
  );
});
