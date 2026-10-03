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
jest.mock('@onekeyhq/desktop/app/config', () => ({ ipcMessageKeys: {} }));
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
