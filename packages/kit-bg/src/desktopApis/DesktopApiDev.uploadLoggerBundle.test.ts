// Regression test for OK-64070: desktop log upload silently sent an empty body.
//
// `uploadLoggerBundle` streams the log archive through Node's built-in fetch
// (undici). undici pulls the request body lazily, only once the connection is
// up, whereas the progress listener used to be attached to the file stream
// before fetch() and drained the whole file in the meantime. The server then
// received a `content-length: 0` POST and fetch rejected with
// UND_ERR_REQ_CONTENT_LENGTH_MISMATCH ("fetch failed").
//
// The suite drives the REAL method against a local self-signed HTTPS server
// whose TLS handshake is deliberately stalled (SNICallback), so the body is
// always pulled well after the file could have been drained — exactly the
// production timing. TLS verification is relaxed for THIS process only.

import fs from 'fs';
import https from 'https';
import os from 'os';
import path from 'path';
import tls from 'tls';
import vm from 'vm';

// eslint-disable-next-line import/no-extraneous-dependencies
import selfsigned from 'selfsigned';

import { ELogUploadStage } from '@onekeyhq/shared/src/logger/types';

import DesktopApiDev from './DesktopApiDev';

import type { IDesktopApi } from './instance/IDesktopApi';
import type { AddressInfo } from 'net';

// jest-setup.js swaps the sandbox's global fetch for node-fetch, and the
// sandbox `process.env` is a copy that never reaches Node's TLS layer. The
// bug under test lives in Node's built-in fetch (undici) and the server uses a
// self-signed cert, so borrow the host realm's globals for this suite.
const hostGlobal = vm.runInThisContext('globalThis') as typeof globalThis;

const TMP_DIR = path.join(os.tmpdir(), 'onekey-desktop-log-upload-test');
const LOG_FILE = path.join(TMP_DIR, 'app-latest.log');
const ARCHIVE_FILE = path.join(TMP_DIR, 'OneKeyLogs-test.zip');
// Larger than a handful of 64 KiB fs chunks so a drained stream is obvious.
const ARCHIVE_SIZE = 1_500_000;
// Simulated connect latency: the body must only be pulled after this.
const HANDSHAKE_DELAY_MS = 300;
// Read lazily by the hoisted electron-log mock (jest requires the `mock` prefix).
const mockLogFilePath = LOG_FILE;

jest.mock('electron', () => ({ shell: { openPath: jest.fn() } }));
jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    transports: {
      file: {
        getFile: () => ({ path: mockLogFilePath }),
      },
    },
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
// The UA injector consults renderer-only helpers; keep headers as given.
jest.mock('@onekeyhq/shared/src/request/customUA', () => ({
  withCustomUAHeaders: async (
    _url: string,
    headers: Record<string, string>,
  ) => ({ ...headers }),
}));

interface IProgressEvent {
  stage: ELogUploadStage;
  progressPercent?: number;
  message?: string;
}

interface IUploadServer {
  url: string;
  requests: Array<{
    contentLength: string | undefined;
    transferEncoding: string | undefined;
    receivedBytes: number;
    completed: boolean;
  }>;
  close: () => Promise<void>;
}

function startStalledHttpsServer(): Promise<IUploadServer> {
  const pems = selfsigned.generate(
    [{ name: 'commonName', value: 'localhost' }],
    { days: 1, keySize: 2048 },
  );
  const requests: IUploadServer['requests'] = [];
  const server = https.createServer(
    {
      key: pems.private,
      cert: pems.cert,
      // Stall the handshake so undici starts pulling the body only after the
      // file stream would have been drained by an eager consumer.
      SNICallback: (_servername, callback) => {
        setTimeout(
          () =>
            callback(
              null,
              tls.createSecureContext({ key: pems.private, cert: pems.cert }),
            ),
          HANDSHAKE_DELAY_MS,
        );
      },
    },
    (req, res) => {
      const record: IUploadServer['requests'][number] = {
        contentLength: req.headers['content-length'],
        transferEncoding: req.headers['transfer-encoding'],
        receivedBytes: 0,
        completed: false,
      };
      requests.push(record);
      req.on('data', (chunk: Buffer) => {
        record.receivedBytes += chunk.length;
      });
      req.on('end', () => {
        record.completed = true;
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            code: 0,
            message: 'ok',
            data: { objectKey: `logs/${record.receivedBytes}` },
          }),
        );
      });
    },
  );
  return new Promise<IUploadServer>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        // A hostname (not an IP) is required for SNI to be sent at all.
        url: `https://localhost:${port}/wallet/v1/client/log`,
        requests,
        close: () =>
          new Promise<void>((done) => {
            server.closeAllConnections?.();
            server.close(() => done());
          }),
      });
    });
  });
}

function makeApi(): { api: DesktopApiDev; events: IProgressEvent[] } {
  const events: IProgressEvent[] = [];
  const mainWindow = {
    isDestroyed: () => false,
    webContents: {
      send: (_channel: string, payload: IProgressEvent) => {
        events.push(payload);
      },
    },
  };
  const desktopApi = {
    appUpdate: { getMainWindow: () => mainWindow },
  } as unknown as IDesktopApi;
  return { api: new DesktopApiDev({ desktopApi }), events };
}

describe('DesktopApiDev.uploadLoggerBundle', () => {
  let server: IUploadServer;
  let previousTlsSetting: string | undefined;
  let sandboxFetch: typeof fetch;

  beforeAll(async () => {
    sandboxFetch = globalThis.fetch;
    globalThis.fetch = hostGlobal.fetch;
    previousTlsSetting = hostGlobal.process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    hostGlobal.process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    fs.mkdirSync(TMP_DIR, { recursive: true });
    fs.writeFileSync(LOG_FILE, 'log');
    // Non-uniform content so a byte count cannot pass by accident.
    const payload = Buffer.alloc(ARCHIVE_SIZE);
    for (let i = 0; i < ARCHIVE_SIZE; i += 1) {
      payload[i] = (i * 31 + 7) & 0xff;
    }
    fs.writeFileSync(ARCHIVE_FILE, payload);
    server = await startStalledHttpsServer();
  });

  afterAll(async () => {
    await server.close();
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
    globalThis.fetch = sandboxFetch;
    if (previousTlsSetting === undefined) {
      delete hostGlobal.process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      hostGlobal.process.env.NODE_TLS_REJECT_UNAUTHORIZED = previousTlsSetting;
    }
  });

  beforeEach(() => {
    server.requests.length = 0;
  });

  it('streams the whole archive after a delayed connection and reports progress', async () => {
    const { api, events } = makeApi();

    const result = (await api.uploadLoggerBundle({
      uploadUrl: server.url,
      filePath: ARCHIVE_FILE,
      sizeBytes: ARCHIVE_SIZE,
      // Same shape the renderer sends (index.desktop.ts uploadLogBundle).
      headers: {
        'content-type': 'application/zip',
        'content-length': String(ARCHIVE_SIZE),
      },
    })) as { code: number; data: { objectKey: string } };

    expect(result.code).toBe(0);
    expect(result.data.objectKey).toBe(`logs/${ARCHIVE_SIZE}`);

    expect(server.requests).toHaveLength(1);
    const [request] = server.requests;
    expect(request.contentLength).toBe(String(ARCHIVE_SIZE));
    expect(request.transferEncoding).toBeUndefined();
    expect(request.receivedBytes).toBe(ARCHIVE_SIZE);
    expect(request.completed).toBe(true);

    // Progress: starts at 0, only ever moves forward, finishes with Success.
    expect(events[0]).toEqual({
      stage: ELogUploadStage.Uploading,
      progressPercent: 0,
      message: undefined,
    });
    const uploading = events.filter(
      (event) => event.stage === ELogUploadStage.Uploading,
    );
    expect(uploading.length).toBeGreaterThan(2);
    for (let i = 1; i < uploading.length; i += 1) {
      expect(uploading[i].progressPercent).toBeGreaterThanOrEqual(
        uploading[i - 1].progressPercent ?? 0,
      );
    }
    expect(uploading[uploading.length - 1].progressPercent).toBe(100);
    expect(events[events.length - 1]).toEqual({
      stage: ELogUploadStage.Success,
      progressPercent: 100,
      message: undefined,
    });
    expect(events.some((event) => event.stage === ELogUploadStage.Error)).toBe(
      false,
    );
  });

  it('rejects and reports an error when the archive cannot be read', async () => {
    const { api, events } = makeApi();
    const missingFile = path.join(TMP_DIR, 'missing.zip');

    // The rejection comes from the host realm's fetch, so inspect its shape
    // rather than using `instanceof Error`.
    let rejection: { message?: string; cause?: unknown } | undefined;
    try {
      await api.uploadLoggerBundle({
        uploadUrl: server.url,
        filePath: missingFile,
        sizeBytes: ARCHIVE_SIZE,
        headers: {
          'content-type': 'application/zip',
          'content-length': String(ARCHIVE_SIZE),
        },
      });
    } catch (error) {
      rejection = error as { message?: string; cause?: unknown };
    }
    expect(rejection).toBeDefined();
    expect(rejection?.message).toBe('fetch failed');
    // The file read error must be what aborted the request.
    expect(String(rejection?.cause)).toContain('ENOENT');

    const errorEvents = events.filter(
      (event) => event.stage === ELogUploadStage.Error,
    );
    expect(errorEvents.length).toBeGreaterThan(0);
    expect(
      events.some((event) => event.stage === ELogUploadStage.Success),
    ).toBe(false);
    // The read error must abort the request rather than leave the server
    // waiting on a body that never arrives.
    expect(server.requests.every((request) => !request.completed)).toBe(true);
  });
});
