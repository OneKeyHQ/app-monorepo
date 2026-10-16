import { execFileSync, spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';

import { BrowserWindow, app, autoUpdater, dialog, shell } from 'electron';
import logger from 'electron-log/main';
import { readCleartextMessage, readKey } from 'openpgp';
import semver from 'semver';
import YAML from 'yaml';

import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import { PUBLIC_KEY } from '@onekeyhq/desktop/app/constant/gpg';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { ElectronTranslations, i18nText } from '@onekeyhq/desktop/app/i18n';
import * as store from '@onekeyhq/desktop/app/libs/store';
import type {
  IInstallUpdateParams,
  IVerifyUpdateParams,
} from '@onekeyhq/desktop/app/preload';
import {
  clearWindowProgressBar,
  updateWindowProgressBar,
} from '@onekeyhq/desktop/app/windowProgressBar';
import { buildServiceEndpoint } from '@onekeyhq/shared/src/config/appConfig';
import {
  EUpdateErrorCode,
  createUpdateError,
  getUpdateError,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update/error';
import type { TUpdateErrorStep } from '@onekeyhq/shared/src/modules3rdParty/auto-update/error';
import {
  EAppUpdatePackageAvailabilityStatus,
  type IAppUpdatePackageAvailability,
  type IUpdateDownloadedEvent,
  type IUpdateProgressUpdate,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update/type';
import { withCustomUAHeaders } from '@onekeyhq/shared/src/request/customUA';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import { getDownloadedFileAvailability } from './appUpdatePackageAvailability';
import { requestUpdateUrl } from './electronUpdateRequest';
import {
  classifyNodeError,
  downloadNodeFile,
  stripSensitiveHeaders,
} from './nodeDownload';

import type { IDesktopApi } from './base/types';

function wrapAppUpdateOperationError(error: unknown, step: TUpdateErrorStep) {
  return createUpdateError(getUpdateError(classifyNodeError(error), step));
}

export interface ILatestVersion {
  version: string;
  releaseDate: string;
  isManualCheck?: boolean;
}

export type { IUpdateProgressUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update/type';

interface IFeedFile {
  url: string;
  sha512: string;
  size?: number;
}

interface IFeedData {
  version: string;
  releaseDate?: string;
  files: IFeedFile[];
}

interface IArtifact {
  version: string;
  releaseDate: string;
  url: string;
  sha512: string;
  size?: number;
  platform: NodeJS.Platform;
  arch: string;
  fileName: string;
}

interface ICacheRecord extends IArtifact {
  downloadedFile: string;
}

interface IAppImageHandoff {
  current: string;
  destination: string;
  backup?: string;
  version: string;
  buildNumber: string;
}

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
const isLinux = process.platform === 'linux';
const isAppImage = isLinux && process.env.DESK_CHANNEL === 'appImage';
const isStoreVersion =
  Boolean(process.mas) ||
  Boolean(isLinux && (process.env.SNAP || process.env.FLATPAK)) ||
  Boolean(isWin && process.env.DESK_CHANNEL === 'ms-store');
const MAX_FEED_BYTES = 2 * 1024 * 1024;
const METADATA_STALL_MS = 30_000;

function buildFeedUrl(useTestFeedUrl: boolean, version: string): string {
  const endpoint = buildServiceEndpoint({
    serviceName: EServiceEndpointEnum.Utility,
    env: useTestFeedUrl ? 'test' : 'prod',
  });
  return `${endpoint}/utility/v1/app-update/electron-feed-url?version=${encodeURIComponent(version)}`;
}

function getChannelName(): string {
  if (isMac) return 'latest-mac.yml';
  if (isLinux) {
    return process.arch === 'x64'
      ? 'latest-linux.yml'
      : `latest-linux-${process.arch}.yml`;
  }
  return 'latest.yml';
}

function makeFeedFileUrl(baseUrl: string): string {
  const base = new URL(baseUrl);
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  const feed = new URL(getChannelName(), base);
  feed.search = base.search;
  return feed.toString();
}

function resolveArtifactUrl(fileUrl: string, feedBase: string): string {
  const base = new URL(feedBase);
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  const resolved = new URL(fileUrl, base);
  if (!resolved.search && base.search) resolved.search = base.search;
  if (resolved.protocol !== 'https:') {
    throw createUpdateError({
      code: EUpdateErrorCode.securityRejected,
      step: 'download',
    });
  }
  return resolved.toString();
}

function getRuntimeArch(): string {
  let arch = process.arch;
  if (isMac && arch === 'x64') {
    try {
      if (
        execFileSync('sysctl', ['-n', 'sysctl.proc_translated'], {
          encoding: 'utf8',
        }).trim() === '1'
      ) {
        arch = 'arm64';
      }
    } catch {
      // Intel Macs do not expose the Rosetta translation key.
    }
  }
  return arch;
}

function selectArtifact(
  feed: IFeedData,
  selectedVersion: string,
  baseUrl: string,
  arch = getRuntimeArch(),
): IArtifact {
  if (feed.version !== selectedVersion || !Array.isArray(feed.files)) {
    throw createUpdateError({
      code: EUpdateErrorCode.incompatible,
      step: 'download',
    });
  }
  let extension = '.AppImage';
  if (isMac) extension = '.zip';
  else if (isWin) extension = '.exe';
  const files = feed.files.filter((file) => {
    if (typeof file?.url !== 'string' || typeof file.sha512 !== 'string') {
      return false;
    }
    return new URL(file.url, baseUrl).pathname.endsWith(extension);
  });
  // electron-builder names x64 AppImages with the Linux artifact arch x86_64.
  const artifactArch = isLinux && arch === 'x64' ? 'x86_64' : arch;
  const archMarker = `-${artifactArch}.`;
  const matching = files.filter((file) =>
    new URL(file.url, baseUrl).pathname.includes(archMarker),
  );
  if (matching.length > 1) {
    throw createUpdateError({
      code: EUpdateErrorCode.invalidArgument,
      step: 'download',
    });
  }
  let fallback: IFeedFile[] = [];
  if (matching.length === 0) {
    if (isMac) {
      fallback = files.filter((file) =>
        /-(?:universal|all)\./i.test(new URL(file.url, baseUrl).pathname),
      );
    } else if (isWin) {
      fallback = files.filter(
        (file) =>
          !/-(?:x64|amd64|arm64|aarch64|ia32)\./i.test(
            new URL(file.url, baseUrl).pathname,
          ),
      );
    }
  }
  const selected = matching.length === 1 ? matching : fallback;
  if (selected.length !== 1) {
    throw createUpdateError({
      code: EUpdateErrorCode.packageMissing,
      step: 'download',
    });
  }
  const file = selected[0];
  if (!/^[A-Za-z0-9+/]{86}==$/.test(file.sha512)) {
    throw createUpdateError({
      code: EUpdateErrorCode.integrityFailed,
      step: 'download',
    });
  }
  if (
    file.size !== undefined &&
    (!Number.isSafeInteger(file.size) || file.size <= 0)
  ) {
    throw createUpdateError({
      code: EUpdateErrorCode.invalidArgument,
      step: 'download',
    });
  }
  const url = resolveArtifactUrl(file.url, baseUrl);
  const fileName = path.basename(new URL(url).pathname);
  if (!fileName || fileName === '.' || fileName === '..') {
    throw createUpdateError({
      code: EUpdateErrorCode.invalidArgument,
      step: 'download',
    });
  }
  if (!fileName.includes(selectedVersion)) {
    throw createUpdateError({
      code: EUpdateErrorCode.incompatible,
      step: 'download',
    });
  }
  return {
    version: feed.version,
    releaseDate: feed.releaseDate || '',
    url,
    sha512: file.sha512,
    size: file.size,
    platform: process.platform,
    arch,
    fileName,
  };
}

async function requestText(
  inputUrl: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<string> {
  const { response } = await requestUpdateUrl(
    inputUrl,
    headers,
    signal,
    METADATA_STALL_MS,
  ).catch((error: unknown) => {
    if (signal?.aborted) {
      throw createUpdateError({
        code: EUpdateErrorCode.cancelled,
        step: 'download',
      });
    }
    throw classifyNodeError(error);
  });
  if (response.statusCode !== 200) {
    response.destroy();
    throw createUpdateError({
      code: EUpdateErrorCode.httpError,
      step: 'download',
      httpStatus: response.statusCode,
    });
  }
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of response) {
    const bytes = chunk as Buffer;
    length += bytes.length;
    if (length > MAX_FEED_BYTES) {
      response.destroy();
      throw createUpdateError({
        code: EUpdateErrorCode.securityRejected,
        step: 'download',
      });
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function hashFile(
  filePath: string,
  algorithm: 'sha256' | 'sha512',
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);
    stream.once('error', reject);
    stream.on('data', (chunk) => {
      hash.update(chunk);
    });
    stream.once('end', () =>
      resolve(hash.digest(algorithm === 'sha512' ? 'base64' : 'hex')),
    );
  });
}

class DesktopApiAppUpdate {
  desktopApi: IDesktopApi;

  isManualCheck = false;

  latestVersion = {} as ILatestVersion;

  isDownloading = false;

  downloadedEvent: IUpdateDownloadedEvent;

  private selectedArtifact?: IArtifact;

  private activeController?: AbortController;

  private activeDownload?: Promise<void>;

  private metadataControllers = new Set<AbortController>();

  private metadataRequests = new Set<Promise<string>>();

  private metadataGeneration = 0;

  private cacheClearPromise?: Promise<void>;

  private macFeedServer?: http.Server;

  private macStagedIdentity?: string;

  private macInstallInProgress = false;

  private appImageInstallInProgress = false;

  private installInProgress = false;

  private installHandoffStarted = false;

  private cachedRuntimeArch?: string;

  private lastVerifiedFile?: {
    filePath: string;
    size: number;
    mtimeMs: number;
    sha512: string;
  };

  private isSkipGPGAllowed(skip?: boolean): boolean {
    return (
      process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION === 'true' && Boolean(skip)
    );
  }

  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
    if (isMac) {
      autoUpdater.on?.('error', (error: unknown) => {
        logger.warn('auto-updater', 'Native autoUpdater error:', error);
      });
    }
    if (isAppImage) this.reconcileAppImageHandoff();
  }

  private getRuntimeArch(): string {
    if (!this.cachedRuntimeArch) {
      this.cachedRuntimeArch = getRuntimeArch();
    }
    return this.cachedRuntimeArch;
  }

  private getMainWindow(): BrowserWindow | undefined {
    return globalThis.$desktopMainAppFunctions?.getSafelyMainWindow?.();
  }

  private getCacheDir(): string {
    return path.join(app.getPath('userData'), 'app-shell-updater');
  }

  private getRecordPath(): string {
    return path.join(this.getCacheDir(), 'package.json');
  }

  private getAppImageHandoffPath(): string {
    return path.join(this.getCacheDir(), 'appimage-handoff.json');
  }

  private reconcileAppImageHandoff(): void {
    const marker = this.getAppImageHandoffPath();
    if (!fs.existsSync(marker)) return;
    try {
      const handoff = JSON.parse(
        fs.readFileSync(marker, 'utf8'),
      ) as IAppImageHandoff;
      if (
        !path.isAbsolute(handoff.current) ||
        !path.isAbsolute(handoff.destination) ||
        (handoff.backup && !path.isAbsolute(handoff.backup)) ||
        !semver.valid(handoff.version) ||
        path.dirname(handoff.current) !== path.dirname(handoff.destination) ||
        (handoff.backup !== undefined &&
          (!handoff.backup.startsWith(handoff.destination) ||
            !/^\.[0-9a-f]{16}\.old$/.test(
              handoff.backup.slice(handoff.destination.length),
            ))) ||
        (handoff.destination === handoff.current && !handoff.backup)
      ) {
        throw createUpdateError({
          code: EUpdateErrorCode.installFailed,
          step: 'download',
        });
      }
      if (
        app.getVersion() === handoff.version &&
        process.env.APPIMAGE === handoff.destination
      ) {
        store.setUpdateBuildNumber(handoff.buildNumber);
        if (handoff.destination !== handoff.current) {
          fs.rmSync(handoff.current, { force: true });
        }
        if (handoff.backup) {
          fs.rmSync(handoff.backup, { force: true });
        }
      } else if (
        process.env.APPIMAGE === handoff.current ||
        process.env.APPIMAGE === handoff.backup
      ) {
        if (handoff.backup && fs.existsSync(handoff.backup)) {
          fs.renameSync(handoff.backup, handoff.destination);
        } else if (handoff.destination !== handoff.current) {
          fs.rmSync(handoff.destination, { force: true });
        }
      } else {
        return;
      }
      fs.rmSync(marker, { force: true });
    } catch (error) {
      logger.warn('auto-updater', 'AppImage handoff recovery failed', error);
    }
  }

  private getTargetPath(artifact: IArtifact): string {
    return path.join(this.getCacheDir(), artifact.fileName);
  }

  private cleanupStaleInstallers(keepFileName: string): void {
    const cacheDir = this.getCacheDir();
    if (!fs.existsSync(cacheDir)) return;
    const keep = new Set([
      keepFileName,
      `${keepFileName}.partial`,
      `${keepFileName}.partial.progress.json`,
      'package.json',
      'appimage-handoff.json',
    ]);
    try {
      for (const entry of fs.readdirSync(cacheDir)) {
        if (!keep.has(entry)) {
          fs.rmSync(path.join(cacheDir, entry), {
            recursive: true,
            force: true,
          });
        }
      }
    } catch (error) {
      logger.warn('auto-updater', 'Stale installer cleanup failed', error);
    }
  }

  private readRecord(): ICacheRecord | undefined {
    try {
      const record = JSON.parse(
        fs.readFileSync(this.getRecordPath(), 'utf8'),
      ) as ICacheRecord;
      if (
        path.basename(record.fileName) !== record.fileName ||
        record.platform !== process.platform ||
        record.arch !== this.getRuntimeArch() ||
        record.downloadedFile !== this.getTargetPath(record) ||
        !semver.valid(record.version) ||
        !semver.gt(record.version, app.getVersion()) ||
        !/^[A-Za-z0-9+/]{86}==$/.test(record.sha512) ||
        new URL(record.url).protocol !== 'https:'
      ) {
        return undefined;
      }
      return record;
    } catch {
      return undefined;
    }
  }

  private writeRecord(record: ICacheRecord): void {
    fs.mkdirSync(this.getCacheDir(), { recursive: true });
    const temp = `${this.getRecordPath()}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(record), { mode: 0o600 });
    fs.renameSync(temp, this.getRecordPath());
  }

  private async verifiedRecord(
    identity?: IVerifyUpdateParams,
  ): Promise<ICacheRecord | undefined> {
    const record = this.readRecord();
    if (
      !record ||
      (identity &&
        (identity.latestVersion !== record.version ||
          identity.downloadUrl !== record.url))
    ) {
      return undefined;
    }
    const availability = getDownloadedFileAvailability(record.downloadedFile);
    if (availability.status !== EAppUpdatePackageAvailabilityStatus.available) {
      return undefined;
    }
    const stat = fs.statSync(record.downloadedFile);
    if (record.size && stat.size !== record.size) {
      return undefined;
    }
    if (
      this.lastVerifiedFile &&
      this.lastVerifiedFile.filePath === record.downloadedFile &&
      this.lastVerifiedFile.size === stat.size &&
      this.lastVerifiedFile.mtimeMs === stat.mtimeMs &&
      this.lastVerifiedFile.sha512 === record.sha512
    ) {
      return record;
    }
    const actual = await hashFile(record.downloadedFile, 'sha512');
    if (actual !== record.sha512) {
      return undefined;
    }
    this.lastVerifiedFile = {
      filePath: record.downloadedFile,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      sha512: actual,
    };
    return record;
  }

  private async assertVerifiedRecord(
    identity: IVerifyUpdateParams,
  ): Promise<ICacheRecord> {
    const record = await this.verifiedRecord(identity);
    if (!record) {
      throw createUpdateError({
        code: EUpdateErrorCode.packageMissing,
        step: 'verifyPackage',
      });
    }
    return record;
  }

  private async requestMetadata(
    url: string,
    headers: Record<string, string>,
  ): Promise<string> {
    const controller = new AbortController();
    const request = requestText(url, headers, controller.signal);
    this.metadataControllers.add(controller);
    this.metadataRequests.add(request);
    try {
      return await request;
    } finally {
      this.metadataControllers.delete(controller);
      this.metadataRequests.delete(request);
    }
  }

  async isDownloadingPackage(): Promise<boolean> {
    return this.isDownloading;
  }

  async checkDownloadedFileExists(
    identity: IVerifyUpdateParams,
  ): Promise<boolean> {
    return Boolean(await this.verifiedRecord(identity));
  }

  async getDownloadedFileAvailability(
    identity?: IVerifyUpdateParams,
  ): Promise<IAppUpdatePackageAvailability> {
    try {
      return await this.getDownloadedFileAvailabilityInternal(identity);
    } catch (error) {
      throw wrapAppUpdateOperationError(error, 'install');
    }
  }

  private async getDownloadedFileAvailabilityInternal(
    identity?: IVerifyUpdateParams,
  ): Promise<IAppUpdatePackageAvailability> {
    if (!identity?.latestVersion || !identity.downloadUrl) {
      return { status: EAppUpdatePackageAvailabilityStatus.missing };
    }
    const record = this.readRecord();
    if (
      !record ||
      record.version !== identity.latestVersion ||
      record.url !== identity.downloadUrl
    ) {
      return { status: EAppUpdatePackageAvailabilityStatus.notPrepared };
    }
    const availability = getDownloadedFileAvailability(record.downloadedFile);
    if (availability.status !== EAppUpdatePackageAvailabilityStatus.available) {
      return availability;
    }
    return (await this.verifiedRecord(identity))
      ? availability
      : { status: EAppUpdatePackageAvailabilityStatus.notPrepared };
  }

  async clearUpdateCache(): Promise<void> {
    if (this.installInProgress) {
      throw createUpdateError({
        code: EUpdateErrorCode.installFailed,
        step: 'cleanup',
      });
    }
    if (this.cacheClearPromise) {
      try {
        return await this.cacheClearPromise;
      } catch (error) {
        throw wrapAppUpdateOperationError(error, 'cleanup');
      }
    }
    this.cacheClearPromise = (async () => {
      this.activeController?.abort();
      this.metadataGeneration += 1;
      this.metadataControllers.forEach((controller) => controller.abort());
      await Promise.allSettled(this.metadataRequests);
      try {
        await this.activeDownload;
      } catch {
        // The cancelled transfer leaves its partial file for normal resume.
      }
      this.macFeedServer?.close();
      this.macFeedServer = undefined;
      this.macStagedIdentity = undefined;
      this.downloadedEvent = undefined;
      this.selectedArtifact = undefined;
      this.lastVerifiedFile = undefined;
      this.isDownloading = false;
      store.clearASCFile();
      fs.rmSync(this.getCacheDir(), { recursive: true, force: true });
      try {
        const homeDir = app.getPath('home');
        let legacyBaseCacheDir =
          process.env.XDG_CACHE_HOME || path.join(homeDir, '.cache');
        if (isMac) {
          legacyBaseCacheDir = path.join(homeDir, 'Library', 'Caches');
        } else if (isWin) {
          legacyBaseCacheDir =
            process.env.LOCALAPPDATA || app.getPath('userData');
        }
        fs.rmSync(path.join(legacyBaseCacheDir, '@onekeyhqdesktop-updater'), {
          recursive: true,
          force: true,
        });
      } catch {
        // Ignore if legacy cache path is unavailable.
      }
    })();
    try {
      await this.cacheClearPromise;
    } catch (error) {
      throw wrapAppUpdateOperationError(error, 'cleanup');
    } finally {
      this.cacheClearPromise = undefined;
    }
  }

  async clearUpdateSettings(): Promise<void> {
    try {
      store.clearUpdateSettings();
    } catch (error) {
      throw wrapAppUpdateOperationError(error, 'cleanup');
    }
  }

  async checkForUpdates(
    isManual = false,
    requestHeaders: Record<string, string> = {},
    latestVersion: string,
  ): Promise<IArtifact | null> {
    try {
      return await this.checkForUpdatesInternal(
        isManual,
        requestHeaders,
        latestVersion,
      );
    } catch (error) {
      throw wrapAppUpdateOperationError(error, 'download');
    }
  }

  private async checkForUpdatesInternal(
    isManual: boolean,
    requestHeaders: Record<string, string>,
    latestVersion: string,
  ): Promise<IArtifact | null> {
    if (this.cacheClearPromise) await this.cacheClearPromise;
    if (this.installInProgress) {
      throw createUpdateError({
        code: EUpdateErrorCode.installFailed,
        step: 'download',
      });
    }
    this.isManualCheck = isManual;
    const metadataGeneration = this.metadataGeneration;
    if (!latestVersion || isStoreVersion) return null;
    if (
      !semver.valid(latestVersion) ||
      !semver.gt(latestVersion, app.getVersion())
    ) {
      throw createUpdateError({
        code: EUpdateErrorCode.invalidArgument,
        step: 'download',
      });
    }
    const feedBase = buildFeedUrl(
      store.getUpdateSettings().useTestFeedUrl,
      latestVersion,
    );
    const feedUrl = makeFeedFileUrl(feedBase);
    const headers = await withCustomUAHeaders(feedUrl, requestHeaders);
    if (metadataGeneration !== this.metadataGeneration) {
      throw createUpdateError({
        code: EUpdateErrorCode.cancelled,
        step: 'download',
      });
    }
    const raw = await this.requestMetadata(feedUrl, headers);
    if (metadataGeneration !== this.metadataGeneration) {
      throw createUpdateError({
        code: EUpdateErrorCode.cancelled,
        step: 'download',
      });
    }
    const parsed = YAML.parse(raw) as IFeedData;
    const artifact = selectArtifact(
      parsed,
      latestVersion,
      feedBase,
      this.getRuntimeArch(),
    );
    this.selectedArtifact = artifact;
    this.latestVersion = {
      version: artifact.version,
      releaseDate: artifact.releaseDate,
      isManualCheck: isManual,
    };
    this.requestHeaders = headers;
    this.requestHeadersOrigin = new URL(feedUrl).origin;
    this.getMainWindow()?.webContents.send(
      ipcMessageKeys.UPDATE_DOWNLOAD_FILE_INFO,
      artifact.url,
    );
    return artifact;
  }

  private requestHeaders: Record<string, string> = {};

  private requestHeadersOrigin: string | undefined;

  private getArtifactRequestHeaders(url: string): Record<string, string> {
    return new URL(url).origin === this.requestHeadersOrigin
      ? this.requestHeaders
      : stripSensitiveHeaders(this.requestHeaders);
  }

  private emitProgress(progress: IUpdateProgressUpdate): void {
    this.getMainWindow()?.webContents.send(
      ipcMessageKeys.UPDATE_DOWNLOADING,
      progress,
    );
    updateWindowProgressBar(this.getMainWindow(), progress.percent);
  }

  private emitDownloaded(record: ICacheRecord): void {
    this.downloadedEvent = {
      latestVersion: record.version,
      downloadUrl: record.url,
    };
    this.emitDownloadedFromEvent();
  }

  private emitDownloadedFromEvent(): void {
    if (!this.downloadedEvent) return;
    this.getMainWindow()?.webContents.send(
      ipcMessageKeys.UPDATE_DOWNLOADED,
      this.downloadedEvent,
    );
    clearWindowProgressBar(this.getMainWindow());
  }

  private emitError(error: unknown): void {
    const updateError = getUpdateError(classifyNodeError(error), 'download');
    if (updateError.code === EUpdateErrorCode.cancelled) return;
    const message = createUpdateError(updateError).message;
    logger.error('auto-updater', message);
    this.getMainWindow()?.webContents.send(ipcMessageKeys.UPDATE_ERROR, {
      message,
    });
    clearWindowProgressBar(this.getMainWindow());
  }

  async downloadUpdate(): Promise<void> {
    if (this.installInProgress) {
      throw createUpdateError({
        code: EUpdateErrorCode.installFailed,
        step: 'download',
      });
    }
    if (this.isDownloading) {
      if (this.activeDownload) {
        await this.activeDownload;
        this.emitDownloadedFromEvent();
      }
      return;
    }
    const artifact = this.selectedArtifact;
    if (!artifact)
      throw createUpdateError({
        code: EUpdateErrorCode.packageMissing,
        step: 'download',
      });
    this.isDownloading = true;
    this.downloadedEvent = undefined;
    this.activeController = new AbortController();
    const run = async () => {
      try {
        let record = await this.verifiedRecord();
        if (
          !record ||
          record.version !== artifact.version ||
          record.url !== artifact.url ||
          record.sha512 !== artifact.sha512
        ) {
          const targetPath = this.getTargetPath(artifact);
          await downloadNodeFile({
            url: artifact.url,
            targetPath,
            identity: `${artifact.version}:${artifact.platform}:${artifact.arch}:${artifact.fileName}:${artifact.sha512}`,
            headers: this.getArtifactRequestHeaders(artifact.url),
            expectedSha512: artifact.sha512,
            expectedBytes: artifact.size,
            transport: requestUpdateUrl,
            onProgress: (progress) => this.emitProgress(progress),
            signal: this.activeController?.signal,
          });
          const stat = fs.statSync(targetPath);
          this.lastVerifiedFile = {
            filePath: targetPath,
            size: stat.size,
            mtimeMs: stat.mtimeMs,
            sha512: artifact.sha512,
          };
          record = { ...artifact, downloadedFile: targetPath };
          this.writeRecord(record);
          this.cleanupStaleInstallers(artifact.fileName);
        }
        this.emitDownloaded(record);
      } catch (error) {
        this.emitError(error);
        throw createUpdateError(
          getUpdateError(classifyNodeError(error), 'download'),
        );
      } finally {
        this.isDownloading = false;
        this.activeController = undefined;
      }
    };
    this.activeDownload = run();
    try {
      await this.activeDownload;
    } finally {
      this.activeDownload = undefined;
    }
  }

  private async stageMacUpdate(record: ICacheRecord): Promise<void> {
    const identity = `${record.version}:${record.sha512}:${record.url}`;
    if (this.macStagedIdentity === identity) return;
    this.macFeedServer?.close();
    const user = 'autoupdater';
    const pass = crypto.randomBytes(48).toString('base64url');
    const credential = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
    const fileToken = `${crypto.randomBytes(32).toString('hex')}.zip`;
    const server = http.createServer((request, response) => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      if (request.url === '/') {
        if (request.headers.authorization !== credential) {
          response.writeHead(401).end();
          return;
        }
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(
          JSON.stringify({ url: `http://127.0.0.1:${port}/${fileToken}` }),
        );
        return;
      }
      // Electron 43 Squirrel.Mac does not forward feed headers to ZIP requests.
      // The random path is the loopback ZIP request's bearer credential.
      if (request.url !== `/${fileToken}`) {
        response.writeHead(404).end();
        return;
      }
      let size: number;
      try {
        size = fs.statSync(record.downloadedFile).size;
      } catch {
        response.writeHead(404).end();
        return;
      }
      const stream = fs.createReadStream(record.downloadedFile);
      stream.once('error', () => response.destroy());
      response.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Length': size,
      });
      stream.pipe(response);
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    this.macFeedServer = server;
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw createUpdateError({
        code: EUpdateErrorCode.installFailed,
        step: 'install',
      });
    }
    try {
      await new Promise<void>((resolve, reject) => {
        const timer: { id?: ReturnType<typeof setTimeout> } = {};
        let onDownloaded = () => {};
        let onError = (_error: Error) => {};
        const cleanup = () => {
          clearTimeout(timer.id);
          autoUpdater.removeListener('update-downloaded', onDownloaded);
          autoUpdater.removeListener('error', onError);
          server.close();
          if (this.macFeedServer === server) {
            this.macFeedServer = undefined;
          }
        };
        onDownloaded = () => {
          cleanup();
          resolve();
        };
        onError = (error: Error) => {
          cleanup();
          reject(error);
        };
        timer.id = setTimeout(() => {
          cleanup();
          reject(
            createUpdateError({
              code: EUpdateErrorCode.timeout,
              step: 'install',
            }),
          );
        }, 120_000);
        autoUpdater.once('update-downloaded', onDownloaded);
        autoUpdater.once('error', onError);
        autoUpdater.setFeedURL({
          url: `http://127.0.0.1:${address.port}`,
          headers: { Authorization: credential, 'Cache-Control': 'no-cache' },
        });
        try {
          autoUpdater.checkForUpdates();
        } catch (error) {
          cleanup();
          reject(error);
        }
      });
      this.macStagedIdentity = identity;
    } catch (error) {
      server.close();
      this.macFeedServer = undefined;
      throw error;
    }
  }

  async downloadASC(params: IInstallUpdateParams): Promise<boolean> {
    try {
      return await this.downloadASCInternal(params);
    } catch (error) {
      throw wrapAppUpdateOperationError(error, 'downloadASC');
    }
  }

  private async downloadASCInternal(
    params: IInstallUpdateParams,
  ): Promise<boolean> {
    if (this.cacheClearPromise) await this.cacheClearPromise;
    if (this.installInProgress) {
      throw createUpdateError({
        code: EUpdateErrorCode.installFailed,
        step: 'downloadASC',
      });
    }
    const metadataGeneration = this.metadataGeneration;
    store.clearASCFile();
    const record = await this.assertVerifiedRecord(params);
    if (this.isSkipGPGAllowed(params.skipGPGVerification)) return true;
    const ascUrl = new URL(record.url);
    ascUrl.pathname += '.SHA256SUMS.asc';
    const headers = await withCustomUAHeaders(
      ascUrl.toString(),
      this.getArtifactRequestHeaders(ascUrl.toString()),
    );
    if (metadataGeneration !== this.metadataGeneration) {
      throw createUpdateError({
        code: EUpdateErrorCode.cancelled,
        step: 'downloadASC',
      });
    }
    const text = await this.requestMetadata(ascUrl.toString(), headers);
    if (metadataGeneration !== this.metadataGeneration) {
      throw createUpdateError({
        code: EUpdateErrorCode.cancelled,
        step: 'downloadASC',
      });
    }
    if (!text) return false;
    store.setASCFile(text);
    return true;
  }

  async getSha256(expectedFileName?: string): Promise<string> {
    const asc = store.getASCFile();
    if (!asc) return '';
    try {
      const message = await readCleartextMessage({ cleartextMessage: asc });
      const key = await readKey({ armoredKey: PUBLIC_KEY });
      const signatures = await message.verify([key]);
      const valid = Boolean(signatures[0]) && (await signatures[0].verified);
      if (!valid) {
        throw createUpdateError({
          code: EUpdateErrorCode.integrityFailed,
          step: 'verifyASC',
        });
      }
      const lines = message
        .getText()
        .trim()
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      let checksum = '';
      if (expectedFileName) {
        for (const line of lines) {
          const tokens = line.split(/\s+/);
          if (tokens.length >= 2) {
            const signedName = path.basename(tokens[1].replace(/^\*/, ''));
            if (signedName === expectedFileName) {
              checksum = tokens[0];
              break;
            }
          }
        }
      } else {
        checksum = lines[0]?.split(/\s+/)[0] ?? '';
      }
      return /^[a-fA-F0-9]{64}$/.test(checksum) ? checksum.toLowerCase() : '';
    } catch {
      throw createUpdateError({
        code: EUpdateErrorCode.integrityFailed,
        step: 'verifyASC',
      });
    }
  }

  async verifyASC(params?: IInstallUpdateParams): Promise<boolean> {
    try {
      if (!params) return false;
      const record = await this.verifiedRecord(params);
      if (!record) return false;
      if (this.isSkipGPGAllowed(params.skipGPGVerification)) return true;
      return Boolean(await this.getSha256(record.fileName));
    } catch (error) {
      throw wrapAppUpdateOperationError(error, 'verifyASC');
    }
  }

  private async verifySha256(
    downloadedFile: string,
    sha256: string,
  ): Promise<boolean> {
    const expected = sha256.toLowerCase();
    const actual = await hashFile(downloadedFile, 'sha256');
    return actual === expected;
  }

  async verifyFile(params: IInstallUpdateParams): Promise<boolean> {
    try {
      const record = await this.assertVerifiedRecord(params);
      if (this.isSkipGPGAllowed(params.skipGPGVerification)) return true;
      const sha256 = await this.getSha256(record.fileName);
      return Boolean(
        sha256 && (await this.verifySha256(record.downloadedFile, sha256)),
      );
    } catch (error) {
      throw wrapAppUpdateOperationError(error, 'verifyPackage');
    }
  }

  async verifyPackage(params: IInstallUpdateParams): Promise<boolean> {
    return this.verifyFile(params);
  }

  private async getInstallRecord(
    params: IInstallUpdateParams,
  ): Promise<ICacheRecord> {
    const record = await this.assertVerifiedRecord(params);
    if (
      !params.latestVersion ||
      params.latestVersion !== record.version ||
      params.downloadUrl !== record.url
    ) {
      throw createUpdateError({
        code: EUpdateErrorCode.packageMissing,
        step: 'install',
      });
    }
    if (!(await this.verifyFile(params))) {
      throw createUpdateError({
        code: EUpdateErrorCode.integrityFailed,
        step: 'install',
      });
    }
    return record;
  }

  private async launchWindowsInstaller(record: ICacheRecord): Promise<void> {
    const args = ['--updated', '--force-run'];
    const start = (file: string, argv: string[]): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        const child = spawn(file, argv, {
          cwd: path.dirname(file),
          detached: true,
          stdio: 'ignore',
        });
        child.once('error', reject);
        child.once('spawn', () => {
          child.unref();
          resolve();
        });
      });
    try {
      await start(record.downloadedFile, args);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EACCES' && code !== 'UNKNOWN') throw error;
      await start(path.join(process.resourcesPath, 'elevate.exe'), [
        record.downloadedFile,
        ...args,
      ]);
    }
  }

  private canAutoInstallAppImage(): boolean {
    const current = process.env.APPIMAGE;
    if (!current || !path.isAbsolute(current)) return false;
    try {
      const stat = fs.statSync(current);
      fs.accessSync(current, fs.constants.W_OK);
      fs.accessSync(path.dirname(current), fs.constants.W_OK);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  private async installAppImage(
    record: ICacheRecord,
    buildNumber: string,
  ): Promise<boolean> {
    const current = process.env.APPIMAGE;
    if (!this.canAutoInstallAppImage() || !current) {
      await this.manualInstallPackage({
        buildNumber: '',
        downloadUrl: record.url,
        latestVersion: record.version,
      });
      return true;
    }
    const oldName = path.basename(current);
    const destination =
      oldName === record.fileName || !/\d+\.\d+\.\d+/.test(oldName)
        ? current
        : path.join(path.dirname(current), record.fileName);
    const nonce = crypto.randomBytes(8).toString('hex');
    const staging = path.join(
      path.dirname(destination),
      `.${record.fileName}.${nonce}.new`,
    );
    const backup = `${destination}.${nonce}.old`;
    let renamed = false;
    let handoffQueued = false;
    const marker = this.getAppImageHandoffPath();
    if (fs.existsSync(marker)) {
      throw createUpdateError({
        code: EUpdateErrorCode.installFailed,
        step: 'install',
      });
    }
    this.appImageInstallInProgress = true;
    try {
      await fs.promises.copyFile(
        record.downloadedFile,
        staging,
        fs.constants.COPYFILE_EXCL,
      );
      await fs.promises.chmod(staging, 0o755);
      if (fs.existsSync(destination)) {
        try {
          await fs.promises.link(destination, backup);
        } catch {
          await fs.promises.copyFile(destination, backup);
        }
      }
      await fs.promises.rename(staging, destination);
      renamed = true;
      const handoff: IAppImageHandoff = {
        current,
        destination,
        backup: fs.existsSync(backup) ? backup : undefined,
        version: record.version,
        buildNumber,
      };
      fs.mkdirSync(this.getCacheDir(), { recursive: true });
      fs.writeFileSync(marker, JSON.stringify(handoff), { mode: 0o600 });
      app.relaunch({ execPath: destination, args: process.argv.slice(1) });
      handoffQueued = true;
      app.quit();
      this.installHandoffStarted = true;
      return true;
    } catch (error) {
      if (!handoffQueued) {
        fs.rmSync(marker, { force: true });
        if (renamed && fs.existsSync(backup)) {
          await fs.promises.rename(backup, destination);
        } else if (renamed) {
          await fs.promises.rm(destination, { force: true });
        } else {
          await fs.promises.rm(backup, { force: true });
        }
      }
      throw error;
    } finally {
      try {
        await fs.promises.rm(staging, { force: true });
      } catch (error) {
        logger.warn('auto-updater', 'AppImage temporary cleanup failed', error);
      }
      if (!handoffQueued) this.appImageInstallInProgress = false;
    }
  }

  async installPackage(params: IInstallUpdateParams): Promise<boolean> {
    if (this.installInProgress) return false;
    this.installInProgress = true;
    try {
      // Drain cache clearing/downloads before reading the package to install.
      if (this.cacheClearPromise) await this.cacheClearPromise;
      await this.activeDownload;
      this.metadataGeneration += 1;
      this.metadataControllers.forEach((controller) => controller.abort());
      await Promise.allSettled(this.metadataRequests);
      return await this.installPackageLocked(params);
    } catch (error) {
      const classified = getUpdateError(classifyNodeError(error), 'install');
      throw createUpdateError({
        ...classified,
        code:
          classified.code === EUpdateErrorCode.unknown
            ? EUpdateErrorCode.installFailed
            : classified.code,
      });
    } finally {
      // A successful handoff remains locked until this process exits.
      if (!this.installHandoffStarted) this.installInProgress = false;
    }
  }

  private async installPackageLocked(
    params: IInstallUpdateParams,
  ): Promise<boolean> {
    if (isStoreVersion) return false;
    const selection = await dialog.showMessageBox({
      type: 'question',
      buttons: [
        i18nText(ElectronTranslations.update_install_and_restart),
        i18nText(ElectronTranslations.global_later),
      ],
      defaultId: 0,
      message: i18nText(ElectronTranslations.update_new_update_downloaded),
    });
    if (selection.response !== 0) return false;
    const record = await this.getInstallRecord(params);
    if (isMac) {
      if (this.macInstallInProgress) return false;
      this.macInstallInProgress = true;
      let staged = false;
      let mainWindow: BrowserWindow | undefined;
      let mainWindowClosed = false;
      let recoverAfterClose = false;
      let onMainWindowClosed: (() => void) | undefined;
      const windowAllClosedListeners = app.listeners('window-all-closed');
      const windowCloseListeners = BrowserWindow.getAllWindows().map(
        (window) => ({ window, listeners: window.listeners('close') }),
      );
      let nativeQuitTimeout: ReturnType<typeof setTimeout> | undefined;
      const onBeforeQuitForUpdate = () => {
        nativeQuitTimeout = setTimeout(() => {
          logger.warn(
            'auto-updater',
            'Native update quit timed out; forcing exit',
          );
          app.exit();
        }, 15_000);
      };
      try {
        await this.stageMacUpdate(record);
        staged = true;
        mainWindow = this.getMainWindow();
        onMainWindowClosed = () => {
          mainWindowClosed = true;
          if (recoverAfterClose) app.emit('activate');
        };
        mainWindow?.once('closed', onMainWindowClosed);
        // Once Squirrel has staged an update, it may apply on the next launch.
        // Native handoff must proceed without another cancellable async step.
        app.removeAllListeners('window-all-closed');
        BrowserWindow.getAllWindows().forEach((window) => {
          if (!window.isDestroyed()) {
            window.removeAllListeners('close');
            window.close();
          }
        });
        autoUpdater.once('before-quit-for-update', onBeforeQuitForUpdate);
        store.setUpdateBuildNumber(params.buildNumber);
        autoUpdater.quitAndInstall();
        this.installHandoffStarted = true;
        return true;
      } catch (error) {
        if (staged) {
          autoUpdater.removeListener(
            'before-quit-for-update',
            onBeforeQuitForUpdate,
          );
          if (nativeQuitTimeout) clearTimeout(nativeQuitTimeout);
          windowAllClosedListeners.forEach((listener) => {
            if (!app.listeners('window-all-closed').includes(listener)) {
              app.on('window-all-closed', listener as () => void);
            }
          });
          windowCloseListeners.forEach(({ window, listeners }) => {
            if (!window.isDestroyed()) {
              listeners.forEach((listener) => {
                if (!window.listeners('close').includes(listener)) {
                  window.on('close', listener as () => void);
                }
              });
            }
          });
          recoverAfterClose = true;
          if (!mainWindow || mainWindowClosed) {
            app.emit('activate');
          } else {
            await new Promise<void>((resolve) => {
              const timer: { id?: ReturnType<typeof setTimeout> } = {};
              const onClosed = () => {
                clearTimeout(timer.id);
                resolve();
              };
              timer.id = setTimeout(() => {
                mainWindow?.removeListener('closed', onClosed);
                resolve();
              }, 1000);
              mainWindow?.once('closed', onClosed);
            });
            if (!mainWindowClosed && !mainWindow.isDestroyed()) {
              recoverAfterClose = false;
              if (onMainWindowClosed) {
                mainWindow.removeListener('closed', onMainWindowClosed);
              }
              mainWindow.show();
              mainWindow.focus();
            }
          }
          logger.error(
            'auto-updater',
            'Staged macOS update handoff failed',
            error,
          );
        }
        this.macInstallInProgress = false;
        throw error;
      }
    }
    if (isWin) {
      await this.launchWindowsInstaller(record);
      store.setUpdateBuildNumber(params.buildNumber);
      app.quit();
      this.installHandoffStarted = true;
      return true;
    }
    if (isAppImage) return this.installAppImage(record, params.buildNumber);
    await this.manualInstallPackage(params);
    return true;
  }

  async manualInstallPackage(params: IInstallUpdateParams): Promise<void> {
    try {
      const record = await this.getInstallRecord(params);
      const openError = await shell.openPath(
        path.dirname(record.downloadedFile),
      );
      if (openError) {
        throw createUpdateError({
          code: EUpdateErrorCode.installFailed,
          step: 'install',
        });
      }
    } catch (error) {
      const classified = getUpdateError(classifyNodeError(error), 'install');
      throw createUpdateError({
        ...classified,
        code:
          classified.code === EUpdateErrorCode.unknown
            ? EUpdateErrorCode.installFailed
            : classified.code,
      });
    }
  }

  private isDevSettingsEnabled(): boolean {
    return Boolean(store.getDevSettingsEnabled?.());
  }

  async useTestUpdateFeedUrl(enabled = false): Promise<void> {
    if (app.isPackaged && !this.isDevSettingsEnabled()) {
      return;
    }
    store.setUpdateSettings({ useTestFeedUrl: enabled });
  }

  async getPreviousUpdateBuildNumber(): Promise<string> {
    return store.getUpdateBuildNumber() || '';
  }
}

export default DesktopApiAppUpdate;
