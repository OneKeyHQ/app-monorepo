import { SniRequestError } from '@onekeyfe/react-native-sni-connect/node';
import electronLogger from 'electron-log/main';

import type { ISniRequestConfig } from '@onekeyhq/shared/src/request/types/ipTable';

import DesktopApiSniRequest from './DesktopApiSniRequest';

import type { IDesktopApi } from './instance/IDesktopApi';
import type SniNodeClient from '@onekeyfe/react-native-sni-connect/node';

const mockResolveProxy = jest.fn<Promise<string>, [string]>();

jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('electron', () => ({
  session: {
    defaultSession: {
      resolveProxy: (url: string) => mockResolveProxy(url),
    },
  },
}));

const mockedElectronLogger = jest.mocked(electronLogger);

const baseConfig = (): ISniRequestConfig => ({
  ip: '93.184.216.34',
  hostname: 'example.com',
  path: '/',
  headers: {},
  method: 'GET',
  body: null,
  timeout: 30_000,
});

function getClient(api: DesktopApiSniRequest): SniNodeClient {
  return (api as unknown as { client: SniNodeClient }).client;
}

describe('DesktopApiSniRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('adapts a bodyless app POST to the SDK request format', async () => {
    const api = new DesktopApiSniRequest({ desktopApi: {} as IDesktopApi });
    const clientRequest = jest
      .spyOn(getClient(api), 'request')
      .mockResolvedValue({
        body: '',
        data: '',
        status: 204,
        statusCode: 204,
        statusText: '',
        headers: {},
      });
    const config = { ...baseConfig(), method: 'POST' };

    await expect(api.request(config)).resolves.toMatchObject({ status: 204 });
    expect(clientRequest).toHaveBeenCalledWith({ ...config, body: '' });
  });

  test('applies the desktop IPv6 range policy before delegating to the SDK', async () => {
    const api = new DesktopApiSniRequest({ desktopApi: {} as IDesktopApi });
    const client = getClient(api);
    const unexpectedCall = new Error('Unexpected SDK call');
    const sdkRequest = jest
      .spyOn(client, 'request')
      .mockRejectedValue(unexpectedCall);
    const sdkUpload = jest
      .spyOn(client, 'uploadFile')
      .mockRejectedValue(unexpectedCall);
    const sdkSnapshot = jest
      .spyOn(client, 'getDebugSnapshot')
      .mockRejectedValue(unexpectedCall);
    const ip = '3fff::1';
    const config = { ...baseConfig(), ip };

    await expect(api.request(config)).rejects.toMatchObject({
      code: 'SNI_INVALID_CONFIG',
      failClosed: true,
    });
    await expect(
      api.uploadFile({
        ...config,
        method: 'POST',
        filePath: '/test/logs.zip',
      }),
    ).rejects.toMatchObject({ code: 'SNI_INVALID_CONFIG', failClosed: true });
    await expect(
      api.getDebugSnapshot({ hostname: config.hostname, ip }),
    ).rejects.toMatchObject({ code: 'SNI_INVALID_CONFIG', failClosed: true });
    expect(sdkRequest).not.toHaveBeenCalled();
    expect(sdkUpload).not.toHaveBeenCalled();
    expect(sdkSnapshot).not.toHaveBeenCalled();
  });

  test.each([
    ['Protocol upgrades are not supported', 'SNI_RESPONSE_FAILED'],
    ['Preflight policy rejected the upload', 'SNI_SECURITY_POLICY_FAILED'],
  ])(
    'classifies "%s" as %s for the upload fallback decision',
    async (message, code) => {
      const api = new DesktopApiSniRequest({ desktopApi: {} as IDesktopApi });
      jest
        .spyOn(getClient(api), 'uploadFile')
        .mockRejectedValue(
          new SniRequestError('SNI_SECURITY_POLICY_FAILED', message, true),
        );

      await expect(
        api.uploadFile({
          ...baseConfig(),
          method: 'POST',
          filePath: '/test/logs.zip',
        }),
      ).rejects.toMatchObject({ code, failClosed: true });
    },
  );

  test('logs the destination IP while redacting validation error details', async () => {
    const api = new DesktopApiSniRequest({ desktopApi: {} as IDesktopApi });

    await expect(
      api.request({ ...baseConfig(), ip: '10.0.0.5' }),
    ).rejects.toThrow(/Forbidden IP: 10\.0\.0\.5/);

    const errorLogs = mockedElectronLogger.error.mock.calls
      .map(([message]) => String(message))
      .join('\n');
    expect(errorLogs).toContain(
      'errorMessage=SNI_INVALID_CONFIG:_Forbidden_IP:_<ip>',
    );
    expect(errorLogs).toContain('ip=10.0.0.5');
    expect(errorLogs).not.toContain('ipHash=');
  });

  test('exposes count-only limiter state in production QA builds', async () => {
    const api = new DesktopApiSniRequest({ desktopApi: {} as IDesktopApi });
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      await expect(
        api.getDebugSnapshot({
          hostname: 'example.com',
          ip: '93.184.216.34',
        }),
      ).resolves.toEqual({
        activeRequests: 0,
        activeRequestsForPair: 0,
        pendingRequests: 0,
        pendingRequestsForPair: 0,
      });
    } finally {
      if (previousNodeEnv === undefined) {
        Reflect.deleteProperty(process.env, 'NODE_ENV');
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
    }
  });

  test('detects active proxy routes from Electron resolveProxy output', async () => {
    const api = new DesktopApiSniRequest({ desktopApi: {} as IDesktopApi });

    mockResolveProxy.mockResolvedValueOnce('DIRECT');
    await expect(api.isProxyActiveForUrl('https://example.com/')).resolves.toBe(
      false,
    );

    mockResolveProxy.mockResolvedValueOnce('PROXY 127.0.0.1:7890; DIRECT');
    await expect(api.isProxyActiveForUrl('https://example.com/')).resolves.toBe(
      true,
    );
  });
});
