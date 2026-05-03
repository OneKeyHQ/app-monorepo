import { mkdtempSync, rmSync } from 'node:fs';
import {
  type IncomingMessage,
  type Server,
  createServer,
  request as httpRequest,
} from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequestHandler } from '../src/router';
import { Store } from '../src/store';

export type ITestServer = {
  url: string;
  store: Store;
  storeDir: string;
  filePath: string;
  close: () => Promise<void>;
  setNow: (fn: () => number) => void;
};

export async function startTestServer(opts?: {
  initialNow?: () => number;
  filePath?: string;
}): Promise<ITestServer> {
  const storeDir =
    opts?.filePath !== undefined
      ? ''
      : mkdtempSync(join(tmpdir(), 'bwks-test-'));
  const filePath = opts?.filePath ?? join(storeDir, 'keys.json');
  const store = new Store({ filePath });

  let nowFn = opts?.initialNow ?? Date.now;
  const handler = createRequestHandler({
    store,
    now: () => nowFn(),
  });
  const server: Server = createServer((req, res) => void handler(req, res));
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    // eslint-disable-next-line no-restricted-syntax
    throw new Error('test server: missing address');
  }
  const port = address.port;
  return {
    url: `http://127.0.0.1:${port}`,
    store,
    storeDir,
    filePath,
    close: async () => {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
      if (storeDir !== '') {
        try {
          rmSync(storeDir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }
    },
    setNow: (fn) => {
      nowFn = fn;
    },
  };
}

export type IHttpResponse = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  json: <T = unknown>() => T;
};

export async function httpJson(
  url: string,
  init: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS';
    headers?: Record<string, string>;
    body?: string;
  },
): Promise<IHttpResponse> {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: u.hostname,
        port: Number(u.port),
        path: `${u.pathname}${u.search}`,
        method: init.method,
        headers: init.headers,
      },
      (res: IncomingMessage) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body,
            json: <T = unknown>(): T => JSON.parse(body) as T,
          });
        });
      },
    );
    req.on('error', reject);
    if (init.body !== undefined) req.write(init.body);
    req.end();
  });
}

export async function registerKey(
  url: string,
  keyBase64: string,
): Promise<{ keyId: string; accessToken: string }> {
  const res = await httpJson(`${url}/v1/bot-wallet-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyBase64 }),
  });
  if (res.status !== 200) {
    // eslint-disable-next-line no-restricted-syntax
    throw new Error(`register failed ${res.status}: ${res.body}`);
  }
  return res.json<{ keyId: string; accessToken: string }>();
}

/** A canonical valid 32-byte AES key in base64. */
export const FIXTURE_KEY_BASE64 =
  'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=';

/** A second valid 32-byte key, distinct from the first. */
export const FIXTURE_KEY_BASE64_B =
  'IB8eHRwbGhkYFxYVFBMSERAPDg0MCwoJCAcGBQQDAgE=';
