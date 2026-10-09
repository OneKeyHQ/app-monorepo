// Regression tests for OK-64070: desktop log upload silently sent an empty body.
//
// `uploadLoggerBundle` streams the log archive through Node's built-in fetch
// (undici). undici pulls the request body lazily, only once the connection is
// up, whereas the progress listener used to be attached to the file stream
// before fetch() and drained the whole file in the meantime. The server then
// received a `content-length: 0` POST and fetch rejected with
// UND_ERR_REQ_CONTENT_LENGTH_MISMATCH ("fetch failed").
//
// The suite drives the REAL method against local self-signed TLS servers whose
// handshake is deliberately stalled (SNICallback), so the body is always
// pulled well after the file could have been drained — exactly the production
// timing. TLS verification is relaxed for THIS process only.

import { once } from 'events';
import fs from 'fs';
import https from 'https';
import net from 'net';
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
// bug under test lives in Node's built-in fetch (undici) and the servers use a
// self-signed cert, so borrow the host realm's globals for this suite.
const hostGlobal = vm.runInThisContext('globalThis') as typeof globalThis;

const TMP_DIR = path.join(os.tmpdir(), 'onekey-desktop-log-upload-test');
const LOG_FILE = path.join(TMP_DIR, 'app-latest.log');
const ARCHIVE_FILE = path.join(TMP_DIR, 'OneKeyLogs-test.zip');
const SMALL_ARCHIVE_FILE = path.join(TMP_DIR, 'OneKeyLogs-small.zip');
// Larger than a handful of 64 KiB fs chunks so a drained stream is obvious.
const ARCHIVE_SIZE = 1_500_000;
// Fits in a single fs chunk: progress must still not reach 100% before
// anything has been transmitted.
const SMALL_ARCHIVE_SIZE = 1024;
// Simulated connect latency: the body must only be pulled after this.
const HANDSHAKE_DELAY_MS = 300;
// Read lazily by the hoisted electron-log mock (jest requires the `mock` prefix).
const mockLogFilePath = LOG_FILE;
// Every archive stream the method opens, so tests can assert it was released.
const mockOpenedStreams: fs.ReadStream[] = [];

jest.mock('fs', () => {
  const actual = jest.requireActual<typeof import('fs')>('fs');
  return {
    ...actual,
    createReadStream: (
      ...args: Parameters<typeof actual.createReadStream>
    ): ReturnType<typeof actual.createReadStream> => {
      const stream = actual.createReadStream(...args);
      mockOpenedStreams.push(stream);
      return stream;
    },
  };
});
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

interface ILocalServer {
  url: string;
  close: () => Promise<void>;
}

interface IUploadServer extends ILocalServer {
  requests: Array<{
    contentLength: string | undefined;
    transferEncoding: string | undefined;
    receivedBytes: number;
    completed: boolean;
  }>;
}

const pems = selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
  days: 1,
  keySize: 2048,
});
const tlsCredentials = { key: pems.private, cert: pems.cert };

// Stall the handshake so undici starts pulling the body only after the file
// stream would have been drained by an eager consumer.
const stalledSniCallback = (
  _servername: string,
  callback: (err: Error | null, ctx?: tls.SecureContext) => void,
) => {
  setTimeout(
    () => callback(null, tls.createSecureContext(tlsCredentials)),
    HANDSHAKE_DELAY_MS,
  );
};

function listenLocally(server: net.Server): Promise<ILocalServer> {
  const sockets = new Set<net.Socket>();
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  return new Promise<ILocalServer>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        // A hostname (not an IP) is required for SNI to be sent at all.
        url: `https://localhost:${port}/wallet/v1/client/log`,
        close: () =>
          new Promise<void>((done) => {
            sockets.forEach((socket) => socket.destroy());
            server.close(() => done());
          }),
      });
    });
  });
}

function startUploadServer(): Promise<IUploadServer> {
  const requests: IUploadServer['requests'] = [];
  const server = https.createServer(
    { ...tlsCredentials, SNICallback: stalledSniCallback },
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
  return listenLocally(server).then((local) => ({ ...local, requests }));
}

// Answers before reading a single byte of the request and never reads it,
// the way a WAF block page does, so the client is cut off mid-body.
function startEarlyReplyServer(): Promise<ILocalServer> {
  const html = '<html>blocked</html>';
  const server = tls.createServer(
    { ...tlsCredentials, SNICallback: stalledSniCallback },
    (socket) => {
      socket.on('error', () => {});
      socket.end(
        `HTTP/1.1 403 Forbidden\r\ncontent-type: text/html\r\ncontent-length: ${html.length}\r\nconnection: close\r\n\r\n${html}`,
      );
    },
  );
  return listenLocally(server);
}

// Accepts the TCP connection and drops it before any TLS handshake, so fetch
// rejects without ever asking for the body.
function startBrokenServer(): Promise<ILocalServer> {
  const server = net.createServer((socket) => {
    socket.destroy();
  });
  return listenLocally(server);
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

function uploadHeaders(sizeBytes: number): Record<string, string> {
  // Same shape the renderer sends (index.desktop.ts uploadLogBundle).
  return {
    'content-type': 'application/zip',
    'content-length': String(sizeBytes),
  };
}

async function waitForClose(stream: fs.ReadStream): Promise<void> {
  if (!stream.closed) {
    await once(stream, 'close');
  }
}

function uploadingEvents(events: IProgressEvent[]): IProgressEvent[] {
  return events.filter((event) => event.stage === ELogUploadStage.Uploading);
}

describe('DesktopApiDev.uploadLoggerBundle', () => {
  let uploadServer: IUploadServer;
  let earlyReplyServer: ILocalServer;
  let brokenServer: ILocalServer;
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
    fs.writeFileSync(
      SMALL_ARCHIVE_FILE,
      payload.subarray(0, SMALL_ARCHIVE_SIZE),
    );
    [uploadServer, earlyReplyServer, brokenServer] = await Promise.all([
      startUploadServer(),
      startEarlyReplyServer(),
      startBrokenServer(),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      uploadServer.close(),
      earlyReplyServer.close(),
      brokenServer.close(),
    ]);
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
    globalThis.fetch = sandboxFetch;
    if (previousTlsSetting === undefined) {
      delete hostGlobal.process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      hostGlobal.process.env.NODE_TLS_REJECT_UNAUTHORIZED = previousTlsSetting;
    }
  });

  beforeEach(() => {
    uploadServer.requests.length = 0;
    mockOpenedStreams.length = 0;
  });

  it('streams the whole archive after a delayed connection and reports progress', async () => {
    const { api, events } = makeApi();

    const result = (await api.uploadLoggerBundle({
      uploadUrl: uploadServer.url,
      filePath: ARCHIVE_FILE,
      sizeBytes: ARCHIVE_SIZE,
      headers: uploadHeaders(ARCHIVE_SIZE),
    })) as { code: number; data: { objectKey: string } };

    expect(result.code).toBe(0);
    expect(result.data.objectKey).toBe(`logs/${ARCHIVE_SIZE}`);

    expect(uploadServer.requests).toHaveLength(1);
    const [request] = uploadServer.requests;
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
    const uploading = uploadingEvents(events);
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

    // The archive is released once the upload is over.
    expect(mockOpenedStreams).toHaveLength(1);
    await waitForClose(mockOpenedStreams[0]);
    expect(mockOpenedStreams[0].closed).toBe(true);
  });

  it('never opens the archive or advances progress when the connection fails', async () => {
    const { api, events } = makeApi();

    let rejection: { message?: string } | undefined;
    try {
      await api.uploadLoggerBundle({
        uploadUrl: brokenServer.url,
        filePath: SMALL_ARCHIVE_FILE,
        sizeBytes: SMALL_ARCHIVE_SIZE,
        headers: uploadHeaders(SMALL_ARCHIVE_SIZE),
      });
    } catch (error) {
      rejection = error as { message?: string };
    }
    expect(rejection?.message).toBe('fetch failed');

    // fetch never pulled the body, so the archive was never opened and there
    // is nothing left to release.
    expect(mockOpenedStreams).toHaveLength(0);
    // Even a one-chunk archive must not report 100% before transmission.
    expect(
      uploadingEvents(events).every(
        (event) => (event.progressPercent ?? 0) === 0,
      ),
    ).toBe(true);
    expect(events[events.length - 1]?.stage).toBe(ELogUploadStage.Error);
  });

  it('releases the archive when the server replies before reading the body', async () => {
    const { api, events } = makeApi();

    const result = (await api.uploadLoggerBundle({
      uploadUrl: earlyReplyServer.url,
      filePath: ARCHIVE_FILE,
      sizeBytes: ARCHIVE_SIZE,
      headers: uploadHeaders(ARCHIVE_SIZE),
    })) as { code: number; message: string };

    // Non-JSON block page: surfaced as a stable message, never the raw HTML.
    expect(result).toEqual({
      code: 403,
      message: 'Upload failed (HTTP 403, cf-ray=n/a)',
    });
    expect(events[events.length - 1]).toEqual({
      stage: ELogUploadStage.Error,
      progressPercent: undefined,
      message: 'Upload failed (HTTP 403, cf-ray=n/a)',
    });

    // The upload was cut off midway, and the archive must not stay open.
    const uploading = uploadingEvents(events);
    expect(uploading[uploading.length - 1].progressPercent).toBeLessThan(100);
    expect(mockOpenedStreams).toHaveLength(1);
    await waitForClose(mockOpenedStreams[0]);
    expect(mockOpenedStreams[0].closed).toBe(true);
  });

  it('rejects and reports an error when the archive cannot be read', async () => {
    const { api, events } = makeApi();
    const missingFile = path.join(TMP_DIR, 'missing.zip');

    // The rejection comes from the host realm's fetch, so inspect its shape
    // rather than using `instanceof Error`.
    let rejection: { message?: string; cause?: unknown } | undefined;
    try {
      await api.uploadLoggerBundle({
        uploadUrl: uploadServer.url,
        filePath: missingFile,
        sizeBytes: ARCHIVE_SIZE,
        headers: uploadHeaders(ARCHIVE_SIZE),
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
    expect(uploadServer.requests.every((request) => !request.completed)).toBe(
      true,
    );
  });
});
