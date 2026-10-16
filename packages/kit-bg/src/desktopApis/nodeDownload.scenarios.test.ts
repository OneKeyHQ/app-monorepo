import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';

import {
  EUpdateErrorCode,
  UPDATE_ERROR_WIRE_PREFIX,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update/error';

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
          throw Object.assign(
            new Error(
              fault === 'stall' ? 'Download timeout' : 'Connection dropped',
            ),
            { code: fault === 'stall' ? 'ETIMEDOUT' : 'ECONNRESET' },
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

test('resumes an unknown-size single download after a transient probe failure', async () => {
  const opts = options();
  let probes = 0;
  const ranges: Array<string | undefined> = [];
  opts.transport = async (url, headers) => {
    if (headers.Range === 'bytes=0-0') {
      probes += 1;
      throw Object.assign(new Error('probe connection lost'), {
        code: 'ECONNRESET',
      });
    }
    ranges.push(headers.Range);
    if (!headers.Range) {
      const interrupted = async function* () {
        yield content.subarray(0, 1024);
        throw Object.assign(new Error('download connection lost'), {
          code: 'ECONNRESET',
        });
      };
      return {
        url,
        response: response(
          200,
          { 'content-length': String(content.length), etag: '"fixture"' },
          interrupted(),
        ),
      };
    }
    expect(headers.Range).toBe('bytes=1024-');
    expect(headers['If-Range']).toBe('"fixture"');
    expect(
      JSON.parse(
        fs.readFileSync(`${opts.targetPath}.partial.progress.json`, 'utf8'),
      ),
    ).toMatchObject({
      size: content.length,
      etag: '"fixture"',
      mode: 'single',
      parts: [{ done: 1024 }],
    });
    return {
      url,
      response: response(
        206,
        {
          'content-range': `bytes 1024-${content.length - 1}/${content.length}`,
          etag: '"fixture"',
        },
        [content.subarray(1024)],
      ),
    };
  };

  await downloadNodeFile(opts);
  expect(probes).toBe(4);
  expect(ranges).toEqual([undefined, 'bytes=1024-']);
  expect(fs.readFileSync(opts.targetPath)).toEqual(content);
});

test('keeps a verified single partial when the next probe supports parallel ranges', async () => {
  const controller = new AbortController();
  const firstOpts: INodeDownloadOptions = {
    ...options(),
    signal: controller.signal,
    onProgress: ({ transferred }) => {
      if (transferred === 1024) controller.abort();
    },
  };
  let probes = 0;
  firstOpts.transport = async (url, headers) => {
    if (headers.Range === 'bytes=0-0') {
      probes += 1;
      throw Object.assign(new Error('probe connection lost'), {
        code: 'ECONNRESET',
      });
    }
    expect(headers.Range).toBeUndefined();
    return {
      url,
      response: response(
        200,
        { 'content-length': String(content.length), etag: '"fixture"' },
        [content.subarray(0, 1024), content.subarray(1024)],
      ),
    };
  };
  await expect(downloadNodeFile(firstOpts)).rejects.toBeTruthy();
  expect(probes).toBe(4);
  expect(fs.statSync(`${firstOpts.targetPath}.partial`).size).toBe(1024);

  const resumedOpts = options();
  const ranges: string[] = [];
  resumedOpts.transport = async (url, headers) => {
    ranges.push(headers.Range ?? '');
    if (headers.Range === 'bytes=0-0') return { url, response: probe() };
    expect(headers.Range).toBe('bytes=1024-');
    expect(headers['If-Range']).toBe('"fixture"');
    return {
      url,
      response: response(
        206,
        {
          'content-range': `bytes 1024-${content.length - 1}/${content.length}`,
          etag: '"fixture"',
        },
        [content.subarray(1024)],
      ),
    };
  };
  await downloadNodeFile(resumedOpts);
  expect(ranges).toEqual(['bytes=0-0', 'bytes=1024-']);
  expect(fs.readFileSync(resumedOpts.targetPath)).toEqual(content);
});

test('rejects a changed total after learning the size from a single response', async () => {
  const opts = options();
  let probes = 0;
  opts.transport = async (url, headers) => {
    if (headers.Range === 'bytes=0-0') {
      probes += 1;
      throw Object.assign(new Error('probe connection lost'), {
        code: 'ECONNRESET',
      });
    }
    if (!headers.Range) {
      const interrupted = async function* () {
        yield content.subarray(0, 1024);
        throw Object.assign(new Error('download connection lost'), {
          code: 'ECONNRESET',
        });
      };
      return {
        url,
        response: response(
          200,
          { 'content-length': String(content.length), etag: '"fixture"' },
          interrupted(),
        ),
      };
    }
    expect(headers.Range).toBe('bytes=1024-');
    expect(headers['If-Range']).toBe('"fixture"');
    return {
      url,
      response: response(206, {
        'content-range': `bytes 1024-${content.length}/${content.length + 1}`,
        etag: '"fixture"',
      }),
    };
  };
  await expect(downloadNodeFile(opts)).rejects.toMatchObject({
    data: {
      updateError: {
        code: EUpdateErrorCode.integrityFailed,
        step: 'download',
      },
    },
  });
  expect(probes).toBe(4);
  for (const suffix of ['', '.partial', '.partial.progress.json']) {
    expect(fs.existsSync(`${opts.targetPath}${suffix}`)).toBe(false);
  }
});

test.each(['identity', 'checksum', 'etag', 'size'] as const)(
  'does not reuse a single partial when %s changes',
  async (changed) => {
    const opts = options();
    seedSingle(opts, content, 1024);
    const manifestPath = `${opts.targetPath}.partial.progress.json`;
    const manifest = JSON.parse(
      fs.readFileSync(manifestPath, 'utf8'),
    ) as Record<string, unknown>;
    if (changed === 'size') {
      manifest[changed] = content.length - 1;
    } else if (changed === 'etag') {
      manifest[changed] = '"older"';
    } else {
      manifest[changed] = 'different';
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    const ranges: string[] = [];
    opts.transport = async (url, headers) => {
      ranges.push(headers.Range ?? '');
      if (headers.Range === 'bytes=0-0') return { url, response: probe() };
      const range = /^bytes=(\d+)-(\d+)$/.exec(headers.Range ?? '');
      expect(range).not.toBeNull();
      const start = Number(range?.[1]);
      const end = Number(range?.[2]);
      return {
        url,
        response: response(
          206,
          {
            'content-range': `bytes ${start}-${end}/${content.length}`,
            etag: '"fixture"',
          },
          [content.subarray(start, end + 1)],
        ),
      };
    };
    await downloadNodeFile(opts);
    expect(ranges).not.toContain('bytes=1024-');
    expect(ranges.some((range) => range.startsWith('bytes=0-'))).toBe(true);
    expect(fs.readFileSync(opts.targetPath)).toEqual(content);
  },
);

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
  const expected = {
    code: EUpdateErrorCode.integrityFailed,
    step: 'download',
  };
  await expect(downloadNodeFile(opts)).rejects.toMatchObject({
    message: `${UPDATE_ERROR_WIRE_PREFIX}${JSON.stringify(expected)}`,
    data: { updateError: expected },
  });
  expect(requests).toBe(9);
  for (const suffix of ['', '.partial', '.partial.progress.json'])
    expect(fs.existsSync(`${opts.targetPath}${suffix}`)).toBe(false);
});

test('omits If-Range for weak ETags while sending If-Range for strong ETags', async () => {
  const strongOpts = options();
  const strongIfRanges: Array<string | undefined> = [];
  strongOpts.transport = async (url, headers) => {
    if (headers.Range === 'bytes=0-0') {
      return {
        url,
        response: response(206, {
          'content-range': `bytes 0-0/${content.length}`,
          etag: '"strong-etag"',
        }),
      };
    }
    strongIfRanges.push(headers['If-Range']);
    const match = /^bytes=(\d+)-(\d+)$/.exec(headers.Range!)!;
    const start = Number(match[1]);
    const end = Number(match[2]);
    return {
      url,
      response: response(
        206,
        {
          'content-range': `bytes ${start}-${end}/${content.length}`,
          etag: '"strong-etag"',
        },
        [content.subarray(start, end + 1)],
      ),
    };
  };
  await downloadNodeFile(strongOpts);
  expect(strongIfRanges).toHaveLength(8);
  expect(strongIfRanges.every((v) => v === '"strong-etag"')).toBe(true);

  const weakTargetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'weak-etag-'));
  try {
    const weakOpts: INodeDownloadOptions = {
      ...options(),
      targetPath: path.join(weakTargetDir, 'bundle.zip'),
    };
    const weakIfRanges: Array<string | undefined> = [];
    weakOpts.transport = async (url, headers) => {
      if (headers.Range === 'bytes=0-0') {
        return {
          url,
          response: response(206, {
            'content-range': `bytes 0-0/${content.length}`,
            etag: 'W/"weak-etag"',
          }),
        };
      }
      weakIfRanges.push(headers['If-Range']);
      const match = /^bytes=(\d+)-(\d+)$/.exec(headers.Range!)!;
      const start = Number(match[1]);
      const end = Number(match[2]);
      return {
        url,
        response: response(
          206,
          {
            'content-range': `bytes ${start}-${end}/${content.length}`,
            etag: 'W/"weak-etag"',
          },
          [content.subarray(start, end + 1)],
        ),
      };
    };
    await downloadNodeFile(weakOpts);
    expect(weakIfRanges).toHaveLength(8);
    expect(weakIfRanges.every((v) => v === undefined)).toBe(true);
  } finally {
    fs.rmSync(weakTargetDir, { recursive: true, force: true });
  }
});

test('resumes a partial download when signed URL changes for the same identity', async () => {
  const bytes = Buffer.from('resumed across refreshed tokenized url');
  const initialOpts = options(bytes);
  seedSingle(
    { ...initialOpts, url: 'https://fixture.test/bundle?token=expired' },
    bytes,
    8,
  );
  const refreshedOpts: INodeDownloadOptions = {
    ...initialOpts,
    url: 'https://fixture.test/bundle?token=fresh',
  };
  const seenRequests: Array<{ url: string; range?: string }> = [];
  refreshedOpts.transport = async (url, headers) => {
    seenRequests.push({ url, range: headers.Range });
    if (headers.Range === 'bytes=0-0') {
      return { url, response: probe(bytes.length) };
    }
    expect(headers.Range).toBe('bytes=8-');
    return {
      url,
      response: response(
        206,
        {
          'content-range': `bytes 8-${bytes.length - 1}/${bytes.length}`,
          etag: '"fixture"',
        },
        [bytes.subarray(8)],
      ),
    };
  };
  await downloadNodeFile(refreshedOpts);
  expect(seenRequests).toEqual([
    { url: 'https://fixture.test/bundle?token=fresh', range: 'bytes=0-0' },
    { url: 'https://fixture.test/bundle?token=fresh', range: 'bytes=8-' },
  ]);
  expect(fs.readFileSync(refreshedOpts.targetPath)).toEqual(bytes);
});

test('truncates un-flushed tail bytes in single mode and resumes from manifest done', async () => {
  const bytes = Buffer.from('0123456789abcdef-complete-single-stream');
  const opts = options(bytes);
  const done = 10;
  // Simulate unclean exit where 16 bytes were written to .partial before manifest flushed at 10
  fs.writeFileSync(
    `${opts.targetPath}.partial`,
    Buffer.concat([bytes.subarray(0, done), Buffer.from('GARBAGE!')]),
  );
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
  const ranges: Array<string | undefined> = [];
  opts.transport = async (url, headers) => {
    ranges.push(headers.Range);
    if (headers.Range === 'bytes=0-0') {
      return { url, response: probe(bytes.length) };
    }
    expect(headers.Range).toBe(`bytes=${done}-`);
    expect(fs.statSync(`${opts.targetPath}.partial`).size).toBe(done);
    return {
      url,
      response: response(
        206,
        {
          'content-range': `bytes ${done}-${bytes.length - 1}/${bytes.length}`,
          etag: '"fixture"',
        },
        [bytes.subarray(done)],
      ),
    };
  };
  await downloadNodeFile(opts);
  expect(ranges).toEqual(['bytes=0-0', `bytes=${done}-`]);
  expect(fs.readFileSync(opts.targetPath)).toEqual(bytes);
});

test('rethrows non-ENOENT read errors in verify without discarding partial progress', async () => {
  const bytes = Buffer.from('complete partial fixture with transient EIO');
  const opts = options(bytes);
  seedSingle(opts, bytes, bytes.length);
  opts.transport = async (url) => ({
    url,
    response: probe(bytes.length),
  });
  const realCreateReadStream = fs.createReadStream;
  const spy = jest.spyOn(fs, 'createReadStream').mockImplementation(((
    target: fs.PathLike,
    ...rest: unknown[]
  ) => {
    if (String(target) === `${opts.targetPath}.partial`) {
      return new Readable({
        read() {
          const ioErr = Object.assign(new Error('disk read failure'), {
            code: 'EIO',
          });
          this.destroy(ioErr);
        },
      }) as unknown as fs.ReadStream;
    }
    return (realCreateReadStream as (...args: unknown[]) => fs.ReadStream)(
      target,
      ...rest,
    );
  }) as typeof fs.createReadStream);
  try {
    const expected = {
      code: EUpdateErrorCode.storageError,
      step: 'download',
    };
    await expect(downloadNodeFile(opts)).rejects.toMatchObject({
      message: `${UPDATE_ERROR_WIRE_PREFIX}${JSON.stringify(expected)}`,
      data: { updateError: expected },
    });
    expect(fs.existsSync(`${opts.targetPath}.partial`)).toBe(true);
    expect(fs.existsSync(`${opts.targetPath}.partial.progress.json`)).toBe(
      true,
    );
  } finally {
    spy.mockRestore();
  }
});
