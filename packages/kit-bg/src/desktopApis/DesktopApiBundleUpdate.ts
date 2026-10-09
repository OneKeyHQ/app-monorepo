import fs from 'fs';
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

import { requestUpdateUrl } from './electronUpdateRequest';
import { downloadNodeFile } from './nodeDownload';

import type { IDesktopApi } from './base/types';
import type { BrowserWindow } from 'electron';

export interface IUpdateProgressUpdate {
  percent: number;
  delta: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

// Retained exports for callers that classify HTTP failures and retry delays.
const BUNDLE_RETRY_BASE_DELAY_MS = 500;
const BUNDLE_RETRY_MAX_DELAY_MS = 1000 * 10;

// OCDS §4 failure classification. Every non-2xx HTTP status resolves to exactly
// one of two classes with opposite recoveries: a Permanent failure means the
// concurrent path is unusable for this object (fall back / give up), a
// Transient failure means retry-in-place keeping artifacts. The mapping follows
// the §4 default rule exactly:
//   4xx → permanent, EXCEPT 408 / 429 → transient
//   5xx → transient, EXCEPT 501 / 505 → permanent
//   anything else / unknown → permanent
// NOTE: this set must stay in agreement with the shared-JS
// UNRECOVERABLE_DOWNLOAD_ERROR_CODES taxonomy
// (packages/kit/src/components/AppUpdate/updateErrorTaxonomy.ts). kit-bg must
// not import from kit at runtime, so the relationship is duplicated here; the
// test imports the real shared set and asserts the two stay in agreement.
// Exported so the test exercises the shipped code, not a re-implemented copy.
export function classifyHttpStatus(status: number): 'permanent' | 'transient' {
  if (status >= 400 && status <= 499) {
    // 408 (request timeout) and 429 (throttled) are retryable. 416
    // (range-not-satisfiable on a resume request) is Transient too: the size
    // must be re-evaluated and the request re-issued — a bare 416 must NEVER
    // discard the resumable bytes already on disk (OCDS §4).
    if (status === 408 || status === 416 || status === 429) return 'transient';
    return 'permanent';
  }
  if (status >= 500 && status <= 599) {
    if (status === 501 || status === 505) return 'permanent';
    return 'transient';
  }
  // Unknown / unexpected (e.g. a stray 3xx that was not a redirect, or 0) is
  // classified Permanent so the "exactly one of two classes" property holds.
  return 'permanent';
}

// OCDS §5.4 backoff with jitter. Exponential growth capped at
// BUNDLE_RETRY_MAX_DELAY_MS, then up to ±50% jitter so concurrent segments do
// not retry in lockstep.
export function computeBackoffMs(retry: number): number {
  const base = Math.min(
    BUNDLE_RETRY_BASE_DELAY_MS * 2 ** retry,
    BUNDLE_RETRY_MAX_DELAY_MS,
  );
  const jitter = base * (Math.random() - 0.5);
  return Math.max(0, Math.round(base + jitter));
}

// OCDS §5.4: a `Retry-After` header (delta-seconds or an HTTP-date) overrides
// the computed backoff. Returns null when absent/unparseable so the caller
// falls back to computeBackoffMs.
export function retryAfterMsFromHeader(
  header: string | string[] | undefined,
): number | null {
  if (!header) return null;
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const dateMs = Date.parse(raw);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return null;
}

// OCDS §5.5 Content-Range validation for a segment 206 response. The probe
// (§5.1) already accepts only `bytes <start>-<end>/<total>` with a concrete
// numeric total, so a segment body is accepted only when its window matches the
// requested range exactly and its total agrees with the probe total. A `*`
// total, a multi-range/multipart body, or any disagreement is rejected.
export function validateSegmentContentRange(opts: {
  contentRange: string | string[] | undefined;
  contentType: string | string[] | undefined;
  rangeStart: number;
  rangeEnd: number;
  expectedTotal: number;
}): { ok: true } | { ok: false; reason: string } {
  const { contentRange, contentType, rangeStart, rangeEnd, expectedTotal } =
    opts;
  const type = (
    Array.isArray(contentType) ? contentType[0] : (contentType ?? '')
  ).toLowerCase();
  if (type.includes('multipart/byteranges')) {
    return { ok: false, reason: 'multipart/byteranges body' };
  }
  const rangeHeader = Array.isArray(contentRange)
    ? contentRange[0]
    : contentRange;
  if (typeof rangeHeader !== 'string') {
    return { ok: false, reason: 'missing content-range' };
  }
  const match = rangeHeader.match(/^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/i);
  if (!match) {
    return { ok: false, reason: `unparseable content-range "${rangeHeader}"` };
  }
  const start = parseInt(match[1], 10);
  const end = parseInt(match[2], 10);
  const totalRaw = match[3];
  if (totalRaw === '*') {
    return { ok: false, reason: 'unknown (*) content-range total' };
  }
  const total = parseInt(totalRaw, 10);
  if (start !== rangeStart || end !== rangeEnd) {
    return {
      ok: false,
      reason: `content-range window ${start}-${end} != requested ${rangeStart}-${rangeEnd}`,
    };
  }
  if (total !== expectedTotal) {
    return {
      ok: false,
      reason: `content-range total ${total} != probe total ${expectedTotal}`,
    };
  }
  return { ok: true };
}

// OCDS §5.6 single-stream resume guard: parse only the *start* of a 206
// Content-Range so we can confirm the server resumed at exactly the offset we
// asked for before appending. Returns null when absent/unparseable.
export function contentRangeStart(
  contentRange: string | string[] | undefined,
): number | null {
  const raw = Array.isArray(contentRange) ? contentRange[0] : contentRange;
  if (typeof raw !== 'string') return null;
  const match = raw.match(/^bytes\s+(\d+)-/i);
  if (!match) return null;
  const start = parseInt(match[1], 10);
  return Number.isFinite(start) ? start : null;
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

  get isDownloading(): boolean {
    return this.cancelByDest.size > 0;
  }

  // OCDS §5.8 per-destination single-flight. Keyed on the destination zip path:
  // a second download() for the same dest JOINS the in-flight run (returns the
  // same promise) rather than co-writing the same artifacts; different-dest
  // runs proceed independently. The entry is always deleted on settle (finally)
  // so a crashed/rejected run never permanently wedges a destination — the
  // in-memory map is the reclaimable lock (the process restarting clears it
  // entirely, which is the desktop equivalent of stale-lock recovery).
  private inflightDownloads = new Map<
    string,
    Promise<IUpdateDownloadedEvent>
  >();

  // OCDS §5.8: cancellation wired per-destination so cancelling one dest does
  // not tear down an unrelated concurrent run.
  private cancelByDest = new Map<string, () => void>();

  private cacheClearPromise: Promise<void> | undefined;

  private isSkipGPGAllowed(skipGPGVerification?: boolean) {
    return (
      process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION === 'true' &&
      Boolean(skipGPGVerification)
    );
  }

  constructor({
    desktopApi,
  }: {
    desktopApi: IDesktopApi;
    stallTimeoutMs?: number;
  }) {
    this.desktopApi = desktopApi;
  }

  private getMainWindow(): BrowserWindow | undefined {
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

  // The destination zip path for a (appVersion, bundleVersion) pair.
  private getDestZipPath(params: IDownloadPackageParams): string | null {
    const { latestVersion: appVersion, bundleVersion } = params;
    if (!appVersion || !bundleVersion) return null;
    return path.join(
      this.getDownloadDir(),
      `${appVersion}-${bundleVersion}.zip`,
    );
  }

  // Public entry point. OCDS §5.8 per-destination single-flight: a second
  // download() for the same destination JOINS the in-flight run instead of
  // co-writing the same artifacts; a different destination proceeds
  // independently. The map entry is removed on settle so a crashed/rejected run
  // never wedges the destination (in-memory map = reclaimable lock).
  async downloadBundle(
    params: IDownloadPackageParams,
  ): Promise<IUpdateDownloadedEvent> {
    while (this.cacheClearPromise) await this.cacheClearPromise;
    const destKey = this.getDestZipPath(params);
    // No usable key (missing version params): skip single-flight bookkeeping
    // and let the downstream validation produce the canonical error.
    if (!destKey) {
      return this.runDownloadBundle(params);
    }
    const existing = this.inflightDownloads.get(destKey);
    if (existing) {
      logger.info(
        'bundle-download',
        'Joining in-flight download for same destination',
      );
      return existing;
    }
    const run = this.runDownloadBundle(params).finally(() => {
      this.inflightDownloads.delete(destKey);
      this.cancelByDest.delete(destKey);
    });
    this.inflightDownloads.set(destKey, run);
    return run;
  }

  // The shared downloader owns range selection, resume, and integrity checks.
  private async runDownloadBundle(
    params: IDownloadPackageParams,
  ): Promise<IUpdateDownloadedEvent> {
    const {
      latestVersion,
      bundleVersion,
      downloadUrl,
      sha256,
      fileSize,
      headers,
    } = params;
    if (!latestVersion || !bundleVersion || !downloadUrl || !sha256) {
      throw new OneKeyLocalError('Invalid parameters');
    }
    const filePath = this.getDestZipPath(params);
    if (!filePath) throw new OneKeyLocalError('Invalid parameters');
    const controller = new AbortController();
    const cancel = () => controller.abort();
    this.cancelByDest.set(filePath, cancel);
    if (this.cancelByDest.size === 1)
      clearWindowProgressBar(this.getMainWindow());
    try {
      await downloadNodeFile({
        url: downloadUrl,
        targetPath: filePath,
        identity: `bundle:${latestVersion}:${bundleVersion}:${downloadUrl}:${sha256}`,
        headers,
        expectedBytes:
          typeof fileSize === 'number' &&
          Number.isSafeInteger(fileSize) &&
          fileSize > 0
            ? fileSize
            : undefined,
        expectedSha256: sha256,
        transport: requestUpdateUrl,
        signal: controller.signal,
        onProgress: (progress) => {
          this.getMainWindow()?.webContents.send(
            ipcMessageKeys.UPDATE_DOWNLOADING,
            { ...progress, latestVersion, bundleVersion },
          );
          updateWindowProgressBar(this.getMainWindow(), progress.percent);
        },
      });
      return {
        downloadedFile: filePath,
        downloadUrl,
        latestVersion,
        bundleVersion,
      };
    } catch (error) {
      if (
        error instanceof OneKeyLocalError &&
        error.message === 'Downloaded file checksum mismatch'
      ) {
        throw new OneKeyLocalError(
          'Downloaded file is not valid: SHA256_MISMATCH',
        );
      }
      throw wrapDownloadError(error, 'Bundle download failed');
    } finally {
      this.cancelByDest.delete(filePath);
      if (!this.isDownloading) clearWindowProgressBar(this.getMainWindow());
    }
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
    await this.restartAppForBundleUpdate();
  }

  async clearDownload() {
    if (this.cacheClearPromise) return this.cacheClearPromise;
    // Publish the barrier before cancellation callbacks can start another run.
    const clear = Promise.resolve()
      .then(async () => {
        for (const cancel of this.cancelByDest.values()) cancel();
        await Promise.allSettled(this.inflightDownloads.values());
        fs.rmSync(this.getDownloadDir(), { recursive: true, force: true });
      })
      .finally(() => {
        if (this.cacheClearPromise === clear)
          this.cacheClearPromise = undefined;
      });
    this.cacheClearPromise = clear;
    return clear;
  }

  async getFallbackUpdateBundleData() {
    return store.getFallbackUpdateBundleData();
  }

  async setCurrentUpdateBundleData(
    updateBundleData: IDesktopStoreUpdateBundleData,
  ) {
    store.setUpdateBundleData(updateBundleData);
    if (updateBundleData.appVersion && updateBundleData.bundleVersion) {
      await this.restartAppForBundleUpdate();
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

  // Single choke point for "restart the app to load the just-written bundle".
  // The active bundle pointer (store.setUpdateBundleData) must already be
  // written before calling this.
  // - Normal builds: hard restart (destroy renderer + relaunch process).
  // - MAS / Mac App Store builds: app.relaunch() is forbidden by the sandbox,
  //   so we soft-restart — destroy + recreate the renderer in-process. The
  //   main process (which hosts all kit-bg desktopApis and the bundle store)
  //   stays alive, and createMainWindow() re-reads the new bundle pointer.
  async restartAppForBundleUpdate() {
    const bundleData = store.getUpdateBundleData();
    logger.info('bundle-restart', {
      mode: process.mas ? 'soft' : 'hard',
      mas: process.mas,
      appVersion: bundleData?.appVersion,
      bundleVersion: bundleData?.bundleVersion,
    });
    if (process.mas) {
      const softRestart =
        globalThis.$desktopMainAppFunctions?.softRestartRenderer;
      if (!softRestart) {
        // Should not happen once the main window exists (the full
        // $desktopMainAppFunctions is assigned in createMainWindow). Log loudly
        // so an online "update applied but UI didn't refresh" report is
        // diagnosable, then fall back to a hard exit.
        logger.error(
          'bundle-restart: softRestartRenderer unavailable, falling back to app.exit',
        );
        this.getMainWindow()?.destroy();
        app.exit(0);
        return;
      }
      await softRestart();
      return;
    }
    // Destroy window first to ensure renderer process is fully terminated
    // before relaunch, preventing webview custom element double registration
    this.getMainWindow()?.destroy();
    app.relaunch();
    if (process.platform === 'darwin') {
      // before-quit releases BLE native managers before Node environment teardown.
      app.quit();
    } else {
      app.exit(0);
    }
  }

  async restart() {
    await this.restartAppForBundleUpdate();
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
