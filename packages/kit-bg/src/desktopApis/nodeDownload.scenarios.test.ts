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
  chunks: Buffer[] | AsyncIterable<Buffer> = [],
) {
  return Object.assign(Readable.from(chunks), {
    statusCode,
    headers,
  }) as IncomingMessage;
}
const content = Buffer.alloc(3 * 1024 * 1024, 37);
let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'download-scenarios-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});
function options(bytes = content): INodeDownloadOptions {
  return {
    url: 'https://fixture.test/bundle',
    targetPath: path.join(dir, 'bundle.zip'),
    identity: 'fixture',
    expectedSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
}
function probe(size = content.length) {
  return response(206, {
    'content-range': `bytes 0-0/${size}`,
    etag: '"fixture"',
  });
}

test.each([
  '200',
  'misaligned',
  'overlong',
  'short',
  'disconnect',
  'stall',
  '429',
] as const)(
  'recovers a %s segment without corrupting the final artifact',
  async (fault) => {
    const opts = options();
    const counts = new Map<number, number>();
    const percents: number[] = [];
    const rejected: { stream: IncomingMessage; resume: jest.SpyInstance }[] =
      [];
    let fallbackCalls = 0;
    opts.onProgress = ({ percent }) => {
      percents.push(percent);
    };
    opts.transport = async (url, headers) => {
      if (headers.Range === 'bytes=0-0') return { url, response: probe() };
      if (!headers.Range) {
        fallbackCalls += 1;
        expect(fs.statSync(`${opts.targetPath}.partial`).size).toBe(0);
        return {
          url,
          response: response(
            200,
            { 'content-length': String(content.length), etag: '"fixture"' },
            [content],
          ),
        };
      }
      const match = /^bytes=(\d+)-(\d+)$/.exec(headers.Range)!;
      const start = Number(match[1]);
      const end = Number(match[2]);
      const segmentIndex = Math.floor(start / (content.length / 8));
      const count = (counts.get(segmentIndex) ?? 0) + 1;
      counts.set(segmentIndex, count);
      const body = content.subarray(start, end + 1);
      const rangeHeaders = {
        'content-range': `bytes ${start}-${end}/${content.length}`,
        etag: '"fixture"',
      };
      if (segmentIndex === 0 && count === 1) {
        if (fault === '200' || fault === 'misaligned' || fault === '429') {
          const bad = response(
            fault === 'misaligned' ? 206 : Number(fault),
            fault === 'misaligned'
              ? {
                  ...rangeHeaders,
                  'content-range': `bytes ${start + 1}-${end}/${content.length}`,
                }
              : { 'retry-after': '0' },
            [content],
          );
          rejected.push({ stream: bad, resume: jest.spyOn(bad, 'resume') });
          return { url, response: bad };
        }
        if (fault === 'overlong')
          return {
            url,
            response: response(206, rangeHeaders, [
              body.subarray(0, 1024),
              Buffer.alloc(body.length),
            ]),
          };
        if (fault === 'short')
          return {
            url,
            response: response(206, rangeHeaders, [body.subarray(0, 1024)]),
          };
        const interrupted = async function* () {
          yield body.subarray(0, 1024);
          throw new OneKeyLocalError(
            fault === 'stall' ? 'Download timeout' : 'Connection dropped',
          );
        };
        return { url, response: response(206, rangeHeaders, interrupted()) };
      }
      if (
        segmentIndex === 0 &&
        count === 2 &&
        ['short', 'disconnect', 'stall'].includes(fault)
      )
        expect(start).toBe(1024);
      return { url, response: response(206, rangeHeaders, [body]) };
    };
    await downloadNodeFile(opts);
    expect(fs.readFileSync(opts.targetPath).equals(content)).toBe(true);
    expect(fs.existsSync(`${opts.targetPath}.partial`)).toBe(false);
    expect(fs.existsSync(`${opts.targetPath}.partial.progress.json`)).toBe(
      false,
    );
    for (let i = 1; i < percents.length; i += 1)
      expect(percents[i]).toBeGreaterThanOrEqual(percents[i - 1]);
    expect(percents[percents.length - 1]).toBe(100);
    for (const bad of rejected) {
      expect(bad.stream.destroyed).toBe(true);
      expect(bad.resume).not.toHaveBeenCalled();
    }
    if (['200', 'misaligned', 'overlong'].includes(fault))
      expect(fallbackCalls).toBe(1);
    else {
      expect(fallbackCalls).toBe(0);
      expect(counts.get(0)).toBe(2);
      for (let i = 1; i < 8; i += 1) expect(counts.get(i)).toBe(1);
    }
  },
);

test('destroys a large unsupported probe before consuming its body', async () => {
  const opts = options();
  let consumed = 0;
  const unused = Object.assign(
    new Readable({
      read() {
        consumed += content.length;
        this.push(content);
        this.push(null);
      },
    }),
    { statusCode: 200, headers: { 'content-length': String(content.length) } },
  ) as IncomingMessage;
  const resume = jest.spyOn(unused, 'resume');
  let calls = 0;
  opts.transport = async (url) => {
    calls += 1;
    return {
      url,
      response:
        calls === 1
          ? unused
          : response(200, { 'content-length': String(content.length) }, [
              content,
            ]),
    };
  };
  await downloadNodeFile(opts);
  expect(unused.destroyed).toBe(true);
  expect(resume).not.toHaveBeenCalled();
  expect(consumed).toBe(0);
});

function seedSingle(opts: INodeDownloadOptions, bytes: Buffer, done: number) {
  fs.writeFileSync(`${opts.targetPath}.partial`, bytes.subarray(0, done));
  fs.writeFileSync(
    `${opts.targetPath}.partial.progress.json`,
    JSON.stringify({
      identity: opts.identity,
      url: opts.url,
      size: bytes.length,
      etag: '"fixture"',
      checksum: `:${opts.expectedSha256}`,
      mode: 'single',
      parts: [{ start: 0, end: bytes.length - 1, done }],
    }),
  );
}

test('restarts a single stream cleanly when an existing partial gets a 200 resume response', async () => {
  const bytes = Buffer.from('a complete artifact after resume');
  const opts = options(bytes);
  seedSingle(opts, bytes, 5);
  const ranges: Array<string | undefined> = [];
  opts.transport = async (url, headers) => {
    ranges.push(headers.Range);
    if (headers.Range === 'bytes=0-0')
      return { url, response: probe(bytes.length) };
    expect(headers.Range).toBe('bytes=5-');
    return {
      url,
      response: response(200, { 'content-length': String(bytes.length) }, [
        bytes,
      ]),
    };
  };
  await downloadNodeFile(opts);
  expect(ranges).toEqual(['bytes=0-0', 'bytes=5-']);
  expect(fs.readFileSync(opts.targetPath)).toEqual(bytes);
});

test('finalizes a complete partial after checksum verification without downloading it again', async () => {
  const bytes = Buffer.from('complete partial fixture');
  const opts = options(bytes);
  seedSingle(opts, bytes, bytes.length);
  const transport = jest.fn(async (url: string) => ({
    url,
    response: probe(bytes.length),
  }));
  opts.transport = transport;
  await downloadNodeFile(opts);
  expect(transport).toHaveBeenCalledTimes(1);
  expect(fs.readFileSync(opts.targetPath)).toEqual(bytes);
  expect(fs.existsSync(`${opts.targetPath}.partial.progress.json`)).toBe(false);
});

test('rejects corrupted parallel assembly without publishing or retaining artifacts', async () => {
  const opts = options();
  let requests = 0;
  opts.transport = async (url, headers) => {
    requests += 1;
    if (headers.Range === 'bytes=0-0') return { url, response: probe() };
    const match = /^bytes=(\d+)-(\d+)$/.exec(headers.Range!)!;
    const start = Number(match[1]);
    const end = Number(match[2]);
    const bytes = Buffer.from(content.subarray(start, end + 1));
    if (start === 0) bytes[0] ^= 1;
    return {
      url,
      response: response(
        206,
        { 'content-range': `bytes ${start}-${end}/${content.length}` },
        [bytes],
      ),
    };
  };
  await expect(downloadNodeFile(opts)).rejects.toThrow('checksum mismatch');
  expect(requests).toBe(9);
  for (const suffix of ['', '.partial', '.partial.progress.json'])
    expect(fs.existsSync(`${opts.targetPath}${suffix}`)).toBe(false);
});
