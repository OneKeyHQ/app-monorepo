const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { downloadOciBlobConcurrent } = require('./oci-concurrent-download');

const bytes = crypto.randomBytes(2 * 1024 * 1024 + 17);
const descriptor = {
  digest: `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`,
  size: bytes.length,
};

function rangeResponse(start, end, body = bytes.subarray(start, end + 1)) {
  return new Response(body, {
    headers: {
      'content-range': `bytes ${start}-${end}/${bytes.length}`,
      etag: '"test-blob"',
    },
    status: 206,
  });
}

test('downloads OCI ranges concurrently and resumes a short segment', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'oci-range-'));
  const filePath = path.join(directory, 'shell.apk');
  const seenRanges = [];
  let active = 0;
  let maxActive = 0;
  let interrupted = false;
  const client = {
    async fetchBlob(_digest, _timeoutMs, options) {
      const [start, end] = options.range
        .match(/bytes=(\d+)-(\d+)/)
        .slice(1)
        .map(Number);
      seenRanges.push([start, end]);
      if (end === 0) return rangeResponse(start, end);
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      if (!interrupted && start === 0) {
        interrupted = true;
        return rangeResponse(start, end, bytes.subarray(start, start + 100));
      }
      return rangeResponse(start, end);
    },
  };
  try {
    const result = await downloadOciBlobConcurrent({
      client,
      descriptor,
      filePath,
      wait: async () => undefined,
    });
    assert.ok(result);
    assert.ok(maxActive > 1);
    assert.ok(seenRanges.some(([start]) => start === 100));
    assert.deepEqual(await fs.readFile(filePath), bytes);
  } finally {
    await fs.rm(directory, { force: true, recursive: true });
  }
});

test('returns a verified buffer for a vendor blob', async () => {
  const client = {
    async fetchBlob(_digest, _timeoutMs, options) {
      const [start, end] = options.range
        .match(/bytes=(\d+)-(\d+)/)
        .slice(1)
        .map(Number);
      return rangeResponse(start, end);
    },
  };
  const result = await downloadOciBlobConcurrent({ client, descriptor });
  assert.deepEqual(result.content, bytes);
});

test('falls back when the server cannot serve Range', async () => {
  for (const status of [200, 416]) {
    const client = {
      async fetchBlob() {
        return new Response(bytes, { status });
      },
    };
    assert.equal(await downloadOciBlobConcurrent({ client, descriptor }), null);
  }
});

test('removes a partial shell when a segment ignores Range', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'oci-range-'));
  const filePath = path.join(directory, 'shell.apk');
  const client = {
    async fetchBlob(_digest, _timeoutMs, options) {
      const [start, end] = options.range
        .match(/bytes=(\d+)-(\d+)/)
        .slice(1)
        .map(Number);
      if (end !== 0 && start === 0) return new Response(bytes);
      return rangeResponse(start, end);
    },
  };
  try {
    assert.equal(
      await downloadOciBlobConcurrent({ client, descriptor, filePath }),
      null,
    );
    await assert.rejects(fs.stat(filePath), { code: 'ENOENT' });
  } finally {
    await fs.rm(directory, { force: true, recursive: true });
  }
});

test('rejects a blob with the wrong digest', async () => {
  const corrupted = Buffer.from(bytes);
  corrupted[100] ^= 1;
  const client = {
    async fetchBlob(_digest, _timeoutMs, options) {
      const [start, end] = options.range
        .match(/bytes=(\d+)-(\d+)/)
        .slice(1)
        .map(Number);
      return rangeResponse(start, end, corrupted.subarray(start, end + 1));
    },
  };
  await assert.rejects(
    downloadOciBlobConcurrent({ client, descriptor }),
    /integrity mismatch/,
  );
});
