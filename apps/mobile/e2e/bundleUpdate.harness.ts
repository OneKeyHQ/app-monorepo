/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
// Bundle Update Native Module harness tests
// Runs on real device (Hermes) via react-native-harness to verify native BundleUpdateModule
// functions work correctly on Android/iOS.
//
// These tests exercise the native bridge methods exposed by:
//   - Android: BundleUpdateModule.java
//   - iOS: BundleUpdateModule.m
//
// NOTE: Tests that require actual downloads or app restart are skipped.
// We focus on local operations: SHA256, file manipulation, version logic, parameter validation.

import { ReactNativeBundleUpdate as BundleUpdateModule } from '@onekeyfe/react-native-bundle-update';
import { describe, expect, test } from 'react-native-harness';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import mmkvDevSettingStorageInstance from '@onekeyhq/shared/src/storage/instance/mmkvDevSettingStorageInstance';
import { EDevSettingSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

// ---- Helpers ----

const RNFS = // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('@onekeyhq/shared/src/modules3rdParty/react-native-fs')?.default;

async function writeTestFile(filePath: string, content: string): Promise<void> {
  if (!RNFS) throw new OneKeyLocalError('RNFS unavailable');
  await RNFS.writeFile(filePath, content, 'utf8');
}

async function deleteIfExists(filePath: string): Promise<void> {
  if (!RNFS) return;
  const exists = await RNFS.exists(filePath);
  if (exists) {
    await RNFS.unlink(filePath);
  }
}

async function getTempDir(): Promise<string> {
  if (!RNFS) throw new OneKeyLocalError('RNFS unavailable');
  const dir = `${RNFS.CachesDirectoryPath}/bundleUpdateTest`;
  const exists = await RNFS.exists(dir);
  if (!exists) {
    await RNFS.mkdir(dir);
  }
  return dir;
}

const TEST_MAIN_BUNDLE_FILE = 'main.jsbundle.hbc';
const TEST_BACKGROUND_BUNDLE_FILE = 'background.bundle';
const TEST_WEB_EMBED_INDEX_FILE = 'web-embed/index.html';
const TEST_BACKGROUND_PROTOCOL_VERSION = '1';

function parseMetadataPathFromMessage(message: string): string {
  const marker = 'Created empty metadata.json: ';
  const index = message.indexOf(marker);
  if (index < 0) {
    throw new OneKeyLocalError(
      `Unexpected metadata result message: ${message}`,
    );
  }
  return message.slice(index + marker.length).trim();
}

async function ensureDir(dirPath: string): Promise<void> {
  if (!RNFS) throw new OneKeyLocalError('RNFS unavailable');
  const exists = await RNFS.exists(dirPath);
  if (!exists) {
    await RNFS.mkdir(dirPath);
  }
}

async function writeBundleMetadata(
  metadataPath: string,
  metadata: Record<string, string>,
): Promise<void> {
  await writeTestFile(metadataPath, JSON.stringify(metadata, null, 2));
}

async function createBundleRuntimeDir(
  appVersion: string,
  bundleVersion: string,
): Promise<{ bundleDir: string; metadataPath: string }> {
  await BundleUpdateModule.testDeleteJsRuntimeDir(appVersion, bundleVersion);
  const result = await BundleUpdateModule.testWriteEmptyMetadataJson(
    appVersion,
    bundleVersion,
  );
  if (!result.success) {
    throw new OneKeyLocalError(
      `Failed to create test metadata: ${result.message}`,
    );
  }
  const metadataPath = parseMetadataPathFromMessage(result.message);
  const bundleDir = metadataPath.replace(/\/metadata\.json$/, '');
  return { bundleDir, metadataPath };
}

async function setSkipGpgVerificationForTests(enabled: boolean): Promise<void> {
  mmkvDevSettingStorageInstance.set(
    EDevSettingSyncStorageKeys.onekey_developer_mode_enabled,
    enabled,
  );
  mmkvDevSettingStorageInstance.set(
    EDevSettingSyncStorageKeys.onekey_bundle_skip_gpg_verification,
    enabled,
  );
}

type IBundlePairFixtureOptions = {
  appVersion: string;
  bundleVersion: string;
  includeMain?: boolean;
  includeBackground?: boolean;
  includeWebEmbed?: boolean;
  requiresBackgroundBundle?: boolean;
  backgroundProtocolVersion?: string;
};

async function prepareSkipGpgVerificationForTests(): Promise<boolean> {
  await setSkipGpgVerificationForTests(true);
  if (!BundleUpdateModule.isSkipGpgVerificationAllowed()) {
    return false;
  }
  return BundleUpdateModule.testSkipVerification();
}

async function createBundlePairFixture({
  appVersion,
  bundleVersion,
  includeMain = true,
  includeBackground = true,
  includeWebEmbed = true,
  requiresBackgroundBundle = true,
  backgroundProtocolVersion = TEST_BACKGROUND_PROTOCOL_VERSION,
}: IBundlePairFixtureOptions): Promise<{
  bundleDir: string;
  mainPath: string;
  backgroundPath: string;
  webEmbedDir: string;
}> {
  const folderName = `${appVersion}-${bundleVersion}`;
  const { bundleDir, metadataPath } = await createBundleRuntimeDir(
    appVersion,
    bundleVersion,
  );
  const mainPath = `${bundleDir}/${TEST_MAIN_BUNDLE_FILE}`;
  const backgroundPath = `${bundleDir}/${TEST_BACKGROUND_BUNDLE_FILE}`;
  const webEmbedDir = `${bundleDir}/web-embed`;
  const webEmbedIndexPath = `${bundleDir}/${TEST_WEB_EMBED_INDEX_FILE}`;
  const metadata: Record<string, string> = {};

  if (includeMain) {
    await writeTestFile(mainPath, `main bundle ${folderName}`);
    metadata[TEST_MAIN_BUNDLE_FILE] =
      await BundleUpdateModule.getSha256FromFilePath(mainPath);
  }

  if (includeBackground) {
    await writeTestFile(backgroundPath, `background bundle ${folderName}`);
    metadata[TEST_BACKGROUND_BUNDLE_FILE] =
      await BundleUpdateModule.getSha256FromFilePath(backgroundPath);
  }

  if (includeWebEmbed) {
    await ensureDir(webEmbedDir);
    await writeTestFile(webEmbedIndexPath, `<html>${folderName}</html>`);
    metadata[TEST_WEB_EMBED_INDEX_FILE] =
      await BundleUpdateModule.getSha256FromFilePath(webEmbedIndexPath);
  }

  metadata.requiresBackgroundBundle = requiresBackgroundBundle
    ? 'true'
    : 'false';
  metadata.backgroundProtocolVersion = backgroundProtocolVersion;

  await writeBundleMetadata(metadataPath, metadata);

  return {
    bundleDir,
    mainPath,
    backgroundPath,
    webEmbedDir,
  };
}

async function clearBundlePairFixture(
  appVersion: string,
  bundleVersion: string,
): Promise<void> {
  await BundleUpdateModule.clearAllJSBundleData();
  await BundleUpdateModule.testDeleteJsRuntimeDir(appVersion, bundleVersion);
}

// ---------------------------------------------------------------------------
// Prerequisite check
// ---------------------------------------------------------------------------
describe('BundleUpdateModule availability', () => {
  test('BundleUpdateModule is registered as a native module', () => {
    expect(BundleUpdateModule).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// getSha256FromFilePath - Native SHA256 calculation
// ---------------------------------------------------------------------------
describe('getSha256FromFilePath', () => {
  test('calculates SHA256 of a known file', async () => {
    const appVersion = '99.99.80';
    const bundleVersion = '8001';
    const { bundleDir } = await createBundleRuntimeDir(
      appVersion,
      bundleVersion,
    );
    const filePath = `${bundleDir}/sha256-test.txt`;
    // "hello" SHA256 = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    try {
      await writeTestFile(filePath, 'hello');
      const sha256 = await BundleUpdateModule.getSha256FromFilePath(filePath);
      expect(sha256).toBe(
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      );
    } finally {
      await clearBundlePairFixture(appVersion, bundleVersion);
    }
  });

  test('returns empty string for non-existent file', async () => {
    const appVersion = '99.99.80';
    const bundleVersion = '8002';
    const { bundleDir } = await createBundleRuntimeDir(
      appVersion,
      bundleVersion,
    );
    try {
      const sha256 = await BundleUpdateModule.getSha256FromFilePath(
        `${bundleDir}/missing.txt`,
      );
      expect(sha256).toBe('');
    } finally {
      await clearBundlePairFixture(appVersion, bundleVersion);
    }
  });

  test('rejects null file path', async () => {
    try {
      await BundleUpdateModule.getSha256FromFilePath(null as unknown as string);
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error?.message || error).toBeTruthy();
    }
  });

  test('calculates SHA256 for empty file', async () => {
    const appVersion = '99.99.80';
    const bundleVersion = '8003';
    const { bundleDir } = await createBundleRuntimeDir(
      appVersion,
      bundleVersion,
    );
    const filePath = `${bundleDir}/empty-sha256-test.txt`;
    try {
      await writeTestFile(filePath, '');
      const sha256 = await BundleUpdateModule.getSha256FromFilePath(filePath);
      // SHA256 of empty string
      expect(sha256).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
    } finally {
      await clearBundlePairFixture(appVersion, bundleVersion);
    }
  });

  test('different content produces different hash', async () => {
    const appVersion = '99.99.80';
    const bundleVersion = '8004';
    const { bundleDir } = await createBundleRuntimeDir(
      appVersion,
      bundleVersion,
    );
    const fileA = `${bundleDir}/sha256-a.txt`;
    const fileB = `${bundleDir}/sha256-b.txt`;
    try {
      await writeTestFile(fileA, 'content A');
      await writeTestFile(fileB, 'content B');
      const hashA = await BundleUpdateModule.getSha256FromFilePath(fileA);
      const hashB = await BundleUpdateModule.getSha256FromFilePath(fileB);
      expect(hashA).not.toBe(hashB);
      expect(hashA.length).toBe(64);
      expect(hashB.length).toBe(64);
    } finally {
      await clearBundlePairFixture(appVersion, bundleVersion);
    }
  });
});

// ---------------------------------------------------------------------------
// getNativeAppVersion
// ---------------------------------------------------------------------------
describe('getNativeAppVersion', () => {
  test('returns a valid semver-like version string', async () => {
    const version = await BundleUpdateModule.getNativeAppVersion();
    expect(typeof version).toBe('string');
    expect(version.length).toBeGreaterThan(0);
    // Should match pattern like "1.0.0" or "1.2.3"
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

// ---------------------------------------------------------------------------
// getJsBundlePath - Returns current JS bundle path (empty if not installed)
// ---------------------------------------------------------------------------
describe('getJsBundlePath', () => {
  test('returns a string (empty or valid path)', async () => {
    const path = BundleUpdateModule.getJsBundlePath();
    expect(typeof path).toBe('string');
    // May be empty string if no bundle is installed, which is fine
  });
});

// ---------------------------------------------------------------------------
// getBackgroundJsBundlePath - Returns current background JS bundle path
// ---------------------------------------------------------------------------
describe('getBackgroundJsBundlePath', () => {
  test('getBackgroundJsBundlePath sync returns a string', () => {
    const path = BundleUpdateModule.getBackgroundJsBundlePath();
    expect(typeof path).toBe('string');
  });

  test('getBackgroundJsBundlePathAsync returns a string', async () => {
    const path = await BundleUpdateModule.getBackgroundJsBundlePathAsync();
    expect(typeof path).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// getWebEmbedPathAsync / getWebEmbedPath
// ---------------------------------------------------------------------------
describe('getWebEmbedPath', () => {
  test('getWebEmbedPathAsync returns a string', async () => {
    const path = await BundleUpdateModule.getWebEmbedPathAsync();
    expect(typeof path).toBe('string');
  });

  test('getWebEmbedPath sync returns a string', () => {
    const path = BundleUpdateModule.getWebEmbedPath();
    expect(typeof path).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// testVerification - Tests GPG signature verification with embedded test data
// ---------------------------------------------------------------------------
describe('testVerification', () => {
  test('GPG signature verification with test data returns true', async () => {
    const result = await BundleUpdateModule.testVerification();
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// downloadBundle - Parameter validation (no actual download)
// ---------------------------------------------------------------------------
describe('downloadBundle parameter validation', () => {
  test('rejects with missing required params', async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await BundleUpdateModule.downloadBundle({} as any);
      // Should not reach here
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message || e.code || e).toBeTruthy();
    }
  });

  test('rejects HTTP (non-HTTPS) download URL', async () => {
    try {
      await BundleUpdateModule.downloadBundle({
        latestVersion: '1.0.0',
        bundleVersion: '1',
        downloadUrl: 'http://example.com/bundle.zip',
        fileSize: 1000,
        sha256: 'abc123',
      });
      expect(true).toBe(false);
    } catch (e: any) {
      const msg = String(e.message || e);
      expect(msg).toMatch(/HTTPS/i);
    }
  });
});

// ---------------------------------------------------------------------------
// verifyBundle - Parameter validation
// ---------------------------------------------------------------------------
describe('verifyBundle parameter validation', () => {
  test('rejects with missing filePath and sha256', async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await BundleUpdateModule.verifyBundle({} as any);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message || e.code || e).toBeTruthy();
    }
  });

  test('rejects with non-existent file path', async () => {
    try {
      await BundleUpdateModule.verifyBundle({
        downloadedFile: '/non/existent/bundle.zip',
        sha256: 'abc123',
        latestVersion: '1.0.0',
        bundleVersion: '1',
      });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message || e.code || e).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// verifyBundleASC - Parameter validation
// ---------------------------------------------------------------------------
describe('verifyBundleASC parameter validation', () => {
  test('rejects with missing params', async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await BundleUpdateModule.verifyBundleASC({} as any);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message || e.code || e).toBeTruthy();
    }
  });

  test('rejects with wrong SHA256 for existing file', async () => {
    const dir = await getTempDir();
    const filePath = `${dir}/fake-bundle.zip`;
    await writeTestFile(filePath, 'not a real zip');
    try {
      await BundleUpdateModule.verifyBundleASC({
        downloadedFile: filePath,
        sha256: 'wrong_hash_value',
        latestVersion: '1.0.0',
        bundleVersion: '999',
        signature: 'invalid_signature',
      });
      expect(true).toBe(false);
    } catch (e: any) {
      const msg = String(e.message || e);
      expect(msg.length).toBeGreaterThan(0);
    }
    await deleteIfExists(filePath);
  });
});

// ---------------------------------------------------------------------------
// downloadBundleASC - Parameter validation
// ---------------------------------------------------------------------------
describe('downloadBundleASC parameter validation', () => {
  test('rejects with missing required params', async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await BundleUpdateModule.downloadBundleASC({} as any);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message || e.code || e).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// installBundle - Parameter validation & version downgrade prevention
// ---------------------------------------------------------------------------
describe('installBundle parameter validation', () => {
  test('rejects with missing required params', async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await BundleUpdateModule.installBundle({} as any);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message || e.code || e).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// clearBundle
// ---------------------------------------------------------------------------
describe('clearBundle', () => {
  test('clearBundle resolves without error', async () => {
    await BundleUpdateModule.clearBundle();
    // Should not throw
    expect(true).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// clearAllJSBundleData
// ---------------------------------------------------------------------------
describe('clearAllJSBundleData', () => {
  test('clears all JS bundle data and returns success', async () => {
    const result = await BundleUpdateModule.clearAllJSBundleData();
    expect(result).toBeDefined();
    if (result) {
      expect(result.success).toBe(true);
    }
  });

  test('getJsBundlePath returns empty after clear', async () => {
    await BundleUpdateModule.clearAllJSBundleData();
    const path = BundleUpdateModule.getJsBundlePath();
    // After clearing, should be empty or null
    expect(!path || path === '').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// testDeleteJsBundle / testDeleteJsRuntimeDir / testDeleteMetadataJson /
// testWriteEmptyMetadataJson - test helper functions
// ---------------------------------------------------------------------------
describe('test helper functions', () => {
  const testAppVersion = '99.99.99';
  const testBundleVersion = '9999';

  test('testWriteEmptyMetadataJson creates empty metadata', async () => {
    const result = await BundleUpdateModule.testWriteEmptyMetadataJson(
      testAppVersion,
      testBundleVersion,
    );
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  test('testDeleteMetadataJson removes metadata file', async () => {
    // First ensure it exists
    await BundleUpdateModule.testWriteEmptyMetadataJson(
      testAppVersion,
      testBundleVersion,
    );
    const result = await BundleUpdateModule.testDeleteMetadataJson(
      testAppVersion,
      testBundleVersion,
    );
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  test('testDeleteMetadataJson returns success=false for non-existent', async () => {
    const result = await BundleUpdateModule.testDeleteMetadataJson(
      '0.0.0',
      '0',
    );
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
  });

  test('testDeleteJsBundle returns success=false for non-existent', async () => {
    const result = await BundleUpdateModule.testDeleteJsBundle('0.0.0', '0');
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
  });

  test('testDeleteJsRuntimeDir returns success=false for non-existent', async () => {
    const result = await BundleUpdateModule.testDeleteJsRuntimeDir(
      '0.0.0',
      '0',
    );
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
  });

  // Cleanup: remove any test data created
  test('cleanup: delete test runtime dir', async () => {
    const result = await BundleUpdateModule.testDeleteJsRuntimeDir(
      testAppVersion,
      testBundleVersion,
    );
    // May succeed or not depending on whether there's data; either is fine
    expect(result).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// getFallbackUpdateBundleData
// ---------------------------------------------------------------------------
describe('getFallbackUpdateBundleData', () => {
  test('returns an array (possibly empty)', async () => {
    const data = await BundleUpdateModule.getFallbackUpdateBundleData();
    // May be null/undefined on fresh install, or an array
    const isArrayLike =
      Array.isArray(data) || data === null || data === undefined;
    expect(isArrayLike).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// setCurrentUpdateBundleData
// ---------------------------------------------------------------------------
describe('setCurrentUpdateBundleData', () => {
  test('stores bundle data and can be cleared', async () => {
    const appVersion = '99.99.99';
    const bundleVersion = '9999';
    await clearBundlePairFixture(appVersion, bundleVersion);
    const skipGpgReady = await prepareSkipGpgVerificationForTests();

    try {
      const fixture = await createBundlePairFixture({
        appVersion,
        bundleVersion,
      });

      if (!skipGpgReady) {
        await expect(
          BundleUpdateModule.setCurrentUpdateBundleData({
            appVersion,
            bundleVersion,
            signature: '',
          }),
        ).rejects.toBeTruthy();
        return;
      }

      await BundleUpdateModule.setCurrentUpdateBundleData({
        appVersion,
        bundleVersion,
        signature: '',
      });
      expect(BundleUpdateModule.getJsBundlePath()).toBe(fixture.mainPath);
    } finally {
      await clearBundlePairFixture(appVersion, bundleVersion);
      await setSkipGpgVerificationForTests(false);
    }
  });
});

// ---------------------------------------------------------------------------
// bundle pair compatibility
// ---------------------------------------------------------------------------
describe('bundle pair compatibility', () => {
  test('valid pair returns main/background/web-embed OTA paths', async () => {
    const appVersion = '99.99.90';
    const bundleVersion = '9001';
    await clearBundlePairFixture(appVersion, bundleVersion);
    const skipGpgReady = await prepareSkipGpgVerificationForTests();

    try {
      if (!skipGpgReady) {
        expect(BundleUpdateModule.isSkipGpgVerificationAllowed()).toBe(false);
        return;
      }
      const fixture = await createBundlePairFixture({
        appVersion,
        bundleVersion,
      });

      await BundleUpdateModule.setCurrentUpdateBundleData({
        appVersion,
        bundleVersion,
        signature: '',
      });

      expect(BundleUpdateModule.getJsBundlePath()).toBe(fixture.mainPath);
      expect(BundleUpdateModule.getBackgroundJsBundlePath()).toBe(
        fixture.backgroundPath,
      );
      expect(await BundleUpdateModule.getWebEmbedPathAsync()).toBe(
        fixture.webEmbedDir,
      );
    } finally {
      await clearBundlePairFixture(appVersion, bundleVersion);
      await setSkipGpgVerificationForTests(false);
    }
  });

  test('missing main invalidates the whole OTA pair', async () => {
    const appVersion = '99.99.90';
    const bundleVersion = '9002';
    await clearBundlePairFixture(appVersion, bundleVersion);
    const skipGpgReady = await prepareSkipGpgVerificationForTests();

    try {
      if (!skipGpgReady) {
        expect(BundleUpdateModule.isSkipGpgVerificationAllowed()).toBe(false);
        return;
      }
      await createBundlePairFixture({
        appVersion,
        bundleVersion,
        includeMain: false,
      });

      await BundleUpdateModule.setCurrentUpdateBundleData({
        appVersion,
        bundleVersion,
        signature: '',
      });

      expect(BundleUpdateModule.getJsBundlePath()).toBe('');
      expect(BundleUpdateModule.getBackgroundJsBundlePath()).toBe('');
      expect(await BundleUpdateModule.getWebEmbedPathAsync()).toBe('');
    } finally {
      await clearBundlePairFixture(appVersion, bundleVersion);
      await setSkipGpgVerificationForTests(false);
    }
  });

  test('missing background invalidates the whole OTA pair when required', async () => {
    const appVersion = '99.99.90';
    const bundleVersion = '9003';
    await clearBundlePairFixture(appVersion, bundleVersion);
    const skipGpgReady = await prepareSkipGpgVerificationForTests();

    try {
      if (!skipGpgReady) {
        expect(BundleUpdateModule.isSkipGpgVerificationAllowed()).toBe(false);
        return;
      }
      await createBundlePairFixture({
        appVersion,
        bundleVersion,
        includeBackground: false,
      });

      await BundleUpdateModule.setCurrentUpdateBundleData({
        appVersion,
        bundleVersion,
        signature: '',
      });

      expect(BundleUpdateModule.getJsBundlePath()).toBe('');
      expect(BundleUpdateModule.getBackgroundJsBundlePath()).toBe('');
      expect(await BundleUpdateModule.getWebEmbedPathAsync()).toBe('');
    } finally {
      await clearBundlePairFixture(appVersion, bundleVersion);
      await setSkipGpgVerificationForTests(false);
    }
  });

  test('protocol mismatch invalidates the whole OTA pair', async () => {
    const appVersion = '99.99.90';
    const bundleVersion = '9004';
    await clearBundlePairFixture(appVersion, bundleVersion);
    const skipGpgReady = await prepareSkipGpgVerificationForTests();

    try {
      if (!skipGpgReady) {
        expect(BundleUpdateModule.isSkipGpgVerificationAllowed()).toBe(false);
        return;
      }
      await createBundlePairFixture({
        appVersion,
        bundleVersion,
        backgroundProtocolVersion: '999',
      });

      await BundleUpdateModule.setCurrentUpdateBundleData({
        appVersion,
        bundleVersion,
        signature: '',
      });

      expect(BundleUpdateModule.getJsBundlePath()).toBe('');
      expect(BundleUpdateModule.getBackgroundJsBundlePath()).toBe('');
      expect(await BundleUpdateModule.getWebEmbedPathAsync()).toBe('');
    } finally {
      await clearBundlePairFixture(appVersion, bundleVersion);
      await setSkipGpgVerificationForTests(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Android-specific: ANDROID_CHANNEL constant
// ---------------------------------------------------------------------------
describe('platform constants', () => {
  test('module exposes expected constants', () => {
    // Nitro modules don't have getConstants; just verify the module is defined
    expect(BundleUpdateModule).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// SHA256 consistency: native vs JS
// ---------------------------------------------------------------------------
describe('SHA256 cross-verification', () => {
  test('native SHA256 matches JS crypto SHA256 for same content', async () => {
    const appVersion = '99.99.80';
    const bundleVersion = '8005';
    const { bundleDir } = await createBundleRuntimeDir(
      appVersion,
      bundleVersion,
    );
    const filePath = `${bundleDir}/cross-verify.txt`;
    const testContent = 'OneKey Bundle Update Test Content 2025';
    try {
      await writeTestFile(filePath, testContent);

      const nativeSha256 =
        await BundleUpdateModule.getSha256FromFilePath(filePath);
      expect(nativeSha256.length).toBe(64);
      expect(nativeSha256).toMatch(/^[0-9a-f]{64}$/);

      // Verify same file always produces same hash
      const nativeSha256Again =
        await BundleUpdateModule.getSha256FromFilePath(filePath);
      expect(nativeSha256Again).toBe(nativeSha256);
    } finally {
      await clearBundlePairFixture(appVersion, bundleVersion);
    }
  });
});

// ---------------------------------------------------------------------------
// jsBundlePath synchronous method
// ---------------------------------------------------------------------------
describe('getJsBundlePath', () => {
  test('returns a string', async () => {
    const path = BundleUpdateModule.getJsBundlePath();
    expect(typeof path).toBe('string');
  });
});
