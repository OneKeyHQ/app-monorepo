import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

import AdmZip from 'adm-zip';
import * as openpgp from 'openpgp';

import {
  checkFileHash,
  getBundleExtractDir,
  getMetadata,
  verifyMetadataFileSha256,
} from '@onekeyhq/desktop/app/bundle';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EUpdateErrorCode,
  createUpdateError,
  getUpdateError,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update/error';

import DesktopApiBundleUpdate, {
  DIFF_DOWNLOAD_DIR_NAME,
  DIFF_STAGING_DIR_NAME,
  MAX_BUNDLE_UNCOMPRESSED_BYTES,
} from './DesktopApiBundleUpdate';

import type { IDesktopApi } from './base/types';
import type { INodeDownloadOptions } from './nodeDownload';

let mockUserData = '';
let mockAppPath = '';
const mockStore = {
  getUpdateBundleData: jest.fn<unknown, []>(),
  getFallbackUpdateBundleData: jest.fn<unknown, []>(),
  getDevSettingsEnabled: jest.fn(() => false),
  getSkipGPGVerification: jest.fn(() => false),
  getNativeVersion: jest.fn(() => '6.6.0'),
  getNativeBuildNumber: jest.fn(() => ''),
  setUpdateBundleData: jest.fn<void, [unknown]>(),
  setFallbackUpdateBundleData: jest.fn<void, [unknown]>(),
  setNativeVersion: jest.fn<void, [string]>(),
  setNativeBuildNumber: jest.fn<void, [string]>(),
  clearUpdateBundleData: jest.fn<void, []>(),
};
const mockDownloadNodeFile = jest.fn<
  Promise<{ filePath: string; totalBytes: number }>,
  [INodeDownloadOptions]
>();

jest.mock('electron', () => ({
  app: {
    getPath: () => mockUserData,
    getVersion: () => '6.6.0',
    getAppPath: () => mockAppPath,
    exit: jest.fn(),
  },
  dialog: {
    showMessageBox: jest.fn(() => Promise.resolve({ response: 0 })),
  },
}));
jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('@onekeyhq/desktop/app/libs/store', () => ({
  getUpdateBundleData: () => mockStore.getUpdateBundleData(),
  getFallbackUpdateBundleData: () => mockStore.getFallbackUpdateBundleData(),
  getDevSettingsEnabled: () => mockStore.getDevSettingsEnabled(),
  getSkipGPGVerification: () => mockStore.getSkipGPGVerification(),
  getNativeVersion: () => mockStore.getNativeVersion(),
  getNativeBuildNumber: () => mockStore.getNativeBuildNumber(),
  setUpdateBundleData: (v: unknown) => {
    mockStore.setUpdateBundleData(v);
  },
  setFallbackUpdateBundleData: (v: unknown) => {
    mockStore.setFallbackUpdateBundleData(v);
  },
  setNativeVersion: (v: string) => {
    mockStore.setNativeVersion(v);
  },
  setNativeBuildNumber: (v: string) => {
    mockStore.setNativeBuildNumber(v);
  },
  clearUpdateBundleData: () => {
    mockStore.clearUpdateBundleData();
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
  downloadNodeFile: (opts: INodeDownloadOptions) => mockDownloadNodeFile(opts),
}));
jest.mock('./electronUpdateRequest', () => ({ requestUpdateUrl: jest.fn() }));

function sha256Hex(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function sha512Hex(content: string | Buffer): string {
  return crypto.createHash('sha512').update(content).digest('hex');
}

function makeSignedCleartextMock(payload: {
  fileName: string;
  sha256: string;
  appVersion: string;
  bundleVersion: string;
  appType?: string;
}) {
  return {
    verify: async () => [{ verified: Promise.resolve(true) }],
    getText: () =>
      JSON.stringify({
        fileName: payload.fileName,
        sha256: payload.sha256,
        appVersion: payload.appVersion,
        bundleVersion: payload.bundleVersion,
        appType: payload.appType ?? 'electron',
      }),
  } as unknown as openpgp.CleartextMessage;
}

function buildDiffAndFullFixture({
  appVersion = '6.6.0',
  targetBundleVersion = '200',
  changedFiles = { 'index.html': '<html>new v200</html>' },
  reusedFiles = {
    'static/vendor.js': 'console.log("unchanged vendor");',
    'assets/shared.txt': 'shared asset from active ota',
  },
}: {
  appVersion?: string;
  targetBundleVersion?: string;
  changedFiles?: Record<string, string>;
  reusedFiles?: Record<string, string>;
} = {}) {
  const allFiles: Record<string, string> = { ...changedFiles, ...reusedFiles };
  const targetMetadata: Record<string, string> = {};
  for (const [relPath, content] of Object.entries(allFiles)) {
    targetMetadata[relPath] = sha512Hex(content);
  }
  const metadataJson = JSON.stringify(targetMetadata, null, 2);
  const metadataSha256 = sha256Hex(metadataJson);

  const changedHashes: Record<string, string> = {};
  for (const relPath of Object.keys(changedFiles)) {
    changedHashes[relPath] = targetMetadata[relPath];
  }
  const reusedHashes: Record<string, string> = {};
  for (const [relPath] of Object.entries(reusedFiles)) {
    reusedHashes[relPath] = targetMetadata[relPath];
  }

  const diffManifestJson = JSON.stringify(
    {
      schemaVersion: 1,
      appType: 'electron',
      appVersion,
      targetBundleVersion,
      hashAlgorithm: 'sha512',
      targetMetadataSha256: metadataSha256,
      changedFiles: changedHashes,
      reusedFiles: reusedHashes,
    },
    null,
    2,
  );
  const diffManifestSha256 = sha256Hex(diffManifestJson);

  const diffZip = new AdmZip();
  diffZip.addFile('diff-manifest.json', Buffer.from(diffManifestJson, 'utf8'));
  diffZip.addFile('metadata.json', Buffer.from(metadataJson, 'utf8'));
  for (const [relPath, content] of Object.entries(changedFiles)) {
    diffZip.addFile(`build/${relPath}`, Buffer.from(content, 'utf8'));
  }
  const diffZipBuffer = diffZip.toBuffer();

  const fullZip = new AdmZip();
  fullZip.addFile('metadata.json', Buffer.from(metadataJson, 'utf8'));
  for (const [relPath, content] of Object.entries(allFiles)) {
    fullZip.addFile(`build/${relPath}`, Buffer.from(content, 'utf8'));
  }
  const fullZipBuffer = fullZip.toBuffer();

  return {
    appVersion,
    targetBundleVersion,
    changedFiles,
    reusedFiles,
    targetMetadata,
    metadataJson,
    metadataSha256,
    diffManifestJson,
    diffManifestSha256,
    diffZipBuffer,
    diffZipSha256: sha256Hex(diffZipBuffer),
    fullZipBuffer,
    fullZipSha256: sha256Hex(fullZipBuffer),
  };
}

function writeLocalBuildFiles(baseDir: string, files: Record<string, string>) {
  for (const [relPath, content] of Object.entries(files)) {
    const filePath = path.join(baseDir, 'build', relPath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

describe('DesktopApiBundleUpdate incremental diff OTA', () => {
  let api: DesktopApiBundleUpdate;

  beforeEach(() => {
    jest.clearAllMocks();
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-diff-'));
    mockUserData = path.join(tmpRoot, 'userData');
    mockAppPath = path.join(tmpRoot, 'app');
    fs.mkdirSync(mockUserData, { recursive: true });
    fs.mkdirSync(path.join(mockAppPath, 'build'), { recursive: true });
    mockStore.getUpdateBundleData.mockReturnValue(undefined);
    mockStore.getFallbackUpdateBundleData.mockReturnValue([]);
    mockStore.getDevSettingsEnabled.mockReturnValue(false);
    mockStore.getSkipGPGVerification.mockReturnValue(false);
    api = new DesktopApiBundleUpdate({ desktopApi: {} as IDesktopApi });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    const tmpRoot = path.dirname(mockUserData);
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  test('reconstructs bundle from diff zip using active OTA dir + built-in app/build and passes dual GPG & startup verification', async () => {
    const fixture = buildDiffAndFullFixture();

    // Put one reused file in built-in app.getAppPath()/build and the other in active OTA bundle dir
    writeLocalBuildFiles(mockAppPath, {
      'static/vendor.js': fixture.reusedFiles['static/vendor.js'],
    });
    const activeOtaDir = getBundleExtractDir({
      appVersion: fixture.appVersion,
      bundleVersion: '100',
    });
    writeLocalBuildFiles(activeOtaDir, {
      'assets/shared.txt': fixture.reusedFiles['assets/shared.txt'],
    });
    mockStore.getUpdateBundleData.mockReturnValue({
      appVersion: fixture.appVersion,
      bundleVersion: '100',
      signature: 'active-sig',
    });

    mockDownloadNodeFile.mockImplementation(async (opts) => {
      fs.mkdirSync(path.dirname(opts.targetPath), { recursive: true });
      fs.writeFileSync(opts.targetPath, fixture.diffZipBuffer);
      return {
        filePath: opts.targetPath,
        totalBytes: fixture.diffZipBuffer.length,
      };
    });

    const downloadParams = {
      latestVersion: fixture.appVersion,
      bundleVersion: fixture.targetBundleVersion,
      downloadUrl: 'https://cdn.onekey.test/full.zip',
      fileSize: fixture.fullZipBuffer.length,
      sha256: fixture.fullZipSha256,
      signature: 'SIG_METADATA',
      diffDownloadUrl: 'https://cdn.onekey.test/diff.zip',
      diffFileSize: fixture.diffZipBuffer.length,
      diffSha256: fixture.diffZipSha256,
      diffSignature: 'SIG_DIFF_MANIFEST',
    };

    const downloadedEvent = await api.downloadBundle(downloadParams);
    expect(mockDownloadNodeFile).toHaveBeenCalledTimes(1);
    expect(mockDownloadNodeFile.mock.calls[0][0].url).toBe(
      downloadParams.diffDownloadUrl,
    );
    expect(mockDownloadNodeFile.mock.calls[0][0].targetPath).toBe(
      path.join(
        api.getDownloadDir(),
        DIFF_DOWNLOAD_DIR_NAME,
        `${fixture.appVersion}-${fixture.targetBundleVersion}.diff.zip`,
      ),
    );
    expect(downloadedEvent).toEqual({
      downloadUrl: downloadParams.downloadUrl,
      latestVersion: fixture.appVersion,
      bundleVersion: fixture.targetBundleVersion,
      sha256: fixture.fullZipSha256,
      signature: 'SIG_METADATA',
      diffDownloadUrl: downloadParams.diffDownloadUrl,
      diffFileSize: downloadParams.diffFileSize,
      diffSha256: downloadParams.diffSha256,
      diffSignature: downloadParams.diffSignature,
    });

    // verifyBundle called after downloadBundle and BEFORE verifyBundleASC validates the downloaded .diff.zip
    await expect(
      api.verifyBundle({
        latestVersion: fixture.appVersion,
        bundleVersion: fixture.targetBundleVersion,
        sha256: fixture.fullZipSha256.toUpperCase(),
        signature: 'SIG_METADATA',
      }),
    ).resolves.toBeUndefined();

    const readSpy = jest
      .spyOn(openpgp, 'readCleartextMessage')
      .mockImplementation(async ({ cleartextMessage }) => {
        if (cleartextMessage === 'SIG_DIFF_MANIFEST') {
          return makeSignedCleartextMock({
            fileName: 'diff-manifest.json',
            sha256: fixture.diffManifestSha256,
            appVersion: fixture.appVersion,
            bundleVersion: fixture.targetBundleVersion,
          });
        }
        if (cleartextMessage === 'SIG_METADATA') {
          return makeSignedCleartextMock({
            fileName: 'metadata.json',
            sha256: fixture.metadataSha256,
            appVersion: fixture.appVersion,
            bundleVersion: fixture.targetBundleVersion,
          });
        }
        throw new OneKeyLocalError(
          `Unexpected signature: ${String(cleartextMessage)}`,
        );
      });

    await api.verifyBundleASC(downloadedEvent);
    await api.verifyBundle(downloadedEvent);

    const extractDir = getBundleExtractDir({
      appVersion: fixture.appVersion,
      bundleVersion: fixture.targetBundleVersion,
    });
    expect(fs.existsSync(path.join(extractDir, 'diff-manifest.json'))).toBe(
      false,
    );
    expect(fs.existsSync(`${extractDir}.diff-staging`)).toBe(false);
    expect(
      fs.readFileSync(path.join(extractDir, 'build', 'index.html'), 'utf8'),
    ).toBe(fixture.changedFiles['index.html']);
    expect(
      fs.readFileSync(
        path.join(extractDir, 'build', 'static', 'vendor.js'),
        'utf8',
      ),
    ).toBe(fixture.reusedFiles['static/vendor.js']);
    expect(
      fs.readFileSync(
        path.join(extractDir, 'build', 'assets', 'shared.txt'),
        'utf8',
      ),
    ).toBe(fixture.reusedFiles['assets/shared.txt']);

    // Startup verification continues to use metadata.json + full signature.
    await expect(
      verifyMetadataFileSha256({
        appVersion: fixture.appVersion,
        bundleVersion: fixture.targetBundleVersion,
        signature: 'SIG_METADATA',
      }),
    ).resolves.toBe(true);

    const buildDir = path.join(extractDir, 'build');
    const loadedMetadata = await getMetadata({
      bundleDir: buildDir,
      appVersion: fixture.appVersion,
      bundleVersion: fixture.targetBundleVersion,
      signature: 'SIG_METADATA',
    });
    expect(loadedMetadata).toEqual(fixture.targetMetadata);
    expect(
      checkFileHash({
        bundleDirPath: buildDir,
        metadata: loadedMetadata,
        driveLetter: '',
        url: 'static/vendor.js',
      }),
    ).toBe(path.resolve(buildDir, 'static', 'vendor.js'));
    expect(readSpy).toHaveBeenCalled();
  });

  test('falls back to full bundle download when reused file is missing locally', async () => {
    const fixture = buildDiffAndFullFixture();
    // Only write one of the two reused files; the other is missing locally.
    writeLocalBuildFiles(mockAppPath, {
      'static/vendor.js': fixture.reusedFiles['static/vendor.js'],
    });

    mockDownloadNodeFile.mockImplementation(async (opts) => {
      fs.mkdirSync(path.dirname(opts.targetPath), { recursive: true });
      if (opts.url.includes('diff.zip')) {
        fs.writeFileSync(opts.targetPath, fixture.diffZipBuffer);
        return {
          filePath: opts.targetPath,
          totalBytes: fixture.diffZipBuffer.length,
        };
      }
      fs.writeFileSync(opts.targetPath, fixture.fullZipBuffer);
      return {
        filePath: opts.targetPath,
        totalBytes: fixture.fullZipBuffer.length,
      };
    });

    jest
      .spyOn(openpgp, 'readCleartextMessage')
      .mockImplementation(async ({ cleartextMessage }) => {
        if (cleartextMessage === 'SIG_DIFF_MANIFEST') {
          return makeSignedCleartextMock({
            fileName: 'diff-manifest.json',
            sha256: fixture.diffManifestSha256,
            appVersion: fixture.appVersion,
            bundleVersion: fixture.targetBundleVersion,
          });
        }
        return makeSignedCleartextMock({
          fileName: 'metadata.json',
          sha256: fixture.metadataSha256,
          appVersion: fixture.appVersion,
          bundleVersion: fixture.targetBundleVersion,
        });
      });

    const params = {
      latestVersion: fixture.appVersion,
      bundleVersion: fixture.targetBundleVersion,
      downloadUrl: 'https://cdn.onekey.test/full.zip',
      fileSize: fixture.fullZipBuffer.length,
      sha256: fixture.fullZipSha256,
      signature: 'SIG_METADATA',
      diffDownloadUrl: 'https://cdn.onekey.test/diff.zip',
      diffFileSize: fixture.diffZipBuffer.length,
      diffSha256: fixture.diffZipSha256,
      diffSignature: 'SIG_DIFF_MANIFEST',
    };

    const downloadedEvent = await api.downloadBundle(params);
    await api.verifyBundleASC(downloadedEvent);

    expect(mockDownloadNodeFile).toHaveBeenCalledTimes(2);
    expect(mockDownloadNodeFile.mock.calls[0][0].url).toBe(
      'https://cdn.onekey.test/diff.zip',
    );
    expect(mockDownloadNodeFile.mock.calls[1][0].url).toBe(
      'https://cdn.onekey.test/full.zip',
    );
    // Diff zip and staging dir are cleaned up after fallback.
    expect(
      fs.existsSync(
        path.join(
          api.getDownloadDir(),
          DIFF_DOWNLOAD_DIR_NAME,
          `${fixture.appVersion}-${fixture.targetBundleVersion}.diff.zip`,
        ),
      ),
    ).toBe(false);
    const extractDir = getBundleExtractDir({
      appVersion: fixture.appVersion,
      bundleVersion: fixture.targetBundleVersion,
    });
    expect(fs.existsSync(`${extractDir}.diff-staging`)).toBe(false);
    expect(
      fs.readFileSync(
        path.join(extractDir, 'build', 'assets', 'shared.txt'),
        'utf8',
      ),
    ).toBe(fixture.reusedFiles['assets/shared.txt']);

    // Subsequent downloadBundle for the same target skips diff because target is in diffFallbackTargets.
    mockDownloadNodeFile.mockClear();
    const secondEvent = await api.downloadBundle(params);
    expect(mockDownloadNodeFile).toHaveBeenCalledTimes(1);
    expect(mockDownloadNodeFile.mock.calls[0][0].url).toBe(
      'https://cdn.onekey.test/full.zip',
    );
    expect(secondEvent?.diffDownloadUrl).toBeUndefined();
  });

  test('falls back to full bundle download when local reused file has mismatched SHA-512', async () => {
    const fixture = buildDiffAndFullFixture();
    writeLocalBuildFiles(mockAppPath, {
      'static/vendor.js': 'TAMPERED_LOCAL_VENDOR',
      'assets/shared.txt': fixture.reusedFiles['assets/shared.txt'],
    });

    mockDownloadNodeFile.mockImplementation(async (opts) => {
      fs.mkdirSync(path.dirname(opts.targetPath), { recursive: true });
      const buf = opts.url.includes('diff.zip')
        ? fixture.diffZipBuffer
        : fixture.fullZipBuffer;
      fs.writeFileSync(opts.targetPath, buf);
      return { filePath: opts.targetPath, totalBytes: buf.length };
    });

    jest
      .spyOn(openpgp, 'readCleartextMessage')
      .mockImplementation(async ({ cleartextMessage }) => {
        if (cleartextMessage === 'SIG_DIFF_MANIFEST') {
          return makeSignedCleartextMock({
            fileName: 'diff-manifest.json',
            sha256: fixture.diffManifestSha256,
            appVersion: fixture.appVersion,
            bundleVersion: fixture.targetBundleVersion,
          });
        }
        return makeSignedCleartextMock({
          fileName: 'metadata.json',
          sha256: fixture.metadataSha256,
          appVersion: fixture.appVersion,
          bundleVersion: fixture.targetBundleVersion,
        });
      });

    const params = {
      latestVersion: fixture.appVersion,
      bundleVersion: fixture.targetBundleVersion,
      downloadUrl: 'https://cdn.onekey.test/full.zip',
      fileSize: fixture.fullZipBuffer.length,
      sha256: fixture.fullZipSha256,
      signature: 'SIG_METADATA',
      diffDownloadUrl: 'https://cdn.onekey.test/diff.zip',
      diffFileSize: fixture.diffZipBuffer.length,
      diffSha256: fixture.diffZipSha256,
      diffSignature: 'SIG_DIFF_MANIFEST',
    };

    const downloadedEvent = await api.downloadBundle(params);
    await api.verifyBundleASC(downloadedEvent);

    expect(mockDownloadNodeFile).toHaveBeenCalledTimes(2);
    expect(mockDownloadNodeFile.mock.calls[1][0].url).toBe(
      'https://cdn.onekey.test/full.zip',
    );
    const extractDir = getBundleExtractDir({
      appVersion: fixture.appVersion,
      bundleVersion: fixture.targetBundleVersion,
    });
    expect(
      fs.readFileSync(
        path.join(extractDir, 'build', 'static', 'vendor.js'),
        'utf8',
      ),
    ).toBe(fixture.reusedFiles['static/vendor.js']);
  });

  test('rejects invalid GPG diffSignature without falling back to full bundle', async () => {
    const fixture = buildDiffAndFullFixture();
    writeLocalBuildFiles(mockAppPath, fixture.reusedFiles);

    mockDownloadNodeFile.mockImplementation(async (opts) => {
      fs.mkdirSync(path.dirname(opts.targetPath), { recursive: true });
      fs.writeFileSync(opts.targetPath, fixture.diffZipBuffer);
      return {
        filePath: opts.targetPath,
        totalBytes: fixture.diffZipBuffer.length,
      };
    });

    jest
      .spyOn(openpgp, 'readCleartextMessage')
      .mockRejectedValue(new Error('Signed digest did not match'));

    const params = {
      latestVersion: fixture.appVersion,
      bundleVersion: fixture.targetBundleVersion,
      downloadUrl: 'https://cdn.onekey.test/full.zip',
      fileSize: fixture.fullZipBuffer.length,
      sha256: fixture.fullZipSha256,
      signature: 'SIG_METADATA',
      diffDownloadUrl: 'https://cdn.onekey.test/diff.zip',
      diffFileSize: fixture.diffZipBuffer.length,
      diffSha256: fixture.diffZipSha256,
      diffSignature: 'TAMPERED_DIFF_SIG',
    };

    const downloadedEvent = await api.downloadBundle(params);
    const err = await api
      .verifyBundleASC(downloadedEvent)
      .catch((error: unknown) => error);
    expect(getUpdateError(err, 'verifyASC').code).toBe(
      EUpdateErrorCode.integrityFailed,
    );
    // Must NOT fall back to downloading full bundle on GPG failure.
    expect(mockDownloadNodeFile).toHaveBeenCalledTimes(1);
    expect(
      fs.existsSync(
        path.join(
          api.getDownloadDir(),
          DIFF_DOWNLOAD_DIR_NAME,
          `${fixture.appVersion}-${fixture.targetBundleVersion}.diff.zip`,
        ),
      ),
    ).toBe(false);
  });

  test('falls back to full bundle on diff download failure unless aborted by clearDownload', async () => {
    const fixture = buildDiffAndFullFixture();

    // Case 1: non-aborted diff download failure -> falls back to full download
    mockDownloadNodeFile.mockImplementation(async (opts) => {
      if (opts.url.includes('diff.zip')) {
        throw createUpdateError({
          code: EUpdateErrorCode.httpError,
          step: 'download',
          httpStatus: 404,
        });
      }
      fs.mkdirSync(path.dirname(opts.targetPath), { recursive: true });
      fs.writeFileSync(opts.targetPath, fixture.fullZipBuffer);
      return {
        filePath: opts.targetPath,
        totalBytes: fixture.fullZipBuffer.length,
      };
    });

    const result = await api.downloadBundle({
      latestVersion: fixture.appVersion,
      bundleVersion: fixture.targetBundleVersion,
      downloadUrl: 'https://cdn.onekey.test/full.zip',
      fileSize: fixture.fullZipBuffer.length,
      sha256: fixture.fullZipSha256,
      signature: 'SIG_METADATA',
      diffDownloadUrl: 'https://cdn.onekey.test/diff.zip',
      diffFileSize: fixture.diffZipBuffer.length,
      diffSha256: fixture.diffZipSha256,
      diffSignature: 'SIG_DIFF_MANIFEST',
    });

    expect(mockDownloadNodeFile).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      downloadUrl: 'https://cdn.onekey.test/full.zip',
      latestVersion: fixture.appVersion,
      bundleVersion: fixture.targetBundleVersion,
      sha256: fixture.fullZipSha256,
      signature: 'SIG_METADATA',
    });

    // Case 2: aborted diff download -> does NOT fall back to full download
    mockDownloadNodeFile.mockReset();
    mockDownloadNodeFile.mockImplementation(
      (opts) =>
        new Promise((_, reject) => {
          opts.signal?.addEventListener('abort', () => {
            reject(
              createUpdateError({
                code: EUpdateErrorCode.cancelled,
                step: 'download',
              }),
            );
          });
        }),
    );

    const downloadPromise = api.downloadBundle({
      latestVersion: fixture.appVersion,
      bundleVersion: '201',
      downloadUrl: 'https://cdn.onekey.test/full-201.zip',
      fileSize: fixture.fullZipBuffer.length,
      sha256: fixture.fullZipSha256,
      signature: 'SIG_METADATA',
      diffDownloadUrl: 'https://cdn.onekey.test/diff-201.zip',
      diffFileSize: fixture.diffZipBuffer.length,
      diffSha256: fixture.diffZipSha256,
      diffSignature: 'SIG_DIFF_MANIFEST',
    });
    const clearPromise = api.clearDownload();
    const abortErr = await downloadPromise.catch((e: unknown) => e);
    await clearPromise;
    expect(getUpdateError(abortErr, 'download').code).toBe(
      EUpdateErrorCode.cancelled,
    );
    expect(mockDownloadNodeFile).toHaveBeenCalledTimes(1);
    expect(mockDownloadNodeFile.mock.calls[0][0].url).toBe(
      'https://cdn.onekey.test/diff-201.zip',
    );
  });

  test('listLocalBundles ignores .diff-staging, preserves 42.diff bundles, and clearDownload/prune clean .diff and .diff-staging', async () => {
    const extractDir = getBundleExtractDir({
      appVersion: '6.6.0',
      bundleVersion: '200',
    });
    const legacyDiffBundleDir = getBundleExtractDir({
      appVersion: '6.6.0',
      bundleVersion: '42.diff',
    });
    const staleExtractDir = getBundleExtractDir({
      appVersion: '6.5.0',
      bundleVersion: '100',
    });
    const stagingRoot = path.join(
      path.dirname(extractDir),
      DIFF_STAGING_DIR_NAME,
    );
    const stagingRunDir = path.join(stagingRoot, '6.6.0-200-run123');
    const diffDir = path.join(api.getDownloadDir(), DIFF_DOWNLOAD_DIR_NAME);
    const diffZipPath = path.join(diffDir, '6.6.0-200.diff.zip');
    const staleDiffZipPath = path.join(diffDir, '6.5.0-100.diff.zip');

    fs.mkdirSync(extractDir, { recursive: true });
    fs.mkdirSync(legacyDiffBundleDir, { recursive: true });
    fs.mkdirSync(staleExtractDir, { recursive: true });
    fs.mkdirSync(stagingRunDir, { recursive: true });
    fs.mkdirSync(diffDir, { recursive: true });
    fs.writeFileSync(diffZipPath, 'diff-data');
    fs.writeFileSync(staleDiffZipPath, 'stale-diff-data');

    expect(
      (await api.listLocalBundles()).toSorted((a, b) =>
        `${a.appVersion}-${a.bundleVersion}`.localeCompare(
          `${b.appVersion}-${b.bundleVersion}`,
        ),
      ),
    ).toEqual([
      { appVersion: '6.5.0', bundleVersion: '100' },
      { appVersion: '6.6.0', bundleVersion: '200' },
      { appVersion: '6.6.0', bundleVersion: '42.diff' },
    ]);

    const pruned = await api.pruneStaleAppVersionBundles();
    expect(pruned).toBe(1);
    expect(fs.existsSync(staleExtractDir)).toBe(false);
    expect(fs.existsSync(staleDiffZipPath)).toBe(false);
    // Legacy 42.diff bundle for current appVersion must NOT be parsed as stale and deleted!
    expect(fs.existsSync(legacyDiffBundleDir)).toBe(true);
    expect(fs.existsSync(diffZipPath)).toBe(true);
    expect(fs.existsSync(stagingRoot)).toBe(false);

    fs.mkdirSync(stagingRunDir, { recursive: true });
    await api.clearDownload();
    expect(fs.existsSync(diffZipPath)).toBe(false);
    expect(fs.existsSync(stagingRoot)).toBe(false);
    expect(fs.existsSync(extractDir)).toBe(true);
    expect(fs.existsSync(legacyDiffBundleDir)).toBe(true);
  });

  test('preserves resumable diff download on transient NETWORK_ERROR/TIMEOUT and resumes interrupted full fallback in verifyBundleASC', async () => {
    const fixture = buildDiffAndFullFixture();

    // 1. Transient NETWORK_ERROR during diff download rethrows without falling back to full bundle
    mockDownloadNodeFile.mockRejectedValueOnce(
      createUpdateError({
        code: EUpdateErrorCode.networkError,
        step: 'download',
      }),
    );

    const params = {
      latestVersion: fixture.appVersion,
      bundleVersion: fixture.targetBundleVersion,
      downloadUrl: 'https://cdn.onekey.test/full.zip',
      fileSize: fixture.fullZipBuffer.length,
      sha256: fixture.fullZipSha256,
      signature: 'SIG_METADATA',
      diffDownloadUrl: 'https://cdn.onekey.test/diff.zip',
      diffFileSize: fixture.diffZipBuffer.length,
      diffSha256: fixture.diffZipSha256,
      diffSignature: 'SIG_DIFF_MANIFEST',
    };

    const transientErr = await api
      .downloadBundle(params)
      .catch((e: unknown) => e);
    expect(getUpdateError(transientErr, 'download').code).toBe(
      EUpdateErrorCode.networkError,
    );
    expect(mockDownloadNodeFile).toHaveBeenCalledTimes(1);

    // 2. Retrying downloadBundle still attempts diff download because transient error did not blacklist diff
    mockDownloadNodeFile.mockImplementation(async (opts) => {
      fs.mkdirSync(path.dirname(opts.targetPath), { recursive: true });
      if (opts.url.includes('diff.zip')) {
        fs.writeFileSync(opts.targetPath, fixture.diffZipBuffer);
        return {
          filePath: opts.targetPath,
          totalBytes: fixture.diffZipBuffer.length,
        };
      }
      throw createUpdateError({
        code: EUpdateErrorCode.networkError,
        step: 'download',
      });
    });

    const downloadedEvent = await api.downloadBundle(params);
    expect(mockDownloadNodeFile).toHaveBeenCalledTimes(2);
    expect(mockDownloadNodeFile.mock.calls[1][0].url).toBe(
      'https://cdn.onekey.test/diff.zip',
    );

    jest
      .spyOn(openpgp, 'readCleartextMessage')
      .mockImplementation(async ({ cleartextMessage }) => {
        if (cleartextMessage === 'SIG_DIFF_MANIFEST') {
          return makeSignedCleartextMock({
            fileName: 'diff-manifest.json',
            sha256: fixture.diffManifestSha256,
            appVersion: fixture.appVersion,
            bundleVersion: fixture.targetBundleVersion,
          });
        }
        return makeSignedCleartextMock({
          fileName: 'metadata.json',
          sha256: fixture.metadataSha256,
          appVersion: fixture.appVersion,
          bundleVersion: fixture.targetBundleVersion,
        });
      });

    // 3. verifyBundleASC triggers full fallback (reused files missing), and full fallback download fails with transient networkError
    const fallbackErr = await api
      .verifyBundleASC(downloadedEvent)
      .catch((e: unknown) => e);
    expect(getUpdateError(fallbackErr, 'verifyASC').code).toBe(
      EUpdateErrorCode.networkError,
    );

    // 4. Retrying verifyBundleASC (even on a fresh instance without downloadUrl in params) resumes the full fallback download from persisted .diff.zip.meta.json
    mockDownloadNodeFile.mockImplementation(async (opts) => {
      fs.mkdirSync(path.dirname(opts.targetPath), { recursive: true });
      fs.writeFileSync(opts.targetPath, fixture.fullZipBuffer);
      return {
        filePath: opts.targetPath,
        totalBytes: fixture.fullZipBuffer.length,
      };
    });

    const restartedApi = new DesktopApiBundleUpdate({
      desktopApi: {} as IDesktopApi,
    });
    await restartedApi.verifyBundleASC({
      latestVersion: fixture.appVersion,
      bundleVersion: fixture.targetBundleVersion,
      sha256: fixture.fullZipSha256,
      signature: 'SIG_METADATA',
    });

    // 5. After restart, verifyBundle without explicit signature uses the persisted descriptor trust anchor
    await expect(
      restartedApi.verifyBundle({
        latestVersion: fixture.appVersion,
        bundleVersion: fixture.targetBundleVersion,
        sha256: fixture.fullZipSha256,
      }),
    ).resolves.toBeUndefined();
  });

  test('skips oversized non-matching candidate file before checking budget, and rejects SECURITY_REJECTED without full fallback', async () => {
    const fixture = buildDiffAndFullFixture();

    // Put an oversized non-matching static/vendor.js in active OTA dir (earlier candidate)
    // and the valid matching static/vendor.js in built-in mockAppPath/build (later candidate).
    const activeOtaDir = getBundleExtractDir({
      appVersion: fixture.appVersion,
      bundleVersion: '100',
    });
    writeLocalBuildFiles(activeOtaDir, {
      'static/vendor.js': 'wrong-content-in-active-ota',
      'assets/shared.txt': fixture.reusedFiles['assets/shared.txt'],
    });
    writeLocalBuildFiles(mockAppPath, {
      'static/vendor.js': fixture.reusedFiles['static/vendor.js'],
    });
    mockStore.getUpdateBundleData.mockReturnValue({
      appVersion: fixture.appVersion,
      bundleVersion: '100',
      signature: 'active-sig',
    });

    const readRealStat = (targetPath: fs.PathLike): fs.Stats =>
      fs.lstatSync(targetPath);
    const oversizedCandidatePath = path.resolve(
      activeOtaDir,
      'build',
      'static/vendor.js',
    );
    const statSpy = jest
      .spyOn(fs, 'statSync')
      .mockImplementation((targetPath) => {
        const realStat = readRealStat(targetPath);
        if (path.resolve(String(targetPath)) === oversizedCandidatePath) {
          realStat.size = MAX_BUNDLE_UNCOMPRESSED_BYTES + 1024;
        }
        return realStat;
      });

    mockDownloadNodeFile.mockImplementation(async (opts) => {
      fs.mkdirSync(path.dirname(opts.targetPath), { recursive: true });
      fs.writeFileSync(opts.targetPath, fixture.diffZipBuffer);
      return {
        filePath: opts.targetPath,
        totalBytes: fixture.diffZipBuffer.length,
      };
    });

    jest
      .spyOn(openpgp, 'readCleartextMessage')
      .mockImplementation(async ({ cleartextMessage }) => {
        if (cleartextMessage === 'SIG_DIFF_MANIFEST') {
          return makeSignedCleartextMock({
            fileName: 'diff-manifest.json',
            sha256: fixture.diffManifestSha256,
            appVersion: fixture.appVersion,
            bundleVersion: fixture.targetBundleVersion,
          });
        }
        return makeSignedCleartextMock({
          fileName: 'metadata.json',
          sha256: fixture.metadataSha256,
          appVersion: fixture.appVersion,
          bundleVersion: fixture.targetBundleVersion,
        });
      });

    const params = {
      latestVersion: fixture.appVersion,
      bundleVersion: fixture.targetBundleVersion,
      downloadUrl: 'https://cdn.onekey.test/full.zip',
      fileSize: fixture.fullZipBuffer.length,
      sha256: fixture.fullZipSha256,
      signature: 'SIG_METADATA',
      diffDownloadUrl: 'https://cdn.onekey.test/diff.zip',
      diffFileSize: fixture.diffZipBuffer.length,
      diffSha256: fixture.diffZipSha256,
      diffSignature: 'SIG_DIFF_MANIFEST',
    };

    const downloadedEvent = await api.downloadBundle(params);
    // Should succeed using mockAppPath/build/static/vendor.js without throwing SECURITY_REJECTED on the non-matching activeOtaDir file
    await expect(api.verifyBundleASC(downloadedEvent)).resolves.toBeUndefined();

    // Now simulate any matching static/vendor.js candidate exceeding MAX_BUNDLE_UNCOMPRESSED_BYTES -> must throw SECURITY_REJECTED without full fallback
    statSpy.mockImplementation((targetPath) => {
      const realStat = readRealStat(targetPath);
      if (
        path
          .resolve(String(targetPath))
          .endsWith(path.join('build', 'static', 'vendor.js'))
      ) {
        realStat.size = MAX_BUNDLE_UNCOMPRESSED_BYTES + 1024;
      }
      return realStat;
    });

    const secondParams = {
      ...params,
      bundleVersion: '201',
    };
    const fixture201 = buildDiffAndFullFixture({
      targetBundleVersion: '201',
    });
    mockDownloadNodeFile.mockClear();
    mockDownloadNodeFile.mockImplementation(async (opts) => {
      fs.mkdirSync(path.dirname(opts.targetPath), { recursive: true });
      fs.writeFileSync(opts.targetPath, fixture201.diffZipBuffer);
      return {
        filePath: opts.targetPath,
        totalBytes: fixture201.diffZipBuffer.length,
      };
    });
    jest
      .spyOn(openpgp, 'readCleartextMessage')
      .mockImplementation(async ({ cleartextMessage }) => {
        if (cleartextMessage === 'SIG_DIFF_MANIFEST') {
          return makeSignedCleartextMock({
            fileName: 'diff-manifest.json',
            sha256: fixture201.diffManifestSha256,
            appVersion: fixture201.appVersion,
            bundleVersion: '201',
          });
        }
        return makeSignedCleartextMock({
          fileName: 'metadata.json',
          sha256: fixture201.metadataSha256,
          appVersion: fixture201.appVersion,
          bundleVersion: '201',
        });
      });

    const event201 = await api.downloadBundle({
      ...secondParams,
      sha256: fixture201.fullZipSha256,
      diffSha256: fixture201.diffZipSha256,
    });
    const secErr = await api.verifyBundleASC(event201).catch((e: unknown) => e);
    expect(getUpdateError(secErr, 'verifyASC').code).toBe(
      EUpdateErrorCode.securityRejected,
    );
    // Must NOT fall back to downloading full bundle on SECURITY_REJECTED
    expect(mockDownloadNodeFile).toHaveBeenCalledTimes(1);
    statSpy.mockRestore();
  });
});
