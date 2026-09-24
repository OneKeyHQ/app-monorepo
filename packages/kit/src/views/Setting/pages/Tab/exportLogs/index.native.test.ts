import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { ILogDigest } from '@onekeyhq/shared/src/logger/types';
import { getRequestHeaders } from '@onekeyhq/shared/src/request/Interceptor';

import { uploadLogBundle } from './index.native';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceApp: {
      getEndpointInfo: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  appEventBus: { emit: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/request/Interceptor', () => ({
  getRequestHeaders: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/request/customUA', () => ({
  withCustomUAHeaders: jest.fn(
    async (_url: string, headers: object) => headers,
  ),
}));

jest.mock('@onekeyhq/shared/src/logger/exportSupport', () => ({
  prepareLoggerExport: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    setting: { device: { logDeviceInfo: jest.fn() } },
    ipTable: { request: { warn: jest.fn(), info: jest.fn() } },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/utils', () => ({
  __esModule: true,
  default: { getLogFilePath: jest.fn() },
}));

jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger',
  () => ({
    NativeLogger: { getLogFilePaths: jest.fn() },
  }),
);

jest.mock('@onekeyhq/shared/src/modules3rdParty/react-native-fs', () => ({
  __esModule: true,
  default: { uploadFiles: jest.fn() },
}));

jest.mock('expo-file-system/legacy', () => ({
  createUploadTask: jest.fn(),
  FileSystemUploadType: { BINARY_CONTENT: 0 },
}));

const mockUploadFiles = jest.requireMock(
  '@onekeyhq/shared/src/modules3rdParty/react-native-fs',
).default.uploadFiles as jest.Mock;
const mockCreateUploadTask = jest.requireMock('expo-file-system/legacy')
  .createUploadTask as jest.Mock;

describe('uploadLogBundle native fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (
      backgroundApiProxy.serviceApp.getEndpointInfo as jest.Mock
    ).mockResolvedValue({ endpoint: 'https://api.example.com/' });
    (getRequestHeaders as jest.Mock).mockResolvedValue({
      'x-onekey-request-platform-name': 'Galaxy A55',
    });
    mockCreateUploadTask.mockImplementation(() => {
      throw new OneKeyLocalError('Native binary upload failed');
    });
    mockUploadFiles.mockReturnValue({
      promise: Promise.resolve({
        statusCode: 200,
        body: JSON.stringify({
          code: 0,
          data: {
            objectKey: 'logs/test.zip',
            uploadedBytes: 42,
            durationMs: 1,
          },
        }),
      }),
    });
  });

  it('uploads the archive with RNFS multipart after binary upload fails', async () => {
    const digest = {
      sizeBytes: 42,
      sha256: 'test',
      bundle: {
        type: 'file',
        fileName: 'test.zip',
        filePath: 'file:///tmp/test.zip',
        mimeType: 'application/zip',
      },
    } as ILogDigest;

    const result = await uploadLogBundle({ uploadToken: 'test-token', digest });

    expect(mockUploadFiles).toHaveBeenCalledWith({
      toUrl: 'https://api.example.com/wallet/v1/client/log',
      files: [
        {
          name: 'file',
          filename: 'test.zip',
          filepath: '/tmp/test.zip',
          filetype: 'application/zip',
        },
      ],
      method: 'POST',
      headers: {
        'x-onekey-request-platform-name': 'Galaxy A55',
        authorization: 'Bearer test-token',
      },
    });
    expect(result.result.objectKey).toBe('logs/test.zip');
  });
});
