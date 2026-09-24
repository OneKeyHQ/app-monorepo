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
    ['Pixel 8', 'Pixel 8', 'Pixel%208'],
    ['中文设备', 'Galaxy A55', 'Galaxy%20A55'],
    ['Phone 😀', 'GalaxyA55', 'GalaxyA55'],
    ['中文设备', '型号 2', '%E5%9E%8B%E5%8F%B7%202'],
    ['Phone\r\nInjected', undefined, 'unknown'],
    ['', undefined, 'unknown'],
  ])(
    'uses an encoded Android header for %s',
    async (displayName, model, expected) => {
      mockGetDeviceInfo.mockResolvedValue({
        displayName,
        device: { model },
      });

      const headers = await getRequestHeaders();

      expect(headers['x-onekey-request-platform-name']).toBe(expected);
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
    expect(first['x-onekey-request-platform-name']).toBe('Pixel%208');
    expect(concurrent['x-onekey-request-platform-name']).toBe('Pixel%208');
    expect(later['x-onekey-request-platform-name']).toBe('Pixel%208');
  });

  it('caches the unknown fallback when device lookup fails', async () => {
    mockGetDeviceInfo.mockRejectedValueOnce(
      new OneKeyLocalError('Device lookup failed'),
    );

    const first = await getRequestHeaders();
    const later = await getRequestHeaders();

    expect(first['x-onekey-request-platform-name']).toBe('unknown');
    expect(later['x-onekey-request-platform-name']).toBe('unknown');
    expect(mockGetDeviceInfo).toHaveBeenCalledTimes(1);
  });

  it('uses unknown when device lookup throws synchronously', async () => {
    mockGetDeviceInfo.mockImplementationOnce(() => {
      throw new OneKeyLocalError('Device lookup failed');
    });

    const headers = await getRequestHeaders();

    expect(headers['x-onekey-request-platform-name']).toBe('unknown');
  });

  it('uses unknown when model encoding fails', async () => {
    mockGetDeviceInfo.mockResolvedValue({
      displayName: '中文设备',
      device: { model: '\uD800' },
    });

    const headers = await getRequestHeaders();

    expect(headers['x-onekey-request-platform-name']).toBe('unknown');
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
