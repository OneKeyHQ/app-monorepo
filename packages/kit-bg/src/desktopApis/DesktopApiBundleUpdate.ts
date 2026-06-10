import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';

import AdmZip from 'adm-zip';
import { app } from 'electron';
import logger from 'electron-log/main';

import {
  calculateSHA256,
  checkFileSha512,
  getBundleDirName,
  getBundleExtractDir,
  lastSHA256FailureReason,
  testExtractedSha256FromVerifyAscFile,
  verifyMetadataFileSha256,
  verifySha256,
} from '@onekeyhq/desktop/app/bundle';
import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import * as store from '@onekeyhq/desktop/app/libs/store';
import {
  clearWindowProgressBar,
  updateWindowProgressBar,
} from '@onekeyhq/desktop/app/windowProgressBar';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IDownloadPackageParams,
  IUpdateDownloadedEvent,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update/type';
import type { IDesktopStoreUpdateBundleData } from '@onekeyhq/shared/types/desktop';

import type { IDesktopApi } from './base/types';
import type { BrowserWindow } from 'electron';

export interface IUpdateProgressUpdate {
  percent: number;
  delta: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

// ---------------------------------------------------------------------------
// Concurrent (multi-range) download tuning.
//
// We split the bundle into BUNDLE_SEGMENT_COUNT byte ranges and download them
// in parallel, writing each segment directly into its own offset of a single
// pre-allocated `.partial` file (no separate merge pass, 1x disk). A small
// sidecar manifest (`<partial>.progress.json`) records each segment's
// durably-written cursor so an interrupted download resumes by re-requesting
// only `Range: (start+done)-(end)` for the unfinished segments.
// ---------------------------------------------------------------------------
const BUNDLE_SEGMENT_COUNT = 8;
// Below this size the per-connection setup cost outweighs any speedup, so we
// keep the simple single-stream path.
const BUNDLE_MIN_CONCURRENT_BYTES = 2 * 1024 * 1024;
// Per-segment transient-failure retries inside one concurrent run. The outer
// updateRetry loop still wraps the whole download for harder failures.
const BUNDLE_PART_MAX_RETRY = 3;
const BUNDLE_REQUEST_TIMEOUT_MS = 1000 * 60 * 30;
// Persist the manifest at most this often per segment to bound fsync cost.
const BUNDLE_MANIFEST_FLUSH_BYTES = 4 * 1024 * 1024;

interface IBundleDownloadPart {
  index: number;
  start: number;
  end: number;
  // Bytes durably written into [start, start+done) of the partial file.
  done: number;
}

interface IBundleDownloadManifest {
  // CDN ETag captured at probe time; if it changes mid-download the on-disk
  // bytes are stale and the whole download must restart.
  etag: string | null;
  size: number;
  parts: IBundleDownloadPart[];
}

// Sentinel for "the concurrent path cannot proceed" (range unsupported, ETag
// changed, server ignored Range, ...). Encoded as a message-prefixed
// OneKeyLocalError rather than a bespoke Error subclass (keeps the file to a
// single class and satisfies no-raw-error); the orchestrator detects it and
// falls back to the single-stream downloader so we never regress.
const CONCURRENT_FALLBACK_PREFIX = 'CONCURRENT_DOWNLOAD_FALLBACK';
function concurrentFallbackError(reason: string): OneKeyLocalError {
  return new OneKeyLocalError(`${CONCURRENT_FALLBACK_PREFIX}: ${reason}`);
}
function isConcurrentFallback(error: unknown): boolean {
  return (
    error instanceof OneKeyLocalError &&
    error.message.startsWith(CONCURRENT_FALLBACK_PREFIX)
  );
}
// Wraps a Node.js fs/stream/http error into a sanitized OneKeyLocalError
// before it can reach the analytics layer. Node's errno errors embed the
// failing path (`ENOENT: no such file ... open '/Users/<name>/...'`) which
// would otherwise leak the OS username through softwareUpdateResult's
// errorMessage. The errno code itself is preserved as `IO_<errno>` so
// downstream extractUpdateErrorCode can still split mixpanel buckets.
// OneKeyLocalError instances pass through untouched — verifyAndResolve
// already produces structured `Downloaded file is not valid: SHA256_<reason>`
// payloads we want to keep verbatim.
function wrapDownloadError(
  error: unknown,
  fallbackMessage: string,
): OneKeyLocalError {
  if (error instanceof OneKeyLocalError) return error;
  const errno = (error as NodeJS.ErrnoException | null)?.code;
  if (errno) {
    return new OneKeyLocalError(`${fallbackMessage}: IO_${errno}`);
  }
  return new OneKeyLocalError(fallbackMessage);
}

class DesktopApiAppBundleUpdate {
  desktopApi: IDesktopApi;

  cancelCurrentDownload: (() => void) | null;

  isDownloading = false;

  private isSkipGPGAllowed(skipGPGVerification?: boolean) {
    return (
      process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION === 'true' &&
      Boolean(skipGPGVerification)
    );
  }

  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
    this.cancelCurrentDownload = () => {};
  }

  getMainWindow(): BrowserWindow | undefined {
    return globalThis.$desktopMainAppFunctions?.getSafelyMainWindow?.();
  }

  async verifyAndResolve(filePath: string, sha256: string) {
    return new Promise<boolean>((resolve, reject) => {
      setTimeout(() => {
        const verified = verifySha256(filePath, sha256);
        if (!verified) {
          // Capture the side-channel reason verifySha256 stamped — splits the
          // mixpanel "Downloaded file is not valid" bucket into actionable
          // subtypes (FILE_NOT_FOUND / PERMISSION_DENIED / IS_DIRECTORY /
          // OOM / IO_<code> / MISMATCH) that match the iOS/Android nitro
          // module subtypes so cross-platform funnels can compare apples-to-
          // apples.
          const reason = lastSHA256FailureReason() ?? 'UNKNOWN';
          reject(
            new OneKeyLocalError(
              `Downloaded file is not valid: SHA256_${reason}`,
            ),
          );
          return;
        }
        resolve(true);
      }, 1000);
    });
  }

  getDownloadDir() {
    const tempDir = path.join(
      app.getPath('userData'),
      'onekey-bundle-download',
    );
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    logger.info('bundle-download-getDownloadDir', tempDir);
    return tempDir;
  }

  // Public entry point. Only the happy path — valid https URL, no in-flight
  // download, a large enough range-capable file — takes the concurrent route.
  // Everything else (validation errors, the in-progress guard, the cached-file
  // short circuit) stays owned by the single-stream implementation so existing
  // behavior is unchanged, and any capability problem mid-flight falls back to
  // single-stream so we never regress.
  async downloadBundle(
    params: IDownloadPackageParams,
  ): Promise<IUpdateDownloadedEvent> {
    const bundleUrl = params.downloadUrl;
    if (this.isDownloading || !bundleUrl?.startsWith('https://')) {
      return this.downloadBundleSingleStream(params);
    }

    let probe: {
      finalUrl: string;
      totalBytes: number;
      etag: string | null;
      supportsRange: boolean;
    } | null = null;
    try {
      probe = await this.probeBundleRange(bundleUrl);
    } catch (e) {
      logger.warn(
        'bundle-download',
        'Range probe failed, using single-stream',
        e,
      );
    }

    const canConcurrent =
      !!probe &&
      probe.supportsRange &&
      probe.totalBytes >= BUNDLE_MIN_CONCURRENT_BYTES;
    if (!probe || !canConcurrent) {
      return this.downloadBundleSingleStream(params);
    }

    try {
      return await this.downloadBundleConcurrent(params, probe);
    } catch (error) {
      if (isConcurrentFallback(error)) {
        logger.warn(
          'bundle-download',
          `Concurrent download fell back to single-stream: ${
            (error as Error).message
          }`,
        );
        return this.downloadBundleSingleStream(params);
      }
      throw error;
    }
  }

  // Lightweight probe: a one-byte range request that, in a single round trip,
  // confirms Range support, captures the total size and the CDN ETag, and
  // resolves the post-redirect final URL (so segment requests skip redirects).
  private probeBundleRange(
    url: string,
    redirectCount = 0,
  ): Promise<{
    finalUrl: string;
    totalBytes: number;
    etag: string | null;
    supportsRange: boolean;
  }> {
    return new Promise((resolve, reject) => {
      const reqProtocol = url.startsWith('https://') ? https : http;
      const req = reqProtocol.get(
        url,
        { headers: { Range: 'bytes=0-0' } },
        (response) => {
          const status = response.statusCode ?? 0;
          if (
            [301, 302, 307, 308].includes(status) &&
            response.headers.location
          ) {
            response.resume();
            if (redirectCount >= 5) {
              reject(new Error('Too many redirects'));
              return;
            }
            const resolvedRedirectUrl = new URL(
              response.headers.location,
              url,
            ).toString();
            if (!resolvedRedirectUrl.startsWith('https://')) {
              reject(new Error('Redirect to non-HTTPS URL is not allowed'));
              return;
            }
            this.probeBundleRange(resolvedRedirectUrl, redirectCount + 1).then(
              resolve,
              reject,
            );
            return;
          }
          const etag = response.headers.etag ?? null;
          response.resume();
          if (status === 206) {
            const contentRange = response.headers['content-range'];
            const match =
              typeof contentRange === 'string'
                ? contentRange.match(/bytes \d+-\d+\/(\d+)/)
                : null;
            if (match) {
              resolve({
                finalUrl: url,
                totalBytes: parseInt(match[1], 10),
                etag,
                supportsRange: true,
              });
              return;
            }
            resolve({
              finalUrl: url,
              totalBytes: 0,
              etag,
              supportsRange: false,
            });
            return;
          }
          if (status === 200) {
            // Server ignored the Range header — single-stream only.
            resolve({
              finalUrl: url,
              totalBytes: parseInt(
                (response.headers['content-length'] as string) || '0',
                10,
              ),
              etag,
              supportsRange: false,
            });
            return;
          }
          reject(new Error(`HTTP ${status}`));
        },
      );
      req.on('error', reject);
      req.setTimeout(30_000, () => {
        req.destroy();
        reject(new Error('Probe timeout'));
      });
    });
  }

  // Invariant: the progress manifest is only meaningful as metadata for an
  // existing `.partial`. A manifest with no `.partial` behind it (e.g. left by
  // a crash between renaming a finished `.partial` and deleting its manifest)
  // is meaningless — drop it so it can never be half-trusted or linger.
  private dropOrphanManifest(partialFilePath: string, manifestPath: string) {
    if (!fs.existsSync(partialFilePath) && fs.existsSync(manifestPath)) {
      logger.info('bundle-download', 'Dropping orphan progress manifest');
      fs.rmSync(manifestPath, { force: true });
    }
  }

  // Discard the whole resume state. The manifest is removed BEFORE the
  // `.partial` so the manifest never outlives the file it describes (a crash
  // mid-call leaves at most an orphan `.partial`, which is self-discarding).
  private discardPartialDownload(
    partialFilePath: string,
    manifestPath: string,
  ) {
    fs.rmSync(manifestPath, { force: true });
    fs.rmSync(partialFilePath, { force: true });
  }

  // Build a fresh segment plan + pre-allocated partial file, or resume from an
  // existing manifest when its size/ETag still match the current CDN object.
  private loadOrInitManifest(
    manifestPath: string,
    partialFilePath: string,
    totalBytes: number,
    etag: string | null,
  ): IBundleDownloadManifest {
    if (fs.existsSync(manifestPath) && fs.existsSync(partialFilePath)) {
      try {
        const parsed = JSON.parse(
          fs.readFileSync(manifestPath, 'utf8'),
        ) as IBundleDownloadManifest;
        const sameSize = parsed.size === totalBytes;
        const sameEtag = !etag || !parsed.etag || parsed.etag === etag;
        const stat = fs.statSync(partialFilePath);
        if (
          sameSize &&
          sameEtag &&
          stat.size === totalBytes &&
          Array.isArray(parsed.parts) &&
          parsed.parts.length > 0
        ) {
          for (const p of parsed.parts) {
            const segLen = p.end - p.start + 1;
            if (!(p.done >= 0)) p.done = 0;
            if (p.done > segLen) p.done = segLen;
          }
          logger.info('bundle-download', 'Resuming concurrent download', {
            transferred: parsed.parts.reduce((acc, p) => acc + p.done, 0),
            total: totalBytes,
          });
          return parsed;
        }
      } catch (e) {
        logger.warn('bundle-download', 'Manifest parse failed, restarting', e);
      }
    }

    // Fresh start: drop stale artifacts (manifest first so it never describes a
    // not-yet-(re)created partial), pre-allocate the full file, plan the 8
    // segments (last one absorbs the remainder), then write the matching
    // manifest only after the partial exists.
    this.discardPartialDownload(partialFilePath, manifestPath);
    const allocFd = fs.openSync(partialFilePath, 'w');
    try {
      fs.ftruncateSync(allocFd, totalBytes);
    } finally {
      fs.closeSync(allocFd);
    }
    const parts: IBundleDownloadPart[] = [];
    const chunk = Math.ceil(totalBytes / BUNDLE_SEGMENT_COUNT);
    for (let i = 0; i < BUNDLE_SEGMENT_COUNT; i += 1) {
      const start = i * chunk;
      if (start >= totalBytes) break;
      const end = Math.min(start + chunk - 1, totalBytes - 1);
      parts.push({ index: parts.length, start, end, done: 0 });
    }
    const manifest: IBundleDownloadManifest = { etag, size: totalBytes, parts };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    return manifest;
  }

  // Persist the manifest AFTER fsync-ing the data so the recorded cursors never
  // claim more than what is durably on disk (a crash just means a tiny re-fetch
  // on resume; positioned writes are idempotent).
  private flushManifest(
    manifestPath: string,
    manifest: IBundleDownloadManifest,
    fd: number,
  ) {
    try {
      fs.fsyncSync(fd);
    } catch {
      // best effort
    }
    try {
      fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    } catch (e) {
      logger.warn('bundle-download', 'Manifest flush failed', e);
    }
  }

  // Download one segment into [start, end] of the shared fd via positioned
  // writes, resuming from part.done and retrying transient failures in place.
  private downloadBundlePart(opts: {
    fd: number;
    url: string;
    etag: string | null;
    part: IBundleDownloadPart;
    isAborted: () => boolean;
    registerRequest: (req: { destroy: () => void }) => void;
    unregisterRequest: (req: { destroy: () => void }) => void;
    onBytes: (delta: number) => void;
  }): Promise<void> {
    const {
      fd,
      etag,
      part,
      isAborted,
      registerRequest,
      unregisterRequest,
      onBytes,
    } = opts;

    const attempt = (
      url: string,
      redirectCount: number,
      retry: number,
    ): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        if (isAborted()) {
          reject(new Error('Download cancelled'));
          return;
        }
        const rangeStart = part.start + part.done;
        if (rangeStart > part.end) {
          resolve();
          return;
        }
        const reqProtocol = url.startsWith('https://') ? https : http;
        const headers: Record<string, string> = {
          Range: `bytes=${rangeStart}-${part.end}`,
        };
        // If-Range: a mismatched ETag makes the CDN reply 200 (full body)
        // instead of 206, which our handler treats as a fallback signal.
        if (etag) headers['If-Range'] = etag;
        const req = reqProtocol.get(url, { headers }, (response) => {
          const status = response.statusCode ?? 0;
          if (
            [301, 302, 307, 308].includes(status) &&
            response.headers.location
          ) {
            response.resume();
            unregisterRequest(req);
            if (redirectCount >= 5) {
              reject(new Error('Too many redirects'));
              return;
            }
            const next = new URL(response.headers.location, url).toString();
            if (!next.startsWith('https://')) {
              reject(new Error('Redirect to non-HTTPS URL is not allowed'));
              return;
            }
            attempt(next, redirectCount + 1, retry).then(resolve, reject);
            return;
          }
          if (status === 200) {
            // Range ignored or ETag changed — cannot safely assemble.
            response.resume();
            reject(
              concurrentFallbackError('server returned 200 to a Range request'),
            );
            return;
          }
          if (status !== 206) {
            response.resume();
            reject(new Error(`HTTP ${status}`));
            return;
          }
          let writePos = rangeStart;
          response.on('data', (chunk: Buffer) => {
            if (isAborted()) {
              try {
                req.destroy();
              } catch {
                // ignore
              }
              return;
            }
            // Positioned synchronous write — the explicit offset means the 8
            // concurrent segments never interleave on the shared fd.
            fs.writeSync(fd, chunk, 0, chunk.length, writePos);
            writePos += chunk.length;
            part.done += chunk.length;
            onBytes(chunk.length);
          });
          response.on('end', () => {
            unregisterRequest(req);
            resolve();
          });
          response.on('error', (err) => {
            unregisterRequest(req);
            reject(err);
          });
        });
        registerRequest(req);
        req.on('error', (err) => {
          unregisterRequest(req);
          reject(err);
        });
        req.setTimeout(BUNDLE_REQUEST_TIMEOUT_MS, () => {
          try {
            req.destroy();
          } catch {
            // ignore
          }
          reject(new Error('Segment timeout'));
        });
      }).catch((err) => {
        if (
          isConcurrentFallback(err) ||
          isAborted() ||
          retry >= BUNDLE_PART_MAX_RETRY
        ) {
          throw err;
        }
        // Transient failure: bytes written so far (part.done) stay on disk and
        // we resume this same segment from its current cursor.
        logger.warn(
          'bundle-download',
          `segment ${part.index} retry ${retry + 1}: ${(err as Error).message}`,
        );
        return attempt(url, redirectCount, retry + 1);
      });

    return attempt(opts.url, 0, 0);
  }

  // 8-way concurrent download with positioned writes + manifest resume. Reuses
  // the existing cached-file check, SHA256 verification and IPC progress
  // channel so the rest of the update pipeline is unaffected.
  private async downloadBundleConcurrent(
    {
      latestVersion: appVersion,
      bundleVersion,
      downloadUrl: bundleUrl,
      sha256,
    }: IDownloadPackageParams,
    probe: { finalUrl: string; totalBytes: number; etag: string | null },
  ): Promise<IUpdateDownloadedEvent> {
    if (this.isDownloading) {
      logger.info('bundle-download', 'Download already in progress, skipping');
      return undefined as unknown as IUpdateDownloadedEvent;
    }
    // Required params are validated by the single-stream path; bail to it (via
    // fallback) rather than duplicating the canonical error shapes here.
    if (!appVersion || !bundleVersion || !bundleUrl || !sha256) {
      throw concurrentFallbackError('missing required params');
    }
    this.isDownloading = true;
    clearWindowProgressBar(this.getMainWindow());

    const tempDir = this.getDownloadDir();
    const fileName = `${appVersion}-${bundleVersion}.zip`;
    const filePath = path.join(tempDir, fileName);
    const partialFilePath = `${filePath}.partial`;
    const manifestPath = `${partialFilePath}.progress.json`;
    const { totalBytes } = probe;

    // Enforce the manifest<->partial invariant up front: a manifest with no
    // partial behind it is stale and must not survive into this run.
    this.dropOrphanManifest(partialFilePath, manifestPath);

    const result: IUpdateDownloadedEvent = {
      downloadedFile: filePath,
      downloadUrl: bundleUrl,
      latestVersion: appVersion,
      bundleVersion,
    };

    // Reuse a previously downloaded + verified file if present.
    if (fs.existsSync(filePath)) {
      try {
        if (await this.verifyAndResolve(filePath, sha256)) {
          // The final file is authoritative — any leftover partial/manifest is
          // stale junk from an earlier interrupted attempt; drop it.
          this.discardPartialDownload(partialFilePath, manifestPath);
          this.isDownloading = false;
          return result;
        }
      } catch (e) {
        logger.error(
          'bundle-download',
          'Cached file invalid, re-downloading',
          e,
        );
      }
      fs.rmSync(filePath, { force: true });
    }

    let fd: number | null = null;
    let aborted = false;
    const inflight = new Set<{ destroy: () => void }>();
    const abortAll = () => {
      aborted = true;
      for (const req of inflight) {
        try {
          req.destroy();
        } catch {
          // ignore
        }
      }
    };

    try {
      const manifest = this.loadOrInitManifest(
        manifestPath,
        partialFilePath,
        totalBytes,
        probe.etag,
      );
      fd = fs.openSync(partialFilePath, 'r+');
      const fileFd = fd;

      this.cancelCurrentDownload = abortAll;

      const lastFlush = manifest.parts.map((p) => p.done);
      const emitProgress = (delta: number) => {
        const transferred = manifest.parts.reduce((acc, p) => acc + p.done, 0);
        const percent = totalBytes > 0 ? (transferred / totalBytes) * 100 : 0;
        this.getMainWindow()?.webContents.send(
          ipcMessageKeys.UPDATE_DOWNLOADING,
          {
            percent,
            transferred,
            total: totalBytes,
            bytesPerSecond: 0,
            delta,
          },
        );
        updateWindowProgressBar(this.getMainWindow(), percent);
      };
      emitProgress(0);

      try {
        await Promise.all(
          manifest.parts.map((part) =>
            this.downloadBundlePart({
              fd: fileFd,
              url: probe.finalUrl,
              etag: probe.etag,
              part,
              isAborted: () => aborted,
              registerRequest: (req) => inflight.add(req),
              unregisterRequest: (req) => inflight.delete(req),
              onBytes: (delta) => {
                if (
                  part.done - lastFlush[part.index] >=
                  BUNDLE_MANIFEST_FLUSH_BYTES
                ) {
                  lastFlush[part.index] = part.done;
                  this.flushManifest(manifestPath, manifest, fileFd);
                }
                emitProgress(delta);
              },
            }),
          ),
        );
      } catch (e) {
        abortAll();
        throw e;
      }

      if (aborted) {
        throw new OneKeyLocalError('Download cancelled');
      }

      this.flushManifest(manifestPath, manifest, fileFd);
      fs.fsyncSync(fileFd);
      fs.closeSync(fileFd);
      fd = null;
      this.cancelCurrentDownload = () => {};

      const transferred = manifest.parts.reduce((acc, p) => acc + p.done, 0);
      if (transferred < totalBytes) {
        throw new OneKeyLocalError('Download incomplete');
      }

      fs.renameSync(partialFilePath, filePath);
      fs.rmSync(manifestPath, { force: true });
      try {
        await this.verifyAndResolve(filePath, sha256);
      } catch (verifyError) {
        // Bad assembly — discard so the next attempt re-downloads cleanly.
        fs.rmSync(filePath, { force: true });
        throw verifyError;
      }

      this.isDownloading = false;
      clearWindowProgressBar(this.getMainWindow());
      logger.info('bundle-download', 'Concurrent download complete', filePath);
      return result;
    } catch (error) {
      abortAll();
      if (fd !== null) {
        try {
          fs.closeSync(fd);
        } catch {
          // ignore
        }
      }
      this.isDownloading = false;
      this.cancelCurrentDownload = () => {};
      clearWindowProgressBar(this.getMainWindow());

      if (isConcurrentFallback(error)) {
        // On-disk bytes are stale/unusable — clear them before falling back.
        this.discardPartialDownload(partialFilePath, manifestPath);
        throw error;
      }
      // Transient/IO/verify error: keep partial + manifest so the outer retry
      // loop resumes from where we stopped.
      throw wrapDownloadError(error, 'Concurrent download failed');
    }
  }

  private async downloadBundleSingleStream({
    latestVersion: appVersion,
    bundleVersion,
    downloadUrl: bundleUrl,
    fileSize,
    sha256,
  }: IDownloadPackageParams): Promise<IUpdateDownloadedEvent> {
    if (this.isDownloading) {
      logger.info('bundle-download', 'Download already in progress, skipping');
      return;
    }
    clearWindowProgressBar(this.getMainWindow());
    if (!appVersion || !bundleVersion || !bundleUrl || !fileSize || !sha256) {
      logger.error('bundle-download', 'Invalid parameters', {
        appVersion,
        bundleVersion,
        bundleUrl,
        fileSize,
        sha256,
      });
      this.isDownloading = false;
      return Promise.reject(new Error('Invalid parameters'));
    }
    if (!bundleUrl.startsWith('https://')) {
      logger.error('bundle-download', `Non-HTTPS URL rejected: ${bundleUrl}`);
      this.isDownloading = false;
      return Promise.reject(new Error('Bundle download URL must use HTTPS'));
    }
    this.isDownloading = true;
    return new Promise<IUpdateDownloadedEvent>((resolve, reject) => {
      setTimeout(async () => {
        // Synchronous fs / setup errors before the response handlers are
        // installed (getDownloadDir() permission denied, statSync ENOENT
        // races on the partial file, mkdirSync EROFS, etc.) used to
        // bubble up as unhandled rejections — leaving isDownloading=true
        // and blocking every subsequent download call. Wrap the whole
        // body so any setup error becomes a clean safeReject + flag
        // reset.
        // Prevent double resolve/reject when multiple error handlers fire
        let settled = false;
        const safeResolve = (value: IUpdateDownloadedEvent) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        const safeReject = (error: unknown) => {
          if (settled) return;
          settled = true;
          this.isDownloading = false;
          reject(error);
        };
        try {
          const tempDir = this.getDownloadDir();
          logger.info('bundle-download', {
            tempDir,
          });
          const fileName = `${appVersion}-${bundleVersion}.zip`;
          const filePath = path.join(tempDir, fileName);
          const partialFilePath = `${filePath}.partial`;

          let downloadedBytes = 0;
          let totalBytes = fileSize;

          if (fs.existsSync(filePath)) {
            try {
              const result = await this.verifyAndResolve(filePath, sha256);
              if (result) {
                this.isDownloading = false;
                safeResolve({
                  downloadedFile: filePath,
                  downloadUrl: bundleUrl,
                  latestVersion: appVersion,
                  bundleVersion,
                });
                return;
              }
            } catch (e) {
              logger.error(
                'bundle-download',
                'Cached file verification failed, re-downloading',
                e,
              );
            }
            await this.clearDownload();
            fs.mkdirSync(tempDir, { recursive: true });
          }
          // Check if partial file exists for resume
          if (fs.existsSync(partialFilePath)) {
            const stats = fs.statSync(partialFilePath);
            downloadedBytes = stats.size;
            logger.info(
              'bundle-download',
              `Resuming download from ${downloadedBytes} bytes`,
            );
          }

          const options = {
            headers:
              downloadedBytes > 0 ? { Range: `bytes=${downloadedBytes}-` } : {},
          };

          let downloadRequest: http.ClientRequest | null = null;

          const makeDownloadRequest = (
            url: string,
            reqOptions: typeof options,
            redirectCount = 0,
          ) => {
            const reqProtocol = url.startsWith('https://') ? https : http;
            downloadRequest = reqProtocol.get(
              url,
              reqOptions,
              async (response) => {
                // Handle redirects (301, 302, 307, 308)
                if (
                  response.statusCode &&
                  [301, 302, 307, 308].includes(response.statusCode) &&
                  response.headers.location
                ) {
                  response.resume();
                  if (redirectCount >= 5) {
                    logger.error('bundle-download', 'Too many redirects (>5)');
                    this.isDownloading = false;
                    safeReject(new Error('Too many redirects'));
                    return;
                  }
                  const rawRedirectUrl = response.headers.location;
                  const resolvedRedirectUrl = new URL(
                    rawRedirectUrl,
                    url,
                  ).toString();
                  if (!resolvedRedirectUrl.startsWith('https://')) {
                    logger.error(
                      'bundle-download',
                      `Redirect to non-HTTPS URL rejected: ${resolvedRedirectUrl}`,
                    );
                    this.isDownloading = false;
                    safeReject(
                      new Error('Redirect to non-HTTPS URL is not allowed'),
                    );
                    return;
                  }
                  makeDownloadRequest(
                    resolvedRedirectUrl,
                    reqOptions,
                    redirectCount + 1,
                  );
                  return;
                }

                if (response.statusCode === 416) {
                  // Range not satisfiable, file might be complete
                  if (fs.existsSync(partialFilePath)) {
                    try {
                      fs.renameSync(partialFilePath, filePath);
                      await this.verifyAndResolve(filePath, sha256);
                      this.isDownloading = false;
                      safeResolve({
                        downloadedFile: filePath,
                        downloadUrl: bundleUrl,
                        latestVersion: appVersion,
                        bundleVersion,
                      });
                    } catch (error) {
                      this.isDownloading = false;
                      safeReject(
                        wrapDownloadError(error, 'Failed to finalize download'),
                      );
                    }
                    return;
                  }
                  logger.error(
                    'bundle-download',
                    'HTTP 416 with no partial file to resume',
                  );
                  this.isDownloading = false;
                  safeReject(new Error('HTTP 416'));
                  return;
                }

                if (
                  response.statusCode !== 200 &&
                  response.statusCode !== 206
                ) {
                  logger.error(
                    'bundle-download',
                    `Unexpected HTTP status: ${response.statusCode || 0}`,
                  );
                  this.isDownloading = false;
                  // Use the canonical "HTTP <code>" shape so
                  // extractUpdateErrorCode in hooks.tsx parses it as
                  // HTTP_<code> and can apply the unrecoverable-list
                  // (HTTP_403/404/410). Previously "Download failed with
                  // status: 404" did not match the regex, so 404s went
                  // through the retry-with-backoff loop pointlessly.
                  safeReject(new Error(`HTTP ${response.statusCode || 0}`));
                  return;
                }

                if (response.statusCode === 200) {
                  // Full download
                  totalBytes = parseInt(
                    response.headers['content-length'] || '0',
                    10,
                  );
                  downloadedBytes = 0;
                } else if (response.statusCode === 206) {
                  // Partial download
                  const contentRange = response.headers['content-range'];
                  if (contentRange) {
                    const match = contentRange.match(/bytes \d+-\d+\/(\d+)/);
                    if (match) {
                      totalBytes = parseInt(match[1], 10);
                    }
                  }
                }

                const writeStream = fs.createWriteStream(partialFilePath, {
                  flags: downloadedBytes > 0 ? 'a' : 'w',
                });

                // Handle download cancellation
                const cancelDownload = () => {
                  if (downloadRequest) {
                    this.isDownloading = false;
                    downloadRequest.destroy();
                    downloadRequest = null;
                  }
                  writeStream.destroy();
                  safeReject(new Error('Download cancelled'));
                };

                // Store cancel function for external access
                this.cancelCurrentDownload = cancelDownload;

                response.on('data', (chunk) => {
                  downloadedBytes += (chunk as Buffer).length;
                  writeStream.write(chunk);

                  // Emit progress
                  const percent =
                    totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;
                  this.getMainWindow()?.webContents.send(
                    ipcMessageKeys.UPDATE_DOWNLOADING,
                    {
                      percent,
                      transferred: downloadedBytes,
                      total: totalBytes,
                      bytesPerSecond: 0,
                      delta: (chunk as Buffer).length,
                    },
                  );
                  updateWindowProgressBar(this.getMainWindow(), percent);
                });

                response.on('end', () => {
                  writeStream.end();
                });

                writeStream.on('finish', async () => {
                  this.isDownloading = false;
                  logger.info(
                    'bundle-download-end',
                    downloadedBytes,
                    totalBytes,
                    partialFilePath,
                    filePath,
                  );
                  if (downloadedBytes >= totalBytes) {
                    try {
                      // Download complete, rename and verify
                      fs.renameSync(partialFilePath, filePath);
                      await this.verifyAndResolve(filePath, sha256);
                      safeResolve({
                        downloadedFile: filePath,
                        downloadUrl: bundleUrl,
                        latestVersion: appVersion,
                        bundleVersion,
                      });
                    } catch (error) {
                      safeReject(
                        wrapDownloadError(error, 'Failed to finalize download'),
                      );
                    }
                  } else {
                    logger.error(
                      'bundle-download',
                      `Download incomplete: ${downloadedBytes}/${totalBytes} bytes`,
                    );
                    safeReject(new Error('Download incomplete'));
                  }
                  clearWindowProgressBar(this.getMainWindow());
                });

                writeStream.on('error', (error) => {
                  logger.error('bundle-download writeStream error:', error);
                  if (downloadRequest) {
                    downloadRequest.destroy();
                    downloadRequest = null;
                  }
                  this.isDownloading = false;
                  this.cancelCurrentDownload = () => {};
                  safeReject(wrapDownloadError(error, 'Write stream error'));
                  clearWindowProgressBar(this.getMainWindow());
                });

                response.on('error', (error) => {
                  logger.error(
                    'bundle-download',
                    'Response stream error:',
                    error,
                  );
                  writeStream.destroy();
                  downloadRequest = null;
                  this.isDownloading = false;
                  this.cancelCurrentDownload = () => {};
                  safeReject(wrapDownloadError(error, 'Response stream error'));
                  clearWindowProgressBar(this.getMainWindow());
                });
              },
            );

            downloadRequest.on('error', (error) => {
              logger.error('bundle-download', 'Request error:', error);
              downloadRequest = null;
              this.cancelCurrentDownload = null;
              this.isDownloading = false;
              safeReject(wrapDownloadError(error, 'Request error'));
            });

            downloadRequest.setTimeout(1000 * 60 * 30, () => {
              logger.error('bundle-download', 'Download timed out (30min)');
              if (downloadRequest) {
                downloadRequest.destroy();
                downloadRequest = null;
              }
              this.isDownloading = false;
              this.cancelCurrentDownload = null;
              safeReject(new Error('Download timeout'));
            });
          };

          makeDownloadRequest(bundleUrl, options);
        } catch (setupError) {
          logger.error('bundle-download', 'Setup error:', setupError);
          safeReject(wrapDownloadError(setupError, 'Download setup error'));
          clearWindowProgressBar(this.getMainWindow());
        }
      }, 0);
    });
  }

  getBundleBuildPath({
    appVersion,
    bundleVersion,
  }: {
    appVersion: string;
    bundleVersion: string;
  }) {
    const bundleDir = getBundleDirName();
    return path.join(bundleDir, `${appVersion}-${bundleVersion}`, 'build');
  }

  getMetadataFilePath({
    appVersion,
    bundleVersion,
  }: {
    appVersion: string;
    bundleVersion: string;
  }) {
    const bundleDir = getBundleDirName();
    return path.join(
      bundleDir,
      `${appVersion}-${bundleVersion}`,
      'metadata.json',
    );
  }

  async verifyBundle(params: IUpdateDownloadedEvent) {
    const {
      downloadedFile,
      sha256,
      latestVersion: appVersion,
      bundleVersion,
      signature,
      skipGPGVerification,
    } = params || {};
    const allowSkipGPG = this.isSkipGPGAllowed(skipGPGVerification);
    if (
      !downloadedFile ||
      !sha256 ||
      !appVersion ||
      !bundleVersion ||
      (!signature && !allowSkipGPG)
    ) {
      throw new OneKeyLocalError('Invalid parameters');
    }
    if (!allowSkipGPG) {
      await verifyMetadataFileSha256({
        appVersion,
        bundleVersion,
        signature: signature!,
      });
    }
  }

  /**
   * Verify the bundle using ASC (Apple Software Certificate) signature
   * This method validates the digital signature of the downloaded bundle
   * to ensure it comes from a trusted source and hasn't been tampered with
   *
   * @param params - Bundle downloaded event containing file path and signature info
   * @returns Promise that resolves when verification is complete
   */
  async downloadBundleASC(params: IUpdateDownloadedEvent) {
    const {
      downloadedFile,
      sha256,
      latestVersion: appVersion,
      bundleVersion,
      signature,
      skipGPGVerification,
    } = params || {};
    const allowSkipGPG = this.isSkipGPGAllowed(skipGPGVerification);
    if (
      !downloadedFile ||
      !sha256 ||
      !appVersion ||
      !bundleVersion ||
      (!signature && !allowSkipGPG)
    ) {
      throw new OneKeyLocalError('Invalid parameters');
    }
  }

  async verifyBundleASC(params: IUpdateDownloadedEvent) {
    const {
      downloadedFile,
      sha256,
      latestVersion: appVersion,
      bundleVersion,
      signature,
      skipGPGVerification,
    } = params || {};
    const allowSkipGPG = this.isSkipGPGAllowed(skipGPGVerification);
    if (
      !downloadedFile ||
      !sha256 ||
      !appVersion ||
      !bundleVersion ||
      (!signature && !allowSkipGPG)
    ) {
      logger.error('bundle-verifyASC', 'Invalid parameters', {
        downloadedFile,
        sha256,
        appVersion,
        bundleVersion,
        hasSignature: !!signature,
        skipGPGVerification,
        allowSkipGPG,
      });
      throw new OneKeyLocalError('Invalid parameters');
    }
    if (!allowSkipGPG) {
      const isBundleVerified = verifySha256(downloadedFile, sha256);
      if (!isBundleVerified) {
        // Promote the SHA256 subtype (FILE_NOT_FOUND / IO_<errno> /
        // OOM / MISMATCH) into the thrown message so JS-side
        // extractUpdateErrorCode splits this verifyASC bucket the same
        // way the download stage does.
        const reason = lastSHA256FailureReason() ?? 'MISMATCH';
        logger.error(
          'bundle-verifyASC',
          `SHA256 verification failed (reason=${reason})`,
        );
        throw new OneKeyLocalError(
          `Bundle SHA256 verification failed: ${reason}`,
        );
      }
    }
    const extractDir = getBundleExtractDir({
      appVersion,
      bundleVersion,
    });

    try {
      const zip = new AdmZip(downloadedFile);
      const resolvedExtractDir = path.resolve(extractDir);
      // Validate all zip entries for path traversal before extraction
      for (const entry of zip.getEntries()) {
        const entryPath = path.resolve(resolvedExtractDir, entry.entryName);
        if (
          !entryPath.startsWith(resolvedExtractDir + path.sep) &&
          entryPath !== resolvedExtractDir
        ) {
          logger.error(
            'bundle-verifyASC',
            `Path traversal detected in zip entry: ${entry.entryName}`,
          );
          throw new OneKeyLocalError(
            `Path traversal detected in zip entry: ${entry.entryName}`,
          );
        }
      }
      zip.extractAllTo(extractDir, true);
    } catch (error) {
      logger.error('Failed to extract bundle zip file:', error);
      // Cleanup partially extracted directory
      if (fs.existsSync(extractDir)) {
        fs.rmSync(extractDir, { recursive: true, force: true });
      }
      throw error;
    }

    try {
      const metadataFilePath = this.getMetadataFilePath({
        appVersion,
        bundleVersion,
      });
      logger.info('bundle-verifyBundleASC', metadataFilePath, allowSkipGPG);
      if (!allowSkipGPG) {
        await verifyMetadataFileSha256({
          appVersion,
          bundleVersion,
          signature: signature!,
        });
      }

      // Verify all extracted files against metadata SHA256 hashes
      if (!fs.existsSync(metadataFilePath)) {
        throw new OneKeyLocalError('metadata.json not found after extraction');
      }
      const metadataContent = fs.readFileSync(metadataFilePath, 'utf8');
      const metadata = JSON.parse(metadataContent) as Record<string, string>;
      this.verifyAllExtractedFiles(extractDir, metadata, extractDir);
    } catch (error) {
      // Cleanup extracted directory on verification failure
      if (fs.existsSync(extractDir)) {
        fs.rmSync(extractDir, { recursive: true, force: true });
      }
      throw error;
    }
  }

  private verifyAllExtractedFiles(
    dirPath: string,
    metadata: Record<string, string>,
    baseDir: string,
  ) {
    const verifiedFiles = new Set<string>();
    this.walkAndVerifyFiles(dirPath, metadata, baseDir, verifiedFiles);

    // Security: Verify completeness — every file in metadata must exist on disk
    const metadataKeys = Object.keys(metadata);
    for (const key of metadataKeys) {
      if (!verifiedFiles.has(key)) {
        logger.error(
          'bundle-verify',
          `File listed in metadata but missing on disk: ${key}`,
        );
        throw new OneKeyLocalError(
          `File ${key} listed in metadata but missing on disk`,
        );
      }
    }
  }

  private walkAndVerifyFiles(
    dirPath: string,
    metadata: Record<string, string>,
    baseDir: string,
    verifiedFiles: Set<string>,
  ) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      // Security: Reject symbolic links to prevent symlink attacks
      if (entry.isSymbolicLink()) {
        logger.error('bundle-verify', `Symbolic link detected: ${entry.name}`);
        throw new OneKeyLocalError(`Symbolic link detected: ${entry.name}`);
      }
      if (entry.isDirectory()) {
        this.walkAndVerifyFiles(fullPath, metadata, baseDir, verifiedFiles);
      } else if (entry.name !== 'metadata.json' && entry.name !== '.DS_Store') {
        // Strict contract: only files under "build/" are allowed to be hashed
        // by metadata. Any extra root-level file is treated as verification failure.
        const relativePath = path
          .relative(path.join(baseDir, 'build'), fullPath)
          .split(path.sep)
          .join('/');
        const expectedSha512 = metadata[relativePath];
        if (!expectedSha512) {
          logger.error(
            'bundle-verify',
            `File on disk not found in metadata: ${relativePath}`,
          );
          throw new OneKeyLocalError(
            `File ${relativePath} not found in metadata`,
          );
        }
        const isSha512Matched = checkFileSha512(fullPath, expectedSha512);
        if (!isSha512Matched) {
          logger.error('bundle-verify', `SHA512 mismatch for ${relativePath}`);
          throw new OneKeyLocalError(
            `SHA512 mismatch for file ${relativePath}`,
          );
        }
        verifiedFiles.add(relativePath);
      }
    }
  }

  async isBundleExists(
    appVersion: string,
    bundleVersion: string,
  ): Promise<boolean> {
    const extractDir = getBundleExtractDir({ appVersion, bundleVersion });
    return fs.existsSync(extractDir);
  }

  async listLocalBundles(): Promise<
    { appVersion: string; bundleVersion: string }[]
  > {
    const bundleDir = getBundleDirName();
    if (!fs.existsSync(bundleDir)) {
      return [];
    }
    const entries = fs.readdirSync(bundleDir, { withFileTypes: true });
    const results: { appVersion: string; bundleVersion: string }[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const lastDash = entry.name.lastIndexOf('-');
        if (lastDash > 0) {
          const appVersion = entry.name.substring(0, lastDash);
          const bundleVersion = entry.name.substring(lastDash + 1);
          if (appVersion && bundleVersion) {
            results.push({ appVersion, bundleVersion });
          }
        }
      }
    }
    return results;
  }

  // Parse "{appVersion}-{bundleVersion}" using the IDENTICAL convention as
  // listLocalBundles(): split on the LAST dash so semver appVersions that
  // themselves contain dashes (e.g. "6.4.0-beta") stay intact and behavior
  // matches the rest of the codebase.
  private parseAppVersionFromName(name: string): string | null {
    // Strip the known download-artifact suffixes so the same parser works for
    // both extract dir names and download file names.
    let base = name;
    for (const suffix of ['.progress.json', '.partial', '.zip'] as const) {
      if (base.endsWith(suffix)) {
        base = base.slice(0, -suffix.length);
      }
    }
    const lastDash = base.lastIndexOf('-');
    if (lastDash <= 0) {
      return null;
    }
    const appVersion = base.substring(0, lastDash);
    const bundleVersion = base.substring(lastDash + 1);
    if (!appVersion || !bundleVersion) {
      return null;
    }
    return appVersion;
  }

  /**
   * Prune downloaded OTA artifacts whose appVersion != the running native
   * binary version (app.getVersion()). KEEP everything matching the current
   * appVersion (current + same-version fallbacks + pending install — OTA never
   * crosses native version). Cleans:
   *   - onekey-bundle/{appV}-{bV}/                         (extract dirs)
   *   - onekey-bundle-download/{appV}-{bV}.zip(.partial)(.progress.json)
   *   - store fallback entries with appV != currentAppV   (disk<->store sync)
   *
   * Safety net: never deletes the current appVersion's artifacts, and never
   * the active currentBundleVersion from getUpdateBundleData(). Tolerates
   * already-missing files (fs.rmSync force:true).
   *
   * @returns count of deleted version directories.
   */
  async pruneStaleAppVersionBundles(): Promise<number> {
    const currentAppV = app.getVersion();
    // The active install — its dir must survive even if it somehow shared an
    // appVersion mismatch (defense in depth; it will normally match currentAppV).
    const activeBundleData = store.getUpdateBundleData();
    const activeAppV = activeBundleData?.appVersion;
    const activeBundleV = activeBundleData?.bundleVersion;

    let deletedDirCount = 0;

    // 1) Extract dirs: onekey-bundle/{appV}-{bV}/
    const bundleDir = getBundleDirName();
    if (fs.existsSync(bundleDir)) {
      const entries = fs.readdirSync(bundleDir, { withFileTypes: true });
      for (const entry of entries) {
        const appV = entry.isDirectory()
          ? this.parseAppVersionFromName(entry.name)
          : null;
        // Safety net: keep current appVersion AND the active install dir.
        const isActiveInstall = Boolean(
          activeAppV &&
          activeBundleV &&
          entry.name === `${activeAppV}-${activeBundleV}`,
        );
        if (appV && appV !== currentAppV && !isActiveInstall) {
          const dirPath = path.join(bundleDir, entry.name);
          try {
            fs.rmSync(dirPath, { recursive: true, force: true });
            deletedDirCount += 1;
            logger.info(
              'bundle-prune',
              `Deleted stale extract dir: ${entry.name}`,
            );
          } catch (error) {
            logger.error(
              'bundle-prune',
              `Failed to delete stale extract dir ${entry.name}:`,
              error,
            );
          }
        }
      }
    }

    // 2) Download artifacts: onekey-bundle-download/{appV}-{bV}.zip(.partial)(.progress.json)
    const downloadDir = this.getDownloadDir();
    if (fs.existsSync(downloadDir)) {
      const downloadEntries = fs.readdirSync(downloadDir, {
        withFileTypes: true,
      });
      for (const entry of downloadEntries) {
        const appV = entry.isFile()
          ? this.parseAppVersionFromName(entry.name)
          : null;
        // Safety net: never delete current appVersion's download artifacts.
        if (appV && appV !== currentAppV) {
          const filePath = path.join(downloadDir, entry.name);
          try {
            fs.rmSync(filePath, { force: true });
            logger.info(
              'bundle-prune',
              `Deleted stale download artifact: ${entry.name}`,
            );
          } catch (error) {
            logger.error(
              'bundle-prune',
              `Failed to delete stale download artifact ${entry.name}:`,
              error,
            );
          }
        }
      }
    }

    // 3) Store fallback entries: drop appVersion != currentAppV so the store
    // stays consistent with disk (no ghost dev-switcher entries, no orphan asc
    // bookkeeping). Keeps the current appVersion's fallbacks untouched.
    try {
      const fallbackUpdateBundleData = store.getFallbackUpdateBundleData();
      const keptFallback = fallbackUpdateBundleData.filter(
        (item) => item?.appVersion === currentAppV,
      );
      if (keptFallback.length !== fallbackUpdateBundleData.length) {
        store.setFallbackUpdateBundleData(keptFallback);
        logger.info(
          'bundle-prune',
          `Pruned ${
            fallbackUpdateBundleData.length - keptFallback.length
          } stale fallback entries`,
        );
      }
    } catch (error) {
      logger.error(
        'bundle-prune',
        'Failed to prune fallback store data:',
        error,
      );
    }

    logger.info(
      'bundle-prune',
      `pruneStaleAppVersionBundles done, currentAppV=${currentAppV}, deletedDirCount=${deletedDirCount}`,
    );
    return deletedDirCount;
  }

  async verifyExtractedBundle(
    appVersion: string,
    bundleVersion: string,
  ): Promise<void> {
    const extractDir = getBundleExtractDir({ appVersion, bundleVersion });
    if (!fs.existsSync(extractDir)) {
      logger.error(
        'bundle-verify',
        `verifyExtractedBundle: directory not found: ${extractDir}`,
      );
      throw new OneKeyLocalError('Bundle directory not found');
    }
    const metadataFilePath = path.join(extractDir, 'metadata.json');
    if (!fs.existsSync(metadataFilePath)) {
      logger.error(
        'bundle-verify',
        `verifyExtractedBundle: metadata.json not found in ${extractDir}`,
      );
      throw new OneKeyLocalError('metadata.json not found');
    }
    const metadataContent = fs.readFileSync(metadataFilePath, 'utf8');
    const metadata = JSON.parse(metadataContent) as Record<string, string>;
    this.verifyAllExtractedFiles(extractDir, metadata, extractDir);
  }

  async installBundle(params: IUpdateDownloadedEvent) {
    const {
      latestVersion: appVersion,
      bundleVersion,
      signature,
      skipGPGVerification,
    } = params || {};
    const allowSkipGPG = this.isSkipGPGAllowed(skipGPGVerification);
    if (!appVersion || !bundleVersion || (!signature && !allowSkipGPG)) {
      logger.error('bundle-install', 'Invalid parameters', {
        appVersion,
        bundleVersion,
        hasSignature: !!signature,
        allowSkipGPG,
      });
      throw new OneKeyLocalError('Invalid parameters');
    }
    const currentUpdateBundleData = store.getUpdateBundleData();

    // Security: Verify bundle directory exists before updating store
    const extractDir = getBundleExtractDir({ appVersion, bundleVersion });
    if (!fs.existsSync(extractDir)) {
      logger.error(
        'bundle-install',
        `Bundle directory not found: ${appVersion}-${bundleVersion}`,
      );
      throw new OneKeyLocalError(
        `Bundle directory not found: ${appVersion}-${bundleVersion}`,
      );
    }

    store.setUpdateBundleData({
      appVersion,
      bundleVersion,
      signature: signature ?? '',
    });
    logger.info('installBundle', {
      appVersion,
      bundleVersion,
      signature,
    });
    store.setNativeVersion(app.getVersion());
    const buildNumber = process.env.BUILD_NUMBER ?? '';
    store.setNativeBuildNumber(buildNumber);
    logger.info('installBundle setNativeVersion', {
      nativeVersion: app.getVersion(),
      buildNumber,
    });
    const fallbackUpdateBundleData = store.getFallbackUpdateBundleData();
    if (
      currentUpdateBundleData &&
      currentUpdateBundleData.appVersion &&
      currentUpdateBundleData.bundleVersion &&
      currentUpdateBundleData.signature
    ) {
      fallbackUpdateBundleData.push(currentUpdateBundleData);
    }

    if (fallbackUpdateBundleData.length > 3) {
      const shiftUpdateBundleData = fallbackUpdateBundleData.shift();
      if (shiftUpdateBundleData) {
        const dirName = `${shiftUpdateBundleData.appVersion}-${shiftUpdateBundleData.bundleVersion}`;
        const bundleDir = getBundleDirName();
        const bundleDirPath = path.join(bundleDir, dirName);
        if (fs.existsSync(bundleDirPath)) {
          fs.rmSync(bundleDirPath, { recursive: true, force: true });
        }
      }
    }
    logger.info('fallbackUpdateBundleData', fallbackUpdateBundleData);
    store.setFallbackUpdateBundleData(fallbackUpdateBundleData);
    // Destroy window first to ensure renderer process is fully terminated
    // before relaunch, preventing webview custom element double registration
    this.getMainWindow()?.destroy();
    if (!process.mas) {
      app.relaunch();
    }
    app.exit(0);
  }

  async clearDownload() {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        this.cancelCurrentDownload?.();
        const downloadDir = this.getDownloadDir();
        fs.rmSync(downloadDir, { recursive: true, force: true });
        resolve();
      }, 100);
    });
  }

  async getFallbackUpdateBundleData() {
    return store.getFallbackUpdateBundleData();
  }

  async setCurrentUpdateBundleData(
    updateBundleData: IDesktopStoreUpdateBundleData,
  ) {
    store.setUpdateBundleData(updateBundleData);
    if (updateBundleData.appVersion && updateBundleData.bundleVersion) {
      // Destroy window first to ensure renderer process is fully terminated
      // before relaunch, preventing webview custom element double registration
      this.getMainWindow()?.destroy();
      if (!process.mas) {
        app.relaunch();
      }
      app.exit(0);
    }
  }

  async clearBundleExtract() {
    const bundleDir = getBundleDirName();
    try {
      fs.rmSync(bundleDir, { recursive: true, force: true });
    } catch (error) {
      logger.error('Failed to clear bundle extract:', error);
    }
  }

  async clearBundle() {
    await this.clearDownload();
    await this.clearBundleExtract();
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 300);
    });
  }

  async resetToBuiltInBundle() {
    store.clearUpdateBundleData();
    logger.info(
      'resetToBuiltInBundle: cleared update bundle data, app will use built-in bundle on next restart',
    );
  }

  async restart() {
    this.getMainWindow()?.destroy();
    if (!process.mas) {
      app.relaunch();
    }
    app.exit(0);
  }

  async clearAllJSBundleData() {
    await this.clearDownload();
    await this.clearBundleExtract();
    store.clearUpdateBundleData();
    return new Promise<{ success: boolean; message: string }>((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          message: 'Successfully cleared all JS bundle data',
        });
      }, 300);
    });
  }

  async testVerification() {
    return testExtractedSha256FromVerifyAscFile();
  }

  async testSkipVerification() {
    const skipGPGVerification = true;
    return Promise.resolve(this.isSkipGPGAllowed(skipGPGVerification));
  }

  async isSkipGpgVerificationAllowed() {
    return Promise.resolve(
      process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION === 'true',
    );
  }

  /**
   * Test function to delete jsBundle files
   * @param appVersion - Application version
   * @param bundleVersion - Bundle version
   */
  async testDeleteJsBundle(appVersion: string, bundleVersion: string) {
    try {
      const bundleDir = getBundleExtractDir({ appVersion, bundleVersion });
      const mainIndexHtmlPath = path.join(bundleDir, 'index.html');

      if (fs.existsSync(mainIndexHtmlPath)) {
        fs.unlinkSync(mainIndexHtmlPath);
        logger.info(
          'testDeleteJsBundle',
          `Deleted jsBundle: ${mainIndexHtmlPath}`,
        );
        return {
          success: true,
          message: `Deleted jsBundle: ${mainIndexHtmlPath}`,
        };
      }
      logger.info(
        'testDeleteJsBundle',
        `jsBundle not found: ${mainIndexHtmlPath}`,
      );
      return {
        success: false,
        message: `jsBundle not found: ${mainIndexHtmlPath}`,
      };
    } catch (error) {
      logger.error(
        'testDeleteJsBundle',
        `Error deleting jsBundle: ${(error as Error).message}`,
      );
      throw new OneKeyLocalError(
        `Failed to delete jsBundle: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Test function to delete js runtime directory
   * @param appVersion - Application version
   * @param bundleVersion - Bundle version
   */
  async testDeleteJsRuntimeDir(appVersion: string, bundleVersion: string) {
    try {
      const bundleDir = getBundleExtractDir({ appVersion, bundleVersion });

      if (fs.existsSync(bundleDir)) {
        fs.rmSync(bundleDir, { recursive: true, force: true });
        logger.info(
          'testDeleteJsRuntimeDir',
          `Deleted js runtime directory: ${bundleDir}`,
        );
        return {
          success: true,
          message: `Deleted js runtime directory: ${bundleDir}`,
        };
      }
      logger.info(
        'testDeleteJsRuntimeDir',
        `js runtime directory not found: ${bundleDir}`,
      );
      return {
        success: false,
        message: `js runtime directory not found: ${bundleDir}`,
      };
    } catch (error) {
      logger.error(
        'testDeleteJsRuntimeDir',
        `Error deleting js runtime directory: ${(error as Error).message}`,
      );
      throw new OneKeyLocalError(
        `Failed to delete js runtime directory: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Test function to delete metadata.json file
   * @param appVersion - Application version
   * @param bundleVersion - Bundle version
   */
  async testDeleteMetadataJson(appVersion: string, bundleVersion: string) {
    try {
      const metadataFilePath = this.getMetadataFilePath({
        appVersion,
        bundleVersion,
      });

      if (fs.existsSync(metadataFilePath)) {
        fs.unlinkSync(metadataFilePath);
        logger.info(
          'testDeleteMetadataJson',
          `Deleted metadata.json: ${metadataFilePath}`,
        );
        return {
          success: true,
          message: `Deleted metadata.json: ${metadataFilePath}`,
        };
      }
      logger.info(
        'testDeleteMetadataJson',
        `metadata.json not found: ${metadataFilePath}`,
      );
      return {
        success: false,
        message: `metadata.json not found: ${metadataFilePath}`,
      };
    } catch (error) {
      logger.error(
        'testDeleteMetadataJson',
        `Error deleting metadata.json: ${(error as Error).message}`,
      );
      throw new OneKeyLocalError(
        `Failed to delete metadata.json: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Test function to write empty metadata.json file
   * @param appVersion - Application version
   * @param bundleVersion - Bundle version
   */
  async testWriteEmptyMetadataJson(appVersion: string, bundleVersion: string) {
    try {
      const bundleDir = getBundleExtractDir({ appVersion, bundleVersion });
      const metadataFilePath = path.join(bundleDir, 'metadata.json');

      // Ensure directory exists
      if (!fs.existsSync(bundleDir)) {
        fs.mkdirSync(bundleDir, { recursive: true });
      }

      // Write empty metadata.json
      const emptyMetadata = {};
      fs.writeFileSync(
        metadataFilePath,
        JSON.stringify(emptyMetadata, null, 2),
      );

      logger.info(
        'testWriteEmptyMetadataJson',
        `Created empty metadata.json: ${metadataFilePath}`,
      );
      return {
        success: true,
        message: `Created empty metadata.json: ${metadataFilePath}`,
      };
    } catch (error) {
      logger.error(
        'testWriteEmptyMetadataJson',
        `Error writing empty metadata.json: ${(error as Error).message}`,
      );
      throw new OneKeyLocalError(
        `Failed to write empty metadata.json: ${(error as Error).message}`,
      );
    }
  }

  async getNativeAppVersion() {
    return app.getVersion();
  }

  async getNativeBuildNumber(): Promise<string> {
    const buildNumber = process.env.BUILD_NUMBER;
    return typeof buildNumber === 'string' ? buildNumber : '';
  }

  async getBuiltinBundleVersion(): Promise<string> {
    const bundleVersion = process.env.BUNDLE_VERSION;
    return typeof bundleVersion === 'string' ? bundleVersion : '';
  }

  async getJsBundlePath() {
    return (
      globalThis.$desktopMainAppFunctions?.getBundleIndexHtmlPath?.() || ''
    );
  }

  async getSha256FromFilePath(filePath: string) {
    return calculateSHA256(filePath);
  }
}

export default DesktopApiAppBundleUpdate;
