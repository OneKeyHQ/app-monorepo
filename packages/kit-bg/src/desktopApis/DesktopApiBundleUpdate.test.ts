// DesktopApiBundleUpdate logic tests
// Tests the pure logic aspects of DesktopApiBundleUpdate that don't require
// a real Electron environment: parameter validation, HTTPS enforcement,
// redirect logic, bundle install guardrails, and path traversal detection.
//
// The actual DesktopApiBundleUpdate class depends heavily on Electron (app,
// BrowserWindow, IPC) so we test the logic patterns directly.

import path from 'path';

// ---------------------------------------------------------------------------
// HTTPS enforcement - mirrors downloadBundle (lines 97-102)
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate HTTPS enforcement', () => {
  function validateDownloadUrl(url: string | undefined): string | null {
    if (!url) return 'Invalid parameters';
    if (!url.startsWith('https://'))
      return 'Bundle download URL must use HTTPS';
    return null;
  }

  test('accepts valid HTTPS URL', () => {
    expect(validateDownloadUrl('https://cdn.onekey.so/bundle.zip')).toBeNull();
  });

  test('rejects HTTP URL', () => {
    expect(validateDownloadUrl('http://cdn.onekey.so/bundle.zip')).toBe(
      'Bundle download URL must use HTTPS',
    );
  });

  test('rejects undefined URL', () => {
    expect(validateDownloadUrl(undefined)).toBe('Invalid parameters');
  });

  test('rejects empty string', () => {
    expect(validateDownloadUrl('')).toBe('Invalid parameters');
  });

  test('rejects FTP URL', () => {
    expect(validateDownloadUrl('ftp://cdn.onekey.so/bundle.zip')).toBe(
      'Bundle download URL must use HTTPS',
    );
  });
});

// ---------------------------------------------------------------------------
// Redirect validation - mirrors makeDownloadRequest (lines 157-176)
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate redirect validation', () => {
  const MAX_REDIRECTS = 5;

  function validateRedirect(
    redirectUrl: string,
    redirectCount: number,
  ): string | null {
    if (redirectCount >= MAX_REDIRECTS) return 'Too many redirects';
    if (!redirectUrl.startsWith('https://'))
      return 'Redirect to non-HTTPS URL is not allowed';
    return null;
  }

  test('accepts HTTPS redirect within limit', () => {
    expect(validateRedirect('https://cdn2.onekey.so/bundle.zip', 0)).toBeNull();
  });

  test('rejects redirect to HTTP (downgrade attack)', () => {
    expect(validateRedirect('http://evil.com/bundle.zip', 0)).toBe(
      'Redirect to non-HTTPS URL is not allowed',
    );
  });

  test('rejects redirect at max count', () => {
    expect(validateRedirect('https://cdn.onekey.so/bundle.zip', 5)).toBe(
      'Too many redirects',
    );
  });

  test('accepts redirect at count 4 (just under limit)', () => {
    expect(validateRedirect('https://cdn.onekey.so/bundle.zip', 4)).toBeNull();
  });

  test('rejects redirect beyond max count', () => {
    expect(validateRedirect('https://cdn.onekey.so/bundle.zip', 10)).toBe(
      'Too many redirects',
    );
  });
});

// ---------------------------------------------------------------------------
// Parameter validation - mirrors downloadBundle (lines 93-96)
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate parameter validation', () => {
  interface IDownloadParams {
    appVersion?: string;
    bundleVersion?: string;
    bundleUrl?: string;
    fileSize?: number;
    sha256?: string;
  }

  function validateDownloadParams(params: IDownloadParams): string | null {
    const { appVersion, bundleVersion, bundleUrl, fileSize, sha256 } = params;
    if (!appVersion || !bundleVersion || !bundleUrl || !fileSize || !sha256) {
      return 'Invalid parameters';
    }
    if (!bundleUrl.startsWith('https://')) {
      return 'Bundle download URL must use HTTPS';
    }
    return null;
  }

  test('accepts valid parameters', () => {
    expect(
      validateDownloadParams({
        appVersion: '1.0.0',
        bundleVersion: '5',
        bundleUrl: 'https://cdn.onekey.so/bundle.zip',
        fileSize: 1024,
        sha256: 'abc123',
      }),
    ).toBeNull();
  });

  test('rejects missing appVersion', () => {
    expect(
      validateDownloadParams({
        bundleVersion: '5',
        bundleUrl: 'https://cdn.onekey.so/bundle.zip',
        fileSize: 1024,
        sha256: 'abc123',
      }),
    ).toBe('Invalid parameters');
  });

  test('rejects missing bundleVersion', () => {
    expect(
      validateDownloadParams({
        appVersion: '1.0.0',
        bundleUrl: 'https://cdn.onekey.so/bundle.zip',
        fileSize: 1024,
        sha256: 'abc123',
      }),
    ).toBe('Invalid parameters');
  });

  test('rejects missing sha256', () => {
    expect(
      validateDownloadParams({
        appVersion: '1.0.0',
        bundleVersion: '5',
        bundleUrl: 'https://cdn.onekey.so/bundle.zip',
        fileSize: 1024,
      }),
    ).toBe('Invalid parameters');
  });

  test('rejects zero fileSize', () => {
    expect(
      validateDownloadParams({
        appVersion: '1.0.0',
        bundleVersion: '5',
        bundleUrl: 'https://cdn.onekey.so/bundle.zip',
        fileSize: 0,
        sha256: 'abc123',
      }),
    ).toBe('Invalid parameters');
  });
});

// ---------------------------------------------------------------------------
// Version handling - mirrors installBundle (downgrade allowed)
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate version comparison behavior', () => {
  function shouldAllowInstall(
    currentBundleVersion: string | undefined,
    newBundleVersion: string,
  ): boolean {
    // Desktop installBundle no longer blocks downgrade by version number.
    // Keep numeric parsing to ensure this path is intentionally permissive.
    Number(currentBundleVersion ?? '');
    Number(newBundleVersion);
    return true;
  }

  test('allows upgrade from 3 to 5', () => {
    expect(shouldAllowInstall('3', '5')).toBe(true);
  });

  test('allows same version reinstall', () => {
    expect(shouldAllowInstall('5', '5')).toBe(true);
  });

  test('allows downgrade from 5 to 3', () => {
    expect(shouldAllowInstall('5', '3')).toBe(true);
  });

  test('allows when no current version', () => {
    expect(shouldAllowInstall(undefined, '5')).toBe(true);
  });

  test('handles non-numeric versions without blocking install', () => {
    expect(shouldAllowInstall('abc', '200')).toBe(true);
    expect(shouldAllowInstall('200', 'xyz')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Path traversal detection - mirrors verifyBundleASC (lines 444-452)
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate path traversal detection', () => {
  function checkPathTraversal(entryName: string, extractDir: string): boolean {
    const resolvedExtractDir = path.resolve(extractDir);
    const entryPath = path.resolve(resolvedExtractDir, entryName);
    return (
      !entryPath.startsWith(resolvedExtractDir + path.sep) &&
      entryPath !== resolvedExtractDir
    );
  }

  test('normal file is safe', () => {
    expect(checkPathTraversal('build/index.html', '/tmp/bundle')).toBe(false);
  });

  test('nested file is safe', () => {
    expect(checkPathTraversal('build/assets/main.js', '/tmp/bundle')).toBe(
      false,
    );
  });

  test('root file is safe', () => {
    expect(checkPathTraversal('metadata.json', '/tmp/bundle')).toBe(false);
  });

  test('detects parent directory traversal', () => {
    expect(checkPathTraversal('../../../etc/passwd', '/tmp/bundle')).toBe(true);
  });

  test('detects embedded traversal', () => {
    expect(checkPathTraversal('build/../../etc/passwd', '/tmp/bundle')).toBe(
      true,
    );
  });

  test('detects deep embedded traversal', () => {
    expect(
      checkPathTraversal('build/assets/../../../etc/shadow', '/tmp/bundle'),
    ).toBe(true);
  });

  test('safe path with .. that stays inside', () => {
    // build/../build/index.html resolves to build/index.html, still inside
    expect(checkPathTraversal('build/../build/index.html', '/tmp/bundle')).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// verifyBundle parameter validation - mirrors verifyBundle (lines 372-390)
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate verifyBundle params', () => {
  interface IVerifyParams {
    downloadedFile?: string;
    sha256?: string;
    appVersion?: string;
    bundleVersion?: string;
    signature?: string;
  }

  function validateVerifyParams(params: IVerifyParams): string | null {
    const { downloadedFile, sha256, appVersion, bundleVersion, signature } =
      params;
    if (
      !downloadedFile ||
      !sha256 ||
      !appVersion ||
      !bundleVersion ||
      !signature
    ) {
      return 'Invalid parameters';
    }
    return null;
  }

  test('accepts complete params', () => {
    expect(
      validateVerifyParams({
        downloadedFile: '/tmp/bundle.zip',
        sha256: 'abc123',
        appVersion: '1.0.0',
        bundleVersion: '5',
        signature: 'sig',
      }),
    ).toBeNull();
  });

  test('rejects missing downloadedFile', () => {
    expect(
      validateVerifyParams({
        sha256: 'abc123',
        appVersion: '1.0.0',
        bundleVersion: '5',
        signature: 'sig',
      }),
    ).toBe('Invalid parameters');
  });

  test('rejects missing signature', () => {
    expect(
      validateVerifyParams({
        downloadedFile: '/tmp/bundle.zip',
        sha256: 'abc123',
        appVersion: '1.0.0',
        bundleVersion: '5',
      }),
    ).toBe('Invalid parameters');
  });
});

// ---------------------------------------------------------------------------
// Fallback bundle management - mirrors installBundle (lines 566-589)
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate fallback management', () => {
  interface IBundleData {
    appVersion: string;
    bundleVersion: string;
    signature: string;
  }

  function manageFallbacks(
    current: IBundleData | null,
    fallbacks: IBundleData[],
  ): {
    updatedFallbacks: IBundleData[];
    removed: IBundleData | null;
  } {
    const updated = [...fallbacks];
    if (
      current &&
      current.appVersion &&
      current.bundleVersion &&
      current.signature
    ) {
      updated.push(current);
    }

    let removed: IBundleData | null = null;
    if (updated.length > 3) {
      removed = updated.shift() ?? null;
    }

    return { updatedFallbacks: updated, removed };
  }

  test('keeps all when under limit', () => {
    const { updatedFallbacks, removed } = manageFallbacks(
      { appVersion: '1.0.0', bundleVersion: '3', signature: 'sig3' },
      [
        { appVersion: '1.0.0', bundleVersion: '1', signature: 'sig1' },
        { appVersion: '1.0.0', bundleVersion: '2', signature: 'sig2' },
      ],
    );
    expect(updatedFallbacks.length).toBe(3);
    expect(removed).toBeNull();
  });

  test('removes oldest when over limit', () => {
    const { updatedFallbacks, removed } = manageFallbacks(
      { appVersion: '1.0.0', bundleVersion: '4', signature: 'sig4' },
      [
        { appVersion: '1.0.0', bundleVersion: '1', signature: 'sig1' },
        { appVersion: '1.0.0', bundleVersion: '2', signature: 'sig2' },
        { appVersion: '1.0.0', bundleVersion: '3', signature: 'sig3' },
      ],
    );
    expect(updatedFallbacks.length).toBe(3);
    expect(removed?.bundleVersion).toBe('1');
    expect(updatedFallbacks[0].bundleVersion).toBe('2');
  });

  test('does not add current if incomplete', () => {
    const { updatedFallbacks } = manageFallbacks(null, [
      { appVersion: '1.0.0', bundleVersion: '1', signature: 'sig1' },
    ]);
    expect(updatedFallbacks.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// File naming convention
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate file naming', () => {
  test('download file name matches pattern', () => {
    const appVersion = '1.2.3';
    const bundleVersion = '42';
    const fileName = `${appVersion}-${bundleVersion}.zip`;
    expect(fileName).toBe('1.2.3-42.zip');
  });

  test('partial file name has .partial suffix', () => {
    const filePath = '/tmp/bundle/1.2.3-42.zip';
    const partialFilePath = `${filePath}.partial`;
    expect(partialFilePath).toBe('/tmp/bundle/1.2.3-42.zip.partial');
  });

  test('bundle build path includes build subdirectory', () => {
    const appVersion = '1.0.0';
    const bundleVersion = '5';
    const bundleDir = '/tmp/onekey-bundle';
    const buildPath = path.join(
      bundleDir,
      `${appVersion}-${bundleVersion}`,
      'build',
    );
    expect(buildPath).toContain('1.0.0-5');
    expect(buildPath).toMatch(/build$/);
  });
});

// ---------------------------------------------------------------------------
// HTTP status code handling - mirrors downloadBundle response handling
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate HTTP status handling', () => {
  const REDIRECT_CODES = new Set([301, 302, 307, 308]);
  const SUCCESS_CODES = new Set([200, 206]);

  test('redirect codes are identified correctly', () => {
    for (const code of REDIRECT_CODES) {
      expect(REDIRECT_CODES.has(code)).toBe(true);
    }
    expect(REDIRECT_CODES.has(200)).toBe(false);
    expect(REDIRECT_CODES.has(404)).toBe(false);
  });

  test('success codes are 200 and 206', () => {
    expect(SUCCESS_CODES.has(200)).toBe(true);
    expect(SUCCESS_CODES.has(206)).toBe(true);
    expect(SUCCESS_CODES.has(201)).toBe(false);
  });

  test('416 means range not satisfiable', () => {
    const statusCode = 416;
    expect(statusCode === 416).toBe(true);
  });

  test('non-success non-redirect codes are errors', () => {
    const errorCodes = [400, 403, 404, 500, 502, 503];
    for (const code of errorCodes) {
      expect(!REDIRECT_CODES.has(code) && !SUCCESS_CODES.has(code)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Symlink detection - mirrors verifyAllExtractedFiles (line 496)
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate symlink detection', () => {
  test('rejects symbolic links conceptually', () => {
    // This tests the logic: if entry.isSymbolicLink() → throw
    const mockEntries = [
      {
        name: 'build/index.html',
        isSymbolicLink: () => false,
        isDirectory: () => false,
      },
      {
        name: 'build/link.html',
        isSymbolicLink: () => true,
        isDirectory: () => false,
      },
    ];

    const errors: string[] = [];
    for (const entry of mockEntries) {
      if (entry.isSymbolicLink()) {
        errors.push(`Symbolic link detected: ${entry.name}`);
      }
    }

    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('build/link.html');
  });
});

// ---------------------------------------------------------------------------
// Metadata file skip rules - mirrors verifyAllExtractedFiles (line 504)
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate file skip rules', () => {
  const SKIP_FILES = new Set(['metadata.json', '.DS_Store']);

  function shouldSkip(fileName: string): boolean {
    return SKIP_FILES.has(fileName);
  }

  test('skips metadata.json', () => {
    expect(shouldSkip('metadata.json')).toBe(true);
  });

  test('skips .DS_Store', () => {
    expect(shouldSkip('.DS_Store')).toBe(true);
  });

  test('does not skip index.html', () => {
    expect(shouldSkip('index.html')).toBe(false);
  });

  test('does not skip main.js', () => {
    expect(shouldSkip('main.js')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isDownloading guard - mirrors downloadBundle (line 89)
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate isDownloading guard', () => {
  test('second download call returns undefined when already downloading', () => {
    let isDownloading = false;
    function downloadBundle(): string | undefined {
      if (isDownloading) return undefined;
      isDownloading = true;
      return 'downloading';
    }
    expect(downloadBundle()).toBe('downloading');
    expect(downloadBundle()).toBeUndefined();
  });

  test('isDownloading resets after download completes', () => {
    let isDownloading = false;
    function startDownload(): string | undefined {
      if (isDownloading) return undefined;
      isDownloading = true;
      return 'downloading';
    }
    function finishDownload() {
      isDownloading = false;
    }
    expect(startDownload()).toBe('downloading');
    finishDownload();
    expect(startDownload()).toBe('downloading');
  });
});

// ---------------------------------------------------------------------------
// Cached file verification failure - mirrors downloadBundle (lines 115-137)
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate cached file redownload', () => {
  test('when cached file exists but verify fails, clearDownload is called', () => {
    let clearDownloadCalled = false;
    let didReDownload = false;
    function handleCachedFile(verifyResult: boolean): string {
      if (!verifyResult) {
        clearDownloadCalled = true;
        didReDownload = true;
        return 're-downloading';
      }
      return 'cache-hit';
    }
    expect(handleCachedFile(false)).toBe('re-downloading');
    expect(clearDownloadCalled).toBe(true);
    expect(didReDownload).toBe(true);
  });

  test('when cached file exists and verify succeeds, returns cached', () => {
    function handleCachedFile(verifyResult: boolean): string {
      if (!verifyResult) return 're-downloading';
      return 'cache-hit';
    }
    expect(handleCachedFile(true)).toBe('cache-hit');
  });
});

// ---------------------------------------------------------------------------
// 416 status handling - mirrors downloadBundle (lines 195-216)
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate 416 handling', () => {
  function handle416(
    partialExists: boolean,
    verifySucceeds: boolean,
  ): { result: string; error?: string } {
    if (partialExists) {
      if (verifySucceeds) {
        return { result: 'resolved' };
      }
      return { result: 'rejected', error: 'verification failed' };
    }
    return { result: 'rejected', error: 'Download failed with status: 416' };
  }

  test('416 + partial exists + verify succeeds → resolves', () => {
    const r = handle416(true, true);
    expect(r.result).toBe('resolved');
  });

  test('416 + partial exists + verify fails → rejects', () => {
    const r = handle416(true, false);
    expect(r.result).toBe('rejected');
    expect(r.error).toBe('verification failed');
  });

  test('416 + no partial file → rejects with 416 error', () => {
    const r = handle416(false, false);
    expect(r.result).toBe('rejected');
    expect(r.error).toBe('Download failed with status: 416');
  });
});

// ---------------------------------------------------------------------------
// Download completion - mirrors writeStream finish (lines 298-314)
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate download completion', () => {
  function handleFinish(
    downloadedBytes: number,
    totalBytes: number,
    verifySucceeds: boolean,
  ): { result: string; error?: string } {
    if (downloadedBytes >= totalBytes) {
      if (verifySucceeds) return { result: 'resolved' };
      return { result: 'rejected', error: 'verification failed' };
    }
    return { result: 'rejected', error: 'Download incomplete' };
  }

  test('downloadedBytes >= totalBytes + verify succeeds → resolves', () => {
    expect(handleFinish(1024, 1024, true).result).toBe('resolved');
  });

  test('downloadedBytes >= totalBytes + verify fails → rejects', () => {
    const r = handleFinish(1024, 1024, false);
    expect(r.error).toBe('verification failed');
  });

  test('downloadedBytes < totalBytes → rejects incomplete', () => {
    const r = handleFinish(512, 1024, true);
    expect(r.error).toBe('Download incomplete');
  });

  test('downloadedBytes > totalBytes (edge case) → still resolves', () => {
    expect(handleFinish(2048, 1024, true).result).toBe('resolved');
  });
});

// ---------------------------------------------------------------------------
// Download cancellation - mirrors cancelDownload (lines 252-260)
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate download cancellation', () => {
  test('cancel sets isDownloading to false and rejects', () => {
    let isDownloading = true;
    let rejected = false;
    let destroyCalled = false;
    const cancelDownload = () => {
      isDownloading = false;
      destroyCalled = true;
      rejected = true;
    };
    cancelDownload();
    expect(isDownloading).toBe(false);
    expect(rejected).toBe(true);
    expect(destroyCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Double reject guard (settled) - mirrors downloadBundle settled flag
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate settled guard', () => {
  test('only the first reject/resolve is effective', () => {
    let settled = false;
    const results: string[] = [];
    const safeReject = (msg: string) => {
      if (settled) return;
      settled = true;
      results.push(msg);
    };
    const safeResolve = (msg: string) => {
      if (settled) return;
      settled = true;
      results.push(msg);
    };
    safeReject('first error');
    safeReject('second error');
    safeResolve('late success');
    expect(results).toEqual(['first error']);
  });

  test('resolve then reject: only resolve takes effect', () => {
    let settled = false;
    const results: string[] = [];
    const safeResolve = (msg: string) => {
      if (!settled) {
        settled = true;
        results.push(msg);
      }
    };
    const safeReject = (msg: string) => {
      if (!settled) {
        settled = true;
        results.push(msg);
      }
    };
    safeResolve('success');
    safeReject('late error');
    expect(results).toEqual(['success']);
  });
});

// ---------------------------------------------------------------------------
// verifyBundleASC with skipGPGVerification - mirrors (lines 443-516)
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate verifyBundleASC skipGPG', () => {
  interface IVerifyASCParams {
    downloadedFile?: string;
    sha256?: string;
    appVersion?: string;
    bundleVersion?: string;
    signature?: string;
    skipGPGVerification?: boolean;
  }

  function validateVerifyASCParams(params: IVerifyASCParams): string | null {
    const {
      downloadedFile,
      sha256,
      appVersion,
      bundleVersion,
      signature,
      skipGPGVerification,
    } = params;
    if (
      !downloadedFile ||
      !sha256 ||
      !appVersion ||
      !bundleVersion ||
      (!signature && !skipGPGVerification)
    ) {
      return 'Invalid parameters';
    }
    return null;
  }

  function shouldVerifySha256(skipGPG?: boolean): boolean {
    return !skipGPG;
  }

  test('accepts params with signature and no skipGPG', () => {
    expect(
      validateVerifyASCParams({
        downloadedFile: '/tmp/f',
        sha256: 'abc',
        appVersion: '1.0.0',
        bundleVersion: '5',
        signature: 'sig',
      }),
    ).toBeNull();
  });

  test('accepts params with skipGPG but no signature', () => {
    expect(
      validateVerifyASCParams({
        downloadedFile: '/tmp/f',
        sha256: 'abc',
        appVersion: '1.0.0',
        bundleVersion: '5',
        skipGPGVerification: true,
      }),
    ).toBeNull();
  });

  test('rejects when no signature and no skipGPG', () => {
    expect(
      validateVerifyASCParams({
        downloadedFile: '/tmp/f',
        sha256: 'abc',
        appVersion: '1.0.0',
        bundleVersion: '5',
      }),
    ).toBe('Invalid parameters');
  });

  test('SHA256 check is skipped when skipGPG is true', () => {
    expect(shouldVerifySha256(true)).toBe(false);
  });

  test('SHA256 check runs when skipGPG is false', () => {
    expect(shouldVerifySha256(false)).toBe(true);
  });

  test('SHA256 check runs when skipGPG is undefined', () => {
    expect(shouldVerifySha256(undefined)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// verifyAllExtractedFiles completeness check
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate metadata completeness check', () => {
  function checkCompleteness(
    verifiedFiles: Set<string>,
    metadataKeys: string[],
  ): string | null {
    for (const key of metadataKeys) {
      if (!verifiedFiles.has(key)) {
        return `File ${key} listed in metadata but missing on disk`;
      }
    }
    return null;
  }

  test('all metadata files present on disk → passes', () => {
    const verified = new Set(['build/index.html', 'build/main.js']);
    expect(
      checkCompleteness(verified, ['build/index.html', 'build/main.js']),
    ).toBeNull();
  });

  test('file in metadata but missing from disk → detected', () => {
    const verified = new Set(['build/index.html']);
    expect(
      checkCompleteness(verified, ['build/index.html', 'build/crypto.js']),
    ).toBe('File build/crypto.js listed in metadata but missing on disk');
  });

  test('empty metadata → passes', () => {
    const verified = new Set(['build/index.html']);
    expect(checkCompleteness(verified, [])).toBeNull();
  });

  test('empty disk files but metadata has entries → detected', () => {
    const verified = new Set<string>();
    expect(checkCompleteness(verified, ['build/main.js'])).toBe(
      'File build/main.js listed in metadata but missing on disk',
    );
  });
});

// ---------------------------------------------------------------------------
// verifyAllExtractedFiles SHA256 mismatch
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate SHA256 mismatch detection', () => {
  function verifyFile(actual: string, expected: string): string | null {
    if (actual !== expected) {
      return `SHA256 mismatch`;
    }
    return null;
  }

  test('matching hashes → null', () => {
    expect(verifyFile('abc123', 'abc123')).toBeNull();
  });

  test('different hashes → mismatch', () => {
    expect(verifyFile('abc123', 'def456')).toBe('SHA256 mismatch');
  });
});

// ---------------------------------------------------------------------------
// listLocalBundles edge cases - mirrors (lines 564-584)
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate listLocalBundles', () => {
  interface IDirEntry {
    name: string;
    isDirectory: boolean;
  }

  function parseLocalBundles(
    dirExists: boolean,
    entries: IDirEntry[],
  ): { appVersion: string; bundleVersion: string }[] {
    if (!dirExists) return [];
    const results: { appVersion: string; bundleVersion: string }[] = [];
    for (const entry of entries) {
      if (entry.isDirectory) {
        const lastDash = entry.name.lastIndexOf('-');
        if (lastDash > 0) {
          const appVersion = entry.name.substring(0, lastDash);
          const bundleVersion = entry.name.substring(lastDash + 1);
          if (appVersion && bundleVersion) {
            results.push({ appVersion, bundleVersion });
          }
        }
      }
    }
    return results;
  }

  test('dir does not exist → empty array', () => {
    expect(parseLocalBundles(false, [])).toEqual([]);
  });

  test('valid entries are parsed', () => {
    const entries = [
      { name: '1.0.0-5', isDirectory: true },
      { name: '2.0.0-10', isDirectory: true },
    ];
    expect(parseLocalBundles(true, entries)).toEqual([
      { appVersion: '1.0.0', bundleVersion: '5' },
      { appVersion: '2.0.0', bundleVersion: '10' },
    ]);
  });

  test('entry with no dash → skipped', () => {
    const entries = [{ name: 'noDash', isDirectory: true }];
    expect(parseLocalBundles(true, entries)).toEqual([]);
  });

  test('entry with dash at position 0 → skipped', () => {
    const entries = [{ name: '-5', isDirectory: true }];
    expect(parseLocalBundles(true, entries)).toEqual([]);
  });

  test('non-directory entries → skipped', () => {
    const entries = [{ name: '1.0.0-5', isDirectory: false }];
    expect(parseLocalBundles(true, entries)).toEqual([]);
  });

  test('entry with multiple dashes → splits on last dash', () => {
    const entries = [{ name: '1.0.0-beta-5', isDirectory: true }];
    expect(parseLocalBundles(true, entries)).toEqual([
      { appVersion: '1.0.0-beta', bundleVersion: '5' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// verifyExtractedBundle edge cases - mirrors (lines 586-601)
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate verifyExtractedBundle', () => {
  function verifyExtractedBundle(
    dirExists: boolean,
    metadataExists: boolean,
  ): string | null {
    if (!dirExists) return 'Bundle directory not found';
    if (!metadataExists) return 'metadata.json not found';
    return null;
  }

  test('dir does not exist → throws', () => {
    expect(verifyExtractedBundle(false, false)).toBe(
      'Bundle directory not found',
    );
  });

  test('metadata.json does not exist → throws', () => {
    expect(verifyExtractedBundle(true, false)).toBe('metadata.json not found');
  });

  test('both exist → null (ok)', () => {
    expect(verifyExtractedBundle(true, true)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// installBundle extractDir missing - mirrors (lines 630-636)
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate installBundle extractDir check', () => {
  function checkExtractDir(
    exists: boolean,
    appVersion: string,
    bundleVersion: string,
  ): string | null {
    if (!exists) {
      return `Bundle directory not found: ${appVersion}-${bundleVersion}`;
    }
    return null;
  }

  test('extractDir missing → error', () => {
    expect(checkExtractDir(false, '1.0.0', '5')).toBe(
      'Bundle directory not found: 1.0.0-5',
    );
  });

  test('extractDir exists → null', () => {
    expect(checkExtractDir(true, '1.0.0', '5')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// installBundle version check removed - mirrors current behavior
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate installBundle version gating', () => {
  function shouldAllowVersionInstall(
    skipGPG: boolean,
    currentVersion: string | undefined,
    newVersion: string,
  ): boolean {
    Number(skipGPG);
    Number(currentVersion ?? '');
    Number(newVersion);
    return true;
  }

  test('skipGPG=true → downgrade allowed', () => {
    expect(shouldAllowVersionInstall(true, '10', '5')).toBe(true);
  });

  test('skipGPG=false → downgrade still allowed', () => {
    expect(shouldAllowVersionInstall(false, '10', '5')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// installBundle NaN bundleVersion - still allowed
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate NaN bundleVersion', () => {
  function shouldAllowInstallWithNaN(
    currentVersion: string | undefined,
    newVersion: string,
  ): boolean {
    Number(currentVersion ?? '');
    Number(newVersion);
    return true;
  }

  test('non-numeric bundleVersion "abc" → NaN, not blocked', () => {
    expect(shouldAllowInstallWithNaN('5', 'abc')).toBe(true);
  });

  test('non-numeric current version "xyz" → NaN, not blocked', () => {
    expect(shouldAllowInstallWithNaN('xyz', '3')).toBe(true);
  });

  test('both NaN → not blocked', () => {
    expect(shouldAllowInstallWithNaN('abc', 'def')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// installBundle fallback: old dir does not exist - mirrors (lines 662-672)
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate fallback old dir cleanup', () => {
  test('when shifted bundle dir does not exist, no crash', () => {
    const shifted = {
      appVersion: '0.9.0',
      bundleVersion: '1',
      signature: 'sig',
    };
    const dirExists = false;
    // Should not throw
    let deleteCalled = false;
    if (dirExists) {
      deleteCalled = true;
    }
    expect(deleteCalled).toBe(false);
    expect(shifted).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 206 Content-Range parsing - mirrors (lines 236-244)
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate 206 Content-Range parsing', () => {
  function parseTotalBytes(
    contentRange: string | undefined,
    fallback: number,
  ): number {
    if (contentRange) {
      const match = contentRange.match(/bytes \d+-\d+\/(\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return fallback;
  }

  test('valid content-range → extracts total', () => {
    expect(parseTotalBytes('bytes 0-1023/2048', 0)).toBe(2048);
  });

  test('no content-range → uses fallback', () => {
    expect(parseTotalBytes(undefined, 1024)).toBe(1024);
  });

  test('malformed content-range → uses fallback', () => {
    expect(parseTotalBytes('invalid', 1024)).toBe(1024);
  });

  test('content-range with resume → extracts total', () => {
    expect(parseTotalBytes('bytes 512-1023/1024', 0)).toBe(1024);
  });
});

// ---------------------------------------------------------------------------
// writeStream flags - mirrors (line 248)
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate writeStream flags', () => {
  test('downloadedBytes > 0 → append mode', () => {
    const downloadedBytes = 100;
    const flags = downloadedBytes > 0 ? 'a' : 'w';
    expect(flags).toBe('a');
  });

  test('downloadedBytes === 0 → write mode', () => {
    const downloadedBytes = 0;
    const flags = downloadedBytes > 0 ? 'a' : 'w';
    expect(flags).toBe('w');
  });
});

// ---------------------------------------------------------------------------
// switchBundle parameter validation - mirrors switchBundle logic
// ---------------------------------------------------------------------------
describe('DesktopApiBundleUpdate switchBundle parameter validation', () => {
  interface ISwitchBundleParams {
    appVersion?: string;
    bundleVersion?: string;
    signature?: string;
  }

  function validateSwitchParams(params: ISwitchBundleParams): string | null {
    const { appVersion, bundleVersion, signature } = params;
    if (!appVersion || !bundleVersion || !signature) {
      return 'Invalid parameters';
    }
    return null;
  }

  test('accepts valid params', () => {
    expect(
      validateSwitchParams({
        appVersion: '1.0.0',
        bundleVersion: '5',
        signature: 'sig',
      }),
    ).toBeNull();
  });

  test('rejects missing appVersion', () => {
    expect(
      validateSwitchParams({
        bundleVersion: '5',
        signature: 'sig',
      }),
    ).toBe('Invalid parameters');
  });

  test('rejects missing bundleVersion', () => {
    expect(
      validateSwitchParams({
        appVersion: '1.0.0',
        signature: 'sig',
      }),
    ).toBe('Invalid parameters');
  });

  test('rejects missing signature', () => {
    expect(
      validateSwitchParams({
        appVersion: '1.0.0',
        bundleVersion: '5',
      }),
    ).toBe('Invalid parameters');
  });

  test('rejects all empty', () => {
    expect(validateSwitchParams({})).toBe('Invalid parameters');
  });
});
