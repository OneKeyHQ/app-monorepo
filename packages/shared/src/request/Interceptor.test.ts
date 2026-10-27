import { OneKeyLocalError } from '../errors';

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

let getRequestHeaders: typeof import('./Interceptor').getRequestHeaders;
let mockGetDeviceInfo: jest.Mock;
let mockPlatformEnv: { isNativeAndroid: boolean };

describe('getRequestHeaders platform name', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    ({ getRequestHeaders } = require('./Interceptor'));
    mockGetDeviceInfo = jest.requireMock('../appDeviceInfo/appDeviceInfo')
      .default.getDeviceInfo as jest.Mock;
    const mockRequestHelper = jest.requireMock('./requestHelper').default as {
      getSettingsPersistAtom: jest.Mock;
      getSettingsValuePersistAtom: jest.Mock;
    };
    mockPlatformEnv = jest.requireMock('../platformEnv').default as {
      isNativeAndroid: boolean;
    };
    mockPlatformEnv.isNativeAndroid = true;
    mockRequestHelper.getSettingsPersistAtom.mockResolvedValue({
      currencyInfo: { id: 'usd' },
      instanceId: 'test-instance',
      locale: 'en-US',
      theme: 'light',
    });
    mockRequestHelper.getSettingsValuePersistAtom.mockResolvedValue({
      hideValue: false,
    });
  });

  it.each([
    ['Pixel8', 'Pixel 8', 'Pixel8'],
    ['Pixel 8', 'Pixel 8', 'Pixel 8'],
    ['Galaxy A55 5G', 'SM-A556E', 'Galaxy A55 5G'],
    ["Alex's Pixel-8 (work)", 'Pixel 8', "Alex's Pixel-8 (work)"],
    ['中文设备', 'Galaxy A55', 'Galaxy A55'],
    ['Phone 😀', 'GalaxyA55', 'GalaxyA55'],
    ['测试 的 A55', 'SM-A5560', 'SM-A5560'],
    ['测试 的 Pixel 9a 😀', 'Pixel 9a', 'Pixel 9a'],
    ['中文设备', '型号 2', '%E5%9E%8B%E5%8F%B7%202'],
    ['Phone\r\nInjected', undefined, 'Unknown'],
    ['', undefined, 'Unknown'],
  ])(
    'derives the Android platform-name header for %s',
    async (displayName, model, expected) => {
      mockGetDeviceInfo.mockResolvedValue({
        displayName,
        device: { model },
      });

      const headers = await getRequestHeaders();

      expect(headers['x-onekey-request-platform-name']).toBe(expected);
      Object.values(headers).forEach((value) => {
        expect(value).toMatch(/^[\t\x20-\x7E]*$/);
      });
    },
  );

  it('computes the platform name once per JS runtime', async () => {
    mockGetDeviceInfo.mockResolvedValueOnce({
      displayName: '中文设备',
      device: { model: 'Pixel 8' },
    });

    const [first, concurrent] = await Promise.all([
      getRequestHeaders(),
      getRequestHeaders(),
    ]);
    const later = await getRequestHeaders();

    expect(mockGetDeviceInfo).toHaveBeenCalledTimes(1);
    expect(first['x-onekey-request-platform-name']).toBe('Pixel 8');
    expect(concurrent['x-onekey-request-platform-name']).toBe('Pixel 8');
    expect(later['x-onekey-request-platform-name']).toBe('Pixel 8');
  });

  it('caches the Unknown fallback when device lookup fails', async () => {
    mockGetDeviceInfo.mockRejectedValueOnce(
      new OneKeyLocalError('Device lookup failed'),
    );

    const first = await getRequestHeaders();
    const later = await getRequestHeaders();

    expect(first['x-onekey-request-platform-name']).toBe('Unknown');
    expect(later['x-onekey-request-platform-name']).toBe('Unknown');
    expect(mockGetDeviceInfo).toHaveBeenCalledTimes(1);
  });

  it('uses Unknown when device lookup throws synchronously', async () => {
    mockGetDeviceInfo.mockImplementationOnce(() => {
      throw new OneKeyLocalError('Device lookup failed');
    });

    const headers = await getRequestHeaders();

    expect(headers['x-onekey-request-platform-name']).toBe('Unknown');
  });

  it('uses Unknown when model encoding fails', async () => {
    mockGetDeviceInfo.mockResolvedValue({
      displayName: '中文设备',
      device: { model: '\uD800' },
    });

    const headers = await getRequestHeaders();

    expect(headers['x-onekey-request-platform-name']).toBe('Unknown');
  });

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
