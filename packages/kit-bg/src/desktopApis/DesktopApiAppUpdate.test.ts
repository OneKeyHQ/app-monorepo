import crypto from 'crypto';
import { EventEmitter } from 'events';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { PassThrough } from 'stream';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { UPDATE_ERROR_WIRE_PREFIX } from '@onekeyhq/shared/src/modules3rdParty/auto-update/error';
import { EAppUpdatePackageAvailabilityStatus } from '@onekeyhq/shared/src/modules3rdParty/auto-update/type';

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
const mockExecFileSync = jest.fn();
const mockCancelMacUpdate = jest.fn(async () => {});
const mockCaptureMacUpdate = jest.fn(async () => ({ captured: true }));
const mockFinishMacUpdateCancellation = jest.fn(async () => {});
jest.mock('./macUpdateCancellation', () => ({
  cancelMacUpdate: mockCancelMacUpdate,
  captureMacUpdate: mockCaptureMacUpdate,
  finishMacUpdateCancellation: mockFinishMacUpdateCancellation,
  getMacCancellationMarker: (dir: string) => `${dir}.manual-clear`,
}));
const mockAppQuit = jest.fn();
const mockAppExit = jest.fn();
const mockAppRelaunch = jest.fn();
const mockAppGetVersion = jest.fn(() => '5.9.0');
let mockTempDir: string;
const mockApp = Object.assign(new EventEmitter(), {
  getPath: jest.fn(() => mockTempDir),
  getVersion: mockAppGetVersion,
  isPackaged: false,
  quit: mockAppQuit,
  exit: mockAppExit,
  relaunch: mockAppRelaunch,
  moveToApplicationsFolder: jest.fn(() => true),
});
const mockGetAllWindows = jest.fn((): unknown[] => []);
const mockOpenPath = jest.fn(async () => '');
const mockShowMessageBox = jest.fn(async () => ({ response: 0 }));
const mockStore = {
  clearASCFile: jest.fn(),
  clearUpdateSettings: jest.fn(),
  getASCFile: jest.fn(() => ''),
  getDevSettingsEnabled: jest.fn(() => false),
  getUpdateBuildNumber: jest.fn(() => ''),
  getUpdateSettings: jest.fn(() => ({ useTestFeedUrl: false })),
  setASCFile: jest.fn(),
  setUpdateBuildNumber: jest.fn(),
  clearUpdateBuildNumber: jest.fn(),
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
  execFileSync: mockExecFileSync,
}));
jest.mock('./nodeDownload', () => ({
  downloadNodeFile: mockDownloadNodeFile,
  classifyNodeError:
    jest.requireActual<typeof import('./nodeDownload')>('./nodeDownload')
      .classifyNodeError,
  stripSensitiveHeaders:
    jest.requireActual<typeof import('./nodeDownload')>('./nodeDownload')
      .stripSensitiveHeaders,
}));
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
      'User-Agent': 'OneKey-test',
    }),
  ),
}));

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
const originalArch = Object.getOwnPropertyDescriptor(process, 'arch');
const originalChannel = process.env.DESK_CHANNEL;
const originalAppImage = process.env.APPIMAGE;
const originalResourcesPath = Object.getOwnPropertyDescriptor(
  process,
  'resourcesPath',
);
const originalSkipGPG = process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION;
const instances: Array<
  InstanceType<typeof import('./DesktopApiAppUpdate').default>
> = [];
const mockMainWindow = Object.assign(new EventEmitter(), {
  webContents: Object.assign(new EventEmitter(), {
    send: jest.fn(),
    isDestroyed: jest.fn(() => false),
    isCrashed: jest.fn(() => false),
  }),
  isDestroyed: jest.fn(() => false),
  show: jest.fn(),
  focus: jest.fn(),
});

function feed(version: string, files: string[]): string {
  return `version: ${version}\nfiles:\n${files.map((file) => `  - url: ${file}\n    sha512: ${mockSha512}`).join('\n')}\n`;
}

function mockHttpsResponse(body: string, statusCode = 200, finalUrl?: string) {
  mockRequestUpdateUrl.mockImplementation(async (url: string) => {
    const response = Object.assign(new PassThrough(), {
      statusCode,
      headers: {},
    });
    setImmediate(() => response.end(body));
    return { response, url: finalUrl ?? url };
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
  const file = (
    api as unknown as {
      readRecord: () => { downloadedFile: string } | undefined;
    }
  ).readRecord()?.downloadedFile;
  if (!artifact || !file || !api.downloadedEvent?.downloadUrl)
    throw new OneKeyLocalError('package not prepared');
  return {
    api,
    file,
    params: {
      buildNumber: '123',
      downloadUrl: artifact.url,
      latestVersion: '6.0.0',
      skipGPGVerification: true,
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApp.isPackaged = false;
  mockCancelMacUpdate.mockReset().mockResolvedValue(undefined);
  mockSpawn.mockReset();
  mockExecFileSync.mockReset();
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
  mockExecFileSync.mockImplementation((file: string, args: string[]) => {
    if (file === 'reg.exe' && args[1]?.startsWith('HKCU\\')) {
      return `    InstallLocation    REG_SZ    ${path.win32.dirname(
        process.execPath,
      )}\r\n`;
    }
    throw new OneKeyLocalError('Registry key unavailable');
  });
  mockTempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'onekey-node-updater-test-'),
  );
  Object.defineProperty(process, 'resourcesPath', {
    configurable: true,
    value: mockTempDir,
  });
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
      macStagedIdentity?: string;
      quitInstallParams?: unknown;
      preparingQuitInstall?: unknown;
    };
    await api.clearUpdateCache({ manual: true, release: true });
    state.macInstallInProgress = false;
    state.appImageInstallInProgress = false;
    state.installInProgress = false;
    state.macStagedIdentity = undefined;
    state.quitInstallParams = undefined;
    state.preparingQuitInstall = undefined;
    await api.clearUpdateCache();
  }
  jest.restoreAllMocks();
  fs.rmSync(mockTempDir, { recursive: true, force: true });
  if (originalPlatform)
    Object.defineProperty(process, 'platform', originalPlatform);
  if (originalResourcesPath)
    Object.defineProperty(process, 'resourcesPath', originalResourcesPath);
  else delete (process as { resourcesPath?: string }).resourcesPath;
  if (originalArch) Object.defineProperty(process, 'arch', originalArch);
  if (originalChannel === undefined) delete process.env.DESK_CHANNEL;
  else process.env.DESK_CHANNEL = originalChannel;
  if (originalAppImage === undefined) delete process.env.APPIMAGE;
  else process.env.APPIMAGE = originalAppImage;
  if (originalSkipGPG === undefined)
    delete process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION;
  else process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION = originalSkipGPG;
});

test('selects the chosen-version macOS ZIP and keeps feed headers for same-origin artifacts', async () => {
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
    { Authorization: 'test-token', 'User-Agent': 'OneKey-test' },
    expect.any(AbortSignal),
    30_000,
  );
  await api.downloadUpdate();
  expect(mockDownloadNodeFile).toHaveBeenCalledWith(
    expect.objectContaining({
      url: artifact?.url,
      headers: { Authorization: 'test-token', 'User-Agent': 'OneKey-test' },
      expectedSha512: mockSha512,
    }),
  );
  expect(mockNativeUpdater.setFeedURL).not.toHaveBeenCalled();
});

test.each([
  [
    'relative CDN artifact',
    `OneKey-6.0.0-${process.arch}.zip`,
    `https://cdn.fixture.test/releases/6.0.0/OneKey-6.0.0-${process.arch}.zip?feed_token=fixture`,
    false,
  ],
  [
    'absolute original-origin artifact',
    `https://updates.onekey.test/OneKey-6.0.0-${process.arch}.zip`,
    `https://updates.onekey.test/OneKey-6.0.0-${process.arch}.zip`,
    true,
  ],
  [
    'absolute same-CDN-origin artifact',
    `https://cdn.fixture.test/packages/OneKey-6.0.0-${process.arch}.zip`,
    `https://cdn.fixture.test/packages/OneKey-6.0.0-${process.arch}.zip?feed_token=fixture`,
    false,
  ],
  [
    'absolute cross-origin artifact with its own query',
    `https://artifact.fixture.test/OneKey-6.0.0-${process.arch}.zip?artifact_token=own`,
    `https://artifact.fixture.test/OneKey-6.0.0-${process.arch}.zip?artifact_token=own`,
    false,
  ],
])(
  'resolves %s from the redirected feed without leaking headers',
  async (_label, fileUrl, expectedUrl, sameOrigin) => {
    const api = createApi('darwin');
    const get = mockHttpsResponse(
      feed('6.0.0', [fileUrl]),
      200,
      'https://cdn.fixture.test/releases/6.0.0/latest.yml?feed_token=fixture',
    );
    const artifact = await api.checkForUpdates(
      false,
      { Authorization: 'private-fixture' },
      '6.0.0',
    );
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining('https://updates.onekey.test/'),
      { Authorization: 'private-fixture', 'User-Agent': 'OneKey-test' },
      expect.any(AbortSignal),
      30_000,
    );
    expect(artifact?.url).toBe(expectedUrl);
    await api.downloadUpdate();
    expect(mockDownloadNodeFile).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expectedUrl,
        headers: sameOrigin
          ? { Authorization: 'private-fixture', 'User-Agent': 'OneKey-test' }
          : { 'User-Agent': 'OneKey-test' },
      }),
    );
  },
);

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
    '"code":"PACKAGE_MISSING"',
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
    '"code":"INVALID_ARGUMENT"',
  );
  expect(mockDownloadNodeFile).not.toHaveBeenCalled();
});

test('reuses a verified cache and rejects a mismatched release identity or corrupt bytes', async () => {
  const { api, file, params } = await preparePackage('darwin');
  expect(await api.getDownloadedFileAvailability(params)).toEqual({
    status: EAppUpdatePackageAvailabilityStatus.available,
  });
  expect(
    await api.checkDownloadedFileExists({
      latestVersion: params.latestVersion,
      downloadUrl: 'https://example.com/other.zip',
    }),
  ).toBe(false);
  await expect(
    api.installPackage({
      ...params,
      downloadUrl: 'https://example.com/other.zip',
    }),
  ).rejects.toThrow('"code":"PACKAGE_MISSING"');
  const count = mockDownloadNodeFile.mock.calls.length;
  await api.downloadUpdate();
  expect(mockDownloadNodeFile).toHaveBeenCalledTimes(count);
  const restartedApi = createApi('darwin');
  expect(await restartedApi.getDownloadedFileAvailability(params)).toEqual({
    status: EAppUpdatePackageAvailabilityStatus.available,
  });
  mockHttpsResponse(feed('6.0.0', [`OneKey-6.0.0-${process.arch}.zip`]));
  await restartedApi.checkForUpdates(false, {}, '6.0.0');
  await restartedApi.downloadUpdate();
  expect(mockDownloadNodeFile).toHaveBeenCalledTimes(count);
  fs.writeFileSync(file, 'tampered');
  expect(await api.getDownloadedFileAvailability(params)).toEqual({
    status: EAppUpdatePackageAvailabilityStatus.notPrepared,
  });
  await expect(api.installPackage(params)).rejects.toThrow(
    '"code":"PACKAGE_MISSING"',
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
    '"code":"INTEGRITY_FAILED"',
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
    verify: async () => [{ verified: Promise.resolve(true) }],
  });
  expect(await api.verifyASC(params)).toBe(true);
  expect(await api.verifyPackage(params)).toBe(true);
  mockReadCleartextMessage.mockResolvedValueOnce({
    getText: () => `${'0'.repeat(64)}  ${path.basename(file)}`,
    verify: async () => [{ verified: Promise.resolve(true) }],
  });
  expect(await api.verifyPackage(params)).toBe(false);
});

test.each(['installPackage', 'manualInstallPackage'] as const)(
  '%s rehashes bytes changed without changing size or mtime',
  async (method) => {
    const { api, file, params } = await preparePackage('win32');
    const signedParams = { ...params, skipGPGVerification: false };
    mockStore.getASCFile.mockReturnValue('signed checksums');
    mockReadKey.mockResolvedValue({});
    mockReadCleartextMessage.mockResolvedValue({
      getText: () => `${mockSha256}  ${path.basename(file)}`,
      verify: async () => [{ verified: Promise.resolve(true) }],
    });
    const fixedTime = new Date('2025-01-01T00:00:00.000Z');
    fs.utimesSync(file, fixedTime, fixedTime);
    expect(await api.verifyFile(signedParams)).toBe(true);
    const before = fs.statSync(file);
    const tampered = Buffer.from(mockPackage);
    tampered[0] ^= 1;
    fs.writeFileSync(file, tampered);
    fs.utimesSync(file, fixedTime, fixedTime);
    const after = fs.statSync(file);
    expect(after.size).toBe(before.size);
    expect(after.mtimeMs).toBe(before.mtimeMs);

    await expect(api[method](signedParams)).rejects.toThrow(
      '"code":"INTEGRITY_FAILED"',
    );
    expect(mockSpawn).not.toHaveBeenCalled();
    expect(mockOpenPath).not.toHaveBeenCalled();
  },
);

test('macOS stages only after confirmation and verification', async () => {
  const api = createApi('darwin');
  mockHttpsResponse(feed('6.0.0', [`OneKey-6.0.0-${process.arch}.zip`]));
  await api.checkForUpdates(false, {}, '6.0.0');
  await api.downloadUpdate();
  expect(mockNativeUpdater.setFeedURL).not.toHaveBeenCalled();
  const params = {
    buildNumber: '123',
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
  let triggerDownloaded!: () => void;
  mockNativeUpdater.checkForUpdates.mockImplementationOnce(() => {
    triggerDownloaded = () => mockNativeUpdater.emit('update-downloaded');
  });
  const staging = internal.stageMacUpdate(internal.readRecord());
  await new Promise<void>((resolve) => setImmediate(resolve));
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
  triggerDownloaded();
  await staging;
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
  await expect(check).rejects.toThrow('"code":"CANCELLED"');
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
  await expect(oldCheck).rejects.toThrow('"code":"CANCELLED"');
  expect((await newCheck)?.version).toBe('6.0.0');
  await api.downloadUpdate();
  expect(api.downloadedEvent?.downloadUrl).toBeTruthy();
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
  await expect(asc).rejects.toThrow('"code":"CANCELLED"');
  expect(signal?.aborted).toBe(true);
  expect(mockStore.setASCFile).not.toHaveBeenCalled();
});

test('macOS never stages when ASC verification fails', async () => {
  const { api, params } = await preparePackage('darwin');
  delete process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION;
  await expect(api.installPackage(params)).rejects.toThrow(
    '"code":"INTEGRITY_FAILED"',
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
    '"code":"INSTALL_FAILED"',
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
    '"code":"INSTALL_FAILED"',
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

test('macOS native staging rejects cache clearing until handoff completes', async () => {
  const { api, params, file } = await preparePackage('darwin');
  let started!: () => void;
  const stagingStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  mockNativeUpdater.checkForUpdates.mockImplementationOnce(() => {
    started();
  });
  const install = api.installPackage(params);
  await stagingStarted;
  await expect(api.clearUpdateCache()).rejects.toThrow(
    '"code":"INSTALL_FAILED"',
  );
  expect(fs.existsSync(file)).toBe(true);
  mockNativeUpdater.emit('update-downloaded');
  expect(await install).toBe(true);
});

test('macOS staged package cannot be cleared and remains installable', async () => {
  const { api, params, file } = await preparePackage('darwin');
  const internal = api as unknown as {
    readRecord: () => { downloadedFile: string };
    stageMacUpdate: (record: { downloadedFile: string }) => Promise<void>;
  };
  await internal.stageMacUpdate(internal.readRecord());
  await expect(api.clearUpdateCache()).rejects.toThrow(
    '"code":"INSTALL_FAILED"',
  );
  expect(fs.existsSync(file)).toBe(true);
  expect(api.downloadedEvent).toBeDefined();
  expect(await api.installPackage(params)).toBe(true);
  expect(mockNativeUpdater.quitAndInstall).toHaveBeenCalledTimes(1);
});

test('manual cache clearing revokes a captured macOS preparation and removes the package', async () => {
  const { api, file } = await preparePackage('darwin');
  mockApp.isPackaged = true;
  const internal = api as unknown as {
    macStagedIdentity?: string;
    macCancellationSnapshot?: object;
  };
  internal.macStagedIdentity = 'verified-native-stage';
  internal.macCancellationSnapshot = { captured: true };
  await api.clearUpdateCache({ manual: true });
  expect(mockFinishMacUpdateCancellation).not.toHaveBeenCalled();
  await api.clearUpdateCache({ manual: true, complete: true });
  expect(mockCancelMacUpdate).toHaveBeenCalledWith(expect.any(String), {
    captured: true,
  });
  expect(mockFinishMacUpdateCancellation).toHaveBeenCalledTimes(1);
  expect(fs.existsSync(file)).toBe(false);
  expect(internal.macStagedIdentity).toBeUndefined();
});

test('automatic cache clearing preserves a captured macOS preparation', async () => {
  const { api, file } = await preparePackage('darwin');
  (api as unknown as { macStagedIdentity?: string }).macStagedIdentity =
    'staged';
  await expect(api.clearUpdateCache()).rejects.toThrow('INSTALL_FAILED');
  expect(mockCancelMacUpdate).not.toHaveBeenCalled();
  expect(fs.existsSync(file)).toBe(true);
});

test('failed native revocation preserves the prepared file and does not acknowledge cleanup', async () => {
  const { api, file } = await preparePackage('darwin');
  mockApp.isPackaged = true;
  const internal = api as unknown as {
    macStagedIdentity?: string;
    macCancellationSnapshot?: object;
  };
  internal.macStagedIdentity = 'staged';
  internal.macCancellationSnapshot = {};
  mockCancelMacUpdate.mockRejectedValueOnce(new Error('authorization refused'));
  await expect(api.clearUpdateCache({ manual: true })).rejects.toThrow();
  expect(fs.existsSync(file)).toBe(true);
  expect(internal.macStagedIdentity).toBe('staged');
  expect(mockFinishMacUpdateCancellation).not.toHaveBeenCalled();
});

test('manual clearing holds normal quit and rejects an install until revocation settles', async () => {
  const { api, params } = await preparePackage('darwin');
  mockApp.isPackaged = true;
  let finish!: () => void;
  mockCancelMacUpdate.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const clear = api.clearUpdateCache({ manual: true });
  await new Promise<void>((resolve) => setImmediate(resolve));
  const barrierModule =
    require('@onekeyhq/desktop/app/libs/manualUpdateCacheClear') as typeof import('@onekeyhq/desktop/app/libs/manualUpdateCacheClear');
  const barrier = barrierModule.getManualUpdateCacheClearBarrier();
  expect(barrier).toBeDefined();
  expect(await api.installPackage(params)).toBe(false);
  expect(mockAppQuit).not.toHaveBeenCalled();
  finish();
  await clear;
  expect(barrierModule.getManualUpdateCacheClearBarrier()).toBe(barrier);
  await api.clearUpdateCache({ manual: true, complete: true });
  await barrier;
  expect(barrierModule.getManualUpdateCacheClearBarrier()).toBeUndefined();
});

test('unpackaged manual clearing does not require a signed native helper', async () => {
  const { api, file } = await preparePackage('darwin');
  await api.clearUpdateCache({ manual: true });
  expect(mockCancelMacUpdate).not.toHaveBeenCalled();
  expect(fs.existsSync(file)).toBe(false);
});

test('renderer loss releases quit only after native cancellation settles and preserves the receipt', async () => {
  const { api } = await preparePackage('darwin');
  mockApp.isPackaged = true;
  let finish!: () => void;
  mockCancelMacUpdate.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const clear = api.clearUpdateCache({ manual: true });
  await new Promise<void>((resolve) => setImmediate(resolve));
  const barrierModule =
    require('@onekeyhq/desktop/app/libs/manualUpdateCacheClear') as typeof import('@onekeyhq/desktop/app/libs/manualUpdateCacheClear');
  const barrier = barrierModule.getManualUpdateCacheClearBarrier();
  mockMainWindow.webContents.emit('render-process-gone');
  await Promise.resolve();
  expect(barrierModule.getManualUpdateCacheClearBarrier()).toBe(barrier);
  finish();
  await clear;
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(barrierModule.getManualUpdateCacheClearBarrier()).toBeUndefined();
  expect(mockFinishMacUpdateCancellation).not.toHaveBeenCalled();
  expect(mockMainWindow.webContents.listenerCount('render-process-gone')).toBe(
    0,
  );
});

test.each(['missing', 'destroyed', 'crashed'] as const)(
  'an already %s renderer releases quit after native cancellation settles',
  async (state) => {
    const { api } = await preparePackage('darwin');
    mockApp.isPackaged = true;
    if (state === 'missing') {
      (
        globalThis as unknown as {
          $desktopMainAppFunctions: { getSafelyMainWindow: () => unknown };
        }
      ).$desktopMainAppFunctions.getSafelyMainWindow = () => undefined;
    } else if (state === 'destroyed') {
      mockMainWindow.webContents.isDestroyed.mockReturnValueOnce(true);
    } else {
      mockMainWindow.webContents.isCrashed.mockReturnValueOnce(true);
    }
    let finish!: () => void;
    mockCancelMacUpdate.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const clear = api.clearUpdateCache({ manual: true });
    await new Promise<void>((resolve) => setImmediate(resolve));
    const barriers =
      require('@onekeyhq/desktop/app/libs/manualUpdateCacheClear') as typeof import('@onekeyhq/desktop/app/libs/manualUpdateCacheClear');
    expect(barriers.getManualUpdateCacheClearBarrier()).toBeDefined();
    finish();
    await clear;
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(barriers.getManualUpdateCacheClearBarrier()).toBeUndefined();
    expect(mockFinishMacUpdateCancellation).not.toHaveBeenCalled();
  },
);

test('automatic clearing preserves a prepared Windows quit update; manual clearing revokes it', async () => {
  const { api, file, params } = await preparePackage('win32');
  await api.prepareQuitInstall(params);
  expect(api.hasPreparedQuitInstall()).toBe(true);
  await expect(api.clearUpdateCache()).rejects.toThrow('INSTALL_FAILED');
  expect(api.hasPreparedQuitInstall()).toBe(true);
  expect(fs.existsSync(file)).toBe(true);
  await api.clearUpdateCache({ manual: true });
  await api.clearUpdateCache({ manual: true, complete: true });
  expect(api.hasPreparedQuitInstall()).toBe(false);
  expect(fs.existsSync(file)).toBe(false);
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
  expect(mockSpawn).toHaveBeenCalledWith(
    file,
    ['/S', '--updated', '--force-run'],
    {
      cwd: path.dirname(file),
      detached: true,
      stdio: 'ignore',
    },
  );
  expect(mockAppQuit).toHaveBeenCalledTimes(1);
});

test.each(['allUsers', 'unknown'] as const)(
  'Windows %s startup defers installation without elevation and preserves explicit installation',
  async (scope) => {
    const { api, file, params } = await preparePackage('win32');
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (
        scope === 'allUsers' &&
        command === 'reg.exe' &&
        args[1]?.startsWith('HKLM\\')
      ) {
        return `    InstallLocation    REG_SZ    ${path.win32.dirname(process.execPath)}\r\n`;
      }
      throw new OneKeyLocalError('Registry key unavailable');
    });
    mockSpawn.mockImplementation(() => {
      const child = Object.assign(new EventEmitter(), { unref: jest.fn() });
      setImmediate(() => child.emit('exit', 0));
      return child;
    });

    expect(
      await api.installPackage({ ...params, installSource: 'startup' }),
    ).toBe(false);
    expect(mockSpawn).not.toHaveBeenCalled();
    expect(mockAppQuit).not.toHaveBeenCalled();
    expect(mockShowMessageBox).not.toHaveBeenCalled();
    expect(mockStore.setUpdateBuildNumber).not.toHaveBeenCalled();
    expect(fs.existsSync(file)).toBe(true);
    expect(api.downloadedEvent).toBeDefined();

    expect(await api.installPackage({ ...params, userInitiated: true })).toBe(
      true,
    );
    expect(mockSpawn).toHaveBeenCalledTimes(1);
    expect(mockSpawn).toHaveBeenCalledWith(
      path.join(process.resourcesPath, 'elevate.exe'),
      [file, '/S', '--updated', '--force-run'],
      {
        cwd: process.resourcesPath,
        detached: true,
        stdio: 'ignore',
      },
    );
    expect(mockAppQuit).toHaveBeenCalledTimes(1);
  },
);

test('Windows current-user startup still launches the verified installer', async () => {
  const { api, file, params } = await preparePackage('win32');
  expect(
    await api.installPackage({ ...params, installSource: 'startup' }),
  ).toBe(true);
  expect(mockSpawn).toHaveBeenCalledWith(
    file,
    ['/S', '--updated', '--force-run'],
    {
      cwd: path.dirname(file),
      detached: true,
      stdio: 'ignore',
    },
  );
  expect(mockShowMessageBox).not.toHaveBeenCalled();
  expect(mockAppQuit).toHaveBeenCalledTimes(1);
});

test('Windows cancelled elevation keeps the verified update ready and the window visible', async () => {
  const { api, params } = await preparePackage('win32');
  mockExecFileSync.mockImplementation(() => {
    throw new OneKeyLocalError('Registry key unavailable');
  });
  mockSpawn.mockImplementationOnce(() => {
    const child = Object.assign(new EventEmitter(), { unref: jest.fn() });
    setImmediate(() => child.emit('exit', 1223));
    return child;
  });
  await expect(
    api.installPackage({ ...params, userInitiated: true }),
  ).rejects.toThrow('"code":"CANCELLED"');
  expect(mockAppQuit).not.toHaveBeenCalled();
  expect(mockMainWindow.show).toHaveBeenCalled();
  expect(mockMainWindow.focus).toHaveBeenCalled();
});

test('Windows quit update never asks for elevation after a direct launch error', async () => {
  const { api, params } = await preparePackage('win32');
  await api.prepareQuitInstall(params);
  mockSpawn.mockImplementationOnce(() => {
    const child = Object.assign(new EventEmitter(), { unref: jest.fn() });
    setImmediate(() =>
      child.emit(
        'error',
        Object.assign(new Error('denied'), { code: 'EACCES' }),
      ),
    );
    return child;
  });
  expect(await api.installOnQuit()).toBe(false);
  expect(mockSpawn).toHaveBeenCalledTimes(1);
  expect(mockSpawn.mock.calls[0][0]).not.toContain('elevate.exe');
});

test('Windows quit update hands off the verified installer without relaunching', async () => {
  const { api, file, params } = await preparePackage('win32');
  await api.prepareQuitInstall(params);

  expect(api.hasPreparedQuitInstall()).toBe(true);
  expect(await api.installOnQuit()).toBe(true);
  expect(mockSpawn).toHaveBeenCalledWith(file, ['/S', '--updated'], {
    cwd: path.dirname(file),
    detached: true,
    stdio: 'ignore',
  });
  expect(mockShowMessageBox).not.toHaveBeenCalled();
  expect(mockAppRelaunch).not.toHaveBeenCalled();
  expect(mockAppQuit).not.toHaveBeenCalled();
  expect(await api.installOnQuit()).toBe(false);
  expect(mockSpawn).toHaveBeenCalledTimes(1);
});

test('macOS prepares a native quit update without quitting or relaunching early', async () => {
  const { api, params } = await preparePackage('darwin');
  jest.spyOn(fs, 'realpathSync').mockReturnValue('/Applications/OneKey.app');

  await api.prepareMacInstall(params);
  await api.prepareMacInstall(params);

  expect(mockNativeUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
  expect(mockNativeUpdater.quitAndInstall).not.toHaveBeenCalled();
  expect(mockShowMessageBox).not.toHaveBeenCalled();
  expect(mockAppQuit).not.toHaveBeenCalled();
  expect(mockAppRelaunch).not.toHaveBeenCalled();
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
    '"code":"INSTALL_FAILED"',
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
  await expect(api.installPackage(params)).rejects.toThrow(
    '"code":"INSTALL_FAILED"',
  );
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
    verify: async () => [{ verified: Promise.resolve(true) }],
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
    verify: async () => [{ verified: Promise.resolve(true) }],
  });
  expect(await api.installPackage(params)).toBe(true);
  expect(mockOpenPath).toHaveBeenCalledWith(path.dirname(file));
  expect(mockSpawn).not.toHaveBeenCalled();
});

test.each(['missing', 'read-only-file', 'read-only-directory'] as const)(
  'Linux startup with %s AppImage defers to explicit installation without reporting a handoff',
  async (scenario) => {
    const current = path.join(mockTempDir, 'OneKey.AppImage');
    if (scenario === 'missing') delete process.env.APPIMAGE;
    else {
      fs.writeFileSync(current, 'old app');
      process.env.APPIMAGE = current;
    }
    const { api, file, params } = await preparePackage('linux', 'appImage');
    mockStore.getASCFile.mockReturnValue('signed checksums');
    mockReadKey.mockResolvedValue({});
    mockReadCleartextMessage.mockResolvedValue({
      getText: () => `${mockSha256}  ${path.basename(file)}`,
      verify: async () => [{ verified: Promise.resolve(true) }],
    });
    const accessSync = fs.accessSync;
    const readOnlyPath =
      scenario === 'read-only-file' ? current : path.dirname(current);
    jest.spyOn(fs, 'accessSync').mockImplementation((filePath, mode) => {
      if (filePath === readOnlyPath && mode === fs.constants.W_OK) {
        throw Object.assign(new Error('read-only'), { code: 'EACCES' });
      }
      return accessSync(filePath, mode);
    });

    expect(
      await api.installPackage({ ...params, installSource: 'startup' }),
    ).toBe(false);
    expect(mockOpenPath).not.toHaveBeenCalled();
    expect(mockAppQuit).not.toHaveBeenCalled();
    expect(mockAppRelaunch).not.toHaveBeenCalled();
    expect(mockStore.setUpdateBuildNumber).not.toHaveBeenCalled();
    expect(await api.installPackage({ ...params, userInitiated: true })).toBe(
      true,
    );
    expect(mockOpenPath).toHaveBeenCalledWith(path.dirname(file));
  },
);

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
    args: process.argv.slice(1),
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

test('Linux quit update replaces the original versioned AppImage path and keeps it on next launch', async () => {
  const current = path.join(
    mockTempDir,
    'OneKey-Wallet-5.9.0-linux-x86_64.AppImage',
  );
  fs.writeFileSync(current, 'old app');
  process.env.APPIMAGE = current;
  const { api, params } = await preparePackage('linux', 'appImage');

  await api.prepareQuitInstall(params);
  expect(api.hasPreparedQuitInstall()).toBe(true);
  expect(await api.installOnQuit()).toBe(true);
  expect(fs.readFileSync(current)).toEqual(mockPackage);
  expect(mockAppRelaunch).not.toHaveBeenCalled();
  expect(mockAppQuit).not.toHaveBeenCalled();
  expect(
    fs.readdirSync(mockTempDir).some((name) => name.endsWith('.old')),
  ).toBe(true);

  mockAppGetVersion.mockReturnValue('6.0.0');
  createApi('linux', 'appImage');
  expect(fs.readFileSync(current)).toEqual(mockPackage);
  expect(mockStore.setUpdateBuildNumber).toHaveBeenCalledWith('123');
  expect(
    fs.readdirSync(mockTempDir).some((name) => name.endsWith('.old')),
  ).toBe(false);
});

test.each([false, true])(
  'targeted quit cancellation cannot clear a newer preparation (pending=%s)',
  async (pending) => {
    const { api, params } = await preparePackage('win32');
    const internal = api as unknown as {
      getInstallRecord: (value: typeof params) => Promise<unknown>;
    };
    const getRecord = internal.getInstallRecord.bind(internal);
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const verify = jest
      .spyOn(internal, 'getInstallRecord')
      .mockImplementation(async (value) => {
        await barrier;
        return getRecord(value);
      });
    const preparing = api.prepareQuitInstall(params);
    if (!pending) {
      release();
      await preparing;
    }
    await api.prepareQuitInstall(undefined, {
      latestVersion: '5.9.9',
      downloadUrl: 'https://cdn.onekey.so/old.exe',
    });
    if (pending) {
      release();
      await preparing;
    }
    expect(api.hasPreparedQuitInstall()).toBe(true);
    verify.mockRestore();
  },
);

test('cancelled quit preparation does not revive after verification resolves', async () => {
  const { api, params } = await preparePackage('win32');
  const internal = api as unknown as {
    getInstallRecord: (value: typeof params) => Promise<unknown>;
  };
  const getRecord = internal.getInstallRecord.bind(internal);
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  jest.spyOn(internal, 'getInstallRecord').mockImplementation(async (value) => {
    await barrier;
    return getRecord(value);
  });
  const preparing = api.prepareQuitInstall(params);
  await api.prepareQuitInstall(undefined, params);
  release();
  await preparing;
  expect(api.hasPreparedQuitInstall()).toBe(false);
  expect(await api.installOnQuit()).toBe(false);
  expect(mockSpawn).not.toHaveBeenCalled();
});

test('quit revocation cannot acknowledge success while a selected installer is validating', async () => {
  const { api, params } = await preparePackage('win32');
  await api.prepareQuitInstall(params);
  const internal = api as unknown as {
    getInstallRecord: (value: typeof params) => Promise<unknown>;
  };
  const getRecord = internal.getInstallRecord.bind(internal);
  let release!: () => void;
  let started!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const validating = new Promise<void>((resolve) => {
    started = resolve;
  });
  jest
    .spyOn(internal, 'getInstallRecord')
    .mockImplementationOnce(async (value) => {
      started();
      await barrier;
      return getRecord(value);
    });
  const installing = api.installOnQuit();
  await validating;
  try {
    await expect(api.prepareQuitInstall(undefined, params)).rejects.toThrow(
      '"code":"INSTALL_FAILED"',
    );
    expect(mockSpawn).not.toHaveBeenCalled();
  } finally {
    release();
  }
  expect(await installing).toBe(true);
});

test('Linux quit update holds the install lock until AppImage replacement finishes', async () => {
  const current = path.join(
    mockTempDir,
    'OneKey-Wallet-5.9.0-linux-x86_64.AppImage',
  );
  fs.writeFileSync(current, 'old app');
  process.env.APPIMAGE = current;
  const { api, params } = await preparePackage('linux', 'appImage');
  await api.prepareQuitInstall(params);
  let releaseCopy!: () => void;
  let copyStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    copyStarted = resolve;
  });
  const copyFile = fs.promises.copyFile.bind(fs.promises);
  jest
    .spyOn(fs.promises, 'copyFile')
    .mockImplementationOnce(async (source, destination, mode) => {
      copyStarted();
      await new Promise<void>((resolve) => {
        releaseCopy = resolve;
      });
      await copyFile(source, destination, mode);
    });

  const installing = api.installOnQuit();
  await started;
  await expect(api.prepareQuitInstall(undefined, params)).rejects.toThrow(
    '"code":"INSTALL_FAILED"',
  );
  expect(await api.installPackage(params)).toBe(false);
  await expect(api.clearUpdateCache()).rejects.toThrow(
    '"code":"INSTALL_FAILED"',
  );
  releaseCopy();
  expect(await installing).toBe(true);
  expect(fs.readFileSync(current)).toEqual(mockPackage);
});

test.each(['x64', 'arm64'] as const)(
  'Windows %s selects a single multi-arch NSIS installer',
  async (arch) => {
    const api = createApi('win32', undefined, arch);
    mockHttpsResponse(feed('6.6.0', ['OneKey-Wallet-6.6.0-win.exe']));
    const artifact = await api.checkForUpdates(false, {}, '6.6.0');
    expect(artifact?.fileName).toBe('OneKey-Wallet-6.6.0-win.exe');
    expect(artifact?.arch).toBe(arch);
  },
);

test('rejects an ASC signed for a different artifact filename', async () => {
  const { api, params } = await preparePackage('darwin');
  delete process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION;
  mockStore.getASCFile.mockReturnValue('signed checksums');
  mockReadKey.mockResolvedValue({});
  mockReadCleartextMessage.mockResolvedValue({
    getText: () => `${mockSha256}  OneKey-6.5.0-mac-arm64.zip`,
    verify: async () => [{ verified: Promise.resolve(true) }],
  });
  expect(
    await api.verifyFile({
      ...params,
      skipGPGVerification: false,
    }),
  ).toBe(false);
  expect(await api.verifyASC()).toBe(false);
  expect(
    await api.verifyASC({
      ...params,
      downloadUrl: 'https://example.com/OneKey-6.5.0-mac-arm64.zip',
      skipGPGVerification: false,
    }),
  ).toBe(false);
});

test('rejects feed artifact filename that does not contain selectedVersion and guards useTestUpdateFeedUrl in packaged builds', async () => {
  const api = createApi('darwin');
  mockHttpsResponse(feed('6.0.0', [`OneKey-5.9.9-${process.arch}.zip`]));
  await expect(api.checkForUpdates(false, {}, '6.0.0')).rejects.toThrow(
    '"code":"INCOMPATIBLE"',
  );

  mockApp.isPackaged = true;
  mockStore.getDevSettingsEnabled.mockReturnValue(false);
  await api.useTestUpdateFeedUrl(true);
  expect(mockStore.setUpdateSettings).not.toHaveBeenCalled();

  mockStore.getDevSettingsEnabled.mockReturnValue(true);
  await api.useTestUpdateFeedUrl(true);
  expect(mockStore.setUpdateSettings).toHaveBeenCalledWith({
    useTestFeedUrl: true,
  });
  mockApp.isPackaged = false;
  mockStore.getDevSettingsEnabled.mockReturnValue(false);
});

test('Linux AppImage handoff keeps marker if an unrelated AppImage starts and falls back to copyFile on EXDEV', async () => {
  const current = path.join(mockTempDir, 'OneKey.AppImage');
  fs.writeFileSync(current, 'old app');
  process.env.APPIMAGE = current;
  const { api, params } = await preparePackage('linux', 'appImage');
  jest.spyOn(fs.promises, 'link').mockRejectedValueOnce(
    Object.assign(new Error('cross-device link not permitted'), {
      code: 'EXDEV',
    }),
  );
  expect(await api.installPackage(params)).toBe(true);
  expect(fs.readFileSync(current)).toEqual(mockPackage);
  const marker = path.join(
    mockTempDir,
    'app-shell-updater',
    'appimage-handoff.json',
  );
  expect(fs.existsSync(marker)).toBe(true);
  process.env.APPIMAGE = path.join(mockTempDir, 'Moved-OneKey.AppImage');
  mockAppGetVersion.mockReturnValue('6.0.0');
  createApi('linux', 'appImage');
  expect(mockStore.setUpdateBuildNumber).not.toHaveBeenCalled();
  expect(fs.existsSync(marker)).toBe(true);
  expect(fs.readFileSync(current)).toEqual(mockPackage);
});

test('Linux permits a later verified update after the candidate AppImage is moved', async () => {
  const current = path.join(mockTempDir, 'OneKey-5.9.0.AppImage');
  const firstDestination = path.join(mockTempDir, linuxArtifactName());
  fs.writeFileSync(current, 'old running app');
  fs.writeFileSync(firstDestination, 'previous destination');
  process.env.APPIMAGE = current;
  const { api, params } = await preparePackage('linux', 'appImage');
  expect(await api.installPackage(params)).toBe(true);

  const marker = path.join(
    mockTempDir,
    'app-shell-updater',
    'appimage-handoff.json',
  );
  const firstHandoff = JSON.parse(fs.readFileSync(marker, 'utf8')) as {
    backup: string;
  };
  const moved = path.join(mockTempDir, 'Moved-OneKey-6.0.0.AppImage');
  fs.renameSync(firstDestination, moved);
  process.env.APPIMAGE = moved;
  mockAppGetVersion.mockReturnValue('6.0.0');
  const nextApi = createApi('linux', 'appImage');
  expect(fs.existsSync(marker)).toBe(true);

  mockHttpsResponse(
    feed('6.1.0', [linuxArtifactName().replace('6.0.0', '6.1.0')]),
  );
  const nextArtifact = await nextApi.checkForUpdates(false, {}, '6.1.0');
  await nextApi.downloadUpdate();
  expect(
    await nextApi.installPackage({
      buildNumber: '124',
      downloadUrl: nextArtifact?.url || '',
      latestVersion: '6.1.0',
      skipGPGVerification: true,
    }),
  ).toBe(true);
  expect(fs.readFileSync(current, 'utf8')).toBe('old running app');
  expect(fs.readFileSync(firstHandoff.backup, 'utf8')).toBe(
    'previous destination',
  );
  expect(fs.readFileSync(moved)).toEqual(mockPackage);
  expect(JSON.parse(fs.readFileSync(marker, 'utf8'))).toMatchObject({
    current: moved,
    version: '6.1.0',
  });
});

test('Linux restores the old AppImage when relaunch cannot be queued', async () => {
  const current = path.join(mockTempDir, 'OneKey.AppImage');
  fs.writeFileSync(current, 'old app');
  process.env.APPIMAGE = current;
  const { api, params } = await preparePackage('linux', 'appImage');
  mockAppRelaunch.mockImplementationOnce(() => {
    throw new OneKeyLocalError('relaunch failed');
  });
  await expect(api.installPackage(params)).rejects.toThrow(
    '"code":"INSTALL_FAILED"',
  );
  expect(fs.readFileSync(current, 'utf8')).toBe('old app');
  expect(mockAppQuit).not.toHaveBeenCalled();
  expect(mockStore.setUpdateBuildNumber).not.toHaveBeenCalled();
});

test('Linux preserves an existing versioned destination when relaunch fails', async () => {
  const current = path.join(mockTempDir, 'OneKey-5.9.0.AppImage');
  const destination = path.join(mockTempDir, linuxArtifactName());
  fs.writeFileSync(current, 'running app');
  fs.writeFileSync(destination, 'previous destination');
  process.env.APPIMAGE = current;
  const { api, params } = await preparePackage('linux', 'appImage');
  mockAppRelaunch.mockImplementationOnce(() => {
    throw new OneKeyLocalError('relaunch failed');
  });

  await expect(api.installPackage(params)).rejects.toThrow(
    '"code":"INSTALL_FAILED"',
  );
  expect(fs.readFileSync(current, 'utf8')).toBe('running app');
  expect(fs.readFileSync(destination, 'utf8')).toBe('previous destination');
  expect(
    fs.readdirSync(mockTempDir).some((name) => name.endsWith('.old')),
  ).toBe(false);
});

test('Linux restores an existing versioned destination when the old AppImage restarts', async () => {
  const current = path.join(mockTempDir, 'OneKey-5.9.0.AppImage');
  const destination = path.join(mockTempDir, linuxArtifactName());
  fs.writeFileSync(current, 'running app');
  fs.writeFileSync(destination, 'previous destination');
  process.env.APPIMAGE = current;
  const { api, params } = await preparePackage('linux', 'appImage');
  expect(await api.installPackage(params)).toBe(true);
  expect(fs.readFileSync(destination)).toEqual(mockPackage);

  createApi('linux', 'appImage');
  expect(fs.readFileSync(current, 'utf8')).toBe('running app');
  expect(fs.readFileSync(destination, 'utf8')).toBe('previous destination');
  expect(
    fs.readdirSync(mockTempDir).some((name) => name.endsWith('.old')),
  ).toBe(false);
});

test('a failed replacement download retains the last verified installer', async () => {
  const { api, file } = await preparePackage('linux', 'appImage');
  mockHttpsResponse(
    feed('6.1.0', [linuxArtifactName().replace('6.0.0', '6.1.0')]),
  );
  await api.checkForUpdates(false, {}, '6.1.0');
  mockDownloadNodeFile.mockRejectedValueOnce(
    Object.assign(new Error('connection lost'), { code: 'ECONNRESET' }),
  );

  await expect(api.downloadUpdate()).rejects.toThrow('"code":"NETWORK_ERROR"');
  expect(fs.readFileSync(file)).toEqual(mockPackage);
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

test.each([
  ['same origin', 'https://updates.onekey.test', true],
  ['normalized same origin', 'https://UPDATES.onekey.test:443', true],
  ['external CDN', 'https://cdn.fixture.test', false],
  ['lookalike host', 'https://updates.onekey.test.external.test', false],
  ['different port', 'https://updates.onekey.test:444', false],
])(
  'binds artifact and ASC headers to the feed origin: %s',
  async (_label, origin, sameOrigin) => {
    const api = createApi('darwin');
    const headers = {
      Authorization: 'private-fixture',
      Cookie: 'private-cookie',
      'X-Onekey-Instance-Id': 'private-instance',
      'X-Onekey-Locale': 'private-locale',
      'X-Onekey-Currency': 'private-currency',
      'X-Onekey-Platform': 'private-platform',
      Accept: 'application/octet-stream',
    };
    const metadataRequest = mockHttpsResponse(
      feed('6.0.0', [`${origin}/OneKey-6.0.0-${process.arch}.zip`]),
    );
    const artifact = await api.checkForUpdates(false, headers, '6.0.0');
    expect(metadataRequest).toHaveBeenCalledWith(
      expect.stringContaining('https://updates.onekey.test/'),
      { ...headers, 'User-Agent': 'OneKey-test' },
      expect.any(AbortSignal),
      30_000,
    );
    await api.downloadUpdate();
    const expectedHeaders = sameOrigin
      ? { ...headers, 'User-Agent': 'OneKey-test' }
      : { Accept: 'application/octet-stream', 'User-Agent': 'OneKey-test' };
    expect(mockDownloadNodeFile).toHaveBeenCalledWith(
      expect.objectContaining({ url: artifact?.url, headers: expectedHeaders }),
    );
    const ascRequest = mockHttpsResponse('signed checksums');
    expect(
      await api.downloadASC({
        buildNumber: '123',
        downloadUrl: artifact?.url,
        latestVersion: artifact?.version,
        skipGPGVerification: false,
      }),
    ).toBe(true);
    expect(ascRequest).toHaveBeenLastCalledWith(
      expect.stringContaining('.zip.SHA256SUMS.asc'),
      expectedHeaders,
      expect.any(AbortSignal),
      30_000,
    );
  },
);

test('concurrent downloadUpdate calls await activeDownload and emit UPDATE_DOWNLOADED', async () => {
  const api = createApi('darwin');
  mockHttpsResponse(feed('6.0.0', [`OneKey-6.0.0-${process.arch}.zip`]));
  await api.checkForUpdates(false, {}, '6.0.0');

  let finishDownload!: () => void;
  mockDownloadNodeFile.mockImplementationOnce(
    async ({ targetPath }: { targetPath: string }) =>
      new Promise<void>((resolve) => {
        finishDownload = () => {
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          fs.writeFileSync(targetPath, mockPackage);
          resolve();
        };
      }),
  );

  let secondResolved = false;
  const first = api.downloadUpdate();
  const second = api.downloadUpdate().then(() => {
    secondResolved = true;
  });

  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(secondResolved).toBe(false);

  finishDownload();
  await Promise.all([first, second]);
  expect(secondResolved).toBe(true);
  expect(mockDownloadNodeFile).toHaveBeenCalledTimes(1);
  expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
    'UPDATE_DOWNLOADED',
    expect.objectContaining({
      latestVersion: '6.0.0',
      downloadUrl: expect.stringContaining('.zip'),
    }),
  );
});

test.each([
  ['ENOENT', 'PACKAGE_MISSING'],
  ['EACCES', 'STORAGE_ERROR'],
])(
  'normalizes a streamed package hash %s failure before IPC',
  async (errno, code) => {
    const { api, file, params } = await preparePackage('darwin');
    delete process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION;
    mockStore.getASCFile.mockReturnValue('signed checksums');
    mockReadKey.mockResolvedValue({});
    mockReadCleartextMessage.mockResolvedValue({
      getText: () => `${mockSha256}  ${path.basename(file)}`,
      verify: async () => [{ verified: Promise.resolve(true) }],
    });
    const readStream = jest
      .spyOn(fs, 'createReadStream')
      .mockImplementationOnce(() => {
        const stream = new PassThrough();
        setImmediate(() =>
          stream.destroy(
            Object.assign(
              new Error('/Users/private/package.zip?token=secret'),
              { code: errno },
            ),
          ),
        );
        return stream as unknown as fs.ReadStream;
      });
    const dto = { code, step: 'verifyPackage' };
    try {
      await expect(api.verifyPackage(params)).rejects.toMatchObject({
        code: expect.any(Number),
        message: `${UPDATE_ERROR_WIRE_PREFIX}${JSON.stringify(dto)}`,
        data: { updateError: dto },
      });
      expect(readStream).toHaveBeenCalledWith(file);
    } finally {
      readStream.mockRestore();
    }
  },
);

test('rebinds metadata HTTP failure to the public downloadASC step', async () => {
  const { api, params } = await preparePackage('darwin');
  delete process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION;
  mockHttpsResponse('', 429);
  const dto = { code: 'HTTP_ERROR', step: 'downloadASC', httpStatus: 429 };
  await expect(api.downloadASC(params)).rejects.toMatchObject({
    code: expect.any(Number),
    message: `${UPDATE_ERROR_WIRE_PREFIX}${JSON.stringify(dto)}`,
    data: { updateError: dto },
  });
  expect(mockStore.setASCFile).not.toHaveBeenCalled();
});

test.each([
  ['EACCES', 'STORAGE_ERROR'],
  [undefined, 'UNKNOWN'],
])('normalizes cleanup failure %s before IPC', async (errno, code) => {
  const api = createApi('darwin');
  mockStore.clearUpdateSettings.mockImplementationOnce(() => {
    throw Object.assign(
      new Error('/Users/private/update-settings?token=secret'),
      { code: errno },
    );
  });
  const dto = { code, step: 'cleanup' };
  await expect(api.clearUpdateSettings()).rejects.toMatchObject({
    code: expect.any(Number),
    message: `${UPDATE_ERROR_WIRE_PREFIX}${JSON.stringify(dto)}`,
    data: { updateError: dto },
  });
});

describe('install-stage IPC error step rebinding (missing file & SHA mismatch)', () => {
  function simulateElectronIpcRoundtrip(err: unknown): unknown {
    const { makeIpcSafeError, unwrapElectronIpcError } =
      require('@onekeyhq/shared/src/errors/utils/electronIpcError') as typeof import('@onekeyhq/shared/src/errors/utils/electronIpcError');
    const safeError = makeIpcSafeError(err, 'IPC error');
    const ipcWrapped = new Error(
      `Error invoking remote method 'desktopApi': ${safeError.message}`,
    );
    return unwrapElectronIpcError(ipcWrapped);
  }

  test('prepareMacInstall rebinds SHA mismatch and missing installer to install step across IPC', async () => {
    const { getUpdateError } =
      require('@onekeyhq/shared/src/modules3rdParty/auto-update/error') as typeof import('@onekeyhq/shared/src/modules3rdParty/auto-update/error');
    const { api, file, params } = await preparePackage('darwin');
    delete process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION;
    const signedParams = { ...params, skipGPGVerification: false };
    jest
      .spyOn(fs, 'realpathSync')
      .mockReturnValue('/Applications/OneKey.app' as unknown as string);
    mockStore.getASCFile.mockReturnValue('signed checksums');
    mockReadKey.mockResolvedValue({});

    // 1. GPG/SHA-256 mismatch at install time -> INTEGRITY_FAILED rebound to 'install' step
    mockReadCleartextMessage.mockResolvedValue({
      getText: () => `${'0'.repeat(64)}  ${path.basename(file)}`,
      verify: async () => [{ verified: Promise.resolve(true) }],
    });
    let caughtShaMismatch: unknown;
    try {
      await api.prepareMacInstall(signedParams);
    } catch (e) {
      caughtShaMismatch = e;
    }
    expect(caughtShaMismatch).toBeDefined();
    expect(
      getUpdateError(
        simulateElectronIpcRoundtrip(caughtShaMismatch),
        'install',
      ),
    ).toEqual({
      code: 'INTEGRITY_FAILED',
      step: 'install',
    });

    // 2. Bad GPG signature inside verifyFile -> INTEGRITY_FAILED rebound from 'verifyPackage' to 'install'
    mockReadCleartextMessage.mockResolvedValue({
      getText: () => `${mockSha256}  ${path.basename(file)}`,
      verify: async () => [{ verified: Promise.resolve(false) }],
    });
    let caughtBadSig: unknown;
    try {
      await api.prepareMacInstall(signedParams);
    } catch (e) {
      caughtBadSig = e;
    }
    expect(
      getUpdateError(simulateElectronIpcRoundtrip(caughtBadSig), 'install'),
    ).toEqual({
      code: 'INTEGRITY_FAILED',
      step: 'install',
    });

    // 3. Installer deleted before prepareMacInstall -> PACKAGE_MISSING rebound from 'verifyPackage' to 'install'
    fs.rmSync(file, { force: true });
    let caughtMissing: unknown;
    try {
      await api.prepareMacInstall(signedParams);
    } catch (e) {
      caughtMissing = e;
    }
    expect(caughtMissing).toBeDefined();
    expect(
      getUpdateError(simulateElectronIpcRoundtrip(caughtMissing), 'install'),
    ).toEqual({
      code: 'PACKAGE_MISSING',
      step: 'install',
    });
  });

  test('prepareQuitInstall and manualInstallPackage rebind SHA mismatch and missing installer to install step across IPC', async () => {
    const { getUpdateError } =
      require('@onekeyhq/shared/src/modules3rdParty/auto-update/error') as typeof import('@onekeyhq/shared/src/modules3rdParty/auto-update/error');
    const { api, file, params } = await preparePackage('win32');
    delete process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION;
    const signedParams = { ...params, skipGPGVerification: false };
    jest.spyOn(fs, 'accessSync').mockImplementation(() => undefined);
    mockStore.getASCFile.mockReturnValue('signed checksums');
    mockReadKey.mockResolvedValue({});
    mockReadCleartextMessage.mockResolvedValue({
      getText: () => `${'f'.repeat(64)}  ${path.basename(file)}`,
      verify: async () => [{ verified: Promise.resolve(true) }],
    });

    let quitErr: unknown;
    try {
      await api.prepareQuitInstall(signedParams);
    } catch (e) {
      quitErr = e;
    }
    expect(
      getUpdateError(simulateElectronIpcRoundtrip(quitErr), 'install'),
    ).toEqual({
      code: 'INTEGRITY_FAILED',
      step: 'install',
    });

    let manualTamperErr: unknown;
    try {
      await api.manualInstallPackage(signedParams);
    } catch (e) {
      manualTamperErr = e;
    }
    expect(
      getUpdateError(simulateElectronIpcRoundtrip(manualTamperErr), 'install'),
    ).toEqual({
      code: 'INTEGRITY_FAILED',
      step: 'install',
    });

    // Delete installer on disk -> PACKAGE_MISSING preserved (not overwritten with INSTALL_FAILED)
    fs.rmSync(file, { force: true });
    let quitMissingErr: unknown;
    try {
      await api.prepareQuitInstall(signedParams);
    } catch (e) {
      quitMissingErr = e;
    }
    expect(
      getUpdateError(simulateElectronIpcRoundtrip(quitMissingErr), 'install'),
    ).toEqual({
      code: 'PACKAGE_MISSING',
      step: 'install',
    });

    let manualMissingErr: unknown;
    try {
      await api.manualInstallPackage(signedParams);
    } catch (e) {
      manualMissingErr = e;
    }
    expect(
      getUpdateError(simulateElectronIpcRoundtrip(manualMissingErr), 'install'),
    ).toEqual({
      code: 'PACKAGE_MISSING',
      step: 'install',
    });
  });
});
