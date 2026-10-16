import { createHash } from 'crypto';
import fs from 'fs';
import https from 'https';
import path from 'path';

import {
  EUpdateErrorCode,
  createUpdateError,
  getUpdateError,
  isRetryableUpdateError,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update/error';

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

class RangeFallback extends Error {
  constructor(
    message: string,
    readonly refreshMetadata = false,
  ) {
    super(message);
  }
}

function failure(code: EUpdateErrorCode, httpStatus?: number) {
  return createUpdateError({ code, step: 'download', httpStatus });
}

export function classifyNodeError(error: unknown) {
  try {
    if (error instanceof RangeFallback) {
      return error.refreshMetadata
        ? failure(EUpdateErrorCode.httpError, 416)
        : failure(EUpdateErrorCode.integrityFailed);
    }
    const known = getUpdateError(error, 'download');
    if (known.code !== EUpdateErrorCode.unknown)
      return createUpdateError(known);
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ENOENT' || code === 'ENOTDIR')
      return failure(EUpdateErrorCode.packageMissing);
    if (
      ['ENOSPC', 'EACCES', 'EPERM', 'EIO', 'EBUSY', 'EROFS'].includes(
        code ?? '',
      )
    )
      return failure(EUpdateErrorCode.storageError);
    if (['ETIMEDOUT', 'ESOCKETTIMEDOUT'].includes(code ?? ''))
      return failure(EUpdateErrorCode.timeout);
    if (
      [
        'ECONNRESET',
        'ECONNREFUSED',
        'ENETUNREACH',
        'EHOSTUNREACH',
        'EAI_AGAIN',
        'ENOTFOUND',
      ].includes(code ?? '')
    )
      return failure(EUpdateErrorCode.networkError);
    if (
      [
        'CERT_HAS_EXPIRED',
        'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        'SELF_SIGNED_CERT_IN_CHAIN',
        'ERR_TLS_CERT_ALTNAME_INVALID',
      ].includes(code ?? '')
    )
      return failure(EUpdateErrorCode.securityRejected);
    if ((error as Error | undefined)?.name === 'AbortError')
      return failure(EUpdateErrorCode.cancelled);
    return failure(EUpdateErrorCode.unknown);
  } catch {
    return failure(EUpdateErrorCode.unknown);
  }
}

function cancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw failure(EUpdateErrorCode.cancelled);
}

function waitForRetry(delay: number, signal?: AbortSignal): Promise<void> {
  cancelled(signal);
  return new Promise((resolve, reject) => {
    const timer: { id?: ReturnType<typeof setTimeout> } = {};
    const onAbort = () => {
      clearTimeout(timer.id);
      signal?.removeEventListener('abort', onAbort);
      reject(failure(EUpdateErrorCode.cancelled));
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

export function stripSensitiveHeaders(headers: Record<string, string>) {
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
  if (!isHttps(url)) throw failure(EUpdateErrorCode.invalidArgument);
  if (transport) return transport(url, headers, signal);
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, signal }, (response) => {
      const status = response.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        response.destroy();
        if (!response.headers.location || redirects >= MAX_REDIRECTS) {
          reject(failure(EUpdateErrorCode.securityRejected));
          return;
        }
        const next = new URL(response.headers.location, url).toString();
        if (!isHttps(next)) {
          reject(failure(EUpdateErrorCode.securityRejected));
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
      req.destroy(failure(EUpdateErrorCode.timeout)),
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
    throw failure(EUpdateErrorCode.httpError, status);
  if (!Number.isSafeInteger(size) || size < 0)
    throw failure(EUpdateErrorCode.integrityFailed);
  if (
    size > MAX_DOWNLOAD_BYTES ||
    (opts.expectedBytes && size && size !== opts.expectedBytes)
  )
    throw failure(EUpdateErrorCode.integrityFailed);
  return {
    url,
    size,
    etag: response.headers.etag ?? null,
    parallel: status === 206 && !!range && size >= MIN_PARALLEL_BYTES,
  };
}

function probeFailureIsTransient(error: unknown): boolean {
  return isRetryableUpdateError(
    getUpdateError(classifyNodeError(error), 'download'),
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
  throw failure(EUpdateErrorCode.unknown);
}

function isStrongEtag(etag: string | null | undefined): etag is string {
  return Boolean(
    etag && !etag.trim().startsWith('W/') && !etag.trim().startsWith('w/'),
  );
}

function isRetryableFsError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === 'EPERM' || code === 'EACCES' || code === 'EBUSY';
}

function renameWithRetrySync(fromPath: string, toPath: string): void {
  for (let attempt = 0; attempt <= 3; attempt += 1) {
    try {
      fs.renameSync(fromPath, toPath);
      return;
    } catch (error) {
      if (!isRetryableFsError(error) || attempt === 3) {
        throw error;
      }
    }
  }
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
      const onAbort = () => stream.destroy(failure(EUpdateErrorCode.cancelled));
      opts.signal?.addEventListener('abort', onAbort, { once: true });
      try {
        for await (const chunk of stream) {
          cancelled(opts.signal);
          hash.update(chunk);
        }
      } catch (error) {
        cancelled(opts.signal);
        if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
          return false;
        }
        throw error;
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
  const tempPath = `${manifestPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(manifest));
  try {
    renameWithRetrySync(tempPath, manifestPath);
  } catch (error) {
    if (!isRetryableFsError(error)) throw error;
    fs.copyFileSync(tempPath, manifestPath);
    fs.rmSync(tempPath, { force: true });
  }
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
      (opts.identity
        ? manifest.identity === opts.identity
        : manifest.url === opts.url) &&
      (manifest.size === size ||
        (mode === 'single' &&
          size === 0 &&
          Number.isSafeInteger(manifest.size) &&
          manifest.size >= 0 &&
          manifest.size <= MAX_DOWNLOAD_BYTES)) &&
      manifest.etag === (etag ?? manifest.etag) &&
      manifest.checksum === checksumKey(opts) &&
      manifest.mode === mode &&
      Array.isArray(manifest.parts);
    if (!matching) return null;
    if (
      manifest.parts.some(
        (p) =>
          !Number.isSafeInteger(p.start) ||
          !Number.isSafeInteger(p.end) ||
          !Number.isSafeInteger(p.done) ||
          p.start < 0 ||
          p.end < p.start ||
          p.done < 0 ||
          ((mode === 'parallel' || manifest.size > 0) &&
            p.done > p.end - p.start + 1),
      )
    )
      return null;
    const stat = fs.statSync(partial);
    if (mode === 'parallel' && stat.size !== size) return null;
    if (mode === 'single') {
      if (manifest.parts.length !== 1) return null;
      const done = manifest.parts[0]?.done ?? 0;
      if (stat.size < done) return null;
      if (stat.size > done) fs.truncateSync(partial, done);
    }
    if (manifest.url !== opts.url) {
      manifest.url = opts.url;
    }
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
        ...(isStrongEtag(manifest.etag) ? { 'If-Range': manifest.etag } : {}),
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
        response.destroy();
        if (status === 416) throw new RangeFallback('HTTP 416', true);
        if (status === 200 || status === 206)
          throw new RangeFallback('Range response changed');
        if (!retryableStatus(status))
          throw failure(EUpdateErrorCode.httpError, status);
        serverDelay = retryAfterMs(response.headers['retry-after']);
        throw failure(EUpdateErrorCode.httpError, status);
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
      throw failure(EUpdateErrorCode.networkError);
    } catch (error) {
      try {
        flush();
      } catch {
        /* ignore manifest flush errors during unwind */
      }
      if (error instanceof RangeFallback) throw error;
      if (
        opts.signal?.aborted ||
        retry === MAX_RETRIES ||
        !isRetryableUpdateError(
          getUpdateError(classifyNodeError(error), 'download'),
        )
      )
        throw classifyNodeError(error);
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
  cancelled(opts.signal);
  const fd = fs.openSync(partial, 'r+');
  const flush = () => saveManifest(manifestPath, manifest, fd);
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onAbort, { once: true });
  if (opts.signal?.aborted) controller.abort();
  const terminalHttpError: { current?: Error } = {};
  try {
    emit(opts, manifest, 0);
    const outcomes = await Promise.allSettled(
      manifest.parts.map(async (part) => {
        try {
          await downloadPart(
            { ...opts, signal: controller.signal },
            manifest,
            part,
            fd,
            finalUrl,
            flush,
          );
        } catch (error) {
          const updateError = getUpdateError(error, 'download');
          if (
            updateError.code === EUpdateErrorCode.httpError &&
            !isRetryableUpdateError(updateError) &&
            !terminalHttpError.current
          ) {
            terminalHttpError.current =
              error instanceof Error
                ? error
                : failure(EUpdateErrorCode.httpError, updateError.httpStatus);
            controller.abort();
          }
          throw error;
        }
      }),
    );
    cancelled(opts.signal);
    if (terminalHttpError.current) throw terminalHttpError.current;
    const rejected =
      outcomes.find(
        (outcome) =>
          outcome.status === 'rejected' &&
          outcome.reason instanceof RangeFallback &&
          outcome.reason.refreshMetadata,
      ) ?? outcomes.find((outcome) => outcome.status === 'rejected');
    if (rejected?.status === 'rejected') throw rejected.reason;
    flush();
  } finally {
    opts.signal?.removeEventListener('abort', onAbort);
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
  const knownSize = manifest.size || size;
  const knownEtag = manifest.etag ?? etag;
  if (knownSize && offset === knownSize) return knownSize;
  const headers = {
    ...opts.headers,
    ...(offset ? { Range: `bytes=${offset}-` } : {}),
    ...(offset && isStrongEtag(knownEtag) ? { 'If-Range': knownEtag } : {}),
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
    response.destroy();
    throw failure(EUpdateErrorCode.httpError, status);
  }
  if (
    knownEtag &&
    response.headers.etag &&
    response.headers.etag !== knownEtag
  ) {
    response.destroy();
    discard(partial, manifestPath);
    throw failure(EUpdateErrorCode.integrityFailed);
  }
  if (status === 206) {
    const range = contentRange(response.headers['content-range']);
    if (
      !range ||
      range.start !== offset ||
      (knownSize && range.total !== knownSize)
    ) {
      response.destroy();
      discard(partial, manifestPath);
      throw failure(EUpdateErrorCode.integrityFailed);
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
  if (!manifest.etag && response.headers.etag) {
    manifest.etag = response.headers.etag;
  }
  if (
    manifest.size > MAX_DOWNLOAD_BYTES ||
    (opts.expectedBytes &&
      manifest.size &&
      manifest.size !== opts.expectedBytes)
  ) {
    response.destroy();
    throw failure(EUpdateErrorCode.integrityFailed);
  }
  const fd = fs.openSync(partial, 'r+');
  const flush = () => saveManifest(manifestPath, manifest, fd);
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
        throw failure(EUpdateErrorCode.integrityFailed);
      fs.writeSync(fd, bytes, 0, bytes.length, part.done);
      part.done += bytes.length;
      sinceFlush += bytes.length;
      emit(opts, manifest, bytes.length);
      if (sinceFlush >= FLUSH_BYTES) {
        flush();
        sinceFlush = 0;
      }
    }
    flush();
    if (manifest.size && part.done !== manifest.size)
      throw failure(EUpdateErrorCode.networkError);
    if (opts.expectedBytes && part.done !== opts.expectedBytes)
      throw failure(EUpdateErrorCode.integrityFailed);
    return part.done;
  } finally {
    try {
      flush();
    } catch {
      /* ignore manifest flush errors during unwind */
    }
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
  let currentSize = size;
  let currentEtag = etag;
  for (let retry = 0; retry <= MAX_RETRIES; retry += 1) {
    try {
      return await single(
        opts,
        currentSize,
        currentEtag,
        partial,
        manifestPath,
      );
    } catch (error) {
      const updateError = getUpdateError(classifyNodeError(error), 'download');
      if (
        opts.signal?.aborted ||
        retry === MAX_RETRIES ||
        !isRetryableUpdateError(updateError)
      )
        throw classifyNodeError(error);
      if (updateError.httpStatus === 416) {
        // Revalidate the object before readManifest decides to keep/reset bytes.
        const refreshed = await probeWithRetry(opts);
        currentSize = refreshed.size;
        currentEtag = refreshed.etag;
      }
      await waitForRetry(Math.min(500 * 2 ** retry, 10_000), opts.signal);
    }
  }
  throw failure(EUpdateErrorCode.unknown);
}

async function parallelWithRecovery(
  opts: INodeDownloadOptions,
  initialInfo: Awaited<ReturnType<typeof probe>>,
  partial: string,
  manifestPath: string,
): Promise<number> {
  let info = initialInfo;
  for (let retry = 0; retry <= MAX_RETRIES; retry += 1) {
    try {
      await parallel(
        opts,
        info.url,
        info.size,
        info.etag,
        partial,
        manifestPath,
      );
      return info.size;
    } catch (error) {
      if (!(error instanceof RangeFallback)) throw error;
      if (error.refreshMetadata) {
        cancelled(opts.signal);
        if (retry === MAX_RETRIES) throw error;
        await waitForRetry(Math.min(500 * 2 ** retry, 10_000), opts.signal);
        info = await probeWithRetry(opts);
        // Matching metadata preserves all completed segments on the next run.
      } else {
        discard(partial, manifestPath);
      }
      if (!error.refreshMetadata || !info.parallel) {
        return await singleWithRetry(
          opts,
          info.size,
          info.etag,
          partial,
          manifestPath,
        );
      }
    }
  }
  throw failure(EUpdateErrorCode.unknown);
}

async function downloadNodeFileInternal(
  input: INodeDownloadOptions,
): Promise<{ filePath: string; totalBytes: number }> {
  let highestPercent = 0;
  const opts: INodeDownloadOptions = {
    ...input,
    onProgress: (progress) => {
      highestPercent = Math.max(highestPercent, progress.percent);
      input.onProgress?.({ ...progress, percent: highestPercent });
    },
  };
  cancelled(opts.signal);
  if (!opts.identity || !isHttps(opts.url))
    throw failure(EUpdateErrorCode.invalidArgument);
  if (!opts.expectedSha512 && !opts.expectedSha256)
    throw failure(EUpdateErrorCode.invalidArgument);
  if (
    opts.expectedBytes !== undefined &&
    (!Number.isSafeInteger(opts.expectedBytes) ||
      opts.expectedBytes <= 0 ||
      opts.expectedBytes > MAX_DOWNLOAD_BYTES)
  )
    throw failure(EUpdateErrorCode.invalidArgument);
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
  if (
    info.parallel &&
    !readManifest(opts, partial, manifestPath, info.size, info.etag, 'single')
  ) {
    size = await parallelWithRecovery(opts, info, partial, manifestPath);
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
    throw failure(EUpdateErrorCode.integrityFailed);
  }
  if (!(await verify(partial, opts))) {
    discard(partial, manifestPath);
    throw failure(EUpdateErrorCode.integrityFailed);
  }
  cancelled(opts.signal);
  renameWithRetrySync(partial, opts.targetPath);
  fs.rmSync(manifestPath, { force: true });
  return { filePath: opts.targetPath, totalBytes: size };
}

export async function downloadNodeFile(
  input: INodeDownloadOptions,
): Promise<{ filePath: string; totalBytes: number }> {
  try {
    return await downloadNodeFileInternal(input);
  } catch (error) {
    throw classifyNodeError(error);
  }
}
