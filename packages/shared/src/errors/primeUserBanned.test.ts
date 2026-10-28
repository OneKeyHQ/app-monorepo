import { appLocale } from '../locale/appLocale';
import { primeUserBannedMessage } from '../prime/primeUserBanned';

import { OneKeyErrorPrimeUserBanned } from './errors/appErrors';

describe('OneKeyErrorPrimeUserBanned', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the specified server translation key and preserves the error across serialization', () => {
    const formatMessage = jest
      .spyOn(appLocale.intl, 'formatMessage')
      .mockReturnValueOnce('账号已被封禁');
    const error = new OneKeyErrorPrimeUserBanned();
    expect(formatMessage).toHaveBeenCalledWith(primeUserBannedMessage);
    expect(error.message).toBe('账号已被封禁');
    expect(error.code).toBe(90_012);
    expect(error.autoToast).toBe(true);
    expect(JSON.parse(JSON.stringify(error))).toMatchObject({
      code: 90_012,
      className: 'OneKeyErrorPrimeUserBanned',
    });
  });
});
