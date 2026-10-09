import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { downloadNodeFile } from './nodeDownload';

import type { INodeDownloadOptions } from './nodeDownload';
import type { IncomingMessage } from 'http';

function response(
  statusCode: number,
  headers: IncomingMessage['headers'],
  chunks: Buffer[] = [],
) {
  return Object.assign(Readable.from(chunks), {
    statusCode,
    headers,
  }) as IncomingMessage;
}

describe('download cancellation boundaries', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-cancel-download-'));
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('caps Retry-After and aborts all eight sleeping ranges promptly', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    const timers = jest.spyOn(globalThis, 'setTimeout');
    const controller = new AbortController();
    const download = downloadNodeFile({
      url: 'https://fixture.test/package',
      targetPath: path.join(dir, 'package'),
      identity: 'retry-after',
      expectedSha256: '0'.repeat(64),
      signal: controller.signal,
      transport: async (url, headers) => ({
        url,
        response:
          headers.Range === 'bytes=0-0'
            ? response(206, { 'content-range': 'bytes 0-0/3145728' })
            : response(429, { 'retry-after': '86400' }),
      }),
    });
    const outcome = download.catch((error: unknown) => error);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(timers).toHaveBeenCalledTimes(8);
    for (let index = 1; index <= 8; index += 1) {
      expect(timers).toHaveBeenNthCalledWith(
        index,
        expect.any(Function),
        60_000,
      );
    }
    controller.abort();
    expect(await outcome).toBeInstanceOf(OneKeyLocalError);
    expect(await outcome).toHaveProperty('message', 'Download cancelled');
    expect(jest.getTimerCount()).toBe(0);
    expect(fs.existsSync(path.join(dir, 'package'))).toBe(false);
  });

  test.each(['probe', 'single'])(
    'aborts the %s retry backoff',
    async (phase) => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      const controller = new AbortController();
      const download = downloadNodeFile({
        url: 'https://fixture.test/package',
        targetPath: path.join(dir, 'package'),
        identity: phase,
        expectedSha256: '0'.repeat(64),
        signal: controller.signal,
        transport: async (url, headers) => {
          if (phase === 'single' && headers.Range === 'bytes=0-0') {
            return { url, response: response(200, { 'content-length': '16' }) };
          }
          throw new OneKeyLocalError('temporary network failure');
        },
      });
      const outcome = download.catch((error: unknown) => error);
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(jest.getTimerCount()).toBe(1);
      controller.abort();
      expect(await outcome).toHaveProperty('message', 'Download cancelled');
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  test.each([false, true])(
    'rejects an abort during hash, including cache reuse=%s',
    async (cached) => {
      const content = Buffer.from('verified fixture bytes');
      const targetPath = path.join(dir, 'package');
      if (cached) fs.writeFileSync(targetPath, content);
      const controller = new AbortController();
      const originalReadStream = fs.createReadStream;
      let hashRead = false;
      jest.spyOn(fs, 'createReadStream').mockImplementation((...args) => {
        const stream = originalReadStream(...args);
        hashRead = true;
        stream.once('end', () => controller.abort());
        return stream;
      });
      const transport: NonNullable<INodeDownloadOptions['transport']> = async (
        url,
      ) => ({
        url,
        response: response(200, { 'content-length': String(content.length) }, [
          content,
        ]),
      });
      await expect(
        downloadNodeFile({
          url: 'https://fixture.test/package',
          targetPath,
          identity: 'cancel-hash',
          expectedSha256: crypto
            .createHash('sha256')
            .update(content)
            .digest('hex'),
          signal: controller.signal,
          transport,
        }),
      ).rejects.toThrow('Download cancelled');
      expect(hashRead).toBe(true);
      expect(fs.existsSync(targetPath)).toBe(cached);
      if (!cached) expect(fs.existsSync(`${targetPath}.partial`)).toBe(true);
    },
  );
});
