import { EventEmitter } from 'events';
import fs from 'fs';
import https from 'https';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

import type { ISniUploadFileConfig } from '@onekeyhq/shared/src/request/types/ipTable';

import DesktopApiSniRequest, {
  isSniFailClosedError,
} from './DesktopApiSniRequest';

import type { IDesktopApi } from './instance/IDesktopApi';
import type { IncomingMessage } from 'http';
import type { RequestOptions } from 'https';

// Realpath'd so macOS /var -> /private/var does not affect the assertions.
const TMP_ROOT = fs.realpathSync(
  fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-sni-upload-')),
);
const USER_DATA_DIR = path.join(TMP_ROOT, 'userData');
const LOGS_DIR = path.join(TMP_ROOT, 'Logs', 'OneKey');
const ARCHIVE_DIR = path.join(TMP_ROOT, 'Logs', 'logs_zip');
const APP_TEMP_DIR = path.join(TMP_ROOT, 'temp');
const OUTSIDE_DIR = path.join(TMP_ROOT, 'outside');
const ARCHIVE_FILE = path.join(ARCHIVE_DIR, 'OneKeyLogs.zip');
const ARCHIVE_BYTES = Buffer.from(
  Array.from({ length: 200_000 }, (_value, index) => (index * 31 + 7) & 0xff),
);
// Read lazily by the hoisted mocks (jest requires the `mock` prefix).
const mockAppPaths: Record<string, string> = {
  userData: USER_DATA_DIR,
  logs: LOGS_DIR,
  temp: APP_TEMP_DIR,
};
const mockLogFilePath = path.join(LOGS_DIR, 'app-latest.log');

jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    transports: {
      file: { getFile: () => ({ path: mockLogFilePath }) },
    },
  },
}));

jest.mock('electron', () => ({
  app: {
    getPath: (name: string) => mockAppPaths[name],
  },
  session: {
    defaultSession: { resolveProxy: jest.fn(async () => 'DIRECT') },
  },
}));

// Collects the streamed body the way a writable ClientRequest would.
class FakeUploadRequest extends EventEmitter {
  constructor(public options: RequestOptions) {
    super();
    this.on('pipe', (source: fs.ReadStream) => {
      this.source = source;
    });
  }

  source: fs.ReadStream | undefined;

  chunks: Buffer[] = [];

  ended = false;

  destroyedWith: Error | undefined;

  write = jest.fn((chunk: Buffer | string) => {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return true;
  });

  end = jest.fn((chunk?: Buffer | string) => {
    if (chunk) this.write(chunk);
    this.ended = true;
    this.emit('finish');
    return this as never;
  });

  destroy = jest.fn((error?: Error) => {
    this.destroyedWith = error;
    if (error) this.emit('error', error);
    this.emit('close');
    return this as never;
  });

  get body(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

function respond(
  callback: ((response: IncomingMessage) => void) | undefined,
  statusCode: number,
  body: string,
): void {
  const response = new EventEmitter() as IncomingMessage;
  Object.assign(response, {
    statusCode,
    statusMessage: 'OK',
    headers: { 'content-type': 'application/json' },
    rawHeaders: ['Content-Type', 'application/json'],
    resume: jest.fn(),
  });
  callback?.(response);
  response.emit('data', Buffer.from(body));
  response.emit('end');
}

function baseConfig(
  overrides: Partial<ISniUploadFileConfig> = {},
): ISniUploadFileConfig {
  return {
    ip: '93.184.216.34',
    hostname: 'wallet.example.com',
    path: '/wallet/v1/client/log',
    headers: {
      'content-type': 'application/zip',
      'Content-Length': '1',
    },
    method: 'POST',
    filePath: ARCHIVE_FILE,
    timeout: 30_000,
    ...overrides,
  };
}

function makeApi(): DesktopApiSniRequest {
  return new DesktopApiSniRequest({ desktopApi: {} as IDesktopApi });
}

async function expectInvalidConfig(
  promise: Promise<unknown>,
  message: RegExp,
): Promise<void> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(Error);
  expect((error as { code?: string }).code).toBe('SNI_INVALID_CONFIG');
  expect(isSniFailClosedError(error)).toBe(true);
  expect((error as Error).message).toMatch(message);
}

describe('DesktopApiSniRequest.uploadFile', () => {
  let requestSpy: jest.SpyInstance;
  let requests: FakeUploadRequest[];

  beforeAll(() => {
    for (const dir of [
      USER_DATA_DIR,
      LOGS_DIR,
      ARCHIVE_DIR,
      APP_TEMP_DIR,
      OUTSIDE_DIR,
    ]) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(ARCHIVE_FILE, ARCHIVE_BYTES);
  });

  afterAll(() => {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  });

  beforeEach(() => {
    requests = [];
    requestSpy = jest.spyOn(https, 'request').mockImplementation(((
      options: RequestOptions,
      callback?: (response: IncomingMessage) => void,
    ) => {
      const request = new FakeUploadRequest(options);
      requests.push(request);
      request.on('finish', () => {
        setImmediate(() => respond(callback, 200, '{"code":0}'));
      });
      return request;
    }) as unknown as typeof https.request);
  });

  afterEach(() => {
    requestSpy.mockRestore();
  });

  test('streams the archive to the pinned IP with SNI and Content-Length', async () => {
    const response = await makeApi().uploadFile(baseConfig());

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('{"code":0}');
    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request.options).toMatchObject({
      method: 'POST',
      host: '93.184.216.34',
      port: 443,
      servername: 'wallet.example.com',
      path: '/wallet/v1/client/log',
      rejectUnauthorized: true,
    });
    expect(request.options.headers).toMatchObject({
      Host: 'wallet.example.com',
      'Content-Length': String(ARCHIVE_BYTES.length),
      'content-type': 'application/zip',
    });
    // The caller-supplied Content-Length is module-owned and dropped.
    expect(request.options.headers).not.toHaveProperty('Content-Length', '1');
    expect(request.body.equals(ARCHIVE_BYTES)).toBe(true);
  });

  test('accepts file:// URLs and PUT', async () => {
    await makeApi().uploadFile(
      baseConfig({
        method: 'PUT',
        filePath: pathToFileURL(ARCHIVE_FILE).href,
      }),
    );
    expect(requests[0].options.method).toBe('PUT');
    expect(requests[0].body.length).toBe(ARCHIVE_BYTES.length);
  });

  test('accepts files in userData, logs and temp', async () => {
    for (const dir of [USER_DATA_DIR, LOGS_DIR, APP_TEMP_DIR]) {
      const filePath = path.join(dir, 'upload.bin');
      fs.writeFileSync(filePath, 'x');
      await expect(
        makeApi().uploadFile(baseConfig({ filePath })),
      ).resolves.toMatchObject({ statusCode: 200 });
    }
  });

  test('rejects non-upload methods and a string body before network I/O', async () => {
    await expectInvalidConfig(
      makeApi().uploadFile(
        baseConfig({ method: 'GET' as ISniUploadFileConfig['method'] }),
      ),
      /Invalid upload method/,
    );
    await expectInvalidConfig(
      makeApi().uploadFile({
        ...baseConfig(),
        body: 'text',
      } as ISniUploadFileConfig),
      /does not accept a body/,
    );
    expect(requests).toHaveLength(0);
  });

  test('rejects files outside app storage, including via .. and symlinks', async () => {
    const outsideFile = path.join(OUTSIDE_DIR, 'secret.bin');
    fs.writeFileSync(outsideFile, 'secret');
    const symlink = path.join(ARCHIVE_DIR, 'link.zip');
    fs.symlinkSync(outsideFile, symlink);

    await expectInvalidConfig(
      makeApi().uploadFile(baseConfig({ filePath: outsideFile })),
      /outside app storage/,
    );
    await expectInvalidConfig(
      makeApi().uploadFile(
        baseConfig({
          filePath: `${ARCHIVE_DIR}/../../outside/secret.bin`,
        }),
      ),
      /outside app storage/,
    );
    await expectInvalidConfig(
      makeApi().uploadFile(baseConfig({ filePath: symlink })),
      /outside app storage/,
    );
    await expectInvalidConfig(
      makeApi().uploadFile(baseConfig({ filePath: 'relative/logs.zip' })),
      /must be absolute/,
    );
    // An app storage root itself is not a file inside it.
    await expectInvalidConfig(
      makeApi().uploadFile(baseConfig({ filePath: USER_DATA_DIR })),
      /outside app storage/,
    );
    expect(requests).toHaveLength(0);
  });

  test('rejects missing, empty, oversized and non-regular files', async () => {
    const emptyFile = path.join(ARCHIVE_DIR, 'empty.zip');
    fs.writeFileSync(emptyFile, '');
    const largeFile = path.join(ARCHIVE_DIR, 'large.zip');
    fs.writeFileSync(largeFile, '');
    fs.truncateSync(largeFile, 20 * 1024 * 1024 + 1);
    const maxFile = path.join(ARCHIVE_DIR, 'max.zip');
    fs.writeFileSync(maxFile, '');
    fs.truncateSync(maxFile, 20 * 1024 * 1024);

    await expectInvalidConfig(
      makeApi().uploadFile(
        baseConfig({ filePath: path.join(ARCHIVE_DIR, 'missing.zip') }),
      ),
      /not readable/,
    );
    await expectInvalidConfig(
      makeApi().uploadFile(baseConfig({ filePath: emptyFile })),
      /Invalid upload file size: 0/,
    );
    await expectInvalidConfig(
      makeApi().uploadFile(baseConfig({ filePath: largeFile })),
      /Invalid upload file size/,
    );
    fs.mkdirSync(path.join(ARCHIVE_DIR, 'dir.zip'));
    await expectInvalidConfig(
      makeApi().uploadFile(
        baseConfig({ filePath: path.join(ARCHIVE_DIR, 'dir.zip') }),
      ),
      /not a regular file/,
    );
    expect(requests).toHaveLength(0);

    await expect(
      makeApi().uploadFile(baseConfig({ filePath: maxFile })),
    ).resolves.toMatchObject({ statusCode: 200 });
  });

  test('applies the same IP and hostname validation as request()', async () => {
    await expectInvalidConfig(
      makeApi().uploadFile(baseConfig({ ip: '127.0.0.1' })),
      /Forbidden IP/,
    );
    await expectInvalidConfig(
      makeApi().uploadFile(baseConfig({ hostname: '93.184.216.34' })),
      /Invalid hostname/,
    );
    await expectInvalidConfig(
      makeApi().uploadFile(baseConfig({ timeout: 120_001 })),
      /Invalid timeout/,
    );
  });

  test('times out a stalled upload and releases the archive stream', async () => {
    requestSpy.mockImplementation(((options: RequestOptions) => {
      const request = new FakeUploadRequest(options);
      requests.push(request);
      return request;
    }) as unknown as typeof https.request);

    const error = await makeApi()
      .uploadFile(baseConfig({ timeout: 50 }))
      .then(
        () => undefined,
        (e: unknown) => e,
      );

    expect((error as { code?: string }).code).toBe('SNI_TIMEOUT');
    expect(requests[0].destroyedWith).toBe(error);
    expect(requests[0].source?.destroyed).toBe(true);
  });

  test('cancelRequest aborts an in-flight upload by requestId', async () => {
    requestSpy.mockImplementation(((options: RequestOptions) => {
      const request = new FakeUploadRequest(options);
      requests.push(request);
      return request;
    }) as unknown as typeof https.request);
    const api = makeApi();

    const upload = api.uploadFile(baseConfig({ requestId: 'upload-1' }));
    void upload.catch(() => undefined);
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
    await expect(api.cancelRequest('upload-1')).resolves.toEqual({
      success: true,
    });

    await expect(upload).rejects.toMatchObject({ code: 'SNI_CANCELLED' });
  });
});
