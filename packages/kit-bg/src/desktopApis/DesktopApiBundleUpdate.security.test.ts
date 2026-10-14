import fs from 'fs';
import os from 'os';
import path from 'path';

import { getBundleExtractDir } from '@onekeyhq/desktop/app/bundle';
import { resolveBundlePath } from '@onekeyhq/desktop/app/libs/bundlePaths';

import DesktopApiBundleUpdate from './DesktopApiBundleUpdate';
import { isDesktopApiMethodAllowed } from './desktopApiMethodPolicy';

import type { IDesktopApi } from './base/types';

let mockUserData: string;
const mockStore = {
  getUpdateBundleData: jest.fn<unknown, []>(),
  getFallbackUpdateBundleData: jest.fn<unknown, []>(),
  setUpdateBundleData: jest.fn(),
  setFallbackUpdateBundleData: jest.fn(),
  setNativeVersion: jest.fn(),
  setNativeBuildNumber: jest.fn(),
};
const mockDownload = jest.fn(async (opts: { targetPath: string }) => ({
  filePath: opts.targetPath,
  totalBytes: 1,
}));
jest.mock('electron', () => ({
  app: { getPath: () => mockUserData, getVersion: () => '6.6.0' },
  dialog: {},
}));
jest.mock('electron-log/main', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('@onekeyhq/desktop/app/libs/store', () => ({
  getUpdateBundleData: () => mockStore.getUpdateBundleData(),
  getFallbackUpdateBundleData: () => mockStore.getFallbackUpdateBundleData(),
  setUpdateBundleData: (value: unknown) => {
    mockStore.setUpdateBundleData(value);
  },
  setFallbackUpdateBundleData: (value: unknown) => {
    mockStore.setFallbackUpdateBundleData(value);
  },
  setNativeVersion: (value: string) => {
    mockStore.setNativeVersion(value);
  },
  setNativeBuildNumber: (value: string) => {
    mockStore.setNativeBuildNumber(value);
  },
}));
jest.mock('@onekeyhq/desktop/app/i18n', () => ({ ElectronTranslations: {} }));
jest.mock('@onekeyhq/desktop/app/windowProgressBar', () => ({
  clearWindowProgressBar: jest.fn(),
  updateWindowProgressBar: jest.fn(),
}));
jest.mock('./nodeDownload', () => ({
  stripSensitiveHeaders:
    jest.requireActual<typeof import('./nodeDownload')>('./nodeDownload')
      .stripSensitiveHeaders,
  downloadNodeFile: (opts: { targetPath: string }) => mockDownload(opts),
}));
jest.mock('./electronUpdateRequest', () => ({ requestUpdateUrl: jest.fn() }));

const previousNodeEnv = process.env.NODE_ENV;
let api: DesktopApiBundleUpdate;
let restartSpy: jest.SpyInstance;
let sentinel: string;
beforeEach(() => {
  jest.clearAllMocks();
  mockUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-boundary-'));
  sentinel = path.join(mockUserData, 'outside', 'sentinel');
  fs.mkdirSync(path.dirname(sentinel));
  fs.writeFileSync(sentinel, 'untouched');
  mockStore.getUpdateBundleData.mockReturnValue(undefined);
  mockStore.getFallbackUpdateBundleData.mockReturnValue([]);
  api = new DesktopApiBundleUpdate({ desktopApi: {} as IDesktopApi });
  restartSpy = jest.spyOn(api, 'restartAppForBundleUpdate').mockResolvedValue();
});
afterEach(() => {
  process.env.NODE_ENV = previousNodeEnv;
  jest.restoreAllMocks();
  fs.rmSync(mockUserData, { recursive: true, force: true });
});

test.each([
  '../outside',
  '/../../outside',
  '..',
  'a..b',
  'a/b',
  'a\\b',
  '',
  'version\u0000',
  'é',
])(
  'rejects version case %# before creating or touching artifacts',
  async (version) => {
    expect(() =>
      getBundleExtractDir({ appVersion: '6.6.0', bundleVersion: version }),
    ).toThrow('Invalid bundle version');
    await expect(
      api.downloadBundle({
        latestVersion: version,
        bundleVersion: '123',
        downloadUrl: 'https://fixture.test/bundle',
        sha256: 'hash',
      }),
    ).rejects.toThrow('Invalid bundle version');
    await expect(
      api.verifyBundleASC({
        latestVersion: '6.6.0',
        bundleVersion: version,
        downloadedFile: sentinel,
        sha256: 'hash',
        signature: 'signature',
      }),
    ).rejects.toThrow('Invalid bundle version');
    await expect(
      api.installBundle({
        latestVersion: version,
        bundleVersion: '123',
        signature: 'signature',
      }),
    ).rejects.toThrow('Invalid bundle version');
    expect(mockStore.setUpdateBundleData).not.toHaveBeenCalled();
    expect(mockDownload).not.toHaveBeenCalled();
    expect(fs.readFileSync(sentinel, 'utf8')).toBe('untouched');
    expect(fs.existsSync(path.join(mockUserData, 'onekey-bundle'))).toBe(false);
    expect(
      fs.existsSync(path.join(mockUserData, 'onekey-bundle-download')),
    ).toBe(false);
  },
);

test('accepts safe versions and derives the download and extraction destinations', async () => {
  const appVersion = '6.6.0-beta_1';
  const bundleVersion = '123';
  const extracted = getBundleExtractDir({ appVersion, bundleVersion });
  expect(extracted).toBe(
    path.join(mockUserData, 'onekey-bundle', `${appVersion}-${bundleVersion}`),
  );
  await api.downloadBundle({
    latestVersion: appVersion,
    bundleVersion,
    downloadUrl: 'https://fixture.test/bundle',
    sha256: 'hash',
  });
  expect(mockDownload.mock.calls[0][0].targetPath).toBe(
    path.join(
      mockUserData,
      'onekey-bundle-download',
      `${appVersion}-${bundleVersion}.zip`,
    ),
  );
  await api.testWriteEmptyMetadataJson(appVersion, bundleVersion);
  expect(fs.readFileSync(path.join(extracted, 'metadata.json'), 'utf8')).toBe(
    '{}',
  );
  await api.testDeleteJsRuntimeDir(appVersion, bundleVersion);
  expect(fs.existsSync(extracted)).toBe(false);
});

test('rejects an outside downloadedFile before hashing, parsing or deleting it', async () => {
  await expect(
    api.verifyBundleASC({
      latestVersion: '6.6.0',
      bundleVersion: '123',
      downloadedFile: sentinel,
      sha256: 'hash',
      signature: 'signature',
    }),
  ).rejects.toThrow('Invalid bundle download path');
  expect(fs.readFileSync(sentinel, 'utf8')).toBe('untouched');
  expect(fs.existsSync(path.join(mockUserData, 'onekey-bundle'))).toBe(false);
});

test.each([
  {
    fallback: [
      {
        appVersion: '6.6.0',
        bundleVersion: '/../../outside',
        signature: 'signature',
      },
    ],
  },
  { fallback: [null] },
  { fallback: [{}] },
  { fallback: 'invalid persisted array' },
])(
  'discards malformed fallback case %# without blocking a legal install',
  async ({ fallback }) => {
    const params = {
      latestVersion: '6.6.0',
      bundleVersion: '123',
      signature: 'signature',
    };
    fs.mkdirSync(
      getBundleExtractDir({
        appVersion: params.latestVersion,
        bundleVersion: params.bundleVersion,
      }),
    );
    mockStore.getFallbackUpdateBundleData.mockReturnValue(fallback);
    await api.installBundle(params);
    expect(mockStore.setUpdateBundleData).toHaveBeenCalledWith({
      appVersion: '6.6.0',
      bundleVersion: '123',
      signature: 'signature',
    });
    expect(mockStore.setFallbackUpdateBundleData).toHaveBeenCalledWith([]);
    expect(restartSpy).toHaveBeenCalledTimes(1);
    expect(fs.readFileSync(sentinel, 'utf8')).toBe('untouched');
  },
);

test('installs a legal bundle and prunes only a validated fallback directory', async () => {
  fs.mkdirSync(
    getBundleExtractDir({ appVersion: '6.6.0', bundleVersion: 'new' }),
  );
  const fallback = ['old', 'two', 'three', 'four'].map((bundleVersion) => ({
    appVersion: '6.6.0',
    bundleVersion,
    signature: 'signature',
  }));
  fs.mkdirSync(getBundleExtractDir(fallback[0]));
  mockStore.getFallbackUpdateBundleData.mockReturnValue(fallback);
  await api.installBundle({
    latestVersion: '6.6.0',
    bundleVersion: 'new',
    signature: 'signature',
  });
  expect(mockStore.setUpdateBundleData).toHaveBeenCalledWith({
    appVersion: '6.6.0',
    bundleVersion: 'new',
    signature: 'signature',
  });
  expect(
    fs.existsSync(path.join(mockUserData, 'onekey-bundle', '6.6.0-old')),
  ).toBe(false);
  expect(fs.readFileSync(sentinel, 'utf8')).toBe('untouched');
  expect(restartSpy).toHaveBeenCalledTimes(1);
});

test('rejects a path escaping either managed root', () => {
  expect(() => resolveBundlePath(mockUserData, '../outside')).toThrow(
    'outside',
  );
  expect(() => resolveBundlePath(mockUserData, mockUserData)).toThrow(
    'outside',
  );
});

test('keeps diagnostic methods available only in development builds', async () => {
  const methods = [
    'testDeleteJsRuntimeDir',
    'testDeleteJsBundle',
    'testDeleteMetadataJson',
    'testWriteEmptyMetadataJson',
    'testVerification',
    'testSkipVerification',
    'getSha256FromFilePath',
  ];
  process.env.NODE_ENV = 'development';
  for (const method of methods)
    expect(isDesktopApiMethodAllowed('bundleUpdate', method)).toBe(true);
  process.env.NODE_ENV = 'production';
  for (const method of methods)
    expect(isDesktopApiMethodAllowed('bundleUpdate', method)).toBe(false);
  expect(isDesktopApiMethodAllowed('bundleUpdate', 'verifyAndResolve')).toBe(
    false,
  );
  expect(isDesktopApiMethodAllowed('appUpdate', 'verifySha256')).toBe(false);
  await expect(
    api.testDeleteJsRuntimeDir('6.6.0', '/../../outside'),
  ).rejects.toThrow('unavailable');
  await expect(api.getSha256FromFilePath(sentinel)).rejects.toThrow(
    'unavailable',
  );
  expect(fs.readFileSync(sentinel, 'utf8')).toBe('untouched');
});

test('keeps legal fallbacks and omits a poisoned active pointer during installation', async () => {
  fs.mkdirSync(
    getBundleExtractDir({ appVersion: '6.6.0', bundleVersion: 'new' }),
  );
  const valid = {
    appVersion: '6.6.0',
    bundleVersion: 'old',
    signature: 'signature',
  };
  const poisoned = {
    appVersion: '6.6.0',
    bundleVersion: '/../../outside',
    signature: 'signature',
  };
  mockStore.getUpdateBundleData.mockReturnValue(poisoned);
  mockStore.getFallbackUpdateBundleData.mockReturnValue([poisoned, valid]);
  await api.installBundle({
    latestVersion: '6.6.0',
    bundleVersion: 'new',
    signature: 'signature',
  });
  expect(mockStore.setFallbackUpdateBundleData).toHaveBeenCalledWith([valid]);
  expect(restartSpy).toHaveBeenCalledTimes(1);
  expect(fs.readFileSync(sentinel, 'utf8')).toBe('untouched');
});
