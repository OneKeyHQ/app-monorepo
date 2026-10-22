import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { pathToFileURL } from 'url';

import AdmZip from 'adm-zip';
import { shell } from 'electron';
import logger from 'electron-log/main';

import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import {
  getDesktopNetworkThrottleConfig,
  setDesktopNetworkThrottleConfig,
} from '@onekeyhq/desktop/app/libs/networkThrottle';
import * as store from '@onekeyhq/desktop/app/libs/store';
import { flushDesktopDedup } from '@onekeyhq/desktop/app/logger';
import { endpointsMap } from '@onekeyhq/shared/src/config/endpointsMap';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ELogUploadStage } from '@onekeyhq/shared/src/logger/types';
import { withCustomUAHeaders } from '@onekeyhq/shared/src/request/customUA';
import type {
  IDesktopMainProcessDevOnlyApiParams,
  IDesktopStoreNetworkThrottle,
} from '@onekeyhq/shared/types/desktop';

import type { IDesktopApi } from './instance/IDesktopApi';

// cspell:ignore dacl
const MAX_LOG_FILE_BYTES = 21 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 160 * 1024 * 1024;
const MAX_LOG_FILES = 10;
const ARCHIVE_LIFETIME_MS = 60 * 60 * 1000;
const registeredArchives = new Map<
  string,
  { sizeBytes: number; sha256: string; expiresAt: number }
>();

type FileHandle = Awaited<ReturnType<typeof fsPromises.open>>;

async function readExactFile(
  handle: FileHandle,
  size: number,
  limit: number,
  errorMessage: string,
  allowGrowth = false,
): Promise<Buffer> {
  if (!Number.isSafeInteger(size) || size < 0 || size > limit) {
    throw new OneKeyLocalError(errorMessage);
  }
  const bytes = Buffer.alloc(size);
  let offset = 0;
  while (offset < size) {
    const { bytesRead } = await handle.read(
      bytes,
      offset,
      size - offset,
      offset,
    );
    if (bytesRead === 0) throw new OneKeyLocalError(errorMessage);
    offset += bytesRead;
  }
  const finalStat = await handle.stat();
  if (
    finalStat.nlink !== 1 ||
    (allowGrowth ? finalStat.size < size : finalStat.size !== size)
  ) {
    throw new OneKeyLocalError(errorMessage);
  }
  if (!allowGrowth) {
    const extra = Buffer.alloc(1);
    const { bytesRead: extraBytes } = await handle.read(extra, 0, 1, size);
    if (extraBytes !== 0) throw new OneKeyLocalError(errorMessage);
  }
  return bytes;
}

function assertNoLinksOnPath(filePath: string): void {
  let candidate = path.resolve(filePath);
  for (;;) {
    const stat = fs.lstatSync(candidate);
    if (stat.isSymbolicLink()) {
      throw new OneKeyLocalError('Log path contains a link');
    }
    const parent = path.dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }
}

function safeArchiveName(fileBaseName: string): string {
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(fileBaseName) ||
    fileBaseName.endsWith('.') ||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(fileBaseName)
  ) {
    throw new OneKeyLocalError('Invalid log archive name');
  }
  return `${fileBaseName}.zip`;
}

function assertTrustedUploadUrl(uploadUrl: string): void {
  let actual: URL;
  try {
    actual = new URL(uploadUrl);
  } catch {
    throw new OneKeyLocalError('Untrusted log upload destination');
  }
  const trustedWalletEndpoints = [
    endpointsMap.prod.wallet,
    endpointsMap.test.wallet,
  ];
  const expectedUrls = trustedWalletEndpoints.map(
    (endpoint) =>
      new URL(`${endpoint.replace(/\/$/, '')}/wallet/v1/client/log`),
  );
  if (
    actual.protocol !== 'https:' ||
    actual.username ||
    actual.password ||
    actual.search ||
    actual.hash ||
    !expectedUrls.some(
      (expected) =>
        expected.protocol === 'https:' &&
        !expected.username &&
        !expected.password &&
        !expected.search &&
        !expected.hash &&
        actual.href === expected.href,
    )
  ) {
    throw new OneKeyLocalError('Untrusted log upload destination');
  }
}

function pruneRegisteredArchives(): void {
  const now = Date.now();
  for (const [filePath, archive] of registeredArchives) {
    if (archive.expiresAt < now) registeredArchives.delete(filePath);
  }
}

export async function addWindowsDiagnosticsToZip(zip: AdmZip): Promise<void> {
  if (process.platform !== 'win32') return;
  let result: IWindowsDiagnosticsBundle;
  try {
    const collect =
      globalThis.$desktopMainAppFunctions?.collectWindowsDiagnostics;
    if (!collect) throw new OneKeyLocalError('collector_unavailable');
    result = await collect();
  } catch {
    result = {
      system: {
        schemaVersion: 1,
        collectedAtUtc: new Date().toISOString(),
        appVersion: '',
        electronVersion: process.versions.electron ?? '',
        nodeVersion: process.versions.node,
        osRelease: '',
        architecture: process.arch,
        osArchitecture: process.arch,
        timeZone: '',
        timeZoneOffsetMinutes: 0,
        hardening: { dacl: 'unknown', extensionPoint: 'unknown' },
      },
      events: [],
      collection: { status: 'unavailable', errors: ['collector_unavailable'] },
    };
  }
  zip.addFile(
    'diagnostics/windows-system.json',
    Buffer.from(JSON.stringify(result.system)),
  );
  zip.addFile(
    'diagnostics/windows-events.json',
    Buffer.from(JSON.stringify({ events: result.events })),
  );
  zip.addFile(
    'diagnostics/collection.json',
    Buffer.from(JSON.stringify(result.collection)),
  );
}

export async function addSafeLogFilesToZip(
  zip: AdmZip,
  logDir: string,
): Promise<number> {
  let directory: fs.Stats;
  try {
    directory = await fsPromises.lstat(logDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw error;
  }
  if (!directory.isDirectory() || directory.isSymbolicLink()) {
    throw new OneKeyLocalError('Invalid log directory');
  }
  assertNoLinksOnPath(logDir);
  const logFiles = await fsPromises.readdir(logDir);
  const selected = logFiles.filter((name) => name.endsWith('.log'));
  if (selected.length > MAX_LOG_FILES) {
    throw new OneKeyLocalError('Too many log files');
  }
  let count = 0;
  let totalBytes = 0;
  for (const fileName of selected) {
    const filePath = path.join(logDir, fileName);
    assertNoLinksOnPath(filePath);
    const expected = await fsPromises.lstat(filePath);
    if (
      !expected.isFile() ||
      expected.nlink !== 1 ||
      expected.size > MAX_LOG_FILE_BYTES
    ) {
      throw new OneKeyLocalError('Invalid log file');
    }
    const handle = await fsPromises.open(filePath, 'r');
    try {
      const opened = await handle.stat();
      if (
        !opened.isFile() ||
        opened.dev !== expected.dev ||
        opened.ino !== expected.ino ||
        opened.nlink !== 1 ||
        opened.size > MAX_LOG_FILE_BYTES
      ) {
        throw new OneKeyLocalError('Log file changed during collection');
      }
      totalBytes += opened.size;
      if (totalBytes > MAX_ARCHIVE_BYTES) {
        throw new OneKeyLocalError('Log files exceed size limit');
      }
      zip.addFile(
        fileName,
        await readExactFile(
          handle,
          opened.size,
          MAX_LOG_FILE_BYTES,
          'Log file changed during collection',
          true,
        ),
      );
      count += 1;
    } finally {
      await handle.close();
    }
  }
  return count;
}

class DesktopApiDev {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
  }

  desktopApi: IDesktopApi;

  async callDevOnlyApi(
    params: IDesktopMainProcessDevOnlyApiParams,
  ): Promise<any> {
    if (process.env.NODE_ENV !== 'production') {
      const { module, method, params: apiParams } = params;
      console.log('call APP_DEV_ONLY_API::', module, method, apiParams);
      if (module === 'shell') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return (shell as any)[method](...apiParams);
      }
    }
    return undefined;
  }

  async openLoggerFile(): Promise<void> {
    await shell.openPath(path.dirname(logger.transports.file.getFile().path));
  }

  async exportLoggerZip(params: {
    fileBaseName: string;
  }): Promise<{ filePath: string }> {
    const digest = await this.collectLoggerDigest(params);
    const mainWindow = this.desktopApi.appUpdate.getMainWindow() ?? undefined;
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new OneKeyLocalError('No active window for download');
    }
    // Use pathToFileURL to properly handle Windows backslashes, spaces, and special chars
    const fileUrl = pathToFileURL(digest.filePath).href;
    mainWindow.webContents.downloadURL(fileUrl);
    return { filePath: digest.filePath };
  }

  async collectLoggerDigest(params: { fileBaseName: string }): Promise<{
    filePath: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
  }> {
    const zipName = safeArchiveName(params.fileBaseName);
    // Flush pending dedup state (including pendingRepeatPrefix) so nothing is lost on export
    flushDesktopDedup();

    const logFilePath = logger.transports.file.getFile().path;
    const logDir = path.dirname(logFilePath);

    // Store zips in logs_zip/ next to log directory, matching native behavior
    const zipDir = path.join(path.dirname(logDir), 'logs_zip');
    await fsPromises.mkdir(zipDir, { recursive: true });
    assertNoLinksOnPath(zipDir);

    const zipPath = path.join(zipDir, `${randomUUID()}-${zipName}`);

    // Clean up stale zip files (older than 1 hour) to avoid removing
    // archives that a concurrent upload/download flow may still be using
    const ONE_HOUR_MS = 60 * 60 * 1000;
    try {
      const existingZips = await fsPromises.readdir(zipDir);
      for (const oldZip of existingZips) {
        if (oldZip.endsWith('.zip') && oldZip !== zipName) {
          try {
            const stat = await fsPromises.stat(path.join(zipDir, oldZip));
            if (Date.now() - stat.mtimeMs > ONE_HOUR_MS) {
              await fsPromises.unlink(path.join(zipDir, oldZip));
            }
          } catch {
            // ignore individual cleanup errors
          }
        }
      }
    } catch {
      // ignore cleanup errors
    }

    const zip = new AdmZip();
    await addSafeLogFilesToZip(zip, logDir);
    await addWindowsDiagnosticsToZip(zip);
    const fileBuffer = zip.toBuffer();
    const sizeBytes = fileBuffer.length;
    if (sizeBytes > MAX_ARCHIVE_BYTES) {
      throw new OneKeyLocalError('Log archive exceeds size limit');
    }
    const sha256Hex = createHash('sha256').update(fileBuffer).digest('hex');
    const archiveHandle = await fsPromises.open(zipPath, 'wx', 0o600);
    try {
      await archiveHandle.writeFile(fileBuffer);
    } finally {
      await archiveHandle.close();
    }
    pruneRegisteredArchives();
    registeredArchives.set(zipPath, {
      sizeBytes,
      sha256: sha256Hex,
      expiresAt: Date.now() + ARCHIVE_LIFETIME_MS,
    });

    return {
      filePath: zipPath,
      fileName: zipName,
      mimeType: 'application/zip',
      sizeBytes,
      sha256: sha256Hex,
    };
  }

  async uploadLoggerBundle(params: {
    uploadUrl: string;
    filePath: string;
    headers: Record<string, string>;
    sizeBytes?: number;
  }): Promise<any> {
    const { uploadUrl, filePath, headers, sizeBytes } = params;
    if (!uploadUrl || !filePath) {
      throw new OneKeyLocalError('uploadUrl and filePath are required');
    }
    assertTrustedUploadUrl(uploadUrl);
    const archiveDir = path.join(
      path.dirname(path.dirname(logger.transports.file.getFile().path)),
      'logs_zip',
    );
    if (
      !path.isAbsolute(filePath) ||
      path.dirname(filePath) !== archiveDir ||
      !filePath.toLowerCase().endsWith('.zip')
    ) {
      throw new OneKeyLocalError('Unregistered log archive');
    }
    pruneRegisteredArchives();
    const registered = registeredArchives.get(filePath);
    if (!registered || registered.expiresAt < Date.now()) {
      throw new OneKeyLocalError('Unregistered log archive');
    }
    assertNoLinksOnPath(filePath);
    const fileInfo = await fsPromises.lstat(filePath);
    if (
      !fileInfo.isFile() ||
      fileInfo.nlink !== 1 ||
      fileInfo.size !== registered.sizeBytes ||
      fileInfo.size > MAX_ARCHIVE_BYTES ||
      (sizeBytes !== undefined && sizeBytes !== fileInfo.size)
    ) {
      throw new OneKeyLocalError('Log archive changed before upload');
    }
    const handle = await fsPromises.open(filePath, 'r');
    let archiveBytes: Buffer;
    try {
      const opened = await handle.stat();
      if (
        !opened.isFile() ||
        opened.dev !== fileInfo.dev ||
        opened.ino !== fileInfo.ino ||
        opened.nlink !== 1 ||
        opened.size !== registered.sizeBytes
      ) {
        throw new OneKeyLocalError('Log archive changed before upload');
      }
      archiveBytes = await readExactFile(
        handle,
        registered.sizeBytes,
        MAX_ARCHIVE_BYTES,
        'Log archive changed before upload',
      );
    } finally {
      await handle.close();
    }
    if (
      archiveBytes.length !== registered.sizeBytes ||
      createHash('sha256').update(archiveBytes).digest('hex') !==
        registered.sha256
    ) {
      throw new OneKeyLocalError('Log archive hash mismatch');
    }
    const totalBytes = registered.sizeBytes;
    const reqHeaders: Record<string, string> = { ...headers };
    const authorization = Object.entries(reqHeaders).find(
      ([name]) => name.toLowerCase() === 'authorization',
    )?.[1];
    if (!authorization || !/^Bearer [A-Za-z0-9._~-]+$/.test(authorization)) {
      throw new OneKeyLocalError('Invalid log upload authorization');
    }
    for (const header of Object.keys(reqHeaders)) {
      if (
        header.toLowerCase() === 'content-length' ||
        header.toLowerCase() === 'content-type'
      ) {
        delete reqHeaders[header];
      }
    }
    reqHeaders['content-type'] = 'application/zip';
    reqHeaders['content-length'] = String(totalBytes);
    const sendProgress = ({
      stage,
      progressPercent,
      message,
    }: {
      stage: ELogUploadStage;
      progressPercent?: number;
      message?: string;
    }) => {
      try {
        const mainWindow =
          this.desktopApi.appUpdate.getMainWindow() ?? undefined;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(
            ipcMessageKeys.CLIENT_LOG_UPLOAD_PROGRESS,
            {
              stage,
              progressPercent,
              message,
            },
          );
        }
      } catch (error) {
        logger.warn('[client-log-upload] failed to send progress', error);
      }
    };

    sendProgress({ stage: ELogUploadStage.Uploading, progressPercent: 0 });

    // Fetch pulls the already-verified bytes only after the connection is ready.
    let uploadedBytes = 0;
    const readArchive = async function* (): AsyncGenerator<Buffer> {
      for (let offset = 0; offset < archiveBytes.length; offset += 64 * 1024) {
        const chunk = archiveBytes.subarray(offset, offset + 64 * 1024);
        uploadedBytes += chunk.length;
        if (totalBytes > 0) {
          sendProgress({
            stage: ELogUploadStage.Uploading,
            progressPercent: Math.min(
              100,
              Math.round((uploadedBytes / totalBytes) * 100),
            ),
          });
        }
        yield chunk;
      }
    };
    const body = readArchive();
    const abortController = new AbortController();

    try {
      const finalHeaders = await withCustomUAHeaders(uploadUrl, reqHeaders);
      const requestInit: RequestInit & { duplex: 'half' } = {
        method: 'POST',
        headers: finalHeaders,
        body: body as unknown as BodyInit,
        // Node's native fetch requires duplex for a streaming request body.
        duplex: 'half',
        redirect: 'error',
        signal: abortController.signal,
      };
      const response = await fetch(uploadUrl, requestInit);
      const text = await response.text();
      // Log only safe metadata. The response body is intentionally NOT
      // written here — for non-2xx the upstream is often a Cloudflare HTML
      // error page whose <script>/<iframe>/<style> bytes would otherwise be
      // captured into app-latest.log and re-uploaded inside the next zip,
      // tripping CF's OWASP HTML Injection / XSS rule and creating a
      // self-perpetuating 403 loop. cf-ray is sufficient for backend triage.
      logger.info(
        '[client-log-upload] response status:',
        response.status,
        'cf-ray:',
        response.headers.get('cf-ray') ?? 'n/a',
        'cf-mitigated:',
        response.headers.get('cf-mitigated') ?? 'n/a',
        'body-len:',
        text.length,
      );
      try {
        const parsed = JSON.parse(text) as Record<string, any>;
        if (typeof parsed.code === 'number') {
          if (parsed.code === 0) {
            sendProgress({
              stage: ELogUploadStage.Success,
              progressPercent: 100,
            });
          } else {
            sendProgress({
              stage: ELogUploadStage.Error,
              message:
                (parsed?.data as { message?: string } | undefined)?.message ||
                parsed.message,
            });
          }
        } else {
          sendProgress({
            stage: ELogUploadStage.Success,
            progressPercent: 100,
          });
        }
        return parsed;
      } catch (_error) {
        // Non-JSON response (typically a CF block page). Surface a stable,
        // non-HTML error message so the renderer / caller never sees raw
        // <script>/<iframe> bytes that could be re-logged or rendered.
        const safeMessage = `Upload failed (HTTP ${response.status}, cf-ray=${
          response.headers.get('cf-ray') ?? 'n/a'
        })`;
        sendProgress({
          stage: ELogUploadStage.Error,
          message: safeMessage,
        });
        return {
          code: response.status,
          message: safeMessage,
        };
      }
    } catch (error) {
      const causeCode = (error as { cause?: { code?: unknown } })?.cause?.code;
      logger.error('[client-log-upload] request failed', {
        code: typeof causeCode === 'string' ? causeCode : 'unknown',
      });
      sendProgress({
        stage: ELogUploadStage.Error,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      // A failed request can leave the body unconsumed.
      abortController.abort();
    }
  }

  // -----------------------------------------------------------------------
  // NativeLogger-compatible methods (aligned with react-native-native-logger)
  // -----------------------------------------------------------------------

  getLogDirectory(): string {
    return path.dirname(logger.transports.file.getFile().path);
  }

  async getLogFilePaths(): Promise<string[]> {
    const logDir = this.getLogDirectory();
    const files = await fsPromises.readdir(logDir);
    return files.filter((f) => f.endsWith('.log')).toSorted();
  }

  async deleteLogFiles(): Promise<void> {
    const logDir = this.getLogDirectory();
    const files = await fsPromises.readdir(logDir);
    const logFiles = files.filter((f) => f.endsWith('.log'));
    for (const file of logFiles) {
      const filePath = path.join(logDir, file);
      try {
        if (file === 'app-latest.log') {
          // Truncate active log file instead of deleting (matches native behavior)
          await fsPromises.writeFile(filePath, '');
        } else {
          await fsPromises.unlink(filePath);
        }
      } catch {
        // ignore individual file errors
      }
    }
  }

  async changeDevTools(isOpen: boolean): Promise<void> {
    store.setDevTools(isOpen);
    globalThis.$desktopMainAppFunctions?.refreshMenu?.();
  }

  async getNetworkThrottle(): Promise<IDesktopStoreNetworkThrottle> {
    return getDesktopNetworkThrottleConfig();
  }

  async setNetworkThrottle(
    config: IDesktopStoreNetworkThrottle,
  ): Promise<IDesktopStoreNetworkThrottle> {
    return setDesktopNetworkThrottleConfig(config);
  }

  // not working, use globalThis.desktopApi.testCrash(); instead
  // async testCrash(): Promise<void> {}
}

export default DesktopApiDev;
