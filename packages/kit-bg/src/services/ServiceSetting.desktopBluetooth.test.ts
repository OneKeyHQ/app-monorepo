import { settingsPersistAtom } from '../states/jotai/atoms/settings';

import ServiceSetting from './ServiceSetting';

describe('ServiceSetting desktop Bluetooth', () => {
  const originalIsInBackground = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = originalIsInBackground;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    { persistedValue: undefined, expected: true },
    { persistedValue: true, expected: true },
    { persistedValue: false, expected: false },
  ])(
    'resolves $persistedValue to $expected',
    async ({ persistedValue, expected }) => {
      jest.spyOn(settingsPersistAtom, 'get').mockResolvedValue({
        enableDesktopBluetooth: persistedValue,
      } as never);
      const service = new ServiceSetting({
        backgroundApi: { simpleDb: { appStatus: {} } },
      });

      await expect(service.getEnableDesktopBluetooth()).resolves.toBe(expected);
    },
  );
});
