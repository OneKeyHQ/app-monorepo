import { TurboModuleRegistry } from 'react-native';

import { isSniUploadFileSupported, sniUploadFile } from './sniRequest.native';

import type { ISniUploadFileConfig } from '../types/ipTable';

jest.mock('@onekeyfe/react-native-sni-connect', () => ({
  isProxyActiveForUrl: jest.fn(),
  request: jest.fn(),
}));

jest.mock('react-native', () => ({
  NativeModules: {},
  TurboModuleRegistry: { get: jest.fn() },
}));

jest.mock('../../logger/logger', () => ({
  defaultLogger: {
    ipTable: {
      request: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    },
  },
}));

jest.mock('../../utils/miscUtils', () => ({
  generateUUID: jest.fn(() => 'upload-request-id'),
}));

const mockedTurboModuleGet = TurboModuleRegistry.get as jest.Mock;

function buildUploadConfig(): ISniUploadFileConfig {
  return {
    ip: '93.184.216.34',
    hostname: 'example.com',
    path: '/upload',
    headers: { 'content-type': 'application/zip' },
    method: 'POST',
    filePath: '/cache/logs.zip',
    timeout: 90_000,
  };
}

describe('sniUploadFile (native)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('returns null on native binaries without uploadFile', async () => {
    mockedTurboModuleGet.mockReturnValue({ cancelRequest: jest.fn() });

    expect(isSniUploadFileSupported()).toBe(false);
    await expect(sniUploadFile(buildUploadConfig())).resolves.toBeNull();
  });

  test('forwards the upload with a request id and normalizes the response', async () => {
    const uploadFile = jest.fn().mockResolvedValue({
      data: '{"code":0}',
      status: 200,
      statusText: '',
      headers: { 'content-type': 'application/json' },
    });
    mockedTurboModuleGet.mockReturnValue({
      cancelRequest: jest.fn(),
      uploadFile,
    });

    expect(isSniUploadFileSupported()).toBe(true);
    await expect(sniUploadFile(buildUploadConfig())).resolves.toEqual({
      data: '{"code":0}',
      status: 200,
      statusText: '',
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      multiValueHeaders: undefined,
      body: '{"code":0}',
    });
    expect(uploadFile).toHaveBeenCalledWith({
      ...buildUploadConfig(),
      requestId: 'upload-request-id',
    });
  });

  test('cancels the native upload when the signal aborts', async () => {
    const cancelRequest = jest.fn().mockResolvedValue({ success: true });
    const uploadFile = jest.fn(() => new Promise<never>(() => undefined));
    mockedTurboModuleGet.mockReturnValue({ cancelRequest, uploadFile });
    const controller = new AbortController();

    const pending = sniUploadFile(buildUploadConfig(), {
      signal: controller.signal,
    });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ code: 'SNI_CANCELLED' });
    expect(cancelRequest).toHaveBeenCalledWith('upload-request-id');
  });
});
