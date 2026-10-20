import fs from 'fs';
import os from 'os';
import path from 'path';

import DesktopApiDev from './DesktopApiDev';

import type { IDesktopApi } from './instance/IDesktopApi';

let mockLogFile: string;
const mockOpenedPaths: fs.PathLike[] = [];
jest.mock('fs', () => {
  const actual = jest.requireActual<typeof import('fs')>('fs');
  return {
    ...actual,
    createReadStream: (...args: Parameters<typeof actual.createReadStream>) => {
      mockOpenedPaths.push(args[0]);
      return actual.createReadStream(...args);
    },
  };
});
jest.mock('electron', () => ({ shell: { openPath: jest.fn() } }));
jest.mock('electron-log/main', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  transports: { file: { getFile: () => ({ path: mockLogFile }) } },
}));
jest.mock('@onekeyhq/desktop/app/logger', () => ({
  flushDesktopDedup: jest.fn(),
}));
jest.mock('@onekeyhq/desktop/app/libs/networkThrottle', () => ({}));
jest.mock('@onekeyhq/desktop/app/libs/store', () => ({}));
jest.mock('@onekeyhq/shared/src/request/customUA', () => ({
  withCustomUAHeaders: async (_url: string, headers: Record<string, string>) =>
    headers,
}));
let dir: string;
let api: DesktopApiDev;
let fetchSpy: jest.Mock<
  ReturnType<typeof fetch>,
  [input: unknown, init?: unknown]
>;
const previousFetch = globalThis.fetch;

const uploadUrl = 'https://wallet.onekeycn.com/wallet/v1/client/log';
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'log-boundary-'));
  fs.mkdirSync(path.join(dir, 'logs'));
  mockLogFile = path.join(dir, 'logs', 'app-latest.log');
  fs.writeFileSync(mockLogFile, 'fixture log');
  api = new DesktopApiDev({ desktopApi: {} as IDesktopApi });
  fetchSpy = jest.fn<
    ReturnType<typeof fetch>,
    [input: unknown, init?: unknown]
  >(async (_url, init) => {
    for await (const _chunk of (init as RequestInit | undefined)
      ?.body as unknown as AsyncIterable<Buffer>) {
      /* Consume the pull-based body. */
    }
    return new Response(JSON.stringify({ code: 0, data: { uploaded: true } }), {
      status: 200,
    });
  });
  globalThis.fetch = fetchSpy;
  mockOpenedPaths.length = 0;
});
afterEach(() => {
  jest.restoreAllMocks();
  globalThis.fetch = previousFetch;
  fs.rmSync(dir, { recursive: true, force: true });
});

test.each(['../escape', 'a/b', 'a\\b', '..', '', 'name.zip', 'name\u0000'])(
  'rejects archive name case %# before creating an output directory',
  async (fileBaseName) => {
    await expect(api.collectLoggerDigest({ fileBaseName })).rejects.toThrow(
      'Invalid log archive name',
    );
    expect(fs.existsSync(path.join(dir, 'logs_zip'))).toBe(false);
  },
);

test.each([
  'http://wallet.onekeycn.com/wallet/v1/client/log',
  'https://evil.test/wallet/v1/client/log',
  'https://wallet.onekeycn.com.evil.test/wallet/v1/client/log',
  'https://wallet.onekeycn.com:444/wallet/v1/client/log',
  'https://user:pass@wallet.onekeycn.com/wallet/v1/client/log',
  'file:///tmp/fixture',
  'https://wallet.onekeycn.com/other',
])(
  'rejects URL %s without opening a file or contacting a server',
  async (url) => {
    await expect(
      api.uploadLoggerBundle({
        uploadUrl: url,
        filePath: mockLogFile,
        headers: {},
      }),
    ).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockOpenedPaths).toEqual([]);
  },
);

test('rejects outside files and unregistered zips inside logs_zip without side effects', async () => {
  const zipDir = path.join(dir, 'logs_zip');
  fs.mkdirSync(zipDir);
  const unregistered = path.join(zipDir, 'unregistered.zip');
  fs.writeFileSync(unregistered, 'private fixture');
  for (const filePath of [
    mockLogFile,
    unregistered,
    path.join(zipDir, '..', 'logs', 'app-latest.log'),
  ]) {
    await expect(
      api.uploadLoggerBundle({ uploadUrl, filePath, headers: {} }),
    ).rejects.toThrow('not collected');
  }
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(mockOpenedPaths).toEqual([]);
  expect(fs.readFileSync(unregistered, 'utf8')).toBe('private fixture');
});

test.each(['https://wallet.onekeycn.com', 'https://wallet.onekeytest.com'])(
  'uploads only a collected archive to %s',
  async (origin) => {
    const digest = await api.collectLoggerDigest({
      fileBaseName: 'OneKeyLogs-fixture',
    });
    const result: unknown = await api.uploadLoggerBundle({
      uploadUrl: `${origin}/wallet/v1/client/log`,
      filePath: digest.filePath,
      headers: { 'Content-Length': '1' },
      sizeBytes: 1,
    });
    expect(result).toEqual({ code: 0, data: { uploaded: true } });
    expect(mockOpenedPaths).toEqual([digest.filePath]);
    expect(fetchSpy).toHaveBeenCalledWith(
      `${origin}/wallet/v1/client/log`,
      expect.objectContaining({
        redirect: 'error',
        headers: expect.objectContaining({
          'content-length': String(digest.sizeBytes),
          'content-type': 'application/zip',
        }),
      }),
    );
  },
);

test('rejects a collected archive replaced with a symlink before a network request', async () => {
  const digest = await api.collectLoggerDigest({
    fileBaseName: 'OneKeyLogs-fixture',
  });
  fs.unlinkSync(digest.filePath);
  fs.symlinkSync(mockLogFile, digest.filePath);
  await expect(
    api.uploadLoggerBundle({
      uploadUrl,
      filePath: digest.filePath,
      headers: {},
    }),
  ).rejects.toThrow('changed');
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(mockOpenedPaths).toEqual([]);
});
