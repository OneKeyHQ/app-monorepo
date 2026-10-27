import platformEnv from '../../platformEnv';

import { isSniUploadFileSupported, sniUploadFile } from './sniRequest.desktop';

import type { ISniResponse, ISniUploadFileConfig } from '../types/ipTable';

jest.mock('../../platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: true,
  },
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
  generateUUID: jest.fn(() => 'desktop-upload-request-id'),
}));

type DesktopApiProxyMock = {
  sniRequest?: {
    request?: jest.Mock;
    uploadFile?: jest.Mock<Promise<ISniResponse>, [ISniUploadFileConfig]>;
    cancelRequest?: jest.Mock<Promise<{ success: boolean }>, [string]>;
  };
};

const mockedPlatformEnv = platformEnv as jest.Mocked<typeof platformEnv>;

function setDesktopApiProxy(value: DesktopApiProxyMock | undefined): void {
  Object.defineProperty(globalThis, 'desktopApiProxy', {
    configurable: true,
    writable: true,
    value,
  });
}

function buildUploadConfig(): ISniUploadFileConfig {
  return {
    ip: '93.184.216.34',
    hostname: 'wallet.example.com',
    path: '/wallet/v1/client/log',
    headers: { 'content-type': 'application/zip' },
    method: 'POST',
    filePath: '/Users/test/Library/Logs/logs_zip/OneKeyLogs.zip',
    timeout: 90_000,
  };
}

const sniResponse: ISniResponse = {
  statusCode: 200,
  headers: {},
  body: '{"code":0}',
};

describe('sniUploadFile (desktop)', () => {
  let originalDesktopApiProxyDescriptor: PropertyDescriptor | undefined;

  beforeAll(() => {
    originalDesktopApiProxyDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'desktopApiProxy',
    );
  });

  beforeEach(() => {
    mockedPlatformEnv.isDesktop = true;
    jest.clearAllMocks();
  });

  afterEach(() => {
    setDesktopApiProxy(undefined);
  });

  afterAll(() => {
    if (originalDesktopApiProxyDescriptor) {
      Object.defineProperty(
        globalThis,
        'desktopApiProxy',
        originalDesktopApiProxyDescriptor,
      );
    } else {
      Reflect.deleteProperty(globalThis, 'desktopApiProxy');
    }
  });

  test('forwards the upload to the main process with a request id', async () => {
    const uploadFile = jest
      .fn<Promise<ISniResponse>, [ISniUploadFileConfig]>()
      .mockResolvedValue(sniResponse);
    setDesktopApiProxy({
      sniRequest: { uploadFile, cancelRequest: jest.fn() },
    });

    expect(isSniUploadFileSupported()).toBe(true);
    await expect(sniUploadFile(buildUploadConfig())).resolves.toBe(sniResponse);
    expect(uploadFile).toHaveBeenCalledWith({
      ...buildUploadConfig(),
      requestId: 'desktop-upload-request-id',
    });
  });

  test('returns null when the desktop API is unavailable', async () => {
    setDesktopApiProxy(undefined);
    expect(isSniUploadFileSupported()).toBe(false);
    await expect(sniUploadFile(buildUploadConfig())).resolves.toBeNull();

    setDesktopApiProxy({ sniRequest: { cancelRequest: jest.fn() } });
    await expect(sniUploadFile(buildUploadConfig())).resolves.toBeNull();
  });

  test('returns null on a main process that predates uploadFile', async () => {
    setDesktopApiProxy({
      sniRequest: {
        uploadFile: jest
          .fn<Promise<ISniResponse>, [ISniUploadFileConfig]>()
          .mockRejectedValue(
            new Error(
              'callRemoteApiMethod not found: desktopApi.sniRequest.uploadFile()',
            ),
          ),
        cancelRequest: jest.fn(),
      },
    });

    await expect(sniUploadFile(buildUploadConfig())).resolves.toBeNull();
  });

  test('surfaces transport failures so callers can classify timeouts', async () => {
    const timeoutError = Object.assign(new Error('SNI_TIMEOUT: timed out'), {
      code: 'SNI_TIMEOUT',
    });
    setDesktopApiProxy({
      sniRequest: {
        uploadFile: jest
          .fn<Promise<ISniResponse>, [ISniUploadFileConfig]>()
          .mockRejectedValue(timeoutError),
        cancelRequest: jest.fn(),
      },
    });

    await expect(sniUploadFile(buildUploadConfig())).rejects.toBe(timeoutError);
  });

  test('cancels the main-process upload when the signal aborts', async () => {
    const uploadFile = jest.fn<Promise<ISniResponse>, [ISniUploadFileConfig]>(
      () => new Promise<ISniResponse>(() => undefined),
    );
    const cancelRequest = jest
      .fn<Promise<{ success: boolean }>, [string]>()
      .mockResolvedValue({ success: true });
    setDesktopApiProxy({ sniRequest: { uploadFile, cancelRequest } });
    const controller = new AbortController();

    const upload = sniUploadFile(buildUploadConfig(), {
      signal: controller.signal,
    });
    controller.abort();

    await expect(upload).rejects.toMatchObject({ code: 'SNI_CANCELLED' });
    expect(cancelRequest).toHaveBeenCalledWith('desktop-upload-request-id');
  });

  test('is unsupported outside desktop', async () => {
    mockedPlatformEnv.isDesktop = false;
    setDesktopApiProxy({
      sniRequest: { uploadFile: jest.fn(), cancelRequest: jest.fn() },
    });
    expect(isSniUploadFileSupported()).toBe(false);
    await expect(sniUploadFile(buildUploadConfig())).resolves.toBeNull();
  });
});
