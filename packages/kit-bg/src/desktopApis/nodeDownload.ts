import { createHash } from 'crypto';
import fs from 'fs';
import https from 'https';
import path from 'path';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IUpdateResponse } from './electronUpdateRequest';

const SEGMENTS = 8;
const MIN_PARALLEL_BYTES = 2 * 1024 * 1024;
const FLUSH_BYTES = 4 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const MAX_RETRIES = 3;
const STALL_MS = 60_000;
const MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_RETRY_DELAY_MS = 60_000;

export interface INodeDownloadProgress {
  transferred: number;
  total: number;
  delta: number;
  bytesPerSecond: number;
  percent: number;
}

export interface INodeDownloadOptions {
  url: string;
  targetPath: string;
  identity: string;
  headers?: Record<string, string>;
  expectedSha512?: string;
  expectedSha256?: string;
  expectedBytes?: number;
  transport?: (
    url: string,
    headers: Record<string, string>,
    signal?: AbortSignal,
  ) => Promise<IUpdateResponse>;
  onProgress?: (progress: INodeDownloadProgress) => void;
  signal?: AbortSignal;
}

interface IPart {
  start: number;
  end: number;
  done: number;
}

interface IManifest {
  identity: string;
  url: string;
  size: number;
  etag: string | null;
  checksum: string;
  mode: 'parallel' | 'single';
  parts: IPart[];
}

type IResponse = IUpdateResponse;

function cancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new OneKeyLocalError('Download cancelled');
}

function waitForRetry(delay: number, signal?: AbortSignal): Promise<void> {
  cancelled(signal);
  return new Promise((resolve, reject) => {
    const timer: { id?: ReturnType<typeof setTimeout> } = {};
    const onAbort = () => {
      clearTimeout(timer.id);
      signal?.removeEventListener('abort', onAbort);
      reject(new OneKeyLocalError('Download cancelled'));
    };
    timer.id = setTimeout(
      () => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      },
      Math.min(Math.max(delay, 0), MAX_RETRY_DELAY_MS),
    );
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

function contentRange(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const match = raw?.match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/i);
  if (!match) return null;
  return {
    start: Number(match[1]),
    end: Number(match[2]),
    total: Number(match[3]),
  };
}

function stripSensitiveHeaders(headers: Record<string, string>) {
  const allowed = new Set([
    'user-agent',
    'accept',
    'accept-encoding',
    'range',
    'if-range',
  ]);
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => allowed.has(name.toLowerCase())),
  );
}

async function get(
  url: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
  redirects = 0,
  transport?: INodeDownloadOptions['transport'],
): Promise<IResponse> {
  cancelled(signal);
  if (!isHttps(url)) throw new OneKeyLocalError('Download URL must use HTTPS');
  if (transport) return transport(url, headers, signal);
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, signal }, (response) => {
      const status = response.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        response.resume();
        if (!response.headers.location || redirects >= MAX_REDIRECTS) {
          reject(new OneKeyLocalError('Invalid download redirect'));
          return;
        }
        const next = new URL(response.headers.location, url).toString();
        if (!isHttps(next)) {
          reject(
            new OneKeyLocalError('Redirect to non-HTTPS URL is not allowed'),
          );
          return;
        }
        const nextHeaders =
          new URL(next).origin === new URL(url).origin
            ? headers
            : stripSensitiveHeaders(headers);
        void get(next, nextHeaders, signal, redirects + 1, transport).then(
          resolve,
          reject,
        );
        return;
      }
      resolve({ response, url });
    });
    req.on('error', reject);
    req.setTimeout(STALL_MS, () =>
      req.destroy(new OneKeyLocalError('Download timeout')),
    );
  });
}

async function probe(opts: INodeDownloadOptions) {
  const { response, url } = await get(
    opts.url,
    { ...opts.headers, Range: 'bytes=0-0' },
    opts.signal,
    0,
    opts.transport,
  );
  const status = response.statusCode ?? 0;
  const range = contentRange(response.headers['content-range']);
  let size = Number(response.headers['content-length']) || 0;
  if (status === 206) {
    size = range?.start === 0 && range.end === 0 ? range.total : 0;
  }
  response.destroy();
  if (status !== 200 && status !== 206)
    throw new OneKeyLocalError(`HTTP ${status}`);
  if (!Number.isSafeInteger(size) || size < 0)
    throw new OneKeyLocalError('Invalid download size');
  if (
    size > MAX_DOWNLOAD_BYTES ||
    (opts.expectedBytes && size && size !== opts.expectedBytes)
  )
    throw new OneKeyLocalError('Download size mismatch or limit exceeded');
  return {
    url,
    size,
    etag: response.headers.etag ?? null,
    parallel: status === 206 && !!range && size >= MIN_PARALLEL_BYTES,
  };
}

function probeFailureIsTransient(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  const status = /^HTTP (\d+)$/.exec(error.message);
  if (status) return retryableStatus(Number(status[1]));
  return !(
    error.message === 'Invalid download redirect' ||
    error.message === 'Redirect to non-HTTPS URL is not allowed' ||
    error.message === 'Download URL must use HTTPS' ||
    error.message === 'Download size mismatch or limit exceeded'
  );
}

async function probeWithRetry(opts: INodeDownloadOptions) {
  for (let retry = 0; retry <= MAX_RETRIES; retry += 1) {
    try {
      return await probe(opts);
    } catch (error) {
      if (
        opts.signal?.aborted ||
        !probeFailureIsTransient(error) ||
        retry === MAX_RETRIES
      )
        throw error;
      const delay = Math.min(500 * 2 ** retry, 10_000);
      await waitForRetry(delay, opts.signal);
    }
  }
  throw new OneKeyLocalError('Range probe retry exhausted');
}

function checksumKey(opts: INodeDownloadOptions): string {
  return `${opts.expectedSha512 ?? ''}:${opts.expectedSha256 ?? ''}`;
}

async function verify(
  filePath: string,
  opts: INodeDownloadOptions,
): Promise<boolean> {
  const algorithms = [
    ['sha512', opts.expectedSha512],
    ['sha256', opts.expectedSha256],
  ] as const;
  for (const [algorithm, expected] of algorithms) {
    if (expected) {
      cancelled(opts.signal);
      const hash = createHash(algorithm);
      const stream = fs.createReadStream(filePath);
      const onAbort = () =>
        stream.destroy(new OneKeyLocalError('Download cancelled'));
      opts.signal?.addEventListener('abort', onAbort, { once: true });
      try {
        for await (const chunk of stream) {
          cancelled(opts.signal);
          hash.update(chunk);
        }
      } catch {
        cancelled(opts.signal);
        return false;
      } finally {
        opts.signal?.removeEventListener('abort', onAbort);
        stream.destroy();
      }
      cancelled(opts.signal);
      const actual = hash.digest('hex');
      const normalized = expected.trim().toLowerCase();
      const expectedHex = /^[0-9a-f]+$/.test(normalized)
        ? normalized
        : Buffer.from(expected.trim(), 'base64').toString('hex');
      if (actual !== expectedHex) return false;
    }
  }
  return true;
}

function discard(partial: string, manifestPath: string): void {
  fs.rmSync(manifestPath, { force: true });
  fs.rmSync(partial, { force: true });
}

function saveManifest(
  manifestPath: string,
  manifest: IManifest,
  fd?: number,
): void {
  if (fd !== undefined) fs.fsyncSync(fd);
  const temp = `${manifestPath}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(manifest));
  fs.renameSync(temp, manifestPath);
}

function readManifest(
  opts: INodeDownloadOptions,
  partial: string,
  manifestPath: string,
  size: number,
  etag: string | null,
  mode: IManifest['mode'],
): IManifest | null {
  if (!fs.existsSync(partial) || !fs.existsSync(manifestPath)) return null;
  try {
    const manifest = JSON.parse(
      fs.readFileSync(manifestPath, 'utf8'),
    ) as IManifest;
    const matching =
      manifest.identity === opts.identity &&
      manifest.url === opts.url &&
      manifest.size === size &&
      manifest.etag === etag &&
      manifest.checksum === checksumKey(opts) &&
      manifest.mode === mode &&
      Array.isArray(manifest.parts);
    if (!matching) return null;
    const stat = fs.statSync(partial);
    if (mode === 'parallel' && stat.size !== size) return null;
    if (mode === 'single' && stat.size !== manifest.parts[0]?.done) return null;
    if (
      manifest.parts.some(
        (p) =>
          !Number.isSafeInteger(p.start) ||
          !Number.isSafeInteger(p.end) ||
          !Number.isSafeInteger(p.done) ||
          p.start < 0 ||
          p.end < p.start ||
          p.done < 0 ||
          ((mode === 'parallel' || size > 0) && p.done > p.end - p.start + 1),
      )
    )
      return null;
    return manifest;
  } catch {
    return null;
  }
}

const progressRates = new WeakMap<
  IManifest,
  { lastTime: number; lastBytes: number; bytesPerSecond: number }
>();

function emit(
  opts: INodeDownloadOptions,
  manifest: IManifest,
  delta: number,
): void {
  const transferred = manifest.parts.reduce((sum, part) => sum + part.done, 0);
  const now = Date.now();
  const prior = progressRates.get(manifest) ?? {
    lastTime: now,
    lastBytes: transferred,
    bytesPerSecond: 0,
  };
  const elapsed = now - prior.lastTime;
  if (elapsed >= 250 || (manifest.size > 0 && transferred === manifest.size)) {
    prior.bytesPerSecond = Math.max(
      0,
      Math.round(
        ((transferred - prior.lastBytes) * 1000) / Math.max(1, elapsed),
      ),
    );
    prior.lastTime = now;
    prior.lastBytes = transferred;
  }
  progressRates.set(manifest, prior);
  opts.onProgress?.({
    transferred,
    total: manifest.size,
    delta,
    bytesPerSecond: prior.bytesPerSecond,
    percent: manifest.size ? (transferred / manifest.size) * 100 : 0,
  });
}

class RangeFallback extends Error {}

function retryableStatus(status: number): boolean {
  return (
    status === 408 ||
    status === 429 ||
    (status >= 500 && status <= 599 && status !== 501 && status !== 505)
  );
}

function retryAfterMs(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

async function downloadPart(
  opts: INodeDownloadOptions,
  manifest: IManifest,
  part: IPart,
  fd: number,
  finalUrl: string,
  flush: () => void,
): Promise<void> {
  let serverDelay: number | null = null;
  for (let retry = 0; retry <= MAX_RETRIES; retry += 1) {
    cancelled(opts.signal);
    const start = part.start + part.done;
    if (start > part.end) return;
    try {
      const headers = {
        ...opts.headers,
        Range: `bytes=${start}-${part.end}`,
        ...(manifest.etag ? { 'If-Range': manifest.etag } : {}),
      };
      // A cross-origin probe redirect must not forward source credentials.
      const safeHeaders =
        new URL(finalUrl).origin === new URL(opts.url).origin
          ? headers
          : stripSensitiveHeaders(headers);
      const { response } = await get(
        finalUrl,
        safeHeaders,
        opts.signal,
        0,
        opts.transport,
      );
      const status = response.statusCode ?? 0;
      const range = contentRange(response.headers['content-range']);
      if (
        status !== 206 ||
        !range ||
        range.start !== start ||
        range.end !== part.end ||
        range.total !== manifest.size ||
        (manifest.etag &&
          response.headers.etag &&
          response.headers.etag !== manifest.etag) ||
        String(response.headers['content-type'] ?? '').includes(
          'multipart/byteranges',
        )
      ) {
        response.resume();
        if (status === 200 || status === 206 || status === 416)
          throw new RangeFallback('Range response changed');
        if (!retryableStatus(status))
          throw new RangeFallback(`Permanent HTTP ${status}`);
        serverDelay = retryAfterMs(response.headers['retry-after']);
        throw new OneKeyLocalError(`HTTP ${status}`);
      }
      let sinceFlush = 0;
      for await (const chunk of response) {
        cancelled(opts.signal);
        const bytes = chunk as Buffer;
        if (bytes.length > part.end - part.start + 1 - part.done)
          throw new RangeFallback('Range body exceeds segment');
        fs.writeSync(fd, bytes, 0, bytes.length, part.start + part.done);
        part.done += bytes.length;
        sinceFlush += bytes.length;
        emit(opts, manifest, bytes.length);
        if (sinceFlush >= FLUSH_BYTES) {
          flush();
          sinceFlush = 0;
        }
      }
      flush();
      if (part.done === part.end - part.start + 1) return;
      throw new OneKeyLocalError('Range body incomplete');
    } catch (error) {
      flush();
      if (
        error instanceof RangeFallback ||
        opts.signal?.aborted ||
        retry === MAX_RETRIES
      )
        throw error;
      const delay = serverDelay ?? Math.min(500 * 2 ** retry, 10_000);
      await waitForRetry(delay, opts.signal);
      serverDelay = null;
    }
  }
}

async function parallel(
  opts: INodeDownloadOptions,
  finalUrl: string,
  size: number,
  etag: string | null,
  partial: string,
  manifestPath: string,
): Promise<void> {
  let manifest = readManifest(
    opts,
    partial,
    manifestPath,
    size,
    etag,
    'parallel',
  );
  if (!manifest) {
    discard(partial, manifestPath);
    const chunk = Math.ceil(size / SEGMENTS);
    const parts = Array.from({ length: SEGMENTS }, (_, index) => {
      const start = index * chunk;
      return { start, end: Math.min(start + chunk - 1, size - 1), done: 0 };
    }).filter((part) => part.start < size);
    const fd = fs.openSync(partial, 'w');
    fs.ftruncateSync(fd, size);
    fs.closeSync(fd);
    manifest = {
      identity: opts.identity,
      url: opts.url,
      size,
      etag,
      checksum: checksumKey(opts),
      mode: 'parallel',
      parts,
    };
    saveManifest(manifestPath, manifest);
  }
  const fd = fs.openSync(partial, 'r+');
  const flush = () => saveManifest(manifestPath, manifest, fd);
  try {
    emit(opts, manifest, 0);
    const outcomes = await Promise.allSettled(
      manifest.parts.map((part) =>
        downloadPart(opts, manifest, part, fd, finalUrl, flush),
      ),
    );
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    if (rejected?.status === 'rejected') throw rejected.reason;
    flush();
  } finally {
    fs.closeSync(fd);
  }
}

async function single(
  opts: INodeDownloadOptions,
  size: number,
  etag: string | null,
  partial: string,
  manifestPath: string,
): Promise<number> {
  let manifest = readManifest(
    opts,
    partial,
    manifestPath,
    size,
    etag,
    'single',
  );
  if (!manifest) {
    discard(partial, manifestPath);
    manifest = {
      identity: opts.identity,
      url: opts.url,
      size,
      etag,
      checksum: checksumKey(opts),
      mode: 'single',
      parts: [{ start: 0, end: Math.max(0, size - 1), done: 0 }],
    };
    fs.closeSync(fs.openSync(partial, 'w'));
    saveManifest(manifestPath, manifest);
  }
  const part = manifest.parts[0];
  let offset = part.done;
  if (size && offset === size) return size;
  const headers = {
    ...opts.headers,
    ...(offset ? { Range: `bytes=${offset}-` } : {}),
    ...(offset && etag ? { 'If-Range': etag } : {}),
  };
  const { response } = await get(
    opts.url,
    headers,
    opts.signal,
    0,
    opts.transport,
  );
  const status = response.statusCode ?? 0;
  if (status !== 200 && status !== 206) {
    response.resume();
    if (status === 416) {
      discard(partial, manifestPath);
    }
    throw new OneKeyLocalError(`HTTP ${status}`);
  }
  if (etag && response.headers.etag && response.headers.etag !== etag) {
    response.resume();
    discard(partial, manifestPath);
    throw new OneKeyLocalError('Download object changed');
  }
  if (status === 206) {
    const range = contentRange(response.headers['content-range']);
    if (!range || range.start !== offset || (size && range.total !== size)) {
      response.resume();
      discard(partial, manifestPath);
      throw new OneKeyLocalError('Invalid resume range');
    }
    manifest.size = range.total;
    part.end = range.total - 1;
  } else if (offset) {
    offset = 0;
    part.done = 0;
    fs.truncateSync(partial, 0);
  }
  if (!manifest.size) {
    manifest.size = Number(response.headers['content-length']) || 0;
    part.end = Math.max(0, manifest.size - 1);
  }
  if (
    manifest.size > MAX_DOWNLOAD_BYTES ||
    (opts.expectedBytes &&
      manifest.size &&
      manifest.size !== opts.expectedBytes)
  ) {
    response.destroy();
    throw new OneKeyLocalError('Download size mismatch or limit exceeded');
  }
  const fd = fs.openSync(partial, 'r+');
  let sinceFlush = 0;
  try {
    emit(opts, manifest, 0);
    for await (const chunk of response) {
      cancelled(opts.signal);
      const bytes = chunk as Buffer;
      if (
        (manifest.size && part.done + bytes.length > manifest.size) ||
        part.done + bytes.length > MAX_DOWNLOAD_BYTES ||
        (opts.expectedBytes && part.done + bytes.length > opts.expectedBytes)
      )
        throw new OneKeyLocalError('Download body exceeds expected size');
      fs.writeSync(fd, bytes, 0, bytes.length, part.done);
      part.done += bytes.length;
      sinceFlush += bytes.length;
      emit(opts, manifest, bytes.length);
      if (sinceFlush >= FLUSH_BYTES) {
        saveManifest(manifestPath, manifest, fd);
        sinceFlush = 0;
      }
    }
    saveManifest(manifestPath, manifest, fd);
    if (manifest.size && part.done !== manifest.size)
      throw new OneKeyLocalError('Download incomplete');
    if (opts.expectedBytes && part.done !== opts.expectedBytes)
      throw new OneKeyLocalError('Download size mismatch');
    return part.done;
  } finally {
    saveManifest(manifestPath, manifest, fd);
    fs.closeSync(fd);
  }
}

async function singleWithRetry(
  opts: INodeDownloadOptions,
  size: number,
  etag: string | null,
  partial: string,
  manifestPath: string,
): Promise<number> {
  for (let retry = 0; retry <= MAX_RETRIES; retry += 1) {
    try {
      return await single(opts, size, etag, partial, manifestPath);
    } catch (error) {
      if (
        opts.signal?.aborted ||
        retry === MAX_RETRIES ||
        (error instanceof Error &&
          (error.message === 'Download body exceeds expected size' ||
            error.message === 'Download size mismatch or limit exceeded' ||
            error.message === 'Download size mismatch'))
      )
        throw error;
      const status =
        error instanceof Error ? /^HTTP (\d+)$/.exec(error.message) : null;
      if (
        status &&
        Number(status[1]) !== 416 &&
        !retryableStatus(Number(status[1]))
      )
        throw error;
      await waitForRetry(Math.min(500 * 2 ** retry, 10_000), opts.signal);
    }
  }
  throw new OneKeyLocalError('Download retry exhausted');
}

export async function downloadNodeFile(
  opts: INodeDownloadOptions,
): Promise<{ filePath: string; totalBytes: number }> {
  cancelled(opts.signal);
  if (!opts.identity || !isHttps(opts.url))
    throw new OneKeyLocalError('Invalid download parameters');
  if (!opts.expectedSha512 && !opts.expectedSha256)
    throw new OneKeyLocalError('Download checksum is required');
  if (
    opts.expectedBytes !== undefined &&
    (!Number.isSafeInteger(opts.expectedBytes) ||
      opts.expectedBytes <= 0 ||
      opts.expectedBytes > MAX_DOWNLOAD_BYTES)
  )
    throw new OneKeyLocalError('Invalid expected download size');
  fs.mkdirSync(path.dirname(opts.targetPath), { recursive: true });
  const partial = `${opts.targetPath}.partial`;
  const manifestPath = `${partial}.progress.json`;
  if (fs.existsSync(opts.targetPath)) {
    if (
      fs.statSync(opts.targetPath).size <= MAX_DOWNLOAD_BYTES &&
      (!opts.expectedBytes ||
        fs.statSync(opts.targetPath).size === opts.expectedBytes) &&
      (await verify(opts.targetPath, opts))
    ) {
      cancelled(opts.signal);
      discard(partial, manifestPath);
      return {
        filePath: opts.targetPath,
        totalBytes: fs.statSync(opts.targetPath).size,
      };
    }
    fs.rmSync(opts.targetPath, { force: true });
  }
  let info: Awaited<ReturnType<typeof probe>>;
  try {
    info = await probeWithRetry(opts);
  } catch (error) {
    if (
      opts.signal?.aborted ||
      !probeFailureIsTransient(error) ||
      fs.existsSync(partial)
    )
      throw error;
    info = { url: opts.url, size: 0, etag: null, parallel: false };
  }
  let size: number;
  if (info.parallel) {
    try {
      await parallel(
        opts,
        info.url,
        info.size,
        info.etag,
        partial,
        manifestPath,
      );
      size = info.size;
    } catch (error) {
      if (!(error instanceof RangeFallback)) throw error;
      discard(partial, manifestPath);
      size = await singleWithRetry(
        opts,
        info.size,
        info.etag,
        partial,
        manifestPath,
      );
    }
  } else {
    size = await singleWithRetry(
      opts,
      info.size,
      info.etag,
      partial,
      manifestPath,
    );
  }
  cancelled(opts.signal);
  if (
    size > MAX_DOWNLOAD_BYTES ||
    (opts.expectedBytes && size !== opts.expectedBytes)
  ) {
    throw new OneKeyLocalError('Download size mismatch or limit exceeded');
  }
  if (!(await verify(partial, opts))) {
    discard(partial, manifestPath);
    throw new OneKeyLocalError('Downloaded file checksum mismatch');
  }
  cancelled(opts.signal);
  fs.renameSync(partial, opts.targetPath);
  fs.rmSync(manifestPath, { force: true });
  return { filePath: opts.targetPath, totalBytes: size };
}
