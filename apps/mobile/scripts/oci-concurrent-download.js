/* eslint-disable onekey/no-raw-error */

const crypto = require('crypto');
const fs = require('fs');

const MIN_CONCURRENT_BYTES = 2 * 1024 * 1024;
const SEGMENT_COUNT = 8;
const MAX_ATTEMPTS = 3;

function unsupportedRange(reason) {
  const error = new Error(
    `OCI blob does not support safe range downloads: ${reason}`,
  );
  error.code = 'OCI_RANGE_UNSUPPORTED';
  return error;
}

function retryableStatus(status) {
  return (
    [408, 425, 429].includes(status) ||
    (status >= 500 && ![501, 505].includes(status))
  );
}

function isRetryableOciError(error) {
  const retryableCodes = new Set([
    'EAI_AGAIN',
    'ECONNRESET',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'ETIMEDOUT',
    'UND_ERR_BODY_TIMEOUT',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_HEADERS_TIMEOUT',
    'UND_ERR_SOCKET',
  ]);
  let current = error;
  while (current) {
    if (
      current.retryable === true ||
      ['AbortError', 'TimeoutError'].includes(current.name) ||
      retryableCodes.has(current.code)
    ) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

function validateContentRange(response, start, end, total) {
  if (response.status === 200) {
    throw unsupportedRange('server ignored Range or If-Range');
  }
  if ([416, 501, 505].includes(response.status)) {
    throw unsupportedRange(`HTTP ${response.status}`);
  }
  if (response.status !== 206) {
    const error = new Error(
      `OCI range request failed: HTTP ${response.status}.`,
    );
    error.retryable = retryableStatus(response.status);
    throw error;
  }
  const match = response.headers
    .get('content-range')
    ?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
  if (
    !match ||
    Number(match[1]) !== start ||
    Number(match[2]) !== end ||
    Number(match[3]) !== total ||
    response.headers.get('content-type')?.startsWith('multipart/byteranges') ||
    (response.headers.get('content-encoding') || 'identity') !== 'identity'
  ) {
    throw unsupportedRange('invalid Content-Range or encoded response');
  }
}

async function cancelBody(response) {
  await response.body?.cancel().catch(() => undefined);
}

async function downloadOciBlobConcurrent({
  client,
  descriptor,
  filePath,
  timeoutMs = 180_000,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const { digest, size } = descriptor;
  if (size < MIN_CONCURRENT_BYTES) return null;

  let probe;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      probe = await client.fetchBlob(digest, timeoutMs, {
        range: 'bytes=0-0',
      });
      validateContentRange(probe, 0, 0, size);
      break;
    } catch (error) {
      if (probe) await cancelBody(probe);
      if (error.code === 'OCI_RANGE_UNSUPPORTED') return null;
      if (!isRetryableOciError(error) || attempt === MAX_ATTEMPTS) throw error;
      await wait(250 * attempt);
    }
  }
  const etag = probe.headers.get('etag');
  await cancelBody(probe);

  const content = filePath ? null : Buffer.allocUnsafe(size);
  const file = filePath ? await fs.promises.open(filePath, 'wx', 0o600) : null;
  const controller = new AbortController();
  const chunkSize = Math.ceil(size / SEGMENT_COUNT);
  const parts = Array.from(
    { length: Math.ceil(size / chunkSize) },
    (_, index) => ({
      start: index * chunkSize,
      end: Math.min((index + 1) * chunkSize - 1, size - 1),
      done: 0,
    }),
  );

  async function write(bytes, position) {
    if (content) {
      bytes.copy(content, position);
      return;
    }
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesWritten } = await file.write(
        bytes,
        offset,
        bytes.length - offset,
        position + offset,
      );
      if (bytesWritten <= 0) throw new Error('OCI range file write stalled.');
      offset += bytesWritten;
    }
  }

  async function downloadPart(part) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      if (controller.signal.aborted) return;
      const start = part.start + part.done;
      let response;
      try {
        response = await client.fetchBlob(digest, timeoutMs, {
          range: `bytes=${start}-${part.end}`,
          ifRange: etag,
          signal: controller.signal,
        });
        validateContentRange(response, start, part.end, size);
        for await (const chunk of response.body) {
          const bytes = Buffer.from(chunk);
          if (part.start + part.done + bytes.length > part.end + 1) {
            throw unsupportedRange('range body exceeded the requested end');
          }
          await write(bytes, part.start + part.done);
          part.done += bytes.length;
        }
        if (part.start + part.done !== part.end + 1) {
          const error = new Error(
            'OCI range body ended before the requested end.',
          );
          error.retryable = true;
          throw error;
        }
        return;
      } catch (error) {
        if (response && !response.body?.locked) await cancelBody(response);
        if (controller.signal.aborted) return;
        if (error.code === 'OCI_RANGE_UNSUPPORTED') throw error;
        if (attempt === MAX_ATTEMPTS || !isRetryableOciError(error))
          throw error;
        await wait(250 * attempt);
      }
    }
  }

  try {
    if (file) await file.truncate(size);
    const results = await Promise.allSettled(
      parts.map((part) =>
        downloadPart(part).catch((error) => {
          controller.abort();
          throw error;
        }),
      ),
    );
    const failure = results.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
    if (file) await file.sync();
  } catch (error) {
    controller.abort();
    if (file) {
      await file.close();
      await fs.promises.rm(filePath, { force: true });
    }
    if (error.code === 'OCI_RANGE_UNSUPPORTED') return null;
    throw error;
  }
  if (file) await file.close();

  const hash = crypto.createHash('sha256');
  if (content) {
    hash.update(content);
  } else {
    for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  }
  if (`sha256:${hash.digest('hex')}` !== digest) {
    if (filePath) await fs.promises.rm(filePath, { force: true });
    throw new Error('OCI concurrent blob integrity mismatch.');
  }
  return { content };
}

module.exports = { downloadOciBlobConcurrent, isRetryableOciError };
