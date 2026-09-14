import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { getDeviceTimeZone, getDeviceUtcOffsetMinutes } from './timeZoneUtils';

describe('timeZoneUtils', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prefers the time zone provided by the platform', () => {
    const dateTimeFormatSpy = jest.spyOn(Intl, 'DateTimeFormat');

    expect(getDeviceTimeZone('Asia/Shanghai')).toBe('Asia/Shanghai');
    expect(dateTimeFormatSpy).not.toHaveBeenCalled();
  });

  it('falls back to UTC when Intl cannot resolve a time zone', () => {
    jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new OneKeyLocalError('Intl is unavailable');
    });

    expect(getDeviceTimeZone()).toBe('Etc/UTC');
  });

  it('uses positive minutes for time zones east of UTC', () => {
    jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-480);

    expect(getDeviceUtcOffsetMinutes()).toBe(480);
  });
});
