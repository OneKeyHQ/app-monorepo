import { ETranslations } from '../locale';
import { appLocale } from '../locale/appLocale';
import enUS from '../locale/json/en_US.json';
import zhTW from '../locale/json/zh_TW.json';
import platformEnv from '../platformEnv';

import {
  InfiniReplacementExpiredError,
  InfiniReplacementUnavailableError,
  InvoiceExpiredError,
} from './errors/appErrors';
import { EOneKeyErrorClassNames } from './types/errorTypes';
import { toPlainErrorObject } from './utils/errorUtils';

let mockMessages: Record<string, string> = {};

describe('Infini replacement feedback', () => {
  beforeEach(() => {
    jest.replaceProperty(platformEnv, 'isJest', false);
    jest
      .spyOn(appLocale.intl, 'formatMessage')
      .mockImplementation(({ id }) => mockMessages[String(id)] ?? String(id));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['en-US', enUS, 'Close this window and try again.'],
    ['zh-TW', zhTW, '關閉此視窗後重試。'],
  ] as const)(
    'formats %s before crossing the bg/UI bridge',
    (_locale, messages, expected) => {
      mockMessages = messages;
      const error = new InfiniReplacementUnavailableError();
      expect(error.message).toBe(expected);
      expect(toPlainErrorObject(error)).toMatchObject({
        message: expected,
        key: ETranslations.prime_close_and_try_again__desc,
        className: EOneKeyErrorClassNames.InfiniReplacementUnavailable,
        autoToast: true,
      });
      expect(error.message).not.toContain('Unknown Onekey Internal Error');
    },
  );

  it('preserves localized expiry and its terminal marker across the bridge', () => {
    mockMessages = zhTW;
    const error = new InfiniReplacementExpiredError({
      autoToast: true,
      data: {
        paymentValidationFailure: 'quoteExpired',
      },
    });
    expect(error).toBeInstanceOf(InvoiceExpiredError);
    expect(toPlainErrorObject(error)).toMatchObject({
      message: '發票已過期',
      autoToast: true,
      className: EOneKeyErrorClassNames.InfiniReplacementExpired,
    });
  });
});
