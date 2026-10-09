import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';

import { downloadNodeFile } from './nodeDownload';

import type { INodeDownloadOptions } from './nodeDownload';
import type { IncomingMessage } from 'http';

function response(
  statusCode: number,
  headers: IncomingMessage['headers'],
  body?: Buffer,
) {
  return Object.assign(Readable.from(body ? [body] : []), {
    statusCode,
    headers,
  }) as IncomingMessage;
}

describe('HTTP 416 recovery', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-range-recovery-'));
  });
  afterEach(() => {
    jest.useRealTimers();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function options(content: Buffer): INodeDownloadOptions {
    return {
      url: 'https://fixture.test/package',
      identity: 'range-recovery',
      targetPath: path.join(dir, 'package'),
      expectedSha256: crypto.createHash('sha256').update(content).digest('hex'),
    };
  }

  function seedSingle(
    opts: INodeDownloadOptions,
    content: Buffer,
    offset: number,
  ) {
    fs.writeFileSync(`${opts.targetPath}.partial`, content.subarray(0, offset));
    fs.writeFileSync(
      `${opts.targetPath}.partial.progress.json`,
      JSON.stringify({
        identity: opts.identity,
        url: opts.url,
        size: content.length,
        etag: '"v1"',
        checksum: `:${opts.expectedSha256}`,
        mode: 'single',
        parts: [{ start: 0, end: content.length - 1, done: offset }],
      }),
    );
  }

  function probeResponse(size: number, etag = '"v1"') {
    return response(206, { 'content-range': `bytes 0-0/${size}`, etag });
  }

  test('retries an initial 416 probe instead of failing the update', async () => {
    const content = Buffer.from('a valid signed artifact fixture');
    const opts = options(content);
    let probes = 0;
    opts.transport = async (url, headers) => {
      if (headers.Range === 'bytes=0-0') {
        probes += 1;
        return {
          url,
          response:
            probes === 1
              ? response(416, { 'content-range': `bytes */${content.length}` })
              : probeResponse(content.length),
        };
      }
      return {
        url,
        response: response(
          200,
          { 'content-length': String(content.length) },
          content,
        ),
      };
    };
    await downloadNodeFile(opts);
    expect(probes).toBe(2);
    expect(fs.readFileSync(opts.targetPath).equals(content)).toBe(true);
  });

  test('keeps a valid single-stream offset after refreshed metadata matches', async () => {
    const content = Buffer.from('a valid signed artifact fixture');
    const opts = options(content);
    const offset = 12;
    seedSingle(opts, content, offset);
    const ranges: Array<string | undefined> = [];
    let probes = 0;
    let resumed = 0;
    opts.transport = async (url, headers) => {
      ranges.push(headers.Range);
      if (headers.Range === 'bytes=0-0') {
        probes += 1;
        expect(fs.readFileSync(`${opts.targetPath}.partial`)).toEqual(
          content.subarray(0, offset),
        );
        return { url, response: probeResponse(content.length) };
      }
      resumed += 1;
      return {
        url,
        response:
          resumed === 1
            ? response(416, { 'content-range': `bytes */${content.length}` })
            : response(
                206,
                {
                  'content-range': `bytes ${offset}-${content.length - 1}/${content.length}`,
                  etag: '"v1"',
                },
                content.subarray(offset),
              ),
      };
    };
    await downloadNodeFile(opts);
    expect(probes).toBe(2);
    expect(ranges.filter((range) => range !== 'bytes=0-0')).toEqual([
      `bytes=${offset}-`,
      `bytes=${offset}-`,
    ]);
    expect(fs.readFileSync(opts.targetPath).equals(content)).toBe(true);
  });

  test.each(['etag', 'size'])(
    'resets only after a confirmed %s change',
    async (change) => {
      const content = Buffer.from('the new artifact contents');
      const oldContent = Buffer.alloc(
        change === 'size' ? 64 : content.length,
        65,
      );
      const opts = options(content);
      seedSingle(opts, oldContent, change === 'size' ? 48 : 12);
      let probes = 0;
      const requests: Array<string | undefined> = [];
      opts.transport = async (url, headers) => {
        if (headers.Range === 'bytes=0-0') {
          probes += 1;
          return {
            url,
            response: probeResponse(
              probes === 1 ? oldContent.length : content.length,
              change === 'etag' && probes > 1 ? '"v2"' : '"v1"',
            ),
          };
        }
        requests.push(headers.Range);
        if (headers.Range) return { url, response: response(416, {}) };
        return {
          url,
          response: response(
            200,
            {
              'content-length': String(content.length),
              etag: change === 'etag' ? '"v2"' : '"v1"',
            },
            content,
          ),
        };
      };
      await downloadNodeFile(opts);
      expect(probes).toBe(2);
      expect(requests).toEqual([
        change === 'size' ? 'bytes=48-' : 'bytes=12-',
        undefined,
      ]);
      expect(fs.readFileSync(opts.targetPath).equals(content)).toBe(true);
    },
  );

  test('bounded repeated 416 failures retain the partial and manifest', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    const content = Buffer.from('a valid signed artifact fixture');
    const opts = options(content);
    seedSingle(opts, content, 12);
    const manifest = fs.readFileSync(
      `${opts.targetPath}.partial.progress.json`,
    );
    let resumed = 0;
    opts.transport = async (url, headers) => {
      if (headers.Range !== 'bytes=0-0') resumed += 1;
      return {
        url,
        response:
          headers.Range === 'bytes=0-0'
            ? probeResponse(content.length)
            : response(416, {}),
      };
    };
    const outcome = downloadNodeFile(opts).catch((error: unknown) => error);
    await jest.runAllTimersAsync();
    expect(await outcome).toHaveProperty('message', 'HTTP 416');
    expect(resumed).toBe(4);
    expect(fs.readFileSync(`${opts.targetPath}.partial`)).toEqual(
      content.subarray(0, 12),
    );
    expect(fs.readFileSync(`${opts.targetPath}.partial.progress.json`)).toEqual(
      manifest,
    );
    expect(fs.existsSync(opts.targetPath)).toBe(false);
  });

  test('failed metadata refresh retains bytes instead of guessing the object changed', async () => {
    const content = Buffer.from('a valid signed artifact fixture');
    const opts = options(content);
    seedSingle(opts, content, 12);
    let probes = 0;
    opts.transport = async (url, headers) => {
      if (headers.Range === 'bytes=0-0') {
        probes += 1;
        return {
          url,
          response:
            probes === 1 ? probeResponse(content.length) : response(404, {}),
        };
      }
      return { url, response: response(416, {}) };
    };
    await expect(downloadNodeFile(opts)).rejects.toThrow('HTTP 404');
    expect(fs.readFileSync(`${opts.targetPath}.partial`)).toEqual(
      content.subarray(0, 12),
    );
    expect(fs.existsSync(`${opts.targetPath}.partial.progress.json`)).toBe(
      true,
    );
  });

  test('parallel recovery retains completed segments and requests only unfinished bytes', async () => {
    const content = Buffer.alloc(3 * 1024 * 1024, 83);
    const opts = options(content);
    const chunk = content.length / 8;
    const partial = Buffer.alloc(content.length);
    content.copy(partial, 0, 0, chunk);
    fs.writeFileSync(`${opts.targetPath}.partial`, partial);
    fs.writeFileSync(
      `${opts.targetPath}.partial.progress.json`,
      JSON.stringify({
        identity: opts.identity,
        url: opts.url,
        size: content.length,
        etag: '"v1"',
        checksum: `:${opts.expectedSha256}`,
        mode: 'parallel',
        parts: Array.from({ length: 8 }, (_, index) => ({
          start: index * chunk,
          end: (index + 1) * chunk - 1,
          done: index === 0 ? chunk : 0,
        })),
      }),
    );
    let rejected = false;
    let probes = 0;
    const ranges: string[] = [];
    opts.transport = async (url, headers) => {
      if (headers.Range === 'bytes=0-0') {
        probes += 1;
        return { url, response: probeResponse(content.length) };
      }
      ranges.push(headers.Range);
      const match = /^bytes=(\d+)-(\d+)$/.exec(headers.Range)!;
      const start = Number(match[1]);
      const end = Number(match[2]);
      if (start === chunk && !rejected) {
        rejected = true;
        return { url, response: response(416, {}) };
      }
      return {
        url,
        response: response(
          206,
          {
            'content-range': `bytes ${start}-${end}/${content.length}`,
            etag: '"v1"',
          },
          content.subarray(start, end + 1),
        ),
      };
    };
    await downloadNodeFile(opts);
    expect(probes).toBe(2);
    expect(ranges).toHaveLength(8);
    expect(
      ranges.filter((range) => range.startsWith(`bytes=${chunk}-`)),
    ).toHaveLength(2);
    expect(ranges.some((range) => range.startsWith('bytes=0-'))).toBe(false);
    expect(fs.readFileSync(opts.targetPath).equals(content)).toBe(true);
  });
});
