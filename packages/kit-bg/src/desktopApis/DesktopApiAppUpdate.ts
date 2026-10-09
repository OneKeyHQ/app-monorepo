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
import type { IInstallUpdateParams } from '@onekeyhq/desktop/app/preload';
import {
  clearWindowProgressBar,
  updateWindowProgressBar,
} from '@onekeyhq/desktop/app/windowProgressBar';
import { buildServiceEndpoint } from '@onekeyhq/shared/src/config/appConfig';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppUpdatePackageAvailabilityStatus,
  EAppUpdatePackageErrorCode,
  type IAppUpdatePackageAvailability,
  type IUpdateDownloadedEvent,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update/type';
import { withCustomUAHeaders } from '@onekeyhq/shared/src/request/customUA';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import { getDownloadedFileAvailability } from './appUpdatePackageAvailability';
import { requestUpdateUrl } from './electronUpdateRequest';
import { downloadNodeFile } from './nodeDownload';

import type { IDesktopApi } from './base/types';

export interface ILatestVersion {
  version: string;
  releaseDate: string;
  isManualCheck?: boolean;
}

export interface IUpdateProgressUpdate {
  percent: number;
  delta: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

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
    throw new OneKeyLocalError('App update artifact must use HTTPS');
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
): IArtifact {
  if (feed.version !== selectedVersion || !Array.isArray(feed.files)) {
    throw new OneKeyLocalError('App update feed version mismatch');
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
  const arch = getRuntimeArch();
  // electron-builder names x64 AppImages with the Linux artifact arch x86_64.
  const artifactArch = isLinux && arch === 'x64' ? 'x86_64' : arch;
  const archMarker = `-${artifactArch}.`;
  const matching = files.filter((file) =>
    new URL(file.url, baseUrl).pathname.includes(archMarker),
  );
  const universal = isMac
    ? files.filter((file) =>
        new URL(file.url, baseUrl).pathname.includes('-universal.'),
      )
    : [];
  if (matching.length > 1) {
    throw new OneKeyLocalError('App update feed artifact is ambiguous');
  }
  const selected = matching.length === 1 ? matching : universal;
  if (selected.length !== 1) {
    throw new OneKeyLocalError('App update feed artifact missing or ambiguous');
  }
  const file = selected[0];
  if (!/^[A-Za-z0-9+/]{86}==$/.test(file.sha512)) {
    throw new OneKeyLocalError('App update feed SHA-512 is invalid');
  }
  if (
    file.size !== undefined &&
    (!Number.isSafeInteger(file.size) || file.size <= 0)
  ) {
    throw new OneKeyLocalError('App update feed size is invalid');
  }
  const url = resolveArtifactUrl(file.url, baseUrl);
  const fileName = path.basename(new URL(url).pathname);
  if (!fileName || fileName === '.' || fileName === '..') {
    throw new OneKeyLocalError('App update artifact name is invalid');
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
  );
  if (response.statusCode !== 200) {
    response.destroy();
    throw new OneKeyLocalError(`HTTP ${response.statusCode}`);
  }
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of response) {
    const bytes = chunk as Buffer;
    length += bytes.length;
    if (length > MAX_FEED_BYTES) {
      response.destroy();
      throw new OneKeyLocalError('App update metadata too large');
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

  private isSkipGPGAllowed(skip?: boolean): boolean {
    return (
      process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION === 'true' && Boolean(skip)
    );
  }

  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
    if (isAppImage) this.reconcileAppImageHandoff();
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
          (handoff.destination !== handoff.current ||
            !handoff.backup.startsWith(handoff.current) ||
            !/^\.[0-9a-f]{16}\.old$/.test(
              handoff.backup.slice(handoff.current.length),
            ))) ||
        (handoff.destination === handoff.current && !handoff.backup)
      ) {
        throw new OneKeyLocalError('Invalid AppImage handoff');
      }
      if (
        app.getVersion() === handoff.version &&
        process.env.APPIMAGE === handoff.destination
      ) {
        store.setUpdateBuildNumber(handoff.buildNumber);
        if (handoff.destination !== handoff.current) {
          fs.rmSync(handoff.current, { force: true });
        } else if (handoff.backup) {
          fs.rmSync(handoff.backup, { force: true });
        }
      } else if (
        app.getVersion() !== handoff.version &&
        (process.env.APPIMAGE === handoff.current ||
          process.env.APPIMAGE === handoff.backup)
      ) {
        if (handoff.backup && fs.existsSync(handoff.backup)) {
          fs.renameSync(handoff.backup, handoff.current);
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

  private readRecord(): ICacheRecord | undefined {
    try {
      const record = JSON.parse(
        fs.readFileSync(this.getRecordPath(), 'utf8'),
      ) as ICacheRecord;
      if (
        path.basename(record.fileName) !== record.fileName ||
        record.platform !== process.platform ||
        record.arch !== getRuntimeArch() ||
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
    downloadedFile?: string,
  ): Promise<ICacheRecord | undefined> {
    const record = this.readRecord();
    if (
      !record ||
      (downloadedFile && downloadedFile !== record.downloadedFile)
    ) {
      return undefined;
    }
    const availability = getDownloadedFileAvailability(record.downloadedFile);
    if (availability.status !== EAppUpdatePackageAvailabilityStatus.available) {
      return undefined;
    }
    if (
      record.size &&
      fs.statSync(record.downloadedFile).size !== record.size
    ) {
      return undefined;
    }
    const actual = await hashFile(record.downloadedFile, 'sha512');
    return actual === record.sha512 ? record : undefined;
  }

  private async assertVerifiedRecord(
    downloadedFile?: string,
  ): Promise<ICacheRecord> {
    const record = await this.verifiedRecord(downloadedFile);
    if (!record) {
      throw new OneKeyLocalError(EAppUpdatePackageErrorCode.packageMissing);
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

  async checkDownloadedFileExists(downloadedFile: string): Promise<boolean> {
    return Boolean(await this.verifiedRecord(downloadedFile));
  }

  async getDownloadedFileAvailability(
    downloadedFile?: string,
  ): Promise<IAppUpdatePackageAvailability> {
    if (!downloadedFile) {
      return { status: EAppUpdatePackageAvailabilityStatus.missing };
    }
    const record = this.readRecord();
    if (!record || record.downloadedFile !== downloadedFile) {
      return { status: EAppUpdatePackageAvailabilityStatus.notPrepared };
    }
    const availability = getDownloadedFileAvailability(downloadedFile);
    if (availability.status !== EAppUpdatePackageAvailabilityStatus.available) {
      return availability;
    }
    return (await this.verifiedRecord(downloadedFile))
      ? availability
      : { status: EAppUpdatePackageAvailabilityStatus.notPrepared };
  }

  async clearUpdateCache(): Promise<void> {
    if (this.installInProgress) {
      throw new OneKeyLocalError('App update installation is in progress');
    }
    if (this.cacheClearPromise) return this.cacheClearPromise;
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
      this.isDownloading = false;
      store.clearASCFile();
      fs.rmSync(this.getCacheDir(), { recursive: true, force: true });
    })();
    try {
      await this.cacheClearPromise;
    } finally {
      this.cacheClearPromise = undefined;
    }
  }

  async clearUpdateSettings(): Promise<void> {
    store.clearUpdateSettings();
  }

  async checkForUpdates(
    isManual = false,
    requestHeaders: Record<string, string> = {},
    latestVersion: string,
  ): Promise<IArtifact | null> {
    if (this.cacheClearPromise) await this.cacheClearPromise;
    if (this.installInProgress) {
      throw new OneKeyLocalError('App update installation is in progress');
    }
    this.isManualCheck = isManual;
    const metadataGeneration = this.metadataGeneration;
    if (!latestVersion || isStoreVersion) return null;
    if (
      !semver.valid(latestVersion) ||
      !semver.gt(latestVersion, app.getVersion())
    ) {
      throw new OneKeyLocalError('App update target version is invalid');
    }
    const feedBase = buildFeedUrl(
      store.getUpdateSettings().useTestFeedUrl,
      latestVersion,
    );
    const feedUrl = makeFeedFileUrl(feedBase);
    const headers = await withCustomUAHeaders(feedUrl, requestHeaders);
    if (metadataGeneration !== this.metadataGeneration) {
      throw new OneKeyLocalError('Download cancelled');
    }
    const raw = await this.requestMetadata(feedUrl, headers);
    if (metadataGeneration !== this.metadataGeneration) {
      throw new OneKeyLocalError('Download cancelled');
    }
    const parsed = YAML.parse(raw) as IFeedData;
    const artifact = selectArtifact(parsed, latestVersion, feedBase);
    this.selectedArtifact = artifact;
    this.latestVersion = {
      version: artifact.version,
      releaseDate: artifact.releaseDate,
      isManualCheck: isManual,
    };
    this.requestHeaders = headers;
    this.getMainWindow()?.webContents.send(
      ipcMessageKeys.UPDATE_DOWNLOAD_FILE_INFO,
      artifact.url,
    );
    return artifact;
  }

  private requestHeaders: Record<string, string> = {};

  private emitProgress(progress: IUpdateProgressUpdate): void {
    this.getMainWindow()?.webContents.send(
      ipcMessageKeys.UPDATE_DOWNLOADING,
      progress,
    );
    updateWindowProgressBar(this.getMainWindow(), progress.percent);
  }

  private emitDownloaded(record: ICacheRecord): void {
    this.downloadedEvent = {
      version: record.version,
      downloadedFile: record.downloadedFile,
      downloadUrl: record.url,
    };
    this.getMainWindow()?.webContents.send(
      ipcMessageKeys.UPDATE_DOWNLOADED,
      this.downloadedEvent,
    );
    clearWindowProgressBar(this.getMainWindow());
  }

  private emitError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('auto-updater', message);
    this.getMainWindow()?.webContents.send(ipcMessageKeys.UPDATE_ERROR, {
      message,
    });
    clearWindowProgressBar(this.getMainWindow());
  }

  async downloadUpdate(): Promise<void> {
    if (this.installInProgress) {
      throw new OneKeyLocalError('App update installation is in progress');
    }
    if (this.isDownloading) return;
    const artifact = this.selectedArtifact;
    if (!artifact)
      throw new OneKeyLocalError('App update artifact was not selected');
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
            identity: `${artifact.version}:${artifact.platform}:${artifact.arch}:${artifact.url}:${artifact.sha512}`,
            headers: this.requestHeaders,
            expectedSha512: artifact.sha512,
            expectedBytes: artifact.size,
            transport: requestUpdateUrl,
            onProgress: (progress) => this.emitProgress(progress),
            signal: this.activeController?.signal,
          });
          record = { ...artifact, downloadedFile: targetPath };
          this.writeRecord(record);
        }
        this.emitDownloaded(record);
      } catch (error) {
        this.emitError(error);
        throw error;
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
      const stream = fs.createReadStream(record.downloadedFile);
      stream.once('error', () => response.destroy());
      response.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Length': fs.statSync(record.downloadedFile).size,
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
      throw new OneKeyLocalError('Mac update feed did not bind');
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
          reject(new OneKeyLocalError('Squirrel.Mac staging timed out'));
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
    if (this.cacheClearPromise) await this.cacheClearPromise;
    if (this.installInProgress) {
      throw new OneKeyLocalError('App update installation is in progress');
    }
    const metadataGeneration = this.metadataGeneration;
    store.clearASCFile();
    if (this.isSkipGPGAllowed(params.skipGPGVerification)) return true;
    const record = await this.assertVerifiedRecord(params.downloadedFile);
    if (params.downloadUrl !== record.url) return false;
    const ascUrl = new URL(record.url);
    ascUrl.pathname += '.SHA256SUMS.asc';
    const headers = await withCustomUAHeaders(
      ascUrl.toString(),
      this.requestHeaders,
    );
    if (metadataGeneration !== this.metadataGeneration) {
      throw new OneKeyLocalError('Download cancelled');
    }
    const text = await this.requestMetadata(ascUrl.toString(), headers);
    if (metadataGeneration !== this.metadataGeneration) {
      throw new OneKeyLocalError('Download cancelled');
    }
    if (!text) return false;
    store.setASCFile(text);
    return true;
  }

  async getSha256(): Promise<string> {
    const asc = store.getASCFile();
    if (!asc) return '';
    try {
      const message = await readCleartextMessage({ cleartextMessage: asc });
      const key = await readKey({ armoredKey: PUBLIC_KEY });
      const signatures = await message.verify([key]);
      await signatures[0].verified;
      const checksum = message.getText().trim().split(/\s+/)[0];
      return /^[a-fA-F0-9]{64}$/.test(checksum) ? checksum.toLowerCase() : '';
    } catch {
      throw new OneKeyLocalError(
        ElectronTranslations.update_signature_verification_failed_alert_text,
      );
    }
  }

  async verifyASC(params?: IInstallUpdateParams): Promise<boolean> {
    return (
      this.isSkipGPGAllowed(params?.skipGPGVerification) ||
      Boolean(await this.getSha256())
    );
  }

  async verifySha256(downloadedFile: string, sha256: string): Promise<boolean> {
    return (await hashFile(downloadedFile, 'sha256')) === sha256.toLowerCase();
  }

  async verifyFile(params: IInstallUpdateParams): Promise<boolean> {
    const record = await this.assertVerifiedRecord(params.downloadedFile);
    if (params.downloadUrl !== record.url) return false;
    if (this.isSkipGPGAllowed(params.skipGPGVerification)) return true;
    const sha256 = await this.getSha256();
    return Boolean(
      sha256 && (await this.verifySha256(record.downloadedFile, sha256)),
    );
  }

  async verifyPackage(params: IInstallUpdateParams): Promise<boolean> {
    return this.verifyFile(params);
  }

  private async getInstallRecord(
    params: IInstallUpdateParams,
  ): Promise<ICacheRecord> {
    const record = await this.assertVerifiedRecord(params.downloadedFile);
    if (
      !params.latestVersion ||
      params.latestVersion !== record.version ||
      params.downloadUrl !== record.url
    ) {
      throw new OneKeyLocalError(EAppUpdatePackageErrorCode.packageNotPrepared);
    }
    if (!(await this.verifyFile(params))) {
      throw new OneKeyLocalError(
        ElectronTranslations.update_installation_not_safe_alert_text,
      );
    }
    return record;
  }

  private async launchWindowsInstaller(record: ICacheRecord): Promise<void> {
    const args = ['--updated', '--force-run'];
    const start = (file: string, argv: string[]): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        const child = spawn(file, argv, { detached: true, stdio: 'ignore' });
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
        downloadedFile: record.downloadedFile,
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
    if (destination !== current && fs.existsSync(destination)) {
      throw new OneKeyLocalError('AppImage destination already exists');
    }
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
      throw new OneKeyLocalError('AppImage handoff is already pending');
    }
    this.appImageInstallInProgress = true;
    try {
      await fs.promises.copyFile(record.downloadedFile, staging);
      await fs.promises.chmod(staging, 0o755);
      if (destination === current) {
        await fs.promises.link(current, backup);
      }
      await fs.promises.rename(staging, destination);
      renamed = true;
      const handoff: IAppImageHandoff = {
        current,
        destination,
        backup: destination === current ? backup : undefined,
        version: record.version,
        buildNumber,
      };
      fs.mkdirSync(this.getCacheDir(), { recursive: true });
      fs.writeFileSync(marker, JSON.stringify(handoff), { mode: 0o600 });
      app.relaunch({ execPath: destination, args: [] });
      handoffQueued = true;
      app.quit();
      this.installHandoffStarted = true;
      return true;
    } catch (error) {
      if (!handoffQueued) {
        fs.rmSync(marker, { force: true });
        if (renamed && destination === current) {
          await fs.promises.rename(backup, current);
        } else if (renamed) {
          await fs.promises.rm(destination, { force: true });
        } else if (destination === current) {
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
    const record = await this.assertVerifiedRecord(params.downloadedFile);
    if (params.downloadUrl !== record.url || !(await this.verifyFile(params))) {
      throw new OneKeyLocalError(
        ElectronTranslations.update_installation_not_safe_alert_text,
      );
    }
    const openError = await shell.openPath(path.dirname(record.downloadedFile));
    if (openError) throw new OneKeyLocalError(openError);
  }

  async useTestUpdateFeedUrl(enabled = false): Promise<void> {
    store.setUpdateSettings({ useTestFeedUrl: enabled });
  }

  async getPreviousUpdateBuildNumber(): Promise<string> {
    return store.getUpdateBuildNumber() || '';
  }
}

export default DesktopApiAppUpdate;
