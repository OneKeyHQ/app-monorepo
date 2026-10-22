import { randomBytes } from 'crypto';
import fs from 'fs';
import https from 'https';
import os from 'os';
import path from 'path';
import tls from 'tls';
import vm from 'vm';

import AdmZip from 'adm-zip';
// eslint-disable-next-line import/no-extraneous-dependencies
import selfsigned from 'selfsigned';

import { ELogUploadStage } from '@onekeyhq/shared/src/logger/types';

import DesktopApiDev, {
  addSafeLogFilesToZip,
  addWindowsDiagnosticsToZip,
} from './DesktopApiDev';

import type { IDesktopApi } from './instance/IDesktopApi';
import type { AddressInfo } from 'net';

const hostGlobal = vm.runInThisContext('globalThis') as typeof globalThis;
const TEST_DIR = path.join(os.tmpdir(), `onekey-log-upload-${process.pid}`);
const LOG_DIR = path.join(TEST_DIR, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app-latest.log');
const mockLogFilePath = LOG_FILE;
jest.mock('@onekeyhq/shared/src/config/endpointsMap', () => ({
  endpointsMap: {
    prod: { wallet: 'https://localhost' },
    test: { wallet: 'https://localhost' },
  },
}));
jest.mock('electron', () => ({ shell: { openPath: jest.fn() } }));
jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    transports: { file: { getFile: () => ({ path: mockLogFilePath }) } },
  },
}));
jest.mock('@onekeyhq/desktop/app/config', () => ({
  ipcMessageKeys: { CLIENT_LOG_UPLOAD_PROGRESS: 'client-log-upload-progress' },
}));
jest.mock('@onekeyhq/desktop/app/libs/networkThrottle', () => ({
  getDesktopNetworkThrottleConfig: jest.fn(),
  setDesktopNetworkThrottleConfig: jest.fn(),
}));
jest.mock(
  '@onekeyhq/desktop/app/libs/store',
  () => new Proxy({}, { get: () => () => undefined }),
);
jest.mock('@onekeyhq/desktop/app/logger', () => ({
  flushDesktopDedup: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/request/customUA', () => ({
  withCustomUAHeaders: async (
    _url: string,
    headers: Record<string, string>,
  ) => ({ ...headers }),
}));

const mockEndpointConfig = (
  jest.requireMock('@onekeyhq/shared/src/config/endpointsMap') as {
    endpointsMap: {
      prod: { wallet: string };
      test: { wallet: string };
    };
  }
).endpointsMap;

const cert = selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
  days: 1,
  keySize: 2048,
});
const credentials = { key: cert.private, cert: cert.cert };

type Progress = { stage: ELogUploadStage; progressPercent?: number };
type Request = { bytes: number; contentLength?: string; completed: boolean };

function makeApi(): { api: DesktopApiDev; progress: Progress[] } {
  const progress: Progress[] = [];
  const mainWindow = {
    isDestroyed: () => false,
    webContents: {
      send: (_channel: string, event: Progress) => progress.push(event),
    },
  };
  const desktopApi = {
    appUpdate: { getMainWindow: () => mainWindow },
  } as unknown as IDesktopApi;
  return { api: new DesktopApiDev({ desktopApi }), progress };
}

async function startServer(options: { redirect?: boolean } = {}) {
  const requests: Request[] = [];
  const sockets = new Set<import('stream').Duplex>();
  const server = https.createServer(
    {
      ...credentials,
      SNICallback: (_name, callback) => {
        setTimeout(
          () => callback(null, tls.createSecureContext(credentials)),
          200,
        );
      },
    },
    (req, res) => {
      const record: Request = {
        bytes: 0,
        contentLength: req.headers['content-length'],
        completed: false,
      };
      requests.push(record);
      if (options.redirect) {
        res.writeHead(302, { location: 'https://example.com/collect' });
        res.end();
        return;
      }
      req.on('data', (chunk: Buffer) => {
        record.bytes += chunk.length;
      });
      req.on('end', () => {
        record.completed = true;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ code: 0, data: { objectKey: 'logs/test' } }));
      });
    },
  );
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return {
    url: `https://localhost:${address.port}/wallet/v1/client/log`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        sockets.forEach((socket) => socket.destroy());
        server.close(() => resolve());
      }),
  };
}

let nextArchive = 0;
async function collect(api: DesktopApiDev) {
  nextArchive += 1;
  return api.collectLoggerDigest({
    fileBaseName: `OneKeyLogs-test-${nextArchive}`,
  });
}

function uploadParams(
  url: string,
  digest: Awaited<ReturnType<DesktopApiDev['collectLoggerDigest']>>,
) {
  return {
    uploadUrl: url,
    filePath: digest.filePath,
    sizeBytes: digest.sizeBytes,
    headers: { authorization: 'Bearer test-token' },
  };
}

describe('DesktopApiDev log archive upload boundary', () => {
  let previousTlsSetting: string | undefined;
  let sandboxFetch: typeof fetch;

  beforeAll(() => {
    sandboxFetch = globalThis.fetch;
    globalThis.fetch = hostGlobal.fetch;
    previousTlsSetting = hostGlobal.process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    hostGlobal.process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.writeFileSync(LOG_FILE, randomBytes(1_500_000));
  });

  afterAll(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
    globalThis.fetch = sandboxFetch;
    if (previousTlsSetting === undefined) {
      delete hostGlobal.process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      hostGlobal.process.env.NODE_TLS_REJECT_UNAUTHORIZED = previousTlsSetting;
    }
  });

  it('uploads exactly the registered bytes after a delayed TLS handshake', async () => {
    const server = await startServer();
    try {
      mockEndpointConfig.test.wallet = server.url.replace(
        '/wallet/v1/client/log',
        '',
      );
      const { api, progress } = makeApi();
      const digest = await collect(api);
      const zip = new AdmZip(digest.filePath);
      const names = zip.getEntries().map((entry) => entry.entryName);
      expect(names).toContain('app-latest.log');
      if (process.platform === 'win32') {
        expect(names).toEqual(
          expect.arrayContaining([
            'diagnostics/windows-system.json',
            'diagnostics/windows-events.json',
            'diagnostics/collection.json',
          ]),
        );
      }
      const result = (await api.uploadLoggerBundle(
        uploadParams(server.url, digest),
      )) as { code: number };
      expect(result.code).toBe(0);
      expect(server.requests).toEqual([
        {
          bytes: digest.sizeBytes,
          contentLength: String(digest.sizeBytes),
          completed: true,
        },
      ]);
      expect(progress[0]?.progressPercent).toBe(0);
      expect(progress.at(-1)?.stage).toBe(ELogUploadStage.Success);
      expect(progress.some((event) => event.progressPercent === 100)).toBe(
        true,
      );
    } finally {
      await server.close();
    }
  });

  it('rejects an unregistered file and a changed archive before fetch', async () => {
    const server = await startServer();
    try {
      mockEndpointConfig.test.wallet = server.url.replace(
        '/wallet/v1/client/log',
        '',
      );
      const { api } = makeApi();
      const digest = await collect(api);
      await expect(
        api.uploadLoggerBundle({
          ...uploadParams(server.url, digest),
          filePath: path.join(TEST_DIR, 'other.zip'),
        }),
      ).rejects.toThrow('Unregistered log archive');
      fs.appendFileSync(digest.filePath, 'tampered');
      await expect(
        api.uploadLoggerBundle(uploadParams(server.url, digest)),
      ).rejects.toThrow('Log archive changed before upload');
      expect(server.requests).toHaveLength(0);
    } finally {
      await server.close();
    }
  });

  it('rejects non-wallet and redirected destinations', async () => {
    const server = await startServer({ redirect: true });
    try {
      mockEndpointConfig.test.wallet = server.url.replace(
        '/wallet/v1/client/log',
        '',
      );
      const { api } = makeApi();
      const digest = await collect(api);
      for (const url of [
        'https://example.com/wallet/v1/client/log',
        server.url.replace('https:', 'http:'),
        `${server.url}?next=example.com`,
      ]) {
        await expect(
          api.uploadLoggerBundle(uploadParams(url, digest)),
        ).rejects.toThrow('Untrusted log upload destination');
      }
      await expect(
        api.uploadLoggerBundle(uploadParams(server.url, digest)),
      ).rejects.toThrow();
      expect(server.requests).toHaveLength(1);
    } finally {
      await server.close();
    }
  });

  it('rejects unsafe archive names and a directory masquerading as a log', async () => {
    const { api } = makeApi();
    await expect(
      api.collectLoggerDigest({ fileBaseName: '../outside' }),
    ).rejects.toThrow('Invalid log archive name');
    const fakeLog = path.join(LOG_DIR, 'fake.log');
    fs.mkdirSync(fakeLog);
    try {
      await expect(collect(api)).rejects.toThrow('Invalid log file');
    } finally {
      fs.rmdirSync(fakeLog);
    }
  });

  it('can create a diagnostics-only archive when no log file exists', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const emptyDir = path.join(TEST_DIR, 'empty-logs');
    try {
      fs.mkdirSync(emptyDir);
      const zip = new AdmZip();
      expect(await addSafeLogFilesToZip(zip, emptyDir)).toBe(0);
      await addWindowsDiagnosticsToZip(zip);
      expect(zip.getEntries().map((entry) => entry.entryName)).toEqual(
        expect.arrayContaining([
          'diagnostics/windows-system.json',
          'diagnostics/windows-events.json',
          'diagnostics/collection.json',
        ]),
      );
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });
});
