import appDeviceInfo from '../appDeviceInfo/appDeviceInfo';
import platformEnv from '../platformEnv';

import { getRequestHeaders } from './Interceptor';
import requestHelper from './requestHelper';

jest.mock('../appDeviceInfo/appDeviceInfo', () => ({
  __esModule: true,
  default: { getDeviceInfo: jest.fn() },
}));

jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeAndroid: true,
    isExtension: false,
    appPlatform: 'android',
    appChannel: 'googlePlay',
    appFullName: 'OneKey Android',
    version: '6.6.0',
    buildNumber: '2026092181',
    bundleVersion: '23005199',
  },
}));

jest.mock('./requestHelper', () => ({
  __esModule: true,
  default: {
    getSettingsPersistAtom: jest.fn(),
    getSettingsValuePersistAtom: jest.fn(),
  },
}));

const mockGetDeviceInfo = appDeviceInfo.getDeviceInfo as jest.Mock;
const mockGetSettingsPersistAtom =
  requestHelper.getSettingsPersistAtom as jest.Mock;
const mockGetSettingsValuePersistAtom =
  requestHelper.getSettingsValuePersistAtom as jest.Mock;
const mockPlatformEnv = platformEnv as typeof platformEnv & {
  isNativeAndroid: boolean;
};

describe('getRequestHeaders platform name', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformEnv.isNativeAndroid = true;
    mockGetSettingsPersistAtom.mockResolvedValue({
      currencyInfo: { id: 'usd' },
      instanceId: 'test-instance',
      locale: 'en-US',
      theme: 'light',
    });
    mockGetSettingsValuePersistAtom.mockResolvedValue({
      hideValue: false,
    });
  });

  it.each([
    ['Pixel 8', 'Pixel 8', 'Pixel 8'],
    ['中文设备', 'Galaxy A55', 'Galaxy A55'],
    ['Phone 😀', 'Galaxy A55', 'Galaxy A55'],
    ['Phone\r\nInjected', undefined, 'Unknown'],
  ])(
    'uses an ASCII Android header for %s',
    async (displayName, model, expected) => {
      mockGetDeviceInfo.mockResolvedValue({
        displayName,
        device: { model },
      });

      const headers = await getRequestHeaders();

      expect(headers['x-onekey-request-platform-name']).toBe(expected);
    },
  );

  it('preserves the existing value outside Android', async () => {
    mockPlatformEnv.isNativeAndroid = false;
    mockGetDeviceInfo.mockResolvedValue({
      displayName: '中文设备',
      device: { model: 'iPhone' },
    });

    const headers = await getRequestHeaders();

    expect(headers['x-onekey-request-platform-name']).toBe('中文设备');
  });
});
