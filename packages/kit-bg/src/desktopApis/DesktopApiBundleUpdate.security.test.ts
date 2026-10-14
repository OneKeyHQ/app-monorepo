import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

import AdmZip from 'adm-zip';
import * as openpgp from 'openpgp';

import {
  TEST_SIGNATURE,
  getBundleExtractDir,
} from '@onekeyhq/desktop/app/bundle';
import { resolveBundlePath } from '@onekeyhq/desktop/app/libs/bundlePaths';

import DesktopApiBundleUpdate, {
  MAX_BUNDLE_ENTRY_COUNT,
  MAX_BUNDLE_UNCOMPRESSED_BYTES,
} from './DesktopApiBundleUpdate';
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
const mockDownload = jest.fn(
  async (opts: { targetPath: string; identity?: string; url?: string }) => ({
    filePath: opts.targetPath,
    totalBytes: 1,
  }),
);
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
const mockGetEntriesOverride = jest.fn<AdmZip.IZipEntry[] | undefined, []>(
  () => undefined,
);
const mockExtractAllToSpy = jest.fn();
jest.mock('adm-zip', () => {
  const ActualAdmZip = jest.requireActual<typeof import('adm-zip')>('adm-zip');
  return function MockAdmZip(
    ...args: ConstructorParameters<typeof ActualAdmZip>
  ) {
    const instance = new ActualAdmZip(...args);
    const origGetEntries = instance.getEntries.bind(instance);
    const origExtractAllTo = instance.extractAllTo.bind(instance);
    instance.getEntries = () => mockGetEntriesOverride() ?? origGetEntries();
    instance.extractAllTo = (
      ...extractArgs: Parameters<typeof origExtractAllTo>
    ) => {
      mockExtractAllToSpy(...extractArgs);
      return origExtractAllTo(...extractArgs);
    };
    return instance;
  };
});
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

function prepareValidExtractedBundle(
  appVersion: string,
  bundleVersion: string,
) {
  const extractDir = getBundleExtractDir({ appVersion, bundleVersion });
  const buildDir = path.join(extractDir, 'build');
  fs.mkdirSync(buildDir, { recursive: true });
  const indexHtmlContent = '<html>valid bundle</html>';
  fs.writeFileSync(path.join(buildDir, 'index.html'), indexHtmlContent, 'utf8');
  const indexSha512 = crypto
    .createHash('sha512')
    .update(indexHtmlContent)
    .digest('hex');
  const metadataContent = JSON.stringify({ 'index.html': indexSha512 });
  fs.writeFileSync(
    path.join(extractDir, 'metadata.json'),
    metadataContent,
    'utf8',
  );
  const metadataSha256 = crypto
    .createHash('sha256')
    .update(metadataContent)
    .digest('hex');
  jest.spyOn(openpgp, 'readCleartextMessage').mockResolvedValueOnce({
    verify: async () => [{ verified: Promise.resolve(true) }],
    getText: () =>
      JSON.stringify({
        fileName: 'metadata.json',
        sha256: metadataSha256,
        appVersion,
        bundleVersion,
        appType: 'electron',
      }),
  } as unknown as openpgp.CleartextMessage);
  return { extractDir, buildDir, metadataSha256 };
}

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
    sha256: 'a'.repeat(64),
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
    prepareValidExtractedBundle(params.latestVersion, params.bundleVersion);
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
  prepareValidExtractedBundle('6.6.0', 'new');
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
  prepareValidExtractedBundle('6.6.0', 'new');
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

test('passes URL-independent identity to downloadNodeFile and binds single-flight deduplication to sha256', async () => {
  const shaFixed = 'a'.repeat(64);
  const shaA = 'b'.repeat(64);
  const shaB = 'c'.repeat(64);
  await expect(
    api.downloadBundle({
      latestVersion: '6.6.0',
      bundleVersion: '123',
      downloadUrl: 'https://fixture.test/bundle',
      sha256: 'not-a-valid-sha256',
    }),
  ).rejects.toThrow('Invalid parameters');
  expect(mockDownload).not.toHaveBeenCalled();

  await api.downloadBundle({
    latestVersion: '6.6.0',
    bundleVersion: '123',
    downloadUrl: 'https://fixture.test/bundle?token=ephemeral-1',
    sha256: shaFixed,
  });
  await api.downloadBundle({
    latestVersion: '6.6.0',
    bundleVersion: '123',
    downloadUrl: 'https://fixture.test/bundle?token=ephemeral-2',
    sha256: shaFixed,
  });

  expect(mockDownload).toHaveBeenCalledTimes(2);
  expect(mockDownload.mock.calls[0][0].identity).toBe(
    `bundle:6.6.0:123:${shaFixed}`,
  );
  expect(mockDownload.mock.calls[1][0].identity).toBe(
    `bundle:6.6.0:123:${shaFixed}`,
  );

  // Concurrent calls with different sha256 must not piggyback on the same in-flight promise
  let resolveFirst!: () => void;
  mockDownload.mockImplementationOnce(
    async (opts: { targetPath: string }) =>
      new Promise((resolve) => {
        resolveFirst = () =>
          resolve({ filePath: opts.targetPath, totalBytes: 1 });
      }),
  );
  const firstRun = api.downloadBundle({
    latestVersion: '6.6.0',
    bundleVersion: '123',
    downloadUrl: 'https://fixture.test/bundle',
    sha256: shaA,
  });
  const sameHashRun = api.downloadBundle({
    latestVersion: '6.6.0',
    bundleVersion: '123',
    downloadUrl: 'https://fixture.test/bundle',
    sha256: shaA,
  });
  const differentHashRun = api.downloadBundle({
    latestVersion: '6.6.0',
    bundleVersion: '123',
    downloadUrl: 'https://fixture.test/bundle',
    sha256: shaB,
  });
  resolveFirst();
  await Promise.all([firstRun, sameHashRun, differentHashRun]);
  // 2 from sequential calls + 1 for shaA + 1 for shaB = 4 calls total
  expect(mockDownload).toHaveBeenCalledTimes(4);
});

test('verifyBundleASC rejects zip bombs exceeding entry count or uncompressed byte quotas', async () => {
  const appVersion = '6.1.0';
  const bundleVersion = '7701116';
  const destZip = path.join(
    api.getDownloadDir(),
    `${appVersion}-${bundleVersion}.zip`,
  );
  const dummyZip = new AdmZip();
  dummyZip.addFile('metadata.json', Buffer.from('{}'));
  dummyZip.writeZip(destZip);
  const zipSha256 = crypto
    .createHash('sha256')
    .update(fs.readFileSync(destZip))
    .digest('hex');

  mockExtractAllToSpy.mockClear();

  // 1. Entry count > MAX_BUNDLE_ENTRY_COUNT
  mockGetEntriesOverride.mockReturnValueOnce(
    new Array(MAX_BUNDLE_ENTRY_COUNT + 1).fill({
      entryName: 'build/file.js',
      isDirectory: false,
      header: { size: 1 },
    }) as unknown as AdmZip.IZipEntry[],
  );
  await expect(
    api.verifyBundleASC({
      latestVersion: appVersion,
      bundleVersion,
      downloadedFile: destZip,
      sha256: zipSha256,
      signature: TEST_SIGNATURE,
    }),
  ).rejects.toThrow('Bundle zip contains too many entries');
  expect(mockExtractAllToSpy).not.toHaveBeenCalled();

  // 2. Single entry size > MAX_BUNDLE_UNCOMPRESSED_BYTES
  mockGetEntriesOverride.mockReturnValueOnce([
    {
      entryName: 'metadata.json',
      isDirectory: false,
      header: { size: MAX_BUNDLE_UNCOMPRESSED_BYTES + 1 },
    },
  ] as unknown as AdmZip.IZipEntry[]);
  await expect(
    api.verifyBundleASC({
      latestVersion: appVersion,
      bundleVersion,
      downloadedFile: destZip,
      sha256: zipSha256,
      signature: TEST_SIGNATURE,
    }),
  ).rejects.toThrow('Bundle zip entry exceeds maximum size');
  expect(mockExtractAllToSpy).not.toHaveBeenCalled();

  // 3. Total uncompressed size > MAX_BUNDLE_UNCOMPRESSED_BYTES
  const halfPlusOne = Math.floor(MAX_BUNDLE_UNCOMPRESSED_BYTES / 2) + 1;
  mockGetEntriesOverride.mockReturnValueOnce([
    {
      entryName: 'metadata.json',
      isDirectory: false,
      header: { size: halfPlusOne },
    },
    {
      entryName: 'build/index.html',
      isDirectory: false,
      header: { size: halfPlusOne },
    },
  ] as unknown as AdmZip.IZipEntry[]);
  await expect(
    api.verifyBundleASC({
      latestVersion: appVersion,
      bundleVersion,
      downloadedFile: destZip,
      sha256: zipSha256,
      signature: TEST_SIGNATURE,
    }),
  ).rejects.toThrow('Bundle zip exceeds maximum uncompressed size');
  expect(mockExtractAllToSpy).not.toHaveBeenCalled();
});

test('verifyBundleASC rejects invalid or replayed PGP signature before full zip extraction', async () => {
  const appVersion = '6.6.0';
  const bundleVersion = '999';
  const destZip = path.join(
    api.getDownloadDir(),
    `${appVersion}-${bundleVersion}.zip`,
  );
  const zip = new AdmZip();
  zip.addFile('metadata.json', Buffer.from('{"index.html":"abc"}'));
  zip.addFile('build/index.html', Buffer.from('<html>untrusted</html>'));
  zip.writeZip(destZip);
  const zipSha256 = crypto
    .createHash('sha256')
    .update(fs.readFileSync(destZip))
    .digest('hex');

  mockExtractAllToSpy.mockClear();

  // Replaying valid TEST_SIGNATURE (signed for 6.1.0 / 7701116) against 6.6.0 / 999
  await expect(
    api.verifyBundleASC({
      latestVersion: appVersion,
      bundleVersion,
      downloadedFile: destZip,
      sha256: zipSha256,
      signature: TEST_SIGNATURE,
    }),
  ).rejects.toThrow('Signed metadata appVersion mismatch');

  expect(mockExtractAllToSpy).not.toHaveBeenCalled();
  expect(
    fs.existsSync(getBundleExtractDir({ appVersion, bundleVersion })),
  ).toBe(false);
});

test('installBundle rejects mismatched appVersion, missing files, invalid signature, and tampered extracted files before updating store', async () => {
  // 1. Mismatched appVersion
  await expect(
    api.installBundle({
      latestVersion: '6.5.0',
      bundleVersion: '100',
      signature: 'signature',
    }),
  ).rejects.toThrow('Bundle appVersion mismatch');
  expect(mockStore.setUpdateBundleData).not.toHaveBeenCalled();

  // 2. Missing build/index.html
  const extractDir = getBundleExtractDir({
    appVersion: '6.6.0',
    bundleVersion: '100',
  });
  fs.mkdirSync(extractDir, { recursive: true });
  await expect(
    api.installBundle({
      latestVersion: '6.6.0',
      bundleVersion: '100',
      signature: 'signature',
    }),
  ).rejects.toThrow('Bundle index.html not found');
  expect(mockStore.setUpdateBundleData).not.toHaveBeenCalled();

  // 3. Missing metadata.json
  const buildDir = path.join(extractDir, 'build');
  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(path.join(buildDir, 'index.html'), '<html>ok</html>');
  await expect(
    api.installBundle({
      latestVersion: '6.6.0',
      bundleVersion: '100',
      signature: 'signature',
    }),
  ).rejects.toThrow('metadata.json not found in bundle');
  expect(mockStore.setUpdateBundleData).not.toHaveBeenCalled();

  // 4. Tampered file in extractDir (TOCTOU between verifyBundleASC and installBundle)
  const { buildDir: validBuildDir } = prepareValidExtractedBundle(
    '6.6.0',
    '101',
  );
  fs.writeFileSync(
    path.join(validBuildDir, 'index.html'),
    '<html>tampered</html>',
  );
  await expect(
    api.installBundle({
      latestVersion: '6.6.0',
      bundleVersion: '101',
      signature: 'signature',
    }),
  ).rejects.toThrow('SHA512 mismatch for file index.html');
  expect(mockStore.setUpdateBundleData).not.toHaveBeenCalled();
  expect(restartSpy).not.toHaveBeenCalled();
});

test('setCurrentUpdateBundleData rejects missing signature, mismatched appVersion, and tampered extracted files before updating store', async () => {
  await expect(
    api.setCurrentUpdateBundleData({
      appVersion: '6.5.0',
      bundleVersion: '100',
      signature: 'signature',
    }),
  ).rejects.toThrow('Bundle appVersion mismatch');
  expect(mockStore.setUpdateBundleData).not.toHaveBeenCalled();

  await expect(
    api.setCurrentUpdateBundleData({
      appVersion: '6.6.0',
      bundleVersion: '100',
      signature: '',
    }),
  ).rejects.toThrow('Bundle signature is required');
  expect(mockStore.setUpdateBundleData).not.toHaveBeenCalled();

  const { buildDir } = prepareValidExtractedBundle('6.6.0', '200');
  fs.writeFileSync(path.join(buildDir, 'index.html'), '<html>tampered</html>');
  await expect(
    api.setCurrentUpdateBundleData({
      appVersion: '6.6.0',
      bundleVersion: '200',
      signature: 'signature',
    }),
  ).rejects.toThrow('SHA512 mismatch for file index.html');
  expect(mockStore.setUpdateBundleData).not.toHaveBeenCalled();
  expect(restartSpy).not.toHaveBeenCalled();

  prepareValidExtractedBundle('6.6.0', '201');
  await api.setCurrentUpdateBundleData({
    appVersion: '6.6.0',
    bundleVersion: '201',
    signature: 'signature',
  });
  expect(mockStore.setUpdateBundleData).toHaveBeenCalledWith({
    appVersion: '6.6.0',
    bundleVersion: '201',
    signature: 'signature',
  });
  expect(mockStore.setNativeVersion).toHaveBeenCalledWith('6.6.0');
  expect(restartSpy).toHaveBeenCalledTimes(1);
});
