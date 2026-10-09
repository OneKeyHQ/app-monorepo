import crypto from 'crypto';
import fs from 'fs';
import https from 'https';
import path from 'path';

// eslint-disable-next-line import/no-extraneous-dependencies
import selfsigned from 'selfsigned';

import { USERDATA, makeApi } from './__e2e__/desktopBundleUpdateE2eHarness';

import type { IUpdateResponse } from './electronUpdateRequest';
import type { AddressInfo } from 'net';

const mockRequestUpdateUrl = jest.fn(
  (
    url: string,
    headers: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<IUpdateResponse> =>
    new Promise((resolve, reject) => {
      const request = https.get(url, { headers, signal }, (response) =>
        resolve({ response, url }),
      );
      request.once('error', reject);
    }),
);

jest.mock('electron', () => ({ app: { getPath: () => USERDATA } }));
jest.mock('./electronUpdateRequest', () => ({
  requestUpdateUrl: mockRequestUpdateUrl,
}));
jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('@onekeyhq/desktop/app/bundle', () => ({
  verifySha256: jest.fn(),
}));
jest.mock('@onekeyhq/desktop/app/config', () => ({
  ipcMessageKeys: new Proxy({}, { get: () => 'ipc-key' }),
}));
jest.mock('@onekeyhq/desktop/app/libs/store', () => ({}));
jest.mock('@onekeyhq/desktop/app/windowProgressBar', () => ({
  clearWindowProgressBar: jest.fn(),
  updateWindowProgressBar: jest.fn(),
}));

const pems = selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
  days: 1,
  keySize: 2048,
});

function sha256(bytes: Buffer): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

async function startServer(
  content: Buffer,
  rangesSupported: boolean,
  interruptRange?: () => boolean,
) {
  const requests: Array<{ range?: string; authorization?: string }> = [];
  const server = https.createServer(
    { key: pems.private, cert: pems.cert },
    (request, response) => {
      const range = request.headers.range;
      requests.push({
        range,
        authorization: request.headers.authorization,
      });
      const match = rangesSupported
        ? /^bytes=(\d+)-(\d*)$/.exec(range ?? '')
        : null;
      if (match) {
        const start = Number(match[1]);
        const end = match[2] ? Number(match[2]) : content.length - 1;
        const part = content.subarray(start, end + 1);
        response.writeHead(206, {
          ETag: '"bundle-v1"',
          'Accept-Ranges': 'bytes',
          'Content-Range': `bytes ${start}-${end}/${content.length}`,
          'Content-Length': part.length,
        });
        if (interruptRange?.() && start > 0 && part.length > 1024) {
          response.write(part.subarray(0, 1024), () =>
            response.socket?.destroy(),
          );
          return;
        }
        response.end(part);
        return;
      }
      response.writeHead(200, {
        'Content-Length': content.length,
        ETag: '"bundle-v1"',
      });
      response.end(content);
    },
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `https://127.0.0.1:${port}/bundle.zip`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe('DesktopApiBundleUpdate public download integration', () => {
  jest.setTimeout(30_000);
  let previousRejectUnauthorized: boolean | undefined;

  beforeAll(() => {
    previousRejectUnauthorized = https.globalAgent.options.rejectUnauthorized;
    https.globalAgent.options.rejectUnauthorized = false;
  });

  afterAll(() => {
    https.globalAgent.options.rejectUnauthorized = previousRejectUnauthorized;
  });

  beforeEach(() => {
    fs.rmSync(USERDATA, { recursive: true, force: true });
    mockRequestUpdateUrl.mockClear();
  });

  afterEach(() => {
    fs.rmSync(USERDATA, { recursive: true, force: true });
  });

  test('downloads distinct bundle destinations concurrently through the real downloader', async () => {
    const contentA = crypto.randomBytes(64 * 1024);
    const contentB = crypto.randomBytes(3 * 1024 * 1024);
    const serverA = await startServer(contentA, false);
    const serverB = await startServer(contentB, true);
    try {
      const api = makeApi();
      const first = api.downloadBundle({
        latestVersion: '6.0.0',
        bundleVersion: '123',
        downloadUrl: serverA.url,
        sha256: sha256(contentA),
        fileSize: contentA.length,
      });
      const second = api.downloadBundle({
        latestVersion: '6.0.0',
        bundleVersion: '124',
        downloadUrl: serverB.url,
        sha256: sha256(contentB),
        fileSize: contentB.length,
      });
      const [resultA, resultB] = await Promise.all([first, second]);
      const pathA = path.join(
        USERDATA,
        'onekey-bundle-download',
        '6.0.0-123.zip',
      );
      const pathB = path.join(
        USERDATA,
        'onekey-bundle-download',
        '6.0.0-124.zip',
      );
      expect(resultA?.downloadedFile).toBe(pathA);
      expect(resultB?.downloadedFile).toBe(pathB);
      expect(fs.readFileSync(pathA).equals(contentA)).toBe(true);
      expect(fs.readFileSync(pathB).equals(contentB)).toBe(true);
      expect(api.isDownloading).toBe(false);
    } finally {
      await Promise.all([serverA.close(), serverB.close()]);
    }
  });

  test('assembles ranged bundle through downloadBundle', async () => {
    const content = crypto.randomBytes(3 * 1024 * 1024);
    const server = await startServer(content, true);
    try {
      const result = await makeApi().downloadBundle({
        latestVersion: '6.0.0',
        bundleVersion: '123',
        downloadUrl: server.url,
        sha256: sha256(content),
        fileSize: content.length,
        headers: { Authorization: 'bundle-test-token' },
      });
      const finalPath = path.join(
        USERDATA,
        'onekey-bundle-download',
        '6.0.0-123.zip',
      );
      expect(result?.downloadedFile).toBe(finalPath);
      expect(fs.readFileSync(finalPath).equals(content)).toBe(true);
      expect(
        server.requests.filter((request) => request.range).length,
      ).toBeGreaterThanOrEqual(9);
      expect(
        server.requests.every(
          (request) => request.authorization === 'bundle-test-token',
        ),
      ).toBe(true);
    } finally {
      await server.close();
    }
  });

  test('falls back to a full response when Range is unsupported', async () => {
    const content = crypto.randomBytes(3 * 1024 * 1024);
    const server = await startServer(content, false);
    try {
      const result = await makeApi().downloadBundle({
        latestVersion: '6.0.0',
        bundleVersion: '124',
        downloadUrl: server.url,
        sha256: sha256(content),
        fileSize: content.length,
      });
      const finalPath = path.join(
        USERDATA,
        'onekey-bundle-download',
        '6.0.0-124.zip',
      );
      expect(result?.downloadedFile).toBe(finalPath);
      expect(fs.readFileSync(finalPath).equals(content)).toBe(true);
      expect(server.requests.some((request) => request.range)).toBe(true);
      expect(server.requests.some((request) => !request.range)).toBe(true);
    } finally {
      await server.close();
    }
  });

  test('resumes a partially downloaded bundle through downloadBundle', async () => {
    const content = crypto.randomBytes(3 * 1024 * 1024);
    let interrupt = true;
    const server = await startServer(content, true, () => interrupt);
    const api = makeApi();
    const params = {
      latestVersion: '6.0.0',
      bundleVersion: '126',
      downloadUrl: server.url,
      sha256: sha256(content),
      fileSize: content.length,
    };
    try {
      await expect(api.downloadBundle(params)).rejects.toThrow();
      const manifestPath = path.join(
        USERDATA,
        'onekey-bundle-download',
        '6.0.0-126.zip.partial.progress.json',
      );
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        parts: Array<{ start: number; end: number; done: number }>;
      };
      const resumedRanges = manifest.parts
        .filter((part) => part.done < part.end - part.start + 1)
        .map((part) => `bytes=${part.start + part.done}-${part.end}`);
      const firstRunRequests = server.requests.length;
      interrupt = false;
      const result = await api.downloadBundle(params);
      const finalPath = path.join(
        USERDATA,
        'onekey-bundle-download',
        '6.0.0-126.zip',
      );
      expect(result?.downloadedFile).toBe(finalPath);
      expect(fs.readFileSync(finalPath).equals(content)).toBe(true);
      expect(
        server.requests
          .slice(firstRunRequests)
          .filter((request) => request.range)
          .map((request) => request.range),
      ).toEqual(expect.arrayContaining(resumedRanges));
    } finally {
      await server.close();
    }
  });

  test('rejects a corrupted bundle before publishing the final ZIP', async () => {
    const content = crypto.randomBytes(64 * 1024);
    const server = await startServer(content, false);
    try {
      await expect(
        makeApi().downloadBundle({
          latestVersion: '6.0.0',
          bundleVersion: '125',
          downloadUrl: server.url,
          sha256: sha256(Buffer.from('expected bundle')),
          fileSize: content.length,
        }),
      ).rejects.toThrow('SHA256_MISMATCH');
      expect(
        fs.existsSync(
          path.join(USERDATA, 'onekey-bundle-download', '6.0.0-125.zip'),
        ),
      ).toBe(false);
    } finally {
      await server.close();
    }
  });
});
