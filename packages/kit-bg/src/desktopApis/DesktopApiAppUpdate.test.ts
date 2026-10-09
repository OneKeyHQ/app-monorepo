import crypto from 'crypto';
import { EventEmitter } from 'events';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { PassThrough } from 'stream';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppUpdatePackageAvailabilityStatus,
  EAppUpdatePackageErrorCode,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update/type';

const mockPackage = Buffer.from('verified desktop package');
const mockSha512 = crypto
  .createHash('sha512')
  .update(mockPackage)
  .digest('base64');
const mockSha256 = crypto
  .createHash('sha256')
  .update(mockPackage)
  .digest('hex');
const mockNativeUpdater = Object.assign(new EventEmitter(), {
  checkForUpdates: jest.fn(),
  quitAndInstall: jest.fn(),
  setFeedURL: jest.fn(),
});
const mockSpawn = jest.fn();
const mockAppQuit = jest.fn();
const mockAppExit = jest.fn();
const mockAppRelaunch = jest.fn();
const mockAppGetVersion = jest.fn(() => '5.9.0');
let mockTempDir: string;
const mockApp = Object.assign(new EventEmitter(), {
  getPath: jest.fn(() => mockTempDir),
  getVersion: mockAppGetVersion,
  quit: mockAppQuit,
  exit: mockAppExit,
  relaunch: mockAppRelaunch,
});
const mockGetAllWindows = jest.fn((): unknown[] => []);
const mockOpenPath = jest.fn(async () => '');
const mockShowMessageBox = jest.fn(async () => ({ response: 0 }));
const mockStore = {
  clearASCFile: jest.fn(),
  clearUpdateSettings: jest.fn(),
  getASCFile: jest.fn(() => ''),
  getUpdateBuildNumber: jest.fn(() => ''),
  getUpdateSettings: jest.fn(() => ({ useTestFeedUrl: false })),
  setASCFile: jest.fn(),
  setUpdateBuildNumber: jest.fn(),
  setUpdateSettings: jest.fn(),
};
const mockDownloadNodeFile = jest.fn(
  async ({ targetPath }: { targetPath: string }) => {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, mockPackage);
  },
);
const mockRequestUpdateUrl = jest.fn();
const mockReadCleartextMessage = jest.fn();
const mockReadKey = jest.fn();

jest.mock('electron', () => ({
  BrowserWindow: { getAllWindows: mockGetAllWindows },
  app: mockApp,
  autoUpdater: mockNativeUpdater,
  dialog: { showMessageBox: mockShowMessageBox },
  shell: { openPath: mockOpenPath },
}));
jest.mock('child_process', () => ({
  ...jest.requireActual<typeof import('child_process')>('child_process'),
  spawn: mockSpawn,
}));
jest.mock('./nodeDownload', () => ({ downloadNodeFile: mockDownloadNodeFile }));
jest.mock('./electronUpdateRequest', () => ({
  requestUpdateUrl: mockRequestUpdateUrl,
}));
jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));
jest.mock('openpgp', () => ({
  readCleartextMessage: mockReadCleartextMessage,
  readKey: mockReadKey,
}));
jest.mock('@onekeyhq/desktop/app/config', () => ({
  ipcMessageKeys: new Proxy({}, { get: (_, key) => String(key) }),
}));
jest.mock('@onekeyhq/desktop/app/constant/gpg', () => ({
  PUBLIC_KEY: 'public key',
}));
jest.mock('@onekeyhq/desktop/app/i18n', () => ({
  ElectronTranslations: new Proxy({}, { get: (_, key) => String(key) }),
  i18nText: (key: string) => key,
}));
jest.mock('@onekeyhq/desktop/app/libs/store', () => mockStore);
jest.mock('@onekeyhq/desktop/app/windowProgressBar', () => ({
  clearWindowProgressBar: jest.fn(),
  updateWindowProgressBar: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/config/appConfig', () => ({
  buildServiceEndpoint: jest.fn(() => 'https://updates.onekey.test'),
}));
jest.mock('@onekeyhq/shared/src/request/customUA', () => ({
  withCustomUAHeaders: jest.fn(
    async (_url: string, headers: Record<string, string>) => ({
      ...headers,
      'X-OneKey': 'desktop-test',
    }),
  ),
}));

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
const originalArch = Object.getOwnPropertyDescriptor(process, 'arch');
const originalChannel = process.env.DESK_CHANNEL;
const originalAppImage = process.env.APPIMAGE;
const originalSkipGPG = process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION;
const instances: Array<
  InstanceType<typeof import('./DesktopApiAppUpdate').default>
> = [];
const mockMainWindow = Object.assign(new EventEmitter(), {
  webContents: { send: jest.fn() },
  isDestroyed: jest.fn(() => false),
  show: jest.fn(),
  focus: jest.fn(),
});

function feed(version: string, files: string[]): string {
  return `version: ${version}\nfiles:\n${files.map((file) => `  - url: ${file}\n    sha512: ${mockSha512}`).join('\n')}\n`;
}

function mockHttpsResponse(body: string, statusCode = 200) {
  mockRequestUpdateUrl.mockImplementation(async (url: string) => {
    const response = Object.assign(new PassThrough(), {
      statusCode,
      headers: {},
    });
    setImmediate(() => response.end(body));
    return { response, url };
  });
  return mockRequestUpdateUrl;
}

function localGet(url: string, authorization?: string) {
  return new Promise<{ status: number; body: Buffer }>((resolve, reject) => {
    http
      .get(
        url,
        { headers: authorization ? { Authorization: authorization } : {} },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.once('end', () =>
            resolve({
              status: response.statusCode ?? 0,
              body: Buffer.concat(chunks),
            }),
          );
          response.once('error', reject);
        },
      )
      .once('error', reject);
  });
}

function createApi(
  platform: NodeJS.Platform,
  channel?: string,
  arch?: typeof process.arch,
) {
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value: platform,
  });
  if (arch)
    Object.defineProperty(process, 'arch', { configurable: true, value: arch });
  if (channel) process.env.DESK_CHANNEL = channel;
  else delete process.env.DESK_CHANNEL;
  jest.resetModules();
  const Api = require('./DesktopApiAppUpdate')
    .default as typeof import('./DesktopApiAppUpdate').default;
  const api = new Api({ desktopApi: {} as never });
  instances.push(api);
  return api;
}

function linuxArtifactName(): string {
  const arch = process.arch === 'x64' ? 'x86_64' : process.arch;
  return `OneKey-Wallet-6.0.0-linux-${arch}.AppImage`;
}

async function preparePackage(platform: NodeJS.Platform, channel?: string) {
  const api = createApi(platform, channel);
  let extension = 'AppImage';
  if (platform === 'darwin') extension = 'zip';
  else if (platform === 'win32') extension = 'exe';
  mockHttpsResponse(
    feed('6.0.0', [
      platform === 'linux'
        ? linuxArtifactName()
        : `OneKey-6.0.0-${process.arch}.${extension}`,
    ]),
  );
  const artifact = await api.checkForUpdates(
    false,
    { Authorization: 'test-token' },
    '6.0.0',
  );
  await api.downloadUpdate();
  if (!artifact || !api.downloadedEvent?.downloadedFile)
    throw new OneKeyLocalError('package not prepared');
  return {
    api,
    file: api.downloadedEvent.downloadedFile,
    params: {
      buildNumber: '123',
      downloadedFile: api.downloadedEvent.downloadedFile,
      downloadUrl: artifact.url,
      latestVersion: '6.0.0',
      skipGPGVerification: true,
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApp.removeAllListeners();
  mockGetAllWindows.mockReturnValue([]);
  mockAppGetVersion.mockReturnValue('5.9.0');
  mockStore.getASCFile.mockReturnValue('');
  mockNativeUpdater.removeAllListeners();
  mockMainWindow.removeAllListeners();
  mockNativeUpdater.checkForUpdates.mockImplementation(() => {
    setImmediate(() => mockNativeUpdater.emit('update-downloaded'));
  });
  mockSpawn.mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), { unref: jest.fn() });
    setImmediate(() => child.emit('spawn'));
    return child;
  });
  mockTempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'onekey-node-updater-test-'),
  );
  process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION = 'true';
  (
    globalThis as unknown as { $desktopMainAppFunctions: unknown }
  ).$desktopMainAppFunctions = {
    getSafelyMainWindow: () => mockMainWindow,
  };
});

afterEach(async () => {
  for (const api of instances.splice(0)) {
    const state = api as unknown as {
      macInstallInProgress: boolean;
      appImageInstallInProgress: boolean;
      installInProgress: boolean;
    };
    state.macInstallInProgress = false;
    state.appImageInstallInProgress = false;
    state.installInProgress = false;
    await api.clearUpdateCache();
  }
  jest.restoreAllMocks();
  fs.rmSync(mockTempDir, { recursive: true, force: true });
  if (originalPlatform)
    Object.defineProperty(process, 'platform', originalPlatform);
  if (originalArch) Object.defineProperty(process, 'arch', originalArch);
  if (originalChannel === undefined) delete process.env.DESK_CHANNEL;
  else process.env.DESK_CHANNEL = originalChannel;
  if (originalAppImage === undefined) delete process.env.APPIMAGE;
  else process.env.APPIMAGE = originalAppImage;
  if (originalSkipGPG === undefined)
    delete process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION;
  else process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION = originalSkipGPG;
});

test('selects the chosen-version macOS ZIP and forwards feed and artifact headers', async () => {
  const api = createApi('darwin');
  const get = mockHttpsResponse(
    feed('6.0.0', [
      `OneKey-6.0.0-${process.arch}.dmg`,
      `OneKey-6.0.0-${process.arch}.zip`,
    ]),
  );
  const artifact = await api.checkForUpdates(
    false,
    { Authorization: 'test-token' },
    '6.0.0',
  );
  expect(artifact?.fileName).toBe(`OneKey-6.0.0-${process.arch}.zip`);
  expect(get).toHaveBeenCalledWith(
    expect.stringMatching(/^https:/),
    { Authorization: 'test-token', 'X-OneKey': 'desktop-test' },
    expect.any(AbortSignal),
    30_000,
  );
  await api.downloadUpdate();
  expect(mockDownloadNodeFile).toHaveBeenCalledWith(
    expect.objectContaining({
      url: artifact?.url,
      headers: { Authorization: 'test-token', 'X-OneKey': 'desktop-test' },
      expectedSha512: mockSha512,
    }),
  );
  expect(mockNativeUpdater.setFeedURL).not.toHaveBeenCalled();
});

test.each([
  ['version mismatch', feed('6.0.1', [`OneKey-6.0.1-${process.arch}.zip`])],
  [
    'ambiguous ZIPs',
    feed('6.0.0', [
      `OneKey-a-${process.arch}.zip`,
      `OneKey-b-${process.arch}.zip`,
    ]),
  ],
])('rejects %s before download', async (_label, response) => {
  const api = createApi('darwin');
  mockHttpsResponse(response);
  await expect(api.checkForUpdates(false, {}, '6.0.0')).rejects.toThrow();
  expect(mockDownloadNodeFile).not.toHaveBeenCalled();
});

test.each([
  ['x64', 'x86_64', 'latest-linux.yml'],
  ['arm64', 'arm64', 'latest-linux-arm64.yml'],
] as const)(
  'Linux %s selects the release AppImage name and correct channel',
  async (arch, artifactArch, channel) => {
    const api = createApi('linux', 'appImage', arch);
    const get = mockHttpsResponse(
      feed('6.6.1', [
        'OneKey-Wallet-6.6.1-linux-x86_64.AppImage',
        'OneKey-Wallet-6.6.1-linux-arm64.AppImage',
      ]),
    );
    const artifact = await api.checkForUpdates(false, {}, '6.6.1');
    expect(artifact?.fileName).toBe(
      `OneKey-Wallet-6.6.1-linux-${artifactArch}.AppImage`,
    );
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining(`/${channel}`),
      expect.any(Object),
      expect.any(AbortSignal),
      30_000,
    );
    await api.downloadUpdate();
    expect(mockDownloadNodeFile).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining(`-linux-${artifactArch}.AppImage`),
      }),
    );
  },
);

test('Linux x64 rejects feeds without a matching architecture', async () => {
  const api = createApi('linux', 'appImage', 'x64');
  mockHttpsResponse(
    feed('6.6.1', ['OneKey-Wallet-6.6.1-linux-arm64.AppImage']),
  );
  await expect(api.checkForUpdates(false, {}, '6.6.1')).rejects.toThrow(
    'App update feed artifact missing or ambiguous',
  );
  expect(mockDownloadNodeFile).not.toHaveBeenCalled();
});

test('Linux x64 rejects ambiguous matching AppImages', async () => {
  const api = createApi('linux', 'appImage', 'x64');
  mockHttpsResponse(
    feed('6.6.1', [
      'OneKey-Wallet-6.6.1-linux-x86_64.AppImage',
      'OneKey-Wallet-Test-6.6.1-linux-x86_64.AppImage',
    ]),
  );
  await expect(api.checkForUpdates(false, {}, '6.6.1')).rejects.toThrow(
    'App update feed artifact is ambiguous',
  );
  expect(mockDownloadNodeFile).not.toHaveBeenCalled();
});

test('reuses a verified cache and rejects a renderer-supplied path or corrupt bytes', async () => {
  const { api, file, params } = await preparePackage('darwin');
  expect(await api.getDownloadedFileAvailability(file)).toEqual({
    status: EAppUpdatePackageAvailabilityStatus.available,
  });
  expect(
    await api.checkDownloadedFileExists(path.join(mockTempDir, 'other.zip')),
  ).toBe(false);
  await expect(
    api.installPackage({ ...params, downloadedFile: '/tmp/forged.zip' }),
  ).rejects.toThrow(EAppUpdatePackageErrorCode.packageMissing);
  const count = mockDownloadNodeFile.mock.calls.length;
  await api.downloadUpdate();
  expect(mockDownloadNodeFile).toHaveBeenCalledTimes(count);
  const restartedApi = createApi('darwin');
  expect(await restartedApi.getDownloadedFileAvailability(file)).toEqual({
    status: EAppUpdatePackageAvailabilityStatus.available,
  });
  mockHttpsResponse(feed('6.0.0', [`OneKey-6.0.0-${process.arch}.zip`]));
  await restartedApi.checkForUpdates(false, {}, '6.0.0');
  await restartedApi.downloadUpdate();
  expect(mockDownloadNodeFile).toHaveBeenCalledTimes(count);
  fs.writeFileSync(file, 'tampered');
  expect(await api.getDownloadedFileAvailability(file)).toEqual({
    status: EAppUpdatePackageAvailabilityStatus.notPrepared,
  });
  await expect(api.installPackage(params)).rejects.toThrow(
    EAppUpdatePackageErrorCode.packageMissing,
  );
  expect(mockNativeUpdater.quitAndInstall).not.toHaveBeenCalled();
});

test('rejects an ASC with a failed GPG signature', async () => {
  const { api, params } = await preparePackage('darwin');
  delete process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION;
  mockStore.getASCFile.mockReturnValue('invalid signature');
  mockReadKey.mockResolvedValue({});
  mockReadCleartextMessage.mockResolvedValue({
    getText: () => mockSha256,
    verify: async () => [
      { verified: Promise.reject(new Error('bad signature')) },
    ],
  });
  await expect(api.verifyASC(params)).rejects.toThrow(
    'update_signature_verification_failed_alert_text',
  );
});

test('verifies ASC signature and streamed SHA-256 before install', async () => {
  const { api, file, params } = await preparePackage('darwin');
  delete process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION;
  mockHttpsResponse('signed checksums');
  expect(await api.downloadASC(params)).toBe(true);
  expect(mockStore.setASCFile).toHaveBeenCalledWith('signed checksums');
  mockStore.getASCFile.mockReturnValue('signed checksums');
  mockReadKey.mockResolvedValue({});
  mockReadCleartextMessage.mockResolvedValue({
    getText: () => `${mockSha256}  ${path.basename(file)}`,
    verify: async () => [{ verified: Promise.resolve() }],
  });
  expect(await api.verifyASC(params)).toBe(true);
  expect(await api.verifyPackage(params)).toBe(true);
  mockReadCleartextMessage.mockResolvedValueOnce({
    getText: () => `${'0'.repeat(64)}  ${path.basename(file)}`,
    verify: async () => [{ verified: Promise.resolve() }],
  });
  expect(await api.verifyPackage(params)).toBe(false);
});

test('macOS stages only after confirmation and verification', async () => {
  const api = createApi('darwin');
  mockHttpsResponse(feed('6.0.0', [`OneKey-6.0.0-${process.arch}.zip`]));
  await api.checkForUpdates(false, {}, '6.0.0');
  await api.downloadUpdate();
  expect(mockNativeUpdater.setFeedURL).not.toHaveBeenCalled();
  const params = {
    buildNumber: '123',
    downloadedFile: api.downloadedEvent?.downloadedFile,
    downloadUrl: api.downloadedEvent?.downloadUrl,
    latestVersion: '6.0.0',
    skipGPGVerification: true,
  };
  mockShowMessageBox.mockResolvedValueOnce({ response: 1 });
  expect(await api.installPackage(params)).toBe(false);
  expect(mockNativeUpdater.setFeedURL).not.toHaveBeenCalled();
  expect(mockNativeUpdater.quitAndInstall).not.toHaveBeenCalled();
  expect(await api.installPackage(params)).toBe(true);
  expect(mockNativeUpdater.setFeedURL).toHaveBeenCalledTimes(1);
  expect(mockNativeUpdater.quitAndInstall).toHaveBeenCalledTimes(1);
});

test('macOS local ZIP requires its random capability path', async () => {
  const { api } = await preparePackage('darwin');
  const internal = api as unknown as {
    readRecord: () => { downloadedFile: string };
    stageMacUpdate: (record: { downloadedFile: string }) => Promise<void>;
  };
  await internal.stageMacUpdate(internal.readRecord());
  const feedConfig = mockNativeUpdater.setFeedURL.mock.calls[0][0] as {
    url: string;
    headers: { Authorization: string };
  };
  expect((await localGet(feedConfig.url)).status).toBe(401);
  const feedResponse = await localGet(
    feedConfig.url,
    feedConfig.headers.Authorization,
  );
  expect(feedResponse.status).toBe(200);
  const zipUrl = (JSON.parse(feedResponse.body.toString()) as { url: string })
    .url;
  expect((await localGet(`${feedConfig.url}/wrong.zip`)).status).toBe(404);
  const zipResponse = await localGet(zipUrl);
  expect(zipResponse.status).toBe(200);
  expect(zipResponse.body.equals(mockPackage)).toBe(true);
});

test('clearing update cache cancels a stalled feed request', async () => {
  const api = createApi('darwin');
  let started!: () => void;
  const requestStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  let signal: AbortSignal | undefined;
  mockRequestUpdateUrl.mockImplementationOnce(
    (
      _url: string,
      _headers: Record<string, string>,
      requestSignal: AbortSignal,
    ) =>
      new Promise((_, reject) => {
        signal = requestSignal;
        requestSignal.addEventListener('abort', () =>
          reject(new OneKeyLocalError('Download cancelled')),
        );
        started();
      }),
  );
  const check = api.checkForUpdates(false, {}, '6.0.0');
  void check.catch(() => {});
  await requestStarted;
  await api.clearUpdateCache();
  await expect(check).rejects.toThrow('Download cancelled');
  expect(signal?.aborted).toBe(true);
});

test('a new update check waits for cache clearing to finish', async () => {
  const api = createApi('darwin');
  const get = mockHttpsResponse(
    feed('6.0.0', [`OneKey-6.0.0-${process.arch}.zip`]),
  );
  let started!: () => void;
  const requestStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  let rejectOld!: (error: OneKeyLocalError) => void;
  get.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejectOld = reject;
        started();
      }),
  );
  const oldCheck = api.checkForUpdates(false, {}, '6.0.0');
  void oldCheck.catch(() => {});
  await requestStarted;
  const clear = api.clearUpdateCache();
  const newCheck = api.checkForUpdates(false, {}, '6.0.0');
  expect(get).toHaveBeenCalledTimes(1);
  rejectOld(new OneKeyLocalError('Download cancelled'));
  await clear;
  await expect(oldCheck).rejects.toThrow('Download cancelled');
  expect((await newCheck)?.version).toBe('6.0.0');
  await api.downloadUpdate();
  expect(api.downloadedEvent?.downloadedFile).toBeTruthy();
});

test('clearing update cache cancels a stalled ASC request', async () => {
  const { api, params } = await preparePackage('darwin');
  delete process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION;
  let started!: () => void;
  const requestStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  let signal: AbortSignal | undefined;
  mockRequestUpdateUrl.mockImplementationOnce(
    (
      _url: string,
      _headers: Record<string, string>,
      requestSignal: AbortSignal,
    ) =>
      new Promise((_, reject) => {
        signal = requestSignal;
        requestSignal.addEventListener('abort', () =>
          reject(new OneKeyLocalError('Download cancelled')),
        );
        started();
      }),
  );
  const asc = api.downloadASC(params);
  void asc.catch(() => {});
  await requestStarted;
  await api.clearUpdateCache();
  await expect(asc).rejects.toThrow('Download cancelled');
  expect(signal?.aborted).toBe(true);
  expect(mockStore.setASCFile).not.toHaveBeenCalled();
});

test('macOS never stages when ASC verification fails', async () => {
  const { api, params } = await preparePackage('darwin');
  delete process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION;
  await expect(api.installPackage(params)).rejects.toThrow(
    'update_installation_not_safe_alert_text',
  );
  expect(mockNativeUpdater.setFeedURL).not.toHaveBeenCalled();
  expect(mockNativeUpdater.quitAndInstall).not.toHaveBeenCalled();
});

test('macOS keeps running if native quit handoff throws after staging', async () => {
  const { api, params } = await preparePackage('darwin');
  const onWindowAllClosed = jest.fn();
  const onActivate = jest.fn();
  const onClose = jest.fn();
  let destroyed = false;
  const window = Object.assign(new EventEmitter(), {
    webContents: { send: jest.fn() },
    isDestroyed: jest.fn(() => destroyed),
    close: jest.fn(() => {
      destroyed = true;
      setImmediate(() => window.emit('closed'));
    }),
    show: jest.fn(),
    focus: jest.fn(),
  });
  (
    globalThis as unknown as {
      $desktopMainAppFunctions: { getSafelyMainWindow: () => unknown };
    }
  ).$desktopMainAppFunctions.getSafelyMainWindow = () => window;
  mockApp.on('window-all-closed', onWindowAllClosed);
  mockApp.on('activate', onActivate);
  window.on('close', onClose);
  window.once('closed', () => expect(onActivate).not.toHaveBeenCalled());
  mockGetAllWindows.mockReturnValue([window]);
  mockNativeUpdater.quitAndInstall.mockImplementationOnce(() => {
    throw new OneKeyLocalError('native handoff failed');
  });
  await expect(api.installPackage(params)).rejects.toThrow(
    'native handoff failed',
  );
  expect(mockNativeUpdater.setFeedURL).toHaveBeenCalledTimes(1);
  expect(window.close).toHaveBeenCalledTimes(1);
  expect(mockApp.listeners('window-all-closed')).toContain(onWindowAllClosed);
  expect(onActivate).toHaveBeenCalledTimes(1);
  expect(mockNativeUpdater.listenerCount('before-quit-for-update')).toBe(0);
  expect(mockAppExit).not.toHaveBeenCalled();
});

test('macOS does not reopen a surviving window on a later normal close', async () => {
  const { api, params } = await preparePackage('darwin');
  const onActivate = jest.fn();
  const window = Object.assign(new EventEmitter(), {
    webContents: { send: jest.fn() },
    isDestroyed: jest.fn(() => false),
    close: jest.fn(),
    show: jest.fn(),
    focus: jest.fn(),
  });
  (
    globalThis as unknown as {
      $desktopMainAppFunctions: { getSafelyMainWindow: () => unknown };
    }
  ).$desktopMainAppFunctions.getSafelyMainWindow = () => window;
  mockApp.on('activate', onActivate);
  mockGetAllWindows.mockReturnValue([window]);
  mockNativeUpdater.quitAndInstall.mockImplementationOnce(() => {
    throw new OneKeyLocalError('native handoff failed');
  });
  await expect(api.installPackage(params)).rejects.toThrow(
    'native handoff failed',
  );
  expect(window.show).toHaveBeenCalledTimes(1);
  expect(window.focus).toHaveBeenCalledTimes(1);
  window.emit('closed');
  expect(onActivate).not.toHaveBeenCalled();
});

test('macOS forces exit if native update quit stalls', async () => {
  const { api, params } = await preparePackage('darwin');
  const internal = api as unknown as {
    readRecord: () => { downloadedFile: string };
    stageMacUpdate: (record: { downloadedFile: string }) => Promise<void>;
  };
  await internal.stageMacUpdate(internal.readRecord());
  mockNativeUpdater.quitAndInstall.mockImplementationOnce(() => {
    mockNativeUpdater.emit('before-quit-for-update');
  });
  jest.useFakeTimers();
  try {
    expect(await api.installPackage(params)).toBe(true);
    jest.advanceTimersByTime(14_999);
    expect(mockAppExit).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(mockAppExit).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

test('macOS restages when the checksum changes at the same cache path', async () => {
  const { api } = await preparePackage('darwin');
  const internal = api as unknown as {
    readRecord: () => { sha512: string };
    stageMacUpdate: (record: { sha512: string }) => Promise<void>;
  };
  const record = internal.readRecord();
  await internal.stageMacUpdate(record);
  await internal.stageMacUpdate({ ...record, sha512: 'different-sha512' });
  expect(mockNativeUpdater.setFeedURL).toHaveBeenCalledTimes(2);
});

test('Windows launches only the verified NSIS installer and then quits', async () => {
  const { api, file, params } = await preparePackage('win32');
  expect(await api.installPackage(params)).toBe(true);
  expect(mockSpawn).toHaveBeenCalledWith(file, ['--updated', '--force-run'], {
    detached: true,
    stdio: 'ignore',
  });
  expect(mockAppQuit).toHaveBeenCalledTimes(1);
});

test('Windows rejects a concurrent install before a second confirmation and keeps the handoff locked', async () => {
  const { api, params } = await preparePackage('win32');
  let confirm!: (result: { response: number }) => void;
  mockShowMessageBox.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        confirm = resolve;
      }),
  );
  const first = api.installPackage(params);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(mockShowMessageBox).toHaveBeenCalledTimes(1);
  expect(await api.installPackage(params)).toBe(false);
  await expect(api.clearUpdateCache()).rejects.toThrow(
    'installation is in progress',
  );
  confirm({ response: 0 });
  expect(await first).toBe(true);
  expect(await api.installPackage(params)).toBe(false);
  expect(mockSpawn).toHaveBeenCalledTimes(1);
  expect(mockShowMessageBox).toHaveBeenCalledTimes(1);
});

test('Windows releases the install lock after cancellation or launch failure', async () => {
  const { api, params } = await preparePackage('win32');
  mockShowMessageBox.mockResolvedValueOnce({ response: 1 });
  expect(await api.installPackage(params)).toBe(false);
  mockSpawn.mockImplementationOnce(() => {
    const child = Object.assign(new EventEmitter(), { unref: jest.fn() });
    setImmediate(() => child.emit('error', new Error('installer failed')));
    return child;
  });
  await expect(api.installPackage(params)).rejects.toThrow('installer failed');
  expect(await api.installPackage(params)).toBe(true);
  expect(mockSpawn).toHaveBeenCalledTimes(2);
});

test('manual AppImage fallback releases the install lock for retry', async () => {
  delete process.env.APPIMAGE;
  const { api, file, params } = await preparePackage('linux', 'appImage');
  mockStore.getASCFile.mockReturnValue('signed checksums');
  mockReadKey.mockResolvedValue({});
  mockReadCleartextMessage.mockResolvedValue({
    getText: () => `${mockSha256}  ${path.basename(file)}`,
    verify: async () => [{ verified: Promise.resolve() }],
  });
  expect(await api.installPackage(params)).toBe(true);
  expect(await api.installPackage(params)).toBe(true);
  expect(mockOpenPath).toHaveBeenCalledTimes(2);
  expect(mockAppQuit).not.toHaveBeenCalled();
});

test('Linux AppImage without a writable current path offers the verified download folder', async () => {
  delete process.env.APPIMAGE;
  const { api, file, params } = await preparePackage('linux', 'appImage');
  mockStore.getASCFile.mockReturnValue('signed checksums');
  mockReadKey.mockResolvedValue({});
  mockReadCleartextMessage.mockResolvedValue({
    getText: () => `${mockSha256}  ${path.basename(file)}`,
    verify: async () => [{ verified: Promise.resolve() }],
  });
  expect(await api.installPackage(params)).toBe(true);
  expect(mockOpenPath).toHaveBeenCalledWith(path.dirname(file));
  expect(mockSpawn).not.toHaveBeenCalled();
});

test('Linux replaces a writable AppImage and relaunches it', async () => {
  const current = path.join(mockTempDir, 'OneKey.AppImage');
  fs.writeFileSync(current, 'old app');
  process.env.APPIMAGE = current;
  const { api, params } = await preparePackage('linux', 'appImage');
  expect(await api.installPackage(params)).toBe(true);
  expect(fs.readFileSync(current)).toEqual(mockPackage);
  expect(mockSpawn).not.toHaveBeenCalled();
  expect(mockAppRelaunch).toHaveBeenCalledWith({
    execPath: current,
    args: [],
  });
  expect(mockStore.setUpdateBuildNumber).not.toHaveBeenCalled();
  expect(
    fs.readdirSync(mockTempDir).some((name) => name.endsWith('.old')),
  ).toBe(true);
  expect(mockOpenPath).not.toHaveBeenCalled();
  expect(mockAppQuit).toHaveBeenCalledTimes(1);
  mockAppGetVersion.mockReturnValue('6.0.0');
  createApi('linux', 'appImage');
  expect(mockStore.setUpdateBuildNumber).toHaveBeenCalledWith('123');
  expect(
    fs.readdirSync(mockTempDir).some((name) => name.endsWith('.old')),
  ).toBe(false);
});

test('Linux restores the old AppImage when relaunch cannot be queued', async () => {
  const current = path.join(mockTempDir, 'OneKey.AppImage');
  fs.writeFileSync(current, 'old app');
  process.env.APPIMAGE = current;
  const { api, params } = await preparePackage('linux', 'appImage');
  mockAppRelaunch.mockImplementationOnce(() => {
    throw new OneKeyLocalError('relaunch failed');
  });
  await expect(api.installPackage(params)).rejects.toThrow('relaunch failed');
  expect(fs.readFileSync(current, 'utf8')).toBe('old app');
  expect(mockAppQuit).not.toHaveBeenCalled();
  expect(mockStore.setUpdateBuildNumber).not.toHaveBeenCalled();
});

test('Linux retains the old package until startup and drops the candidate if the old version returns', async () => {
  const current = path.join(mockTempDir, 'OneKey-5.9.0.AppImage');
  fs.writeFileSync(current, 'old app');
  process.env.APPIMAGE = current;
  const { api, params } = await preparePackage('linux', 'appImage');
  const destination = path.join(mockTempDir, linuxArtifactName());
  expect(await api.installPackage(params)).toBe(true);
  expect(fs.readFileSync(current, 'utf8')).toBe('old app');
  expect(fs.existsSync(destination)).toBe(true);
  expect(mockStore.setUpdateBuildNumber).not.toHaveBeenCalled();
  createApi('linux', 'appImage');
  expect(fs.readFileSync(current, 'utf8')).toBe('old app');
  expect(fs.existsSync(destination)).toBe(false);
  expect(mockStore.setUpdateBuildNumber).not.toHaveBeenCalled();
});
