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
import {
  EUpdateErrorCode,
  UPDATE_ERROR_WIRE_PREFIX,
  getUpdateError,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update/error';
import type { IUpdateErrorDTO } from '@onekeyhq/shared/src/modules3rdParty/auto-update/error';

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
  getDevSettingsEnabled: jest.fn(() => false),
  getSkipGPGVerification: jest.fn(() => false),
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
  getDevSettingsEnabled: () => mockStore.getDevSettingsEnabled(),
  getSkipGPGVerification: () => mockStore.getSkipGPGVerification(),
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

async function expectUpdateError(
  operation: Promise<unknown>,
  expected: IUpdateErrorDTO,
) {
  const result = await operation.then(
    () => ({ ok: true as const }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(getUpdateError(result.error, expected.step)).toEqual(expected);
  expect(result.error).toMatchObject({
    message: `${UPDATE_ERROR_WIRE_PREFIX}${JSON.stringify(expected)}`,
    data: { updateError: expected },
  });
  expect(
    (result.error as { data?: { updateError?: unknown } }).data?.updateError,
  ).toEqual(expected);
}

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
  mockStore.getDevSettingsEnabled.mockReturnValue(false);
  mockStore.getSkipGPGVerification.mockReturnValue(false);
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
    await expectUpdateError(
      api.downloadBundle({
        latestVersion: version,
        bundleVersion: '123',
        downloadUrl: 'https://fixture.test/bundle',
        sha256: 'hash',
      }),
      { code: EUpdateErrorCode.invalidArgument, step: 'download' },
    );
    await expectUpdateError(
      api.verifyBundleASC({
        latestVersion: '6.6.0',
        bundleVersion: version,
        sha256: 'hash',
        signature: 'signature',
      }),
      { code: EUpdateErrorCode.invalidArgument, step: 'verifyASC' },
    );
    await expectUpdateError(
      api.installBundle({
        latestVersion: version,
        bundleVersion: '123',
        signature: 'signature',
      }),
      { code: EUpdateErrorCode.invalidArgument, step: 'install' },
    );
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

test.each(['current', 'fallback'])(
  'reuses an installed %s bundle after checking real extracted files',
  async (kind) => {
    const identity = { appVersion: '6.6.0', bundleVersion: '123' };
    const { extractDir, buildDir, metadataSha256 } =
      prepareValidExtractedBundle(identity.appVersion, identity.bundleVersion);
    jest.spyOn(openpgp, 'readCleartextMessage').mockResolvedValue({
      verify: async () => [{ verified: Promise.resolve(true) }],
      getText: () =>
        JSON.stringify({
          fileName: 'metadata.json',
          sha256: metadataSha256,
          appVersion: identity.appVersion,
          bundleVersion: identity.bundleVersion,
          appType: 'electron',
        }),
    } as unknown as openpgp.CleartextMessage);
    const zipPath = path.join(api.getDownloadDir(), '6.6.0-123.zip');
    fs.writeFileSync(zipPath, 'managed ZIP');
    const zipSha256 = crypto
      .createHash('sha256')
      .update('managed ZIP')
      .digest('hex');
    const existingFile = path.join(buildDir, 'index.html');
    const original = fs.readFileSync(existingFile);
    if (kind === 'current') {
      mockStore.getUpdateBundleData.mockReturnValue(identity);
    } else {
      mockStore.getFallbackUpdateBundleData.mockReturnValue([identity]);
    }
    const params = {
      latestVersion: identity.appVersion,
      bundleVersion: identity.bundleVersion,
      sha256: zipSha256,
      signature: 'signed metadata',
    };
    await expect(api.verifyBundleASC(params)).resolves.toBeUndefined();
    expect(fs.readFileSync(existingFile)).toEqual(original);
    expect(mockExtractAllToSpy).not.toHaveBeenCalled();
    expect(mockStore.setUpdateBundleData).not.toHaveBeenCalled();

    fs.writeFileSync(existingFile, Buffer.alloc(original.length, 0));
    await expectUpdateError(api.verifyBundleASC(params), {
      code: EUpdateErrorCode.integrityFailed,
      step: 'verifyASC',
    });
    expect(fs.existsSync(extractDir)).toBe(true);
    expect(fs.readFileSync(existingFile)).toEqual(
      Buffer.alloc(original.length, 0),
    );
    expect(mockExtractAllToSpy).not.toHaveBeenCalled();
  },
);

test('rejects a managed ZIP symlink escaping the download root', async () => {
  const zipPath = path.join(api.getDownloadDir(), '6.6.0-123.zip');
  fs.symlinkSync(sentinel, zipPath);
  await expectUpdateError(
    api.verifyBundleASC({
      latestVersion: '6.6.0',
      bundleVersion: '123',
      sha256: 'hash',
      signature: 'signature',
    }),
    { code: EUpdateErrorCode.securityRejected, step: 'verifyASC' },
  );
  expect(fs.readFileSync(sentinel, 'utf8')).toBe('untouched');
  expect(fs.existsSync(path.join(mockUserData, 'onekey-bundle'))).toBe(false);
});

test('request skip flag cannot authorize unsigned bundle verification', async () => {
  const previous = process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION;
  process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION = 'true';
  const params = {
    latestVersion: '6.6.0',
    bundleVersion: '123',
    sha256: 'a'.repeat(64),
    skipGPGVerification: true,
  };
  try {
    await expectUpdateError(api.downloadBundleASC(params), {
      code: EUpdateErrorCode.invalidArgument,
      step: 'downloadASC',
    });
    mockStore.getDevSettingsEnabled.mockReturnValue(true);
    await expectUpdateError(api.downloadBundleASC(params), {
      code: EUpdateErrorCode.invalidArgument,
      step: 'downloadASC',
    });
    mockStore.getSkipGPGVerification.mockReturnValue(true);
    await expect(api.downloadBundleASC(params)).resolves.toBeUndefined();
  } finally {
    if (previous === undefined) {
      delete process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION;
    } else {
      process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION = previous;
    }
  }
});

test.each([false, true])(
  'rejects an extracted destination symlink without touching its target (installed=%s)',
  async (installed) => {
    const identity = { appVersion: '6.6.0', bundleVersion: '123' };
    const extractDir = getBundleExtractDir(identity);
    fs.symlinkSync(path.dirname(sentinel), extractDir);
    fs.writeFileSync(
      path.join(api.getDownloadDir(), '6.6.0-123.zip'),
      'managed ZIP',
    );
    if (installed) mockStore.getUpdateBundleData.mockReturnValue(identity);
    const previous = process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION;
    process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION = 'true';
    mockStore.getDevSettingsEnabled.mockReturnValue(true);
    mockStore.getSkipGPGVerification.mockReturnValue(true);
    try {
      await expectUpdateError(
        api.verifyBundleASC({
          latestVersion: identity.appVersion,
          bundleVersion: identity.bundleVersion,
          sha256: 'unused',
          skipGPGVerification: true,
        }),
        { code: EUpdateErrorCode.securityRejected, step: 'verifyASC' },
      );
      expect(fs.readFileSync(sentinel, 'utf8')).toBe('untouched');
      expect(mockExtractAllToSpy).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) {
        delete process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION;
      } else {
        process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION = previous;
      }
    }
  },
);

test('replaces an inactive extraction directory before writing through a ZIP child path', async () => {
  const identity = { appVersion: '6.6.0', bundleVersion: '123' };
  const extractDir = getBundleExtractDir(identity);
  fs.mkdirSync(extractDir, { recursive: true });
  fs.symlinkSync(path.dirname(sentinel), path.join(extractDir, 'build'));

  const content = 'new bundle file';
  const metadata = JSON.stringify({
    sentinel: crypto.createHash('sha512').update(content).digest('hex'),
  });
  const zip = new AdmZip();
  zip.addFile('metadata.json', Buffer.from(metadata));
  zip.addFile('build/sentinel', Buffer.from(content));
  const zipPath = path.join(api.getDownloadDir(), '6.6.0-123.zip');
  zip.writeZip(zipPath);

  const previous = process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION;
  process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION = 'true';
  mockStore.getDevSettingsEnabled.mockReturnValue(true);
  mockStore.getSkipGPGVerification.mockReturnValue(true);
  try {
    await expect(
      api.verifyBundleASC({
        latestVersion: identity.appVersion,
        bundleVersion: identity.bundleVersion,
        sha256: crypto
          .createHash('sha256')
          .update(fs.readFileSync(zipPath))
          .digest('hex'),
        skipGPGVerification: true,
      }),
    ).resolves.toBeUndefined();
    expect(fs.readFileSync(sentinel, 'utf8')).toBe('untouched');
    expect(fs.lstatSync(path.join(extractDir, 'build')).isDirectory()).toBe(
      true,
    );
    expect(
      fs.readFileSync(path.join(extractDir, 'build', 'sentinel'), 'utf8'),
    ).toBe(content);
  } finally {
    if (previous === undefined) {
      delete process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION;
    } else {
      process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION = previous;
    }
  }
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
  await expectUpdateError(
    api.testDeleteJsRuntimeDir('6.6.0', '/../../outside'),
    { code: EUpdateErrorCode.invalidArgument, step: 'verifyASC' },
  );
  await expectUpdateError(api.getSha256FromFilePath(sentinel), {
    code: EUpdateErrorCode.invalidArgument,
    step: 'verifyASC',
  });
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

test('uses URL-independent identity and prevents different hashes from writing one destination', async () => {
  const shaFixed = 'a'.repeat(64);
  const shaA = 'b'.repeat(64);
  const shaB = 'c'.repeat(64);
  await expectUpdateError(
    api.downloadBundle({
      latestVersion: '6.6.0',
      bundleVersion: '123',
      downloadUrl: 'https://fixture.test/bundle',
      sha256: 'not-a-valid-sha256',
    }),
    { code: EUpdateErrorCode.invalidArgument, step: 'download' },
  );
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

  // A different hash cannot start a second writer against the same ZIP.
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
  await expectUpdateError(
    api.downloadBundle({
      latestVersion: '6.6.0',
      bundleVersion: '123',
      downloadUrl: 'https://fixture.test/bundle',
      sha256: shaB,
    }),
    { code: EUpdateErrorCode.incompatible, step: 'download' },
  );
  expect(mockDownload).toHaveBeenCalledTimes(3);
  resolveFirst();
  await Promise.all([firstRun, sameHashRun]);
  await api.downloadBundle({
    latestVersion: '6.6.0',
    bundleVersion: '123',
    downloadUrl: 'https://fixture.test/bundle',
    sha256: shaB,
  });
  // The new hash can start after the prior writer settles.
  expect(mockDownload).toHaveBeenCalledTimes(4);
});

test('verifyBundleASC rejects zip bombs exceeding entry count or uncompressed byte quotas', async () => {
  const appVersion = '6.1.0';
  const bundleVersion = '7701116';
  mockStore.getFallbackUpdateBundleData.mockReturnValue(
    'malformed persisted fallback',
  );
  const inactiveDir = getBundleExtractDir({ appVersion, bundleVersion });
  fs.mkdirSync(inactiveDir, { recursive: true });
  fs.writeFileSync(path.join(inactiveDir, 'stale.txt'), 'stale');
  const destZip = path.join(
    api.getDownloadDir(),
    `${appVersion}-${bundleVersion}.zip`,
  );
  const dummyZip = new AdmZip();
  dummyZip.addFile('metadata.json', Buffer.from('{}'));
  dummyZip.writeZip(destZip);
  const originalZip = fs.readFileSync(destZip);
  const zipSha256 = crypto
    .createHash('sha256')
    .update(originalZip)
    .digest('hex');

  mockExtractAllToSpy.mockClear();

  // 1. Reject an oversized central-directory count before getEntries allocates.
  const oversizedZip = Buffer.from(originalZip);
  const eocdOffset = oversizedZip.lastIndexOf(
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
  );
  expect(eocdOffset).toBeGreaterThanOrEqual(0);
  oversizedZip.writeUInt16LE(MAX_BUNDLE_ENTRY_COUNT + 1, eocdOffset + 8);
  oversizedZip.writeUInt16LE(MAX_BUNDLE_ENTRY_COUNT + 1, eocdOffset + 10);
  fs.writeFileSync(destZip, oversizedZip);
  await expectUpdateError(
    api.verifyBundleASC({
      latestVersion: appVersion,
      bundleVersion,
      sha256: crypto.createHash('sha256').update(oversizedZip).digest('hex'),
      signature: TEST_SIGNATURE,
    }),
    { code: EUpdateErrorCode.securityRejected, step: 'verifyASC' },
  );
  expect(mockGetEntriesOverride).not.toHaveBeenCalled();
  expect(mockExtractAllToSpy).not.toHaveBeenCalled();
  expect(fs.existsSync(inactiveDir)).toBe(false);
  fs.writeFileSync(destZip, originalZip);

  // 2. Single entry size > MAX_BUNDLE_UNCOMPRESSED_BYTES
  mockGetEntriesOverride.mockReturnValueOnce([
    {
      entryName: 'metadata.json',
      isDirectory: false,
      header: { size: MAX_BUNDLE_UNCOMPRESSED_BYTES + 1, compressedSize: 10 },
    },
  ] as unknown as AdmZip.IZipEntry[]);
  await expectUpdateError(
    api.verifyBundleASC({
      latestVersion: appVersion,
      bundleVersion,
      sha256: zipSha256,
      signature: TEST_SIGNATURE,
    }),
    { code: EUpdateErrorCode.securityRejected, step: 'verifyASC' },
  );
  expect(mockExtractAllToSpy).not.toHaveBeenCalled();

  // 3. Total uncompressed size > MAX_BUNDLE_UNCOMPRESSED_BYTES
  const halfPlusOne = Math.floor(MAX_BUNDLE_UNCOMPRESSED_BYTES / 2) + 1;
  mockGetEntriesOverride.mockReturnValueOnce([
    {
      entryName: 'metadata.json',
      isDirectory: false,
      header: { size: halfPlusOne, compressedSize: 10 },
    },
    {
      entryName: 'build/index.html',
      isDirectory: false,
      header: { size: halfPlusOne, compressedSize: 10 },
    },
  ] as unknown as AdmZip.IZipEntry[]);
  await expectUpdateError(
    api.verifyBundleASC({
      latestVersion: appVersion,
      bundleVersion,
      sha256: zipSha256,
      signature: TEST_SIGNATURE,
    }),
    { code: EUpdateErrorCode.securityRejected, step: 'verifyASC' },
  );
  expect(mockExtractAllToSpy).not.toHaveBeenCalled();

  // 4. Zero header.size with a non-empty deflate payload bypasses adm-zip's cap.
  mockGetEntriesOverride.mockReturnValueOnce([
    {
      entryName: 'metadata.json',
      isDirectory: false,
      header: { size: 10, compressedSize: 10 },
    },
    {
      entryName: 'build/bomb.js',
      isDirectory: false,
      header: { size: 0, compressedSize: 2, method: 8 },
      getCompressedData: () => Buffer.from([0x00, 0x00]),
    },
  ] as unknown as AdmZip.IZipEntry[]);
  await expectUpdateError(
    api.verifyBundleASC({
      latestVersion: appVersion,
      bundleVersion,
      sha256: zipSha256,
      signature: TEST_SIGNATURE,
    }),
    { code: EUpdateErrorCode.securityRejected, step: 'verifyASC' },
  );
  expect(mockExtractAllToSpy).not.toHaveBeenCalled();
});

test('verifyBundleASC reports a missing managed ZIP without extracting files', async () => {
  const appVersion = '6.6.0';
  const bundleVersion = '123';
  const zipPath = path.join(
    api.getDownloadDir(),
    `${appVersion}-${bundleVersion}.zip`,
  );
  expect(fs.existsSync(zipPath)).toBe(false);

  await expectUpdateError(
    api.verifyBundleASC({
      latestVersion: appVersion,
      bundleVersion,
      sha256: 'a'.repeat(64),
      signature: TEST_SIGNATURE,
    }),
    { code: EUpdateErrorCode.packageMissing, step: 'verifyASC' },
  );

  expect(mockExtractAllToSpy).not.toHaveBeenCalled();
  expect(
    fs.existsSync(getBundleExtractDir({ appVersion, bundleVersion })),
  ).toBe(false);
  expect(fs.readFileSync(sentinel, 'utf8')).toBe('untouched');
});

test('verifyBundleASC rejects a replayed PGP signature as an integrity failure before full zip extraction', async () => {
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
  await expectUpdateError(
    api.verifyBundleASC({
      latestVersion: appVersion,
      bundleVersion,
      sha256: zipSha256,
      signature: TEST_SIGNATURE,
    }),
    { code: EUpdateErrorCode.integrityFailed, step: 'verifyASC' },
  );

  expect(mockExtractAllToSpy).not.toHaveBeenCalled();
  expect(
    fs.existsSync(getBundleExtractDir({ appVersion, bundleVersion })),
  ).toBe(false);
});

test('installBundle rolling back to a fallback entry does not delete the newly installed bundle directory when fallback queue shifts', async () => {
  const { extractDir: b1Dir } = prepareValidExtractedBundle('6.6.0', 'b1');
  const b2Dir = getBundleExtractDir({
    appVersion: '6.6.0',
    bundleVersion: 'b2',
  });
  const b3Dir = getBundleExtractDir({
    appVersion: '6.6.0',
    bundleVersion: 'b3',
  });
  const b4Dir = getBundleExtractDir({
    appVersion: '6.6.0',
    bundleVersion: 'b4',
  });
  fs.mkdirSync(b2Dir, { recursive: true });
  fs.mkdirSync(b3Dir, { recursive: true });
  fs.mkdirSync(b4Dir, { recursive: true });

  mockStore.getUpdateBundleData.mockReturnValue({
    appVersion: '6.6.0',
    bundleVersion: 'b4',
    signature: 'sig-b4',
  });
  mockStore.getFallbackUpdateBundleData.mockReturnValue([
    { appVersion: '6.6.0', bundleVersion: 'b1', signature: 'sig-b1' },
    { appVersion: '6.6.0', bundleVersion: 'b2', signature: 'sig-b2' },
    { appVersion: '6.6.0', bundleVersion: 'b3', signature: 'sig-b3' },
  ]);

  await api.installBundle({
    latestVersion: '6.6.0',
    bundleVersion: 'b1',
    signature: 'sig-b1',
  });

  // b1 is the newly installed bundle and must NOT be deleted!
  expect(fs.existsSync(b1Dir)).toBe(true);
  expect(mockStore.setUpdateBundleData).toHaveBeenCalledWith({
    appVersion: '6.6.0',
    bundleVersion: 'b1',
    signature: 'sig-b1',
  });
  expect(mockStore.setFallbackUpdateBundleData).toHaveBeenCalledWith([
    { appVersion: '6.6.0', bundleVersion: 'b2', signature: 'sig-b2' },
    { appVersion: '6.6.0', bundleVersion: 'b3', signature: 'sig-b3' },
    { appVersion: '6.6.0', bundleVersion: 'b4', signature: 'sig-b4' },
  ]);
});

test('installBundle rejects mismatched appVersion, missing files, invalid signature, and tampered extracted files before updating store', async () => {
  // 1. Mismatched appVersion
  await expectUpdateError(
    api.installBundle({
      latestVersion: '6.5.0',
      bundleVersion: '100',
      signature: 'signature',
    }),
    { code: EUpdateErrorCode.incompatible, step: 'install' },
  );
  expect(mockStore.setUpdateBundleData).not.toHaveBeenCalled();

  // 2. Missing build/index.html
  const extractDir = getBundleExtractDir({
    appVersion: '6.6.0',
    bundleVersion: '100',
  });
  fs.mkdirSync(extractDir, { recursive: true });
  await expectUpdateError(
    api.installBundle({
      latestVersion: '6.6.0',
      bundleVersion: '100',
      signature: 'signature',
    }),
    { code: EUpdateErrorCode.packageMissing, step: 'install' },
  );
  expect(mockStore.setUpdateBundleData).not.toHaveBeenCalled();

  // 3. Missing metadata.json
  const buildDir = path.join(extractDir, 'build');
  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(path.join(buildDir, 'index.html'), '<html>ok</html>');
  await expectUpdateError(
    api.installBundle({
      latestVersion: '6.6.0',
      bundleVersion: '100',
      signature: 'signature',
    }),
    { code: EUpdateErrorCode.packageMissing, step: 'install' },
  );
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
  await expectUpdateError(
    api.installBundle({
      latestVersion: '6.6.0',
      bundleVersion: '101',
      signature: 'signature',
    }),
    { code: EUpdateErrorCode.integrityFailed, step: 'install' },
  );
  expect(mockStore.setUpdateBundleData).not.toHaveBeenCalled();
  expect(restartSpy).not.toHaveBeenCalled();
});

test('setCurrentUpdateBundleData rejects missing signature, mismatched appVersion, and tampered extracted files before updating store', async () => {
  await expectUpdateError(
    api.setCurrentUpdateBundleData({
      appVersion: '6.5.0',
      bundleVersion: '100',
      signature: 'signature',
    }),
    { code: EUpdateErrorCode.incompatible, step: 'install' },
  );
  expect(mockStore.setUpdateBundleData).not.toHaveBeenCalled();

  await expectUpdateError(
    api.setCurrentUpdateBundleData({
      appVersion: '6.6.0',
      bundleVersion: '100',
      signature: '',
    }),
    { code: EUpdateErrorCode.invalidArgument, step: 'install' },
  );
  expect(mockStore.setUpdateBundleData).not.toHaveBeenCalled();

  const { buildDir } = prepareValidExtractedBundle('6.6.0', '200');
  fs.writeFileSync(path.join(buildDir, 'index.html'), '<html>tampered</html>');
  await expectUpdateError(
    api.setCurrentUpdateBundleData({
      appVersion: '6.6.0',
      bundleVersion: '200',
      signature: 'signature',
    }),
    { code: EUpdateErrorCode.integrityFailed, step: 'install' },
  );
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
