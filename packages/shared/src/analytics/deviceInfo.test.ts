import { getDeviceInfo } from './deviceInfo';

describe('getDeviceInfo', () => {
  it('includes the device time zone in common analytics properties', async () => {
    const deviceInfo = await getDeviceInfo();

    expect(deviceInfo.deviceTimeZone).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    expect(deviceInfo.deviceUtcOffsetMinutes).toBe(
      -new Date().getTimezoneOffset(),
    );
  });
});
