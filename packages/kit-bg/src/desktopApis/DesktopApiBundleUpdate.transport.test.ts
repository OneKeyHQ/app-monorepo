import fs from 'fs';
import os from 'os';
import path from 'path';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { INodeDownloadOptions } from './nodeDownload';

let mockUserData: string;
const mockRequestUpdateUrl = jest.fn();
const mockDownloadNodeFile = jest.fn<
  Promise<{ filePath: string; totalBytes: number }>,
  [INodeDownloadOptions]
>(async (opts) => ({ filePath: opts.targetPath, totalBytes: 0 }));

jest.mock('electron', () => ({
  app: { getPath: () => mockUserData },
}));
jest.mock('./electronUpdateRequest', () => ({
  requestUpdateUrl: mockRequestUpdateUrl,
}));
jest.mock('./nodeDownload', () => ({
  downloadNodeFile: mockDownloadNodeFile,
}));
jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('@onekeyhq/desktop/app/bundle', () => ({}));
jest.mock('@onekeyhq/desktop/app/config', () => ({
  ipcMessageKeys: { UPDATE_DOWNLOADING: 'update/downloading' },
}));
jest.mock('@onekeyhq/desktop/app/libs/store', () => ({}));
jest.mock('@onekeyhq/desktop/app/windowProgressBar', () => ({
  clearWindowProgressBar: jest.fn(),
  updateWindowProgressBar: jest.fn(),
}));

const params = {
  latestVersion: '6.0.0',
  bundleVersion: '123',
  downloadUrl: 'https://updates.onekey.test/bundle.zip',
  sha256: 'a'.repeat(64),
  headers: { Authorization: 'bundle-token' },
};

async function createApi() {
  const { default: Api } = await import('./DesktopApiBundleUpdate');
  return new Api({ desktopApi: {} as never });
}

beforeEach(() => {
  mockUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-transport-'));
  mockDownloadNodeFile.mockReset();
  mockDownloadNodeFile.mockImplementation(async (opts) => ({
    filePath: opts.targetPath,
    totalBytes: 0,
  }));
});

afterEach(() => {
  fs.rmSync(mockUserData, { recursive: true, force: true });
});

test('bundle production download forwards headers, size, and Electron transport', async () => {
  const api = await createApi();
  await api.downloadBundle({ ...params, fileSize: 3 * 1024 * 1024 });
  expect(mockDownloadNodeFile).toHaveBeenCalledWith(
    expect.objectContaining({
      headers: params.headers,
      expectedBytes: 3 * 1024 * 1024,
      expectedSha256: params.sha256,
      transport: mockRequestUpdateUrl,
    }),
  );
  await api.downloadBundle({ ...params, bundleVersion: '124', fileSize: 0 });
  expect(mockDownloadNodeFile.mock.calls[1][0].expectedBytes).toBeUndefined();
});

test('bundle cancellation aborts the shared downloader', async () => {
  let signal: AbortSignal | undefined;
  mockDownloadNodeFile.mockImplementationOnce(
    (opts) =>
      new Promise((_, reject) => {
        signal = opts.signal;
        opts.signal?.addEventListener('abort', () =>
          reject(new OneKeyLocalError('Download cancelled')),
        );
      }),
  );
  const api = await createApi();
  const download = api.downloadBundle(params);
  const clear = api.clearDownload();
  await expect(download).rejects.toThrow('Download cancelled');
  await clear;
  expect(signal?.aborted).toBe(true);
});

function pendingDownload(opts: INodeDownloadOptions) {
  let resolve: (value: {
    filePath: string;
    totalBytes: number;
  }) => void = () => {};
  let reject: (error: OneKeyLocalError) => void = () => {};
  const promise = new Promise<{ filePath: string; totalBytes: number }>(
    (resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    },
  );
  opts.signal?.addEventListener(
    'abort',
    () => reject(new OneKeyLocalError('Download cancelled')),
    { once: true },
  );
  return {
    promise,
    complete: () => resolve({ filePath: opts.targetPath, totalBytes: 1 }),
    fail: () => reject(new OneKeyLocalError('Fixture download failed')),
    signal: opts.signal,
  };
}

test('same bundle destination joins the active download and releases it on completion', async () => {
  const runs: ReturnType<typeof pendingDownload>[] = [];
  mockDownloadNodeFile.mockImplementation((opts) => {
    const run = pendingDownload(opts);
    runs.push(run);
    return run.promise;
  });
  const api = await createApi();
  const first = api.downloadBundle(params);
  const joined = api.downloadBundle(params);
  expect(mockDownloadNodeFile).toHaveBeenCalledTimes(1);
  runs[0].complete();
  const [event, sameEvent] = await Promise.all([first, joined]);
  expect(event).toHaveProperty(
    'downloadedFile',
    path.join(mockUserData, 'onekey-bundle-download', '6.0.0-123.zip'),
  );
  expect(sameEvent).toBe(event);
  expect(api.isDownloading).toBe(false);
  const retry = api.downloadBundle(params);
  expect(mockDownloadNodeFile).toHaveBeenCalledTimes(2);
  runs[1].complete();
  await retry;
});

test('different destinations retain active state and cancellation after one completes', async () => {
  const runs: ReturnType<typeof pendingDownload>[] = [];
  mockDownloadNodeFile.mockImplementation((opts) => {
    const run = pendingDownload(opts);
    runs.push(run);
    return run.promise;
  });
  const api = await createApi();
  const first = api.downloadBundle(params);
  const second = api.downloadBundle({ ...params, bundleVersion: '124' });
  const secondOutcome = second.catch((error: unknown) => error);
  expect(mockDownloadNodeFile).toHaveBeenCalledTimes(2);
  runs[0].complete();
  expect(await first).toHaveProperty('bundleVersion', '123');
  expect(api.isDownloading).toBe(true);
  await api.clearDownload();
  expect(await secondOutcome).toHaveProperty('message', 'Download cancelled');
  expect(runs[0].signal?.aborted).toBe(false);
  expect(runs[1].signal?.aborted).toBe(true);
  expect(api.isDownloading).toBe(false);
});

test('a failed destination can retry while another download remains active', async () => {
  const runs: ReturnType<typeof pendingDownload>[] = [];
  mockDownloadNodeFile.mockImplementation((opts) => {
    const run = pendingDownload(opts);
    runs.push(run);
    return run.promise;
  });
  const api = await createApi();
  const first = api.downloadBundle(params);
  const firstOutcome = first.catch((error: unknown) => error);
  const second = api.downloadBundle({ ...params, bundleVersion: '124' });
  expect(mockDownloadNodeFile).toHaveBeenCalledTimes(2);
  runs[0].fail();
  expect(await firstOutcome).toHaveProperty(
    'message',
    'Fixture download failed',
  );
  expect(api.isDownloading).toBe(true);
  const retry = api.downloadBundle(params);
  expect(mockDownloadNodeFile).toHaveBeenCalledTimes(3);
  runs[1].complete();
  expect(await second).toHaveProperty('bundleVersion', '124');
  expect(api.isDownloading).toBe(true);
  runs[2].complete();
  expect(await retry).toHaveProperty('bundleVersion', '123');
  expect(api.isDownloading).toBe(false);
});

test('downloads started during cache clearing wait until cancelled writers settle', async () => {
  let releaseCancelled: () => void = () => {};
  mockDownloadNodeFile.mockImplementation(async (opts) => {
    fs.writeFileSync(opts.targetPath, 'new bundle');
    return { filePath: opts.targetPath, totalBytes: 10 };
  });
  mockDownloadNodeFile.mockImplementationOnce(
    (opts) =>
      new Promise((_, reject) => {
        opts.signal?.addEventListener(
          'abort',
          () => {
            releaseCancelled = () =>
              reject(new OneKeyLocalError('Download cancelled'));
          },
          { once: true },
        );
      }),
  );
  const api = await createApi();
  const oldDownload = api
    .downloadBundle(params)
    .catch((error: unknown) => error);
  const clear = api.clearDownload();
  const joinedClear = api.clearDownload();
  const nextDownload = api.downloadBundle({ ...params, bundleVersion: '124' });
  await Promise.resolve();
  const requestsDuringClear = mockDownloadNodeFile.mock.calls.length;
  releaseCancelled();
  await Promise.all([clear, joinedClear]);
  expect(await oldDownload).toHaveProperty('message', 'Download cancelled');
  const event = await nextDownload;
  expect(event).toHaveProperty('bundleVersion', '124');
  expect(requestsDuringClear).toBe(1);
  expect(mockDownloadNodeFile).toHaveBeenCalledTimes(2);
  if (!event?.downloadedFile)
    throw new OneKeyLocalError('New bundle was not published');
  expect(fs.readFileSync(event.downloadedFile, 'utf8')).toBe('new bundle');
});

test('concurrent bundle progress identifies its destination versions', async () => {
  const send = jest.fn();
  const previous = globalThis.$desktopMainAppFunctions;
  globalThis.$desktopMainAppFunctions = {
    getSafelyMainWindow: () => ({ webContents: { send } }),
  } as unknown as typeof previous;
  const runs: ReturnType<typeof pendingDownload>[] = [];
  mockDownloadNodeFile.mockImplementation((opts) => {
    const run = pendingDownload(opts);
    runs.push(run);
    return run.promise;
  });
  try {
    const api = await createApi();
    const first = api.downloadBundle(params);
    const second = api.downloadBundle({ ...params, bundleVersion: '124' });
    mockDownloadNodeFile.mock.calls[0][0].onProgress?.({
      percent: 10,
      total: 10,
      transferred: 1,
      delta: 1,
      bytesPerSecond: 1,
    });
    mockDownloadNodeFile.mock.calls[1][0].onProgress?.({
      percent: 90,
      total: 10,
      transferred: 9,
      delta: 8,
      bytesPerSecond: 1,
    });
    runs.forEach((run) => run.complete());
    await Promise.all([first, second]);
    expect(send.mock.calls).toEqual([
      [
        'update/downloading',
        expect.objectContaining({
          latestVersion: '6.0.0',
          bundleVersion: '123',
          percent: 10,
        }),
      ],
      [
        'update/downloading',
        expect.objectContaining({
          latestVersion: '6.0.0',
          bundleVersion: '124',
          percent: 90,
        }),
      ],
    ]);
  } finally {
    globalThis.$desktopMainAppFunctions = previous;
  }
});
