import { execFile } from 'child_process';
import crypto from 'crypto';
import { constants as fsConstants, rmSync } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { promisify } from 'util';

import * as Sentry from '@sentry/electron/main';
import {
  BrowserWindow,
  Menu,
  ShareMenu,
  app,
  session,
  shell,
  systemPreferences,
} from 'electron';
import logger from 'electron-log/main';
import si from 'systeminformation';

import type { IDesktopSystemInfo } from '@onekeyhq/desktop/app/config';
import * as store from '@onekeyhq/desktop/app/libs/store';
import type { IMacBundleInfo } from '@onekeyhq/desktop/app/libs/utils';
import {
  getBackgroundColor,
  getMacAppId,
  parseContentPList,
} from '@onekeyhq/desktop/app/libs/utils';
import { restartBridge } from '@onekeyhq/desktop/app/process';
import { getAppStaticResourcesPath } from '@onekeyhq/desktop/app/resoucePath';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { parseLedgerLiveAccountNames } from '@onekeyhq/shared/src/hardware/ledgerLiveAccountNames';
import type { ILedgerLiveAccountNamesResult } from '@onekeyhq/shared/src/hardware/ledgerLiveAccountNames';
import {
  type ITrezorSuiteAccountNamesResult,
  parseTrezorSuiteAccountNames,
} from '@onekeyhq/shared/src/hardware/trezorSuiteAccountNames';
import {
  decryptTrezorSuiteLabelFile,
  pickTrezorSuiteAccountLabel,
} from '@onekeyhq/shared/src/hardware/trezorSuiteLabelDecrypt';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IMediaType, IPrefType } from '@onekeyhq/shared/types/desktop';

import type { IDesktopApi } from './instance/IDesktopApi';

const execFileAsync = promisify(execFile);

// cspell:ignore hidraw udev udevadm pkexec Flathub bubblewrap
const ONEKEY_LINUX_UDEV_RULES_PATH = '/etc/udev/rules.d/99-onekey.rules';
const ONEKEY_LINUX_UDEV_RULES_STATIC_PATH = path.join(
  'udev',
  '99-onekey.rules',
);
const LEDGER_LIVE_APP_JSON_MAX_BYTES = 10 * 1024 * 1024;
const TREZOR_SUITE_INDEXED_DB_MAX_BYTES = 25 * 1024 * 1024;
const TREZOR_SUITE_INDEXED_DB_MAX_FILES = 1000;
const TREZOR_SUITE_SOURCE_READ_TIMEOUT_MS = 10_000;
const TREZOR_SUITE_TEMP_PREFIX = 'onekey-trezor-suite-';
const TREZOR_SUITE_COPY_CHUNK_BYTES = 64 * 1024;
const TREZOR_SUITE_TEMP_REMOVE_RETRIES = 5;
const TREZOR_SUITE_LABEL_FILE_MAX_BYTES = 1 * 1024 * 1024;
const TREZOR_SUITE_LABEL_FILES_MAX = 500;

type ITrezorSuiteSourceAccountWithKeys = {
  metadataKeys?: { fileName: string; aesKey: string }[];
};

// Only the fileSystem provider writes these files locally.
async function attachTrezorSuiteLocalLabels({
  appDataPath,
  sourceAccounts,
}: {
  appDataPath: string;
  sourceAccounts: unknown;
}): Promise<unknown> {
  if (!Array.isArray(sourceAccounts)) {
    return sourceAccounts;
  }
  const metadataDirectory = path.join(
    appDataPath,
    '@trezor',
    'suite-desktop',
    'metadata',
  );
  try {
    const stat = await fs.stat(metadataDirectory);
    if (!stat.isDirectory()) {
      return sourceAccounts;
    }
  } catch {
    return sourceAccounts;
  }

  const labelCache = new Map<string, string | undefined>();
  let readFiles = 0;

  const readLabel = async (fileName: string, aesKey: string) => {
    const cacheKey = `${fileName}:${aesKey}`;
    if (labelCache.has(cacheKey)) {
      return labelCache.get(cacheKey);
    }
    let label: string | undefined;
    // Bare file name only: a crafted entry must not escape the directory.
    if (
      readFiles < TREZOR_SUITE_LABEL_FILES_MAX &&
      fileName === path.basename(fileName) &&
      fileName.endsWith('.mtdt')
    ) {
      readFiles += 1;
      const filePath = path.join(metadataDirectory, fileName);
      try {
        const stat = await fs.stat(filePath);
        if (stat.isFile() && stat.size <= TREZOR_SUITE_LABEL_FILE_MAX_BYTES) {
          label = pickTrezorSuiteAccountLabel(
            decryptTrezorSuiteLabelFile({
              fileContent: await fs.readFile(filePath, 'utf8'),
              aesKeyHex: aesKey,
              createDecipheriv: crypto.createDecipheriv as never,
            }),
          );
        }
      } catch {
      }
    }
    labelCache.set(cacheKey, label);
    return label;
  };

  const result: unknown[] = [];
  for (const account of sourceAccounts) {
    const keys =
      (account as ITrezorSuiteSourceAccountWithKeys)?.metadataKeys ?? [];
    let accountLabel: string | undefined;
    for (const key of keys) {
      accountLabel = await readLabel(key.fileName, key.aesKey);
      if (accountLabel) {
        break;
      }
    }
    result.push(
      accountLabel ? { ...(account as object), accountLabel } : account,
    );
  }
  return result;
}

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

async function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
  message: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function removeTrezorSuiteTemporaryProfile(
  temporaryProfile: string,
): Promise<boolean> {
  for (
    let attempt = 0;
    attempt < TREZOR_SUITE_TEMP_REMOVE_RETRIES;
    attempt += 1
  ) {
    try {
      await fs.rm(temporaryProfile, { recursive: true, force: true });
      return true;
    } catch {
      await delay(100 * (attempt + 1));
    }
  }
  return false;
}

async function cleanupStaleTrezorSuiteTemporaryProfiles(
  temporaryRoot: string,
): Promise<void> {
  try {
    const entries = await fs.readdir(temporaryRoot, { withFileTypes: true });
    await Promise.all(
      entries
        .filter(
          (entry) =>
            entry.isDirectory() &&
            entry.name.startsWith(TREZOR_SUITE_TEMP_PREFIX),
        )
        .map(async (entry) => {
          const profilePath = path.join(temporaryRoot, entry.name);
          if (!(await removeTrezorSuiteTemporaryProfile(profilePath))) {
            logger.warn(
              '[TrezorSuiteSource] could not remove stale temporary profile',
            );
          }
        }),
    );
  } catch {
    // The OS temp directory may not exist yet.
  }
}

const normalizeCanonicalPath = (targetPath: string) => {
  const normalized = path.normalize(targetPath);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
};

async function assertTrezorSuiteSourceDirectory({
  appDataPath,
  sourceDbPath,
}: {
  appDataPath: string;
  sourceDbPath: string;
}): Promise<void> {
  const resolvedRoot = path.resolve(appDataPath);
  const resolvedSource = path.resolve(sourceDbPath);
  const relativeSource = path.relative(resolvedRoot, resolvedSource);
  if (
    !relativeSource ||
    relativeSource.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeSource)
  ) {
    throw new OneKeyLocalError('Invalid Trezor Suite source path');
  }

  const canonicalRoot = await fs.realpath(resolvedRoot);
  const canonicalSource = await fs.realpath(resolvedSource);
  const expectedCanonicalSource = path.resolve(canonicalRoot, relativeSource);
  if (
    normalizeCanonicalPath(canonicalSource) !==
    normalizeCanonicalPath(expectedCanonicalSource)
  ) {
    throw new OneKeyLocalError('Trezor Suite source directory is redirected');
  }

  let currentPath = resolvedRoot;
  const pathParts = relativeSource.split(path.sep).filter(Boolean);
  for (const part of pathParts) {
    currentPath = path.join(currentPath, part);
    const currentStat = await fs.lstat(currentPath);
    if (!currentStat.isDirectory() || currentStat.isSymbolicLink()) {
      throw new OneKeyLocalError(
        'Trezor Suite source path contains a redirected directory',
      );
    }
  }
}

const isSameFileIdentity = (
  pathStat: Awaited<ReturnType<typeof fs.lstat>>,
  fileStat: Awaited<ReturnType<Awaited<ReturnType<typeof fs.open>>['stat']>>,
) =>
  pathStat.dev === fileStat.dev &&
  pathStat.ino === fileStat.ino &&
  pathStat.size === fileStat.size;

async function copyRegularFileAtVerifiedSize({
  sourcePath,
  destinationPath,
  maximumBytes,
}: {
  sourcePath: string;
  destinationPath: string;
  maximumBytes: number;
}): Promise<number> {
  const source = await fs.open(
    sourcePath,
    fsConstants.O_RDONLY |
      (process.platform === 'win32' ? 0 : fsConstants.O_NOFOLLOW),
  );
  let destination: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    const sourceStat = await source.stat();
    const sourcePathStat = await fs.lstat(sourcePath);
    if (
      maximumBytes < 0 ||
      !sourceStat.isFile() ||
      !sourcePathStat.isFile() ||
      sourcePathStat.isSymbolicLink() ||
      !isSameFileIdentity(sourcePathStat, sourceStat) ||
      sourceStat.size > maximumBytes
    ) {
      throw new OneKeyLocalError(
        'Trezor Suite source file exceeds the safe limit',
      );
    }
    destination = await fs.open(
      destinationPath,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL,
      0o600,
    );
    let offset = 0;
    while (offset < sourceStat.size) {
      const requested = Math.min(
        TREZOR_SUITE_COPY_CHUNK_BYTES,
        sourceStat.size - offset,
      );
      const buffer = Buffer.allocUnsafe(requested);
      const { bytesRead } = await source.read(buffer, 0, requested, offset);
      if (bytesRead <= 0) {
        throw new OneKeyLocalError('Trezor Suite source changed while copying');
      }
      await destination.write(buffer, 0, bytesRead, offset);
      offset += bytesRead;
    }
    const [finalSourceStat, finalSourcePathStat] = await Promise.all([
      source.stat(),
      fs.lstat(sourcePath),
    ]);
    if (
      !isSameFileIdentity(finalSourcePathStat, finalSourceStat) ||
      !isSameFileIdentity(sourcePathStat, finalSourceStat) ||
      finalSourcePathStat.isSymbolicLink() ||
      finalSourceStat.mtimeMs !== sourceStat.mtimeMs ||
      finalSourceStat.ctimeMs !== sourceStat.ctimeMs
    ) {
      throw new OneKeyLocalError('Trezor Suite source changed while copying');
    }
    return sourceStat.size;
  } finally {
    await destination?.close().catch(() => undefined);
    await source.close().catch(() => undefined);
  }
}

// Runtime sandbox detection. This module runs in the Electron MAIN process,
// where `platformEnv` derives `desktopChannel` from a module-load-time snapshot
// of `globalThis.desktopApi` and is subject to init-order races. So we read the
// env directly here. The predicate is intentionally identical to the flatpak
// branch in `getChannel()` (apps/desktop/app/libs/react-native-mock.ts) and
// `buildPlatformInfoForIpc()` — keep the three in sync. `FLATPAK_ID` /
// `container` are real runtime signals (not esbuild `define`s), which is what
// makes them reliable inside the Flathub build that re-extracts our AppImage.
const isFlatpakRuntime = () =>
  Boolean(
    process.env.FLATPAK ||
    process.env.FLATPAK_ID ||
    process.env.container === 'flatpak',
  );

const getNativeStaticResourcesPath = () => {
  const appStaticResourcesPath = getAppStaticResourcesPath();
  return app.isPackaged
    ? path.join(appStaticResourcesPath, 'static')
    : appStaticResourcesPath;
};

const getOneKeyLinuxUdevRulesSourcePath = () =>
  path.join(
    getNativeStaticResourcesPath(),
    ONEKEY_LINUX_UDEV_RULES_STATIC_PATH,
  );

const readOneKeyLinuxUdevRules = memoizee(
  async () =>
    fs.readFile(getOneKeyLinuxUdevRulesSourcePath(), {
      encoding: 'utf8',
    }),
  {
    primitive: true,
    promise: true,
    max: 1,
    normalizer: () => 'onekey-linux-udev-rules',
  },
);

export type IInstallOneKeyUdevRulesResult = {
  supported: boolean;
  installed: boolean;
  alreadyInstalled?: boolean;
  // Sandboxed builds (flatpak/snap) cannot reach the host PolicyKit to install
  // udev rules. When true, the UI should guide the user to install the host
  // udev rules manually (see ServiceHardware.ensureLinuxUdevRules).
  needsManualInstall?: boolean;
  skippedReason?:
    | 'not-linux'
    | 'snap'
    | 'flatpak'
    | 'missing-pkexec'
    | 'cancelled'
    | 'not-authorized'
    | 'failed';
  message?: string;
  stdout?: string;
  stderr?: string;
};

export type IMenuItemType = 'normal' | 'separator' | 'submenu';

export type IMenuItemRole =
  | 'about'
  | 'hide'
  | 'unhide'
  | 'quit'
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'delete'
  | 'selectall'
  | 'reload'
  | 'forcereload'
  | 'toggledevtools'
  | 'resetzoom'
  | 'zoomin'
  | 'zoomout'
  | 'togglefullscreen'
  | 'minimize'
  | 'zoom'
  | 'front'
  | 'help';

export interface IMenuItem {
  label: string;
  submenu: IMenu | null;
  type: IMenuItemType;
  role: IMenuItemRole | null;
  accelerator: string | null;
  icon: string | null;
  // cspell:ignore sublabel
  sublabel: string;
  toolTip: string;
  enabled: boolean;
  visible: boolean;
  checked: boolean;
  acceleratorWorksWhenHidden: boolean;
  registerAccelerator: boolean;
  commandId: number;
  userAccelerator: string | null;
}

export interface IMenu {
  groupsMap: Record<string, unknown>;
  items: IMenuItem[];
}

// The only legitimate producer of share images is the renderer share-card
// canvas (`toDataURL('image/png')`), so the main process accepts nothing but
// a bounded PNG data URI — a compromised renderer must not be able to write
// arbitrary or oversized payloads to disk through this API.
const SHARE_IMAGE_DATA_URI_PREFIX = 'data:image/png;base64,';
// real share cards decode to well under 3 MB
const SHARE_IMAGE_MAX_DECODED_BYTES = 10 * 1024 * 1024;
const PNG_MAGIC_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function decodeShareImagePngOrThrow(base64Image: unknown): Buffer {
  if (
    typeof base64Image !== 'string' ||
    !base64Image.startsWith(SHARE_IMAGE_DATA_URI_PREFIX)
  ) {
    throw new OneKeyLocalError(
      'shareImageFile: only PNG data URIs are accepted',
    );
  }
  const base64Data = base64Image.slice(SHARE_IMAGE_DATA_URI_PREFIX.length);
  // reject oversized payloads from the encoded length (4 chars ≈ 3 bytes)
  // before the decode buffer is ever allocated
  if (base64Data.length > (SHARE_IMAGE_MAX_DECODED_BYTES / 3) * 4 + 4) {
    throw new OneKeyLocalError('shareImageFile: image exceeds the size limit');
  }
  const imageBuffer = Buffer.from(base64Data, 'base64');
  if (
    imageBuffer.length === 0 ||
    imageBuffer.length > SHARE_IMAGE_MAX_DECODED_BYTES
  ) {
    throw new OneKeyLocalError('shareImageFile: image exceeds the size limit');
  }
  if (
    !imageBuffer.subarray(0, PNG_MAGIC_BYTES.length).equals(PNG_MAGIC_BYTES)
  ) {
    throw new OneKeyLocalError('shareImageFile: payload is not a PNG image');
  }
  return imageBuffer;
}

// Shared files must survive the picker long enough for share extensions to
// read them (AirDrop reads only after the user picks a target), then be
// reclaimed deterministically even if this API is never called again.
const SHARE_IMAGE_FILE_STALE_MS = 60 * 60 * 1000;
const SHARE_IMAGE_FILE_DELETE_DELAY_MS = 10 * 60 * 1000;

let isShareDirQuitCleanupRegistered = false;
function registerShareDirQuitCleanup(shareDir: string) {
  if (isShareDirQuitCleanupRegistered) {
    return;
  }
  isShareDirQuitCleanupRegistered = true;
  app.on('will-quit', () => {
    try {
      // sync on purpose: async work is not guaranteed to finish during quit
      rmSync(shareDir, { recursive: true, force: true });
    } catch {
      // best-effort privacy cleanup
    }
  });
}

class DesktopApiSystem {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
  }

  desktopApi: IDesktopApi;

  // Cache system info for 30 minutes to avoid frequent system queries
  private _getSystemInfoInternal = memoizee(
    async (): Promise<IDesktopSystemInfo> => {
      try {
        // Fetch all system information concurrently for better performance
        const [system, cpu, osInfo] = await Promise.all([
          si.system(),
          si.cpu(),
          si.osInfo(),
        ]);

        // Get Sentry data (this shouldn't fail, but wrap in try-catch just in case)
        let sentryContexts;
        try {
          const data = Sentry.getGlobalScope().getScopeData();
          sentryContexts = data.contexts;
        } catch (sentryError) {
          // If Sentry fails, log but don't fail the entire operation
          console.warn('Failed to get Sentry context data:', sentryError);
          sentryContexts = undefined;
        }

        // Only cache if we successfully got all required system info
        const result: IDesktopSystemInfo = {
          sentryContexts,
          system,
          cpu,
          os: osInfo,
        };

        return result;
      } catch (error) {
        // Don't cache failed results - rethrow error so memoizee won't cache it
        console.error('Failed to get system information:', error);
        throw error;
      }
    },
    {
      maxAge: 30 * 60 * 1000, // 30 minutes cache duration
      primitive: true, // no arguments to normalize
      promise: true, // ensure concurrent calls wait for the same promise
      max: 1, // limit to only 1 cached result (since no params)
      normalizer: () => 'system-info', // static key for single cached result
    },
  );

  async getSystemInfo(): Promise<IDesktopSystemInfo> {
    return this._getSystemInfoInternal();
  }

  async getPerfMemoryUsage(): Promise<{ rss?: number } | null> {
    try {
      if (typeof app.getAppMetrics === 'function') {
        const metrics = app.getAppMetrics();
        let workingSetKbTotal = 0;
        for (const m of metrics) {
          const ws = m?.memory?.workingSetSize;
          if (typeof ws === 'number' && Number.isFinite(ws) && ws > 0) {
            workingSetKbTotal += ws;
          }
        }
        if (workingSetKbTotal > 0) {
          return { rss: workingSetKbTotal * 1024 };
        }
      }

      if (typeof process.getProcessMemoryInfo === 'function') {
        const info = await process.getProcessMemoryInfo();
        const residentSetKb = info?.residentSet;
        if (
          typeof residentSetKb === 'number' &&
          Number.isFinite(residentSetKb) &&
          residentSetKb > 0
        ) {
          return { rss: residentSetKb * 1024 };
        }
      }
    } catch {
      // ignore
    }

    return null;
  }

  async reload(): Promise<void> {
    const safelyBrowserWindow =
      globalThis.$desktopMainAppFunctions?.getSafelyBrowserWindow?.();
    safelyBrowserWindow?.reload();
  }

  async quitApp(): Promise<void> {
    globalThis.$desktopMainAppFunctions?.quitOrMinimizeApp?.();
  }

  async restore(): Promise<boolean> {
    globalThis.$desktopMainAppFunctions?.showMainWindow?.();
    return true;
  }

  async focus(): Promise<void> {
    globalThis.$desktopMainAppFunctions?.showMainWindow?.();
  }

  async changeLanguage(lang: string): Promise<void> {
    store.setLanguage(lang);
    globalThis.$desktopMainAppFunctions?.refreshMenu?.();
  }

  async toggleMaximizeWindow(): Promise<void> {
    const safelyBrowserWindow =
      globalThis.$desktopMainAppFunctions?.getSafelyBrowserWindow?.();
    const isMaximized = safelyBrowserWindow?.isMaximized();
    console.log('toggleMaximizeWindow', isMaximized);
    if (isMaximized) {
      // Restore the original window size
      safelyBrowserWindow?.unmaximize();
    } else {
      // Maximized window
      safelyBrowserWindow?.maximize();
    }
  }

  async openPreferences(prefType: IPrefType): Promise<void> {
    const platform = os.type();
    if (platform === 'Darwin') {
      if (prefType === 'notification') {
        const appId = getMacAppId();
        void shell.openExternal(
          `x-apple.systempreferences:com.apple.preference.notifications?id=${appId}`,
        );
        // old version MacOS
        // 'x-apple.systempreferences:com.apple.preference.security?Privacy_Notifications'
      } else if (prefType === 'default') {
        await shell.openExternal(
          'x-apple.systempreferences:com.apple.preference.security',
        );
      } else {
        void shell.openPath(
          '/System/Library/PreferencePanes/Security.prefPane',
        );
      }
    } else if (platform === 'Windows_NT') {
      if (prefType === 'notification') {
        void shell.openExternal('ms-settings:notifications');
      }
      // ref https://docs.microsoft.com/en-us/windows/uwp/launch-resume/launch-settings-app
      if (prefType === 'camera') {
        void shell.openExternal('ms-settings:privacy-webcam');
      }
      // BlueTooth is not supported on desktop currently
    } else {
      // Linux ??
    }
  }

  async openPrivacyPanel(): Promise<void> {
    await shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy',
    );
  }

  // Electron only implements the system share picker (ShareMenu) on macOS;
  // a false return means "no system share on this platform" and callers are
  // expected to hide their share entry or fall back to saving the file.
  async shareImageFile(params: { base64Image: string }): Promise<boolean> {
    if (process.platform !== 'darwin') {
      return false;
    }
    const imageBuffer = decodeShareImagePngOrThrow(params.base64Image);
    const shareDir = path.join(app.getPath('temp'), 'onekey-image-share');
    await fs.mkdir(shareDir, { recursive: true });
    // sweep leftovers from crashed/killed sessions whose delete timers died
    try {
      const entries = await fs.readdir(shareDir);
      const now = Date.now();
      await Promise.all(
        entries.map(async (entry) => {
          const entryPath = path.join(shareDir, entry);
          const stat = await fs.stat(entryPath);
          if (now - stat.mtimeMs > SHARE_IMAGE_FILE_STALE_MS) {
            await fs.unlink(entryPath);
          }
        }),
      );
    } catch {
      // best-effort cleanup only
    }
    // filename is built here, never taken from the renderer, so IPC input
    // cannot influence the write path
    const filePath = path.join(shareDir, `onekey-share-${Date.now()}.png`);
    await fs.writeFile(filePath, imageBuffer);
    const shareMenu = new ShareMenu({ filePaths: [filePath] });
    shareMenu.popup();
    // deterministic reclamation for this file: share extensions read it after
    // the picker closes, so delete well past that window. Electron quits
    // explicitly (pending timers never block exit); quitting before the timer
    // fires is covered by the will-quit cleanup below.
    setTimeout(() => {
      void fs.unlink(filePath).catch(() => {});
    }, SHARE_IMAGE_FILE_DELETE_DELAY_MS);
    registerShareDirQuitCleanup(shareDir);
    return true;
  }

  async getMediaAccessStatus(
    prefType: IMediaType,
  ): Promise<
    'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown'
  > {
    const result = systemPreferences?.getMediaAccessStatus?.(prefType);
    return result || 'unknown';
  }

  async getEnvPath(): Promise<{ [key: string]: string }> {
    const home: string = app.getPath('home');
    const appData: string = app.getPath('appData');
    const userData: string = app.getPath('userData');
    const sessionData: string = app.getPath('sessionData');
    const exe: string = app.getPath('exe');
    const temp: string = app.getPath('temp');
    const module: string = app.getPath('module');
    const desktop: string = app.getPath('desktop');
    const appPath: string = app.getAppPath();
    return {
      userData,
      appPath,
      home,
      appData,
      sessionData,
      exe,
      temp,
      module,
      desktop,
    };
  }

  async readLedgerLiveAccountNames(): Promise<ILedgerLiveAccountNamesResult> {
    const appDataPath = app.getPath('appData');
    const candidates = [
      path.join(appDataPath, 'Ledger Live', 'app.json'),
      path.join(appDataPath, 'ledger-live-desktop', 'app.json'),
    ];

    for (const filePath of candidates) {
      try {
        const stat = await fs.stat(filePath);
        if (!stat.isFile() || stat.size > LEDGER_LIVE_APP_JSON_MAX_BYTES) {
          return { status: 'invalid_source', accounts: [] };
        }
        const content = await fs.readFile(filePath, { encoding: 'utf8' });
        return parseLedgerLiveAccountNames(JSON.parse(content) as unknown);
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
          return { status: 'invalid_source', accounts: [] };
        }
      }
    }
    return { status: 'source_not_found', accounts: [] };
  }

  async readTrezorSuiteAccountNames(): Promise<ITrezorSuiteAccountNamesResult> {
    const appDataPath = app.getPath('appData');
    const sourceDbPath = path.join(
      appDataPath,
      '@trezor',
      'suite-desktop',
      'IndexedDB',
      'file__0.indexeddb.leveldb',
    );
    let sourceEntries: Awaited<ReturnType<typeof fs.readdir>>;
    try {
      await assertTrezorSuiteSourceDirectory({
        appDataPath,
        sourceDbPath,
      });
      sourceEntries = await fs.readdir(sourceDbPath, {
        withFileTypes: true,
      });
      if (
        sourceEntries.length > TREZOR_SUITE_INDEXED_DB_MAX_FILES ||
        sourceEntries.some((entry) => !entry.isFile())
      ) {
        return { status: 'invalid_source', accounts: [] };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        logger.warn(
          '[TrezorSuiteSource] source directory validation failed',
          error,
        );
      }
      return (error as NodeJS.ErrnoException)?.code === 'ENOENT'
        ? { status: 'source_not_found', accounts: [] }
        : { status: 'invalid_source', accounts: [] };
    }

    // Never attach Chromium directly to Trezor Suite's profile. Different
    // Electron versions can update profile metadata, and Suite may own the
    // LevelDB lock. Work from a bounded snapshot in a private temporary profile.
    const temporaryRoot = app.getPath('temp');
    await cleanupStaleTrezorSuiteTemporaryProfiles(temporaryRoot);
    const temporaryProfile = await fs.mkdtemp(
      path.join(temporaryRoot, TREZOR_SUITE_TEMP_PREFIX),
    );
    let sourceWindow: BrowserWindow | undefined;
    let sourceSession: Electron.Session | undefined;
    try {
      const temporaryDbPath = path.join(
        temporaryProfile,
        'IndexedDB',
        'file__0.indexeddb.leveldb',
      );
      await fs.mkdir(temporaryDbPath, { recursive: true });
      let copiedBytes = 0;
      for (const entry of sourceEntries) {
        copiedBytes += await copyRegularFileAtVerifiedSize({
          sourcePath: path.join(sourceDbPath, entry.name),
          destinationPath: path.join(temporaryDbPath, entry.name),
          maximumBytes: TREZOR_SUITE_INDEXED_DB_MAX_BYTES - copiedBytes,
        });
      }
      await assertTrezorSuiteSourceDirectory({
        appDataPath,
        sourceDbPath,
      });
      sourceSession = session.fromPath(temporaryProfile, {
        cache: false,
      });
      sourceWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          session: sourceSession,
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      await sourceWindow.loadURL(
        pathToFileURL(path.join(app.getAppPath(), 'recovery.html')).href,
      );
      const sourceAccounts = (await withTimeout(
        sourceWindow.webContents.executeJavaScript(`
          new Promise((resolve) => {
            let settled = false;
            const finish = (value) => {
              if (!settled) {
                settled = true;
                resolve(value);
              }
            };
            const request = indexedDB.open('trezor-suite');
            request.onerror = () => finish({
              error: request.error?.message || 'open failed',
            });
            request.onsuccess = () => {
              const db = request.result;
              if (!Array.from(db.objectStoreNames).includes('accounts')) {
                finish([]);
                db.close();
                return;
              }
              const transaction = db.transaction('accounts', 'readonly');
              const sourceAccounts = [];
              let scannedAccounts = 0;
              const accountsRequest = transaction
                .objectStore('accounts')
                .openCursor();
              accountsRequest.onerror = () => finish({
                error: accountsRequest.error?.message || 'cursor failed',
              });
              accountsRequest.onsuccess = () => {
                const cursor = accountsRequest.result;
                if (!cursor) {
                  return;
                }
                scannedAccounts += 1;
                if (scannedAccounts > 1000) {
                  transaction.abort();
                  finish({ error: 'account scan limit exceeded' });
                  return;
                }
                const account = cursor.value;
                if (account?.symbol === 'btc') {
                  const used = Array.isArray(account?.addresses?.used)
                    ? account.addresses.used.slice(0, 25)
                    : [];
                  const unused = Array.isArray(account?.addresses?.unused)
                    ? account.addresses.unused.slice(0, 25)
                    : [];
                  const firstAddress = [...used, ...unused].find(
                    (item) =>
                      item &&
                      typeof item.address === 'string' &&
                      typeof item.path === 'string',
                  );
                  // One pair per encryption version.
                  const metadataKeys = [2, 1]
                    .map((version) => account?.metadata?.[version])
                    .filter(
                      (item) =>
                        item &&
                        typeof item.fileName === 'string' &&
                        typeof item.aesKey === 'string',
                    )
                    .map((item) => ({
                      fileName: item.fileName,
                      aesKey: item.aesKey,
                    }));
                  sourceAccounts.push({
                    deviceState: account.deviceState,
                    symbol: account.symbol,
                    index: account.index,
                    accountType: account.accountType,
                    visible: account.visible,
                    address: firstAddress?.address,
                    addressPath: firstAddress?.path,
                    metadataKeys,
                  });
                  if (sourceAccounts.length > 500) {
                    transaction.abort();
                    finish({ error: 'account result limit exceeded' });
                    return;
                  }
                }
                cursor.continue();
              };
              transaction.onerror = () => finish({
                error: transaction.error?.message || 'transaction failed',
              });
              transaction.onabort = () => finish({
                error: transaction.error?.message || 'transaction aborted',
              });
              transaction.oncomplete = () => {
                finish(sourceAccounts);
                db.close();
              };
            };
          })
        `),
        TREZOR_SUITE_SOURCE_READ_TIMEOUT_MS,
        'Trezor Suite source read timed out',
      )) as unknown;
      return parseTrezorSuiteAccountNames(
        await attachTrezorSuiteLocalLabels({ appDataPath, sourceAccounts }),
      );
    } catch (error) {
      logger.warn('[TrezorSuiteSource] local account read failed', error);
      return { status: 'invalid_source', accounts: [] };
    } finally {
      sourceWindow?.destroy();
      if (sourceSession) {
        await withTimeout(
          Promise.all([
            sourceSession.clearStorageData({ storages: ['indexdb'] }),
            sourceSession.clearCache(),
          ]).then(() => {
            sourceSession?.flushStorageData();
          }),
          TREZOR_SUITE_SOURCE_READ_TIMEOUT_MS,
          'Trezor Suite temporary session cleanup timed out',
        ).catch(() => undefined);
      }
      if (!(await removeTrezorSuiteTemporaryProfile(temporaryProfile))) {
        logger.warn(
          '[TrezorSuiteSource] could not remove temporary profile; cleanup will retry later',
        );
      }
    }
  }

  async getBundleInfo(): Promise<IMacBundleInfo | undefined> {
    return parseContentPList();
  }

  async openLoggerFile(): Promise<void> {
    await shell.openPath(path.dirname(logger.transports.file.getFile().path));
  }

  async reloadBridgeProcess(): Promise<boolean> {
    await restartBridge();
    return true;
  }

  async installOneKeyUdevRules(): Promise<IInstallOneKeyUdevRulesResult> {
    if (process.platform !== 'linux') {
      return {
        supported: false,
        installed: false,
        skippedReason: 'not-linux',
      };
    }

    if (process.env.SNAP) {
      return {
        supported: false,
        installed: false,
        needsManualInstall: true,
        skippedReason: 'snap',
        message: 'Snap USB interface authorization is handled by snapd.',
      };
    }

    if (isFlatpakRuntime()) {
      return {
        supported: false,
        installed: false,
        needsManualInstall: true,
        skippedReason: 'flatpak',
        message:
          'Flatpak cannot install host udev rules; the user must install them manually.',
      };
    }

    let rules: string;
    try {
      rules = await readOneKeyLinuxUdevRules();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        supported: true,
        installed: false,
        skippedReason: 'failed',
        message: `OneKey udev rules file is unavailable: ${message}`,
      };
    }

    try {
      const currentRules = await fs.readFile(ONEKEY_LINUX_UDEV_RULES_PATH, {
        encoding: 'utf8',
      });
      if (currentRules === rules) {
        return {
          supported: true,
          installed: true,
          alreadyInstalled: true,
        };
      }
    } catch {
      // Missing or unreadable installed rules are handled by the pkexec installer below.
    }

    try {
      await execFileAsync('sh', ['-c', 'command -v pkexec >/dev/null 2>&1']);
    } catch {
      return {
        supported: false,
        installed: false,
        skippedReason: 'missing-pkexec',
        message: 'pkexec is required to install OneKey udev rules.',
      };
    }

    const installScript = `
set -e
install -Dm644 "$1" "$2"
if command -v udevadm >/dev/null 2>&1; then
  udevadm control --reload-rules
  udevadm trigger --subsystem-match=usb --attr-match=idVendor=1209 || true
  udevadm trigger --subsystem-match=hidraw --attr-match=idVendor=1209 || true
  udevadm trigger --subsystem-match=usb --attr-match=idVendor=534c || true
  udevadm trigger --subsystem-match=hidraw --attr-match=idVendor=534c || true
  udevadm settle --timeout=10 || true
fi
`;

    let tempRulesDir: string | undefined;
    try {
      // AppImage resources can live on a FUSE mount that the elevated pkexec
      // process cannot stat, so give pkexec a normal host temp file instead.
      tempRulesDir = await fs.mkdtemp(path.join(os.tmpdir(), 'onekey-udev-'));
      const rulesSourcePath = path.join(
        tempRulesDir,
        path.basename(ONEKEY_LINUX_UDEV_RULES_PATH),
      );
      await fs.writeFile(rulesSourcePath, rules, {
        encoding: 'utf8',
        mode: 0o644,
      });

      const { stdout, stderr } = await execFileAsync(
        'pkexec',
        [
          '/bin/sh',
          '-c',
          installScript,
          'install-onekey-udev-rules',
          rulesSourcePath,
          ONEKEY_LINUX_UDEV_RULES_PATH,
        ],
        { timeout: 120_000 },
      );
      return {
        supported: true,
        installed: true,
        stdout: String(stdout),
        stderr: String(stderr),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // pkexec exit codes are a stable contract: 126 = user dismissed the
      // authentication dialog, 127 = authorization failed (e.g. not allowed).
      // Prefer the numeric exit code over fragile message-string matching.
      const exitCode = String((error as { code?: number | string }).code);
      let skippedReason: IInstallOneKeyUdevRulesResult['skippedReason'] =
        'failed';
      if (exitCode === '126') {
        skippedReason = 'cancelled';
      } else if (exitCode === '127') {
        skippedReason = 'not-authorized';
      }
      return {
        supported: true,
        installed: false,
        skippedReason,
        needsManualInstall: exitCode === '127',
        message,
      };
    } finally {
      if (tempRulesDir) {
        await fs
          .rm(tempRulesDir, { recursive: true, force: true })
          .catch(() => undefined);
      }
    }
  }

  async getAppName(): Promise<string> {
    return (
      globalThis.$desktopMainAppFunctions?.getAppName?.() || 'OneKey Wallet'
    );
  }

  async disableShortcuts(params: {
    disableAllShortcuts?: boolean;
  }): Promise<void> {
    store.setDisableKeyboardShortcuts(params);
  }

  async getApplicationMenu(): Promise<IMenu> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return JSON.parse(
      JSON.stringify(Menu.getApplicationMenu(), (key: string, value: any) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        key !== 'commandsMap' && key !== 'menu' ? value : undefined,
      ),
    );
  }

  private getMenuItemByCommandId(
    id: number,
    menuToSearch: Electron.Menu | null,
  ): Electron.MenuItem | undefined {
    if (!menuToSearch) return undefined;

    for (const item of menuToSearch.items) {
      if (item.submenu) {
        const submenuItem = this.getMenuItemByCommandId(id, item.submenu);
        if (submenuItem) return submenuItem;
      } else if ((item as any).commandId === id) {
        return item;
      }
    }
    return undefined;
  }

  async executeMenuCommand(commandId: number): Promise<void> {
    const menu = Menu.getApplicationMenu();
    if (!menu) return;

    const item = this.getMenuItemByCommandId(commandId, menu);
    if (item) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      item.click(
        undefined as any,
        globalThis.$desktopMainAppFunctions?.getSafelyBrowserWindow?.() as any,
        undefined as any,
      );
    }
  }

  async getMenuItemIcon(commandId: number): Promise<string | null> {
    const menu = Menu.getApplicationMenu();
    if (!menu) return null;

    const item = this.getMenuItemByCommandId(commandId, menu);
    if (item && item.icon && typeof item.icon !== 'string') {
      return item.icon.toDataURL();
    }
    return null;
  }

  async changeTheme(theme: 'light' | 'dark'): Promise<void> {
    store.setTheme(theme);
    const safelyBrowserWindow =
      globalThis.$desktopMainAppFunctions?.getSafelyBrowserWindow?.();
    safelyBrowserWindow?.setBackgroundColor(getBackgroundColor(theme));
    if (process.platform === 'win32') {
      try {
        safelyBrowserWindow?.setTitleBarOverlay({
          symbolColor: theme === 'dark' ? '#ffffff' : '#000000',
          color: '#00000000',
        });
      } catch {
        // noop
      }
    }
  }
}

export default DesktopApiSystem;
