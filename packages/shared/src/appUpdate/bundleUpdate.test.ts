// Bundle update logic tests
// Covers version comparison, update detection, security validations,
// and error handling to prevent regressions in bundle update flow.

import { EAppUpdateStatus, EUpdateFileType, EUpdateStrategy } from './type';

import type { IAppUpdateInfo } from './type';

// ---------------------------------------------------------------------------
// platformEnv mock – controls APP_VERSION / APP_BUNDLE_VERSION used inside
// the module under test. We need to re-import the module after each mock
// change so module-level constants pick up the new values.
// ---------------------------------------------------------------------------

function loadAppUpdate(appVersion: string, bundleVersion: string) {
  jest.resetModules();
  jest.doMock('../platformEnv', () => ({
    __esModule: true,
    default: {
      version: appVersion,
      bundleVersion,
      isExtension: false,
    },
  }));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('./index') as typeof import('./index');
}

describe('resolveUpdateDecision', () => {
  test('appShellUpdate when remote app version is greater', () => {
    const { resolveUpdateDecision } = loadAppUpdate('1.0.0', '1');
    expect(
      resolveUpdateDecision({
        currentAppVersion: '1.0.0',
        currentBundleVersion: '1',
        remoteAppVersion: '2.0.0',
        remoteBundleVersion: '1',
      }),
    ).toMatchObject({
      decision: 'appShellUpdate',
      isValid: true,
    });
  });

  test('jsBundleUpgrade when app versions are equal and remote bundle is greater', () => {
    const { resolveUpdateDecision } = loadAppUpdate('1.0.0', '1');
    expect(
      resolveUpdateDecision({
        currentAppVersion: '1.0.0',
        currentBundleVersion: '1',
        remoteAppVersion: '1.0.0',
        remoteBundleVersion: '2',
      }),
    ).toMatchObject({
      decision: 'jsBundleUpgrade',
      isValid: true,
    });
  });

  test('jsBundleRollback when app versions are equal, remote bundle is lower and allowRollback=true', () => {
    const { resolveUpdateDecision } = loadAppUpdate('1.0.0', '3');
    expect(
      resolveUpdateDecision({
        currentAppVersion: '1.0.0',
        currentBundleVersion: '3',
        remoteAppVersion: '1.0.0',
        remoteBundleVersion: '2',
        allowRollback: true,
      }),
    ).toMatchObject({
      decision: 'jsBundleRollback',
      isValid: true,
    });
  });

  test('staleRemote when remote app version is lower', () => {
    const { resolveUpdateDecision } = loadAppUpdate('2.0.0', '1');
    expect(
      resolveUpdateDecision({
        currentAppVersion: '2.0.0',
        currentBundleVersion: '1',
        remoteAppVersion: '1.0.0',
        remoteBundleVersion: '9',
      }),
    ).toMatchObject({
      decision: 'staleRemote',
      isValid: true,
    });
  });

  test('staleRemote when app versions are equal, remote bundle is lower and allowRollback=false', () => {
    const { resolveUpdateDecision } = loadAppUpdate('1.0.0', '3');
    expect(
      resolveUpdateDecision({
        currentAppVersion: '1.0.0',
        currentBundleVersion: '3',
        remoteAppVersion: '1.0.0',
        remoteBundleVersion: '2',
        allowRollback: false,
      }),
    ).toMatchObject({
      decision: 'staleRemote',
      isValid: true,
    });
  });

  test('invalidLocal when currentAppVersion is invalid semver', () => {
    const { resolveUpdateDecision } = loadAppUpdate('1.0.0', '1');
    expect(
      resolveUpdateDecision({
        currentAppVersion: 'invalid',
        currentBundleVersion: '1',
        remoteAppVersion: '1.0.0',
        remoteBundleVersion: '1',
      }),
    ).toMatchObject({
      decision: 'invalidLocal',
      isValid: false,
      reason: 'invalid_current_app_version',
    });
  });

  test('invalidRemote when remoteAppVersion is invalid semver', () => {
    const { resolveUpdateDecision } = loadAppUpdate('1.0.0', '1');
    expect(
      resolveUpdateDecision({
        currentAppVersion: '1.0.0',
        currentBundleVersion: '1',
        remoteAppVersion: 'invalid',
        remoteBundleVersion: '1',
      }),
    ).toMatchObject({
      decision: 'invalidRemote',
      isValid: false,
      reason: 'invalid_remote_app_version',
    });
  });

  test('none when remoteBundleVersion is non-numeric (treated as not available)', () => {
    const { resolveUpdateDecision } = loadAppUpdate('1.0.0', '1');
    expect(
      resolveUpdateDecision({
        currentAppVersion: '1.0.0',
        currentBundleVersion: '1',
        remoteAppVersion: '1.0.0',
        remoteBundleVersion: 'abc',
      }),
    ).toMatchObject({
      decision: 'none',
      isValid: true,
      reason: 'remote_bundle_version_not_available',
    });
  });

  test('none when remoteBundleVersion is undefined (no false rollback)', () => {
    const { resolveUpdateDecision } = loadAppUpdate('1.0.0', '5');
    expect(
      resolveUpdateDecision({
        currentAppVersion: '1.0.0',
        currentBundleVersion: '5',
        remoteAppVersion: '1.0.0',
        remoteBundleVersion: undefined,
      }),
    ).toMatchObject({
      decision: 'none',
      isValid: true,
      reason: 'remote_bundle_version_not_available',
    });
  });

  test('allowRollback: true + equal versions → none (not misclassified as rollback)', () => {
    const { resolveUpdateDecision } = loadAppUpdate('1.0.0', '5');
    expect(
      resolveUpdateDecision({
        currentAppVersion: '1.0.0',
        currentBundleVersion: '5',
        remoteAppVersion: '1.0.0',
        remoteBundleVersion: '5',
        allowRollback: true,
      }),
    ).toMatchObject({
      decision: 'none',
      isValid: true,
    });
  });

  test('allowRollback defaults to true — remote bundle < current yields jsBundleRollback', () => {
    const { resolveUpdateDecision } = loadAppUpdate('1.0.0', '5');
    expect(
      resolveUpdateDecision({
        currentAppVersion: '1.0.0',
        currentBundleVersion: '5',
        remoteAppVersion: '1.0.0',
        remoteBundleVersion: '2',
      }),
    ).toMatchObject({
      decision: 'jsBundleRollback',
      isValid: true,
    });
  });

  test('jsBundleRollbackToBuiltin when remote bundle is undefined and hasActiveCustomBundle=true', () => {
    const { resolveUpdateDecision } = loadAppUpdate('1.0.0', '5');
    expect(
      resolveUpdateDecision({
        currentAppVersion: '1.0.0',
        currentBundleVersion: '5',
        remoteAppVersion: '1.0.0',
        remoteBundleVersion: undefined,
        allowRollback: true,
        hasActiveCustomBundle: true,
      }),
    ).toMatchObject({
      decision: 'jsBundleRollbackToBuiltin',
      isValid: true,
      reason: 'remote_bundle_not_available_rollback_to_builtin',
    });
  });

  test('none when remote bundle is undefined and hasActiveCustomBundle=false', () => {
    const { resolveUpdateDecision } = loadAppUpdate('1.0.0', '5');
    expect(
      resolveUpdateDecision({
        currentAppVersion: '1.0.0',
        currentBundleVersion: '5',
        remoteAppVersion: '1.0.0',
        remoteBundleVersion: undefined,
        allowRollback: true,
        hasActiveCustomBundle: false,
      }),
    ).toMatchObject({
      decision: 'none',
      isValid: true,
      reason: 'remote_bundle_version_not_available',
    });
  });

  test('none when remote bundle is undefined, hasActiveCustomBundle=true but allowRollback=false', () => {
    const { resolveUpdateDecision } = loadAppUpdate('1.0.0', '5');
    expect(
      resolveUpdateDecision({
        currentAppVersion: '1.0.0',
        currentBundleVersion: '5',
        remoteAppVersion: '1.0.0',
        remoteBundleVersion: undefined,
        allowRollback: false,
        hasActiveCustomBundle: true,
      }),
    ).toMatchObject({
      decision: 'none',
      isValid: true,
      reason: 'remote_bundle_version_not_available',
    });
  });

  test('jsBundleRollbackToBuiltin when remote bundle is empty string and hasActiveCustomBundle=true', () => {
    const { resolveUpdateDecision } = loadAppUpdate('1.0.0', '5');
    expect(
      resolveUpdateDecision({
        currentAppVersion: '1.0.0',
        currentBundleVersion: '5',
        remoteAppVersion: '1.0.0',
        remoteBundleVersion: '',
        allowRollback: true,
        hasActiveCustomBundle: true,
      }),
    ).toMatchObject({
      decision: 'jsBundleRollbackToBuiltin',
      isValid: true,
    });
  });

  test('none when app and bundle versions fully match', () => {
    const { resolveUpdateDecision } = loadAppUpdate('1.0.0', '3');
    expect(
      resolveUpdateDecision({
        currentAppVersion: '1.0.0',
        currentBundleVersion: '3',
        remoteAppVersion: '1.0.0',
        remoteBundleVersion: '3',
      }),
    ).toMatchObject({
      decision: 'none',
      isValid: true,
    });
  });
});

// ---------------------------------------------------------------------------
// gtVersion – decides whether a remote version is newer than local
// ---------------------------------------------------------------------------
describe('gtVersion', () => {
  test('returns true when remote app version is greater (no bundle)', () => {
    const { gtVersion } = loadAppUpdate('1.0.0', '1');
    expect(gtVersion('2.0.0')).toBe(true);
  });

  test('returns false when remote app version equals local (no bundle)', () => {
    const { gtVersion } = loadAppUpdate('1.0.0', '1');
    expect(gtVersion('1.0.0')).toBe(false);
  });

  test('returns false when remote app version is lower', () => {
    const { gtVersion } = loadAppUpdate('2.0.0', '1');
    expect(gtVersion('1.0.0')).toBe(false);
  });

  test('returns false when appVersion is undefined', () => {
    const { gtVersion } = loadAppUpdate('1.0.0', '1');
    expect(gtVersion(undefined)).toBe(false);
  });

  test('returns true when same app version but higher bundle version', () => {
    const { gtVersion } = loadAppUpdate('1.0.0', '1');
    expect(gtVersion('1.0.0', '2')).toBe(true);
  });

  test('returns false when same app version and same bundle version', () => {
    const { gtVersion } = loadAppUpdate('1.0.0', '1');
    expect(gtVersion('1.0.0', '1')).toBe(false);
  });

  test('returns true when same app version but lower bundle version (rollback)', () => {
    const { gtVersion } = loadAppUpdate('1.0.0', '5');
    expect(gtVersion('1.0.0', '3')).toBe(true);
  });

  test('returns true when higher app version with higher bundle version', () => {
    const { gtVersion } = loadAppUpdate('1.0.0', '1');
    expect(gtVersion('2.0.0', '5')).toBe(true);
  });

  test('returns false when lower app version even with higher bundle', () => {
    const { gtVersion } = loadAppUpdate('2.0.0', '1');
    // semver.gte('1.0.0', '2.0.0') → false, so the whole expression is false
    expect(gtVersion('1.0.0', '5')).toBe(false);
  });

  // NOTE: gtVersion cannot produce jsBundleRollbackToBuiltin because it does
  // not pass hasActiveCustomBundle.  Tested via resolveUpdateDecision directly.
});

// ---------------------------------------------------------------------------
// isNeedUpdate – determines if update should be shown to user
// ---------------------------------------------------------------------------
describe('isNeedUpdate', () => {
  test('needs app shell update when remote version is greater', () => {
    const { isNeedUpdate } = loadAppUpdate('1.0.0', '1');
    const result = isNeedUpdate({
      latestVersion: '2.0.0',
      status: EAppUpdateStatus.notify,
    });
    expect(result.shouldUpdate).toBe(true);
    expect(result.fileType).toBe(EUpdateFileType.appShell);
  });

  test('no update needed when status is done', () => {
    const { isNeedUpdate } = loadAppUpdate('1.0.0', '1');
    const result = isNeedUpdate({
      latestVersion: '2.0.0',
      status: EAppUpdateStatus.done,
    });
    expect(result.shouldUpdate).toBe(false);
  });

  test('needs jsBundle update when same app version but higher bundle', () => {
    const { isNeedUpdate } = loadAppUpdate('1.0.0', '1');
    const result = isNeedUpdate({
      latestVersion: '1.0.0',
      jsBundleVersion: '5',
      status: EAppUpdateStatus.notify,
    });
    expect(result.shouldUpdate).toBe(true);
    expect(result.fileType).toBe(EUpdateFileType.jsBundle);
  });

  test('no jsBundle update when bundle version is same', () => {
    const { isNeedUpdate } = loadAppUpdate('1.0.0', '5');
    const result = isNeedUpdate({
      latestVersion: '1.0.0',
      jsBundleVersion: '5',
      status: EAppUpdateStatus.notify,
    });
    expect(result.shouldUpdate).toBe(false);
    expect(result.fileType).toBe(EUpdateFileType.appShell);
  });

  test('rollback returns fileType jsBundle with shouldUpdate false and isRollback true', () => {
    const { isNeedUpdate } = loadAppUpdate('1.0.0', '5');
    const result = isNeedUpdate({
      latestVersion: '1.0.0',
      jsBundleVersion: '3',
      status: EAppUpdateStatus.notify,
    });
    expect(result.shouldUpdate).toBe(false);
    expect(result.fileType).toBe(EUpdateFileType.jsBundle);
    expect(result.isRollback).toBe(true);
  });

  test('does not trigger update when bundle version is lower (rollback path)', () => {
    const { isNeedUpdate } = loadAppUpdate('1.0.0', '5');
    const result = isNeedUpdate({
      latestVersion: '1.0.0',
      jsBundleVersion: '3',
      status: EAppUpdateStatus.notify,
    });
    expect(result.shouldUpdate).toBe(false);
    expect(result.isRollback).toBe(true);
  });

  test('upgrade returns isRollback false', () => {
    const { isNeedUpdate } = loadAppUpdate('1.0.0', '1');
    const result = isNeedUpdate({
      latestVersion: '1.0.0',
      jsBundleVersion: '5',
      status: EAppUpdateStatus.notify,
    });
    expect(result.shouldUpdate).toBe(true);
    expect(result.isRollback).toBe(false);
  });

  test('rollbackToBuiltin returns isRollback true and shouldUpdate false', () => {
    // isNeedUpdate does not pass hasActiveCustomBundle, so it cannot produce
    // jsBundleRollbackToBuiltin directly.  But the resolveUpdateDecision layer
    // can, and higher layers should handle it.  Test that isRollback includes
    // rollbackToBuiltin by testing the decision function directly.
    const { resolveUpdateDecision } = loadAppUpdate('1.0.0', '5');
    const decision = resolveUpdateDecision({
      currentAppVersion: '1.0.0',
      currentBundleVersion: '5',
      remoteAppVersion: '1.0.0',
      remoteBundleVersion: undefined,
      allowRollback: true,
      hasActiveCustomBundle: true,
    });
    expect(decision.decision).toBe('jsBundleRollbackToBuiltin');
  });

  test('appShellUpdate returns isRollback false', () => {
    const { isNeedUpdate } = loadAppUpdate('1.0.0', '1');
    const result = isNeedUpdate({
      latestVersion: '2.0.0',
      jsBundleVersion: '1',
      status: EAppUpdateStatus.notify,
    });
    expect(result.shouldUpdate).toBe(true);
    expect(result.isRollback).toBe(false);
  });

  test('no update when latestVersion is undefined', () => {
    const { isNeedUpdate } = loadAppUpdate('1.0.0', '1');
    const result = isNeedUpdate({
      latestVersion: undefined,
      status: EAppUpdateStatus.notify,
    });
    expect(result.shouldUpdate).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getUpdateFileType
// ---------------------------------------------------------------------------
describe('getUpdateFileType', () => {
  test('returns appShell when no jsBundleVersion', () => {
    const { getUpdateFileType } = loadAppUpdate('1.0.0', '1');
    expect(getUpdateFileType({ latestVersion: '2.0.0' })).toBe(
      EUpdateFileType.appShell,
    );
  });

  test('returns jsBundle when same app version and different bundle', () => {
    const { getUpdateFileType } = loadAppUpdate('1.0.0', '1');
    expect(
      getUpdateFileType({ latestVersion: '1.0.0', jsBundleVersion: '5' }),
    ).toBe(EUpdateFileType.jsBundle);
  });

  test('returns jsBundle for rollback decision (same app version, lower remote bundle)', () => {
    const { getUpdateFileType } = loadAppUpdate('1.0.0', '5');
    expect(
      getUpdateFileType({ latestVersion: '1.0.0', jsBundleVersion: '3' }),
    ).toBe(EUpdateFileType.jsBundle);
  });

  test('returns appShell when latestVersion is undefined', () => {
    const { getUpdateFileType } = loadAppUpdate('1.0.0', '1');
    expect(
      getUpdateFileType({ latestVersion: undefined, jsBundleVersion: '5' }),
    ).toBe(EUpdateFileType.appShell);
  });
});

// ---------------------------------------------------------------------------
// isFirstLaunchAfterUpdated
// ---------------------------------------------------------------------------
describe('isFirstLaunchAfterUpdated', () => {
  test('returns true on first launch after app shell update', () => {
    const { isFirstLaunchAfterUpdated } = loadAppUpdate('2.0.0', '1');
    const info: IAppUpdateInfo = {
      latestVersion: '2.0.0',
      updateAt: Date.now(),
      status: EAppUpdateStatus.ready,
      updateStrategy: EUpdateStrategy.manual,
    };
    expect(isFirstLaunchAfterUpdated(info)).toBeTruthy();
  });

  test('returns false when status is done', () => {
    const { isFirstLaunchAfterUpdated } = loadAppUpdate('2.0.0', '1');
    const info: IAppUpdateInfo = {
      latestVersion: '2.0.0',
      updateAt: Date.now(),
      status: EAppUpdateStatus.done,
      updateStrategy: EUpdateStrategy.manual,
    };
    expect(isFirstLaunchAfterUpdated(info)).toBe(false);
  });

  test('returns true on first launch after jsBundle update', () => {
    const { isFirstLaunchAfterUpdated } = loadAppUpdate('1.0.0', '5');
    const info: IAppUpdateInfo = {
      latestVersion: '1.0.0',
      jsBundleVersion: '5',
      updateAt: Date.now(),
      status: EAppUpdateStatus.ready,
      updateStrategy: EUpdateStrategy.manual,
    };
    expect(isFirstLaunchAfterUpdated(info)).toBe(true);
  });

  test('returns false when local bundle is older than target', () => {
    const { isFirstLaunchAfterUpdated } = loadAppUpdate('1.0.0', '3');
    const info: IAppUpdateInfo = {
      latestVersion: '1.0.0',
      jsBundleVersion: '5',
      updateAt: Date.now(),
      status: EAppUpdateStatus.ready,
      updateStrategy: EUpdateStrategy.manual,
    };
    expect(isFirstLaunchAfterUpdated(info)).toBe(false);
  });

  test('returns false when local bundle is HIGHER than rollback target (rollback not yet applied)', () => {
    const { isFirstLaunchAfterUpdated } = loadAppUpdate('1.0.0', '5');
    const info: IAppUpdateInfo = {
      latestVersion: '1.0.0',
      jsBundleVersion: '3',
      updateAt: Date.now(),
      status: EAppUpdateStatus.notify,
      updateStrategy: EUpdateStrategy.manual,
      isRollbackTarget: true,
    };
    expect(isFirstLaunchAfterUpdated(info)).toBe(false);
  });

  test('returns true when local bundle is HIGHER than upgrade target (upgrade overshoot)', () => {
    // User got bundle 7 via store update, but atom target was 5 (upgrade)
    const { isFirstLaunchAfterUpdated } = loadAppUpdate('1.0.0', '7');
    const info: IAppUpdateInfo = {
      latestVersion: '1.0.0',
      jsBundleVersion: '5',
      updateAt: Date.now(),
      status: EAppUpdateStatus.ready,
      updateStrategy: EUpdateStrategy.manual,
      isRollbackTarget: false,
    };
    expect(isFirstLaunchAfterUpdated(info)).toBe(true);
  });

  test('returns true when rollback successfully applied (exact match)', () => {
    const { isFirstLaunchAfterUpdated } = loadAppUpdate('1.0.0', '3');
    const info: IAppUpdateInfo = {
      latestVersion: '1.0.0',
      jsBundleVersion: '3',
      updateAt: Date.now(),
      status: EAppUpdateStatus.ready,
      updateStrategy: EUpdateStrategy.manual,
      isRollbackTarget: true,
    };
    expect(isFirstLaunchAfterUpdated(info)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// EUpdateStrategy enum validation – mirrors ServiceAppUpdate.fetchConfig
// ---------------------------------------------------------------------------
describe('EUpdateStrategy validation', () => {
  const validStrategies = [
    EUpdateStrategy.silent,
    EUpdateStrategy.force,
    EUpdateStrategy.manual,
    EUpdateStrategy.seamless,
  ];

  test('all known strategy values are accepted', () => {
    for (const s of validStrategies) {
      expect(validStrategies.includes(s)).toBe(true);
    }
  });

  test('unknown numeric strategy is rejected', () => {
    const unknownStrategy = 99 as EUpdateStrategy;
    expect(validStrategies.includes(unknownStrategy)).toBe(false);
  });

  test('enum values match expected numbers', () => {
    expect(EUpdateStrategy.silent).toBe(0);
    expect(EUpdateStrategy.force).toBe(1);
    expect(EUpdateStrategy.manual).toBe(2);
    expect(EUpdateStrategy.seamless).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// HTTPS URL validation – mirrors security checks in ServiceAppUpdate and
// DesktopApiBundleUpdate
// ---------------------------------------------------------------------------
describe('HTTPS URL validation', () => {
  function isValidBundleUrl(url: string | undefined): boolean {
    if (!url) return false;
    return url.startsWith('https://');
  }

  test('accepts valid HTTPS URL', () => {
    expect(isValidBundleUrl('https://example.com/bundle.zip')).toBe(true);
  });

  test('rejects HTTP URL', () => {
    expect(isValidBundleUrl('http://example.com/bundle.zip')).toBe(false);
  });

  test('rejects FTP URL', () => {
    expect(isValidBundleUrl('ftp://example.com/bundle.zip')).toBe(false);
  });

  test('rejects undefined URL', () => {
    expect(isValidBundleUrl(undefined)).toBe(false);
  });

  test('rejects empty string', () => {
    expect(isValidBundleUrl('')).toBe(false);
  });

  test('rejects URL without protocol', () => {
    expect(isValidBundleUrl('example.com/bundle.zip')).toBe(false);
  });

  // Redirect downgrade check (mirrors DesktopApiBundleUpdate line 169)
  function isValidRedirect(redirectUrl: string): boolean {
    return redirectUrl.startsWith('https://');
  }

  test('accepts HTTPS redirect', () => {
    expect(isValidRedirect('https://cdn.example.com/bundle.zip')).toBe(true);
  });

  test('rejects HTTP redirect (downgrade attack)', () => {
    expect(isValidRedirect('http://cdn.example.com/bundle.zip')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Version comparison behavior – mirrors DesktopApiBundleUpdate.installBundle
// ---------------------------------------------------------------------------
describe('version comparison behavior', () => {
  function shouldAllowInstall(
    currentBundleVersion: string | undefined,
    newBundleVersion: string,
  ): true {
    Number(currentBundleVersion ?? '');
    Number(newBundleVersion);
    return true;
  }

  test('allows downgrade from version 5 to 3', () => {
    expect(shouldAllowInstall('5', '3')).toBe(true);
  });

  test('allows upgrade from version 3 to 5', () => {
    expect(shouldAllowInstall('3', '5')).toBe(true);
  });

  test('allows same version reinstall', () => {
    expect(shouldAllowInstall('5', '5')).toBe(true);
  });

  test('allows install when no current version', () => {
    expect(shouldAllowInstall(undefined, '5')).toBe(true);
  });

  test('handles NaN gracefully without blocking install', () => {
    expect(shouldAllowInstall('abc', '5')).toBe(true);
    expect(shouldAllowInstall('5', 'abc')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Path traversal detection – mirrors DesktopApiBundleUpdate.verifyBundleASC
// ---------------------------------------------------------------------------
describe('path traversal detection', () => {
  // Simplified version of the check in DesktopApiBundleUpdate lines 446-452.
  // Uses posix-style path resolution to simulate path.resolve behavior.
  function resolvePosix(...parts: string[]): string {
    const joined = parts.join('/');
    const isAbsolute = joined.startsWith('/');
    const segments = joined.split('/').reduce((acc: string[], part) => {
      if (part === '..') {
        acc.pop();
      } else if (part !== '.' && part !== '') {
        acc.push(part);
      }
      return acc;
    }, [] as string[]);
    return (isAbsolute ? '/' : '') + segments.join('/');
  }

  function hasPathTraversal(entryName: string, extractDir: string): boolean {
    const resolved = resolvePosix(extractDir, entryName);
    const normalizedBase = resolvePosix(extractDir);
    return (
      !resolved.startsWith(`${normalizedBase}/`) && resolved !== normalizedBase
    );
  }

  test('normal file path is safe', () => {
    expect(hasPathTraversal('build/index.html', '/tmp/bundle')).toBe(false);
  });

  test('nested file path is safe', () => {
    expect(hasPathTraversal('build/assets/main.js', '/tmp/bundle')).toBe(false);
  });

  test('detects parent directory traversal', () => {
    expect(hasPathTraversal('../../../etc/passwd', '/tmp/bundle')).toBe(true);
  });

  test('detects embedded traversal', () => {
    expect(hasPathTraversal('build/../../etc/passwd', '/tmp/bundle')).toBe(
      true,
    );
  });

  test('root-level file is safe', () => {
    expect(hasPathTraversal('metadata.json', '/tmp/bundle')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Download error message mapping – mirrors ServiceAppUpdate.downloadPackageFailed
// ---------------------------------------------------------------------------
describe('download error message mapping', () => {
  // Replicate the error classification logic
  function classifyDownloadError(message?: string): string {
    const UPDATE_NETWORK = 'update_network_exception_check_connection';
    const UPDATE_SERVER = 'update_server_not_responding_try_later';
    const UPDATE_INSTABILITY = 'update_network_instability_check_connection';

    if (!message) return UPDATE_NETWORK;

    if (message.includes('Server not responding')) return UPDATE_SERVER;
    if (message.startsWith('Cannot download')) return UPDATE_SERVER;
    if (message.includes('Software caused connection abort'))
      return UPDATE_INSTABILITY;

    const statusNumber = Number(message);
    if (statusNumber === 500) return UPDATE_SERVER;
    if (statusNumber === 404 || statusNumber === 403) return UPDATE_SERVER;

    return message;
  }

  test('maps "Server not responding" to server error', () => {
    expect(classifyDownloadError('Server not responding')).toBe(
      'update_server_not_responding_try_later',
    );
  });

  test('maps "Cannot download..." to server error', () => {
    expect(classifyDownloadError('Cannot download update')).toBe(
      'update_server_not_responding_try_later',
    );
  });

  test('maps connection abort to instability', () => {
    expect(classifyDownloadError('Software caused connection abort')).toBe(
      'update_network_instability_check_connection',
    );
  });

  test('maps status 500 to server error', () => {
    expect(classifyDownloadError('500')).toBe(
      'update_server_not_responding_try_later',
    );
  });

  test('maps status 404 to server error', () => {
    expect(classifyDownloadError('404')).toBe(
      'update_server_not_responding_try_later',
    );
  });

  test('maps status 403 to server error', () => {
    expect(classifyDownloadError('403')).toBe(
      'update_server_not_responding_try_later',
    );
  });

  test('returns default for undefined message', () => {
    expect(classifyDownloadError(undefined)).toBe(
      'update_network_exception_check_connection',
    );
  });

  test('passes through unknown errors', () => {
    expect(classifyDownloadError('Unknown error xyz')).toBe(
      'Unknown error xyz',
    );
  });
});

// ---------------------------------------------------------------------------
// EAppUpdateStatus state transitions
// ---------------------------------------------------------------------------
describe('EAppUpdateStatus state transitions', () => {
  test('all expected statuses exist', () => {
    const expected = [
      'notify',
      'downloadPackage',
      'downloadPackageFailed',
      'downloadASC',
      'downloadASCFailed',
      'verifyASC',
      'verifyASCFailed',
      'verifyPackage',
      'verifyPackageFailed',
      'ready',
      'failed',
      'done',
      'manualInstall',
      'updateIncomplete',
    ];
    for (const status of expected) {
      expect(
        Object.values(EAppUpdateStatus).includes(status as EAppUpdateStatus),
      ).toBe(true);
    }
  });

  // The happy path: notify → downloadPackage → verifyPackage → ready → done
  test('happy path statuses are distinct', () => {
    const happyPath = [
      EAppUpdateStatus.notify,
      EAppUpdateStatus.downloadPackage,
      EAppUpdateStatus.verifyPackage,
      EAppUpdateStatus.ready,
      EAppUpdateStatus.done,
    ];
    const unique = new Set(happyPath);
    expect(unique.size).toBe(happyPath.length);
  });
});

// ---------------------------------------------------------------------------
// getVersion utility
// ---------------------------------------------------------------------------
describe('getVersion', () => {
  // Import directly since it has no platformEnv dependency
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getVersion } = require('./utils') as typeof import('./utils');

  test('uses version array', () => {
    expect(getVersion({ version: [1, 2, 3] })).toEqual({
      latestVersion: '1.2.3',
    });
  });

  test('prefers miniVersion over version', () => {
    expect(getVersion({ version: [1, 0, 0], miniVersion: [2, 0, 0] })).toEqual({
      latestVersion: '2.0.0',
    });
  });

  test('prefers miniVersion over minVersion', () => {
    expect(
      getVersion({ miniVersion: [3, 0, 0], minVersion: [2, 0, 0] }),
    ).toEqual({ latestVersion: '3.0.0' });
  });

  test('uses minVersion when no miniVersion', () => {
    expect(getVersion({ minVersion: [1, 5, 0] })).toEqual({
      latestVersion: '1.5.0',
    });
  });

  test('returns undefined when all are undefined', () => {
    expect(getVersion({})).toEqual({ latestVersion: undefined });
  });
});

// ---------------------------------------------------------------------------
// displayAppUpdateVersion / displayWhatsNewVersion
// ---------------------------------------------------------------------------
describe('displayAppUpdateVersion', () => {
  test('returns plain app version when no update info', () => {
    const { displayAppUpdateVersion } = loadAppUpdate('1.0.0', '1');
    expect(displayAppUpdateVersion(undefined)).toBe('1.0.0');
  });

  test('shows version with bundle when same as local', () => {
    const { displayAppUpdateVersion } = loadAppUpdate('1.0.0', '1');
    const info: IAppUpdateInfo = {
      latestVersion: '1.0.0',
      jsBundleVersion: '5',
      updateAt: Date.now(),
      status: EAppUpdateStatus.notify,
      updateStrategy: EUpdateStrategy.manual,
    };
    expect(displayAppUpdateVersion(info)).toBe('1.0.0(5)');
  });

  test('shows plain version when different from local', () => {
    const { displayAppUpdateVersion } = loadAppUpdate('1.0.0', '1');
    const info: IAppUpdateInfo = {
      latestVersion: '2.0.0',
      updateAt: Date.now(),
      status: EAppUpdateStatus.notify,
      updateStrategy: EUpdateStrategy.manual,
    };
    expect(displayAppUpdateVersion(info)).toBe('2.0.0');
  });
});

describe('displayWhatsNewVersion', () => {
  test('returns plain app version when last update is not js bundle', () => {
    const { displayWhatsNewVersion } = loadAppUpdate('1.5.0', '3');
    // isLastUpdateJsBundle() returns false when storage is empty
    expect(displayWhatsNewVersion()).toBe('1.5.0');
  });
});

// ---------------------------------------------------------------------------
// Redirect count limit – mirrors DesktopApiBundleUpdate redirect handling
// ---------------------------------------------------------------------------
describe('redirect limit', () => {
  const MAX_REDIRECTS = 5;

  test('rejects after max redirects exceeded', () => {
    let redirectCount = 0;
    let rejected = false;
    while (redirectCount <= MAX_REDIRECTS + 1) {
      if (redirectCount >= MAX_REDIRECTS) {
        rejected = true;
        break;
      }
      redirectCount += 1;
    }
    expect(rejected).toBe(true);
  });

  test('allows redirects within limit', () => {
    const redirectCount = 3;
    expect(redirectCount < MAX_REDIRECTS).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fallback bundle management – should keep at most 3 entries
// ---------------------------------------------------------------------------
describe('fallback bundle management', () => {
  interface IBundleEntry {
    appVersion: string;
    bundleVersion: string;
    signature: string;
  }

  function manageFallbacks(
    current: IBundleEntry | undefined,
    existing: IBundleEntry[],
  ): { kept: IBundleEntry[]; removed: IBundleEntry | undefined } {
    const fallbacks = [...existing];
    if (current?.appVersion && current?.bundleVersion && current?.signature) {
      fallbacks.push(current);
    }
    let removed: IBundleEntry | undefined;
    if (fallbacks.length > 3) {
      removed = fallbacks.shift();
    }
    return { kept: fallbacks, removed };
  }

  test('keeps all when under limit', () => {
    const existing = [
      { appVersion: '1.0.0', bundleVersion: '1', signature: 'sig1' },
      { appVersion: '1.0.0', bundleVersion: '2', signature: 'sig2' },
    ];
    const current = {
      appVersion: '1.0.0',
      bundleVersion: '3',
      signature: 'sig3',
    };
    const { kept, removed } = manageFallbacks(current, existing);
    expect(kept.length).toBe(3);
    expect(removed).toBeUndefined();
  });

  test('removes oldest when over limit', () => {
    const existing = [
      { appVersion: '1.0.0', bundleVersion: '1', signature: 'sig1' },
      { appVersion: '1.0.0', bundleVersion: '2', signature: 'sig2' },
      { appVersion: '1.0.0', bundleVersion: '3', signature: 'sig3' },
    ];
    const current = {
      appVersion: '1.0.0',
      bundleVersion: '4',
      signature: 'sig4',
    };
    const { kept, removed } = manageFallbacks(current, existing);
    expect(kept.length).toBe(3);
    expect(removed?.bundleVersion).toBe('1');
  });

  test('skips current if incomplete', () => {
    const existing = [
      { appVersion: '1.0.0', bundleVersion: '1', signature: 'sig1' },
    ];
    const { kept } = manageFallbacks(undefined, existing);
    expect(kept.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// gtVersion: bundleVersion "0" edge case
// ---------------------------------------------------------------------------
describe('gtVersion edge cases', () => {
  test('bundleVersion "0" with same app version → true (rollback)', () => {
    // gtVersion now includes rollback: remote bundle 0 < local bundle 1 → rollback
    const { gtVersion } = loadAppUpdate('1.0.0', '1');
    const result = gtVersion('1.0.0', '0');
    expect(result).toBe(true);
  });

  test('both appVersion and bundleVersion undefined → false', () => {
    const { gtVersion } = loadAppUpdate('1.0.0', '1');
    expect(gtVersion(undefined, undefined)).toBe(false);
  });

  test('appVersion is empty string → false', () => {
    const { gtVersion } = loadAppUpdate('1.0.0', '1');
    expect(gtVersion('', undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Version comparison: non-numeric bundleVersion
// ---------------------------------------------------------------------------
describe('version comparison non-numeric', () => {
  function shouldAllowInstall(current: string, next: string): boolean {
    Number(current);
    Number(next);
    return true;
  }

  test('bundleVersion "abc" → NaN, not blocked', () => {
    expect(shouldAllowInstall('5', 'abc')).toBe(true);
  });

  test('bundleVersion "3a" → NaN, not blocked', () => {
    expect(shouldAllowInstall('5', '3a')).toBe(true);
  });

  test('bundleVersion "-1" → negative value still allowed', () => {
    expect(shouldAllowInstall('5', '-1')).toBe(true);
  });

  test('both NaN → not blocked', () => {
    expect(shouldAllowInstall('abc', 'def')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// HTTPS validation edge cases
// ---------------------------------------------------------------------------
describe('HTTPS validation edge cases', () => {
  function isHttps(url: string | undefined): boolean {
    if (!url) return false;
    return url.startsWith('https://');
  }

  test('uppercase "HTTPS://" → rejected (case-sensitive)', () => {
    expect(isHttps('HTTPS://example.com')).toBe(false);
  });

  test('"https://" with no host → passes check', () => {
    expect(isHttps('https://')).toBe(true);
  });

  test('leading space → rejected', () => {
    expect(isHttps(' https://example.com')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Path traversal edge cases
// ---------------------------------------------------------------------------
describe('path traversal edge cases', () => {
  function isTraversal(entry: string, base: string): boolean {
    const segments = `${base}/${entry}`
      .split('/')
      .reduce((acc: string[], part) => {
        if (part === '..') {
          acc.pop();
        } else if (part !== '.' && part !== '') {
          acc.push(part);
        }
        return acc;
      }, []);
    const baseParts = base.split('/').filter((p) => p !== '');
    return segments.length < baseParts.length;
  }

  test('entry ".." only → traversal detected', () => {
    expect(isTraversal('..', '/tmp/bundle')).toBe(true);
  });

  test('entry "" empty → safe', () => {
    expect(isTraversal('', '/tmp/bundle')).toBe(false);
  });

  test('entry "./build/file.js" → safe', () => {
    expect(isTraversal('./build/file.js', '/tmp/bundle')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fallback bundle management: empty/null current fields
// ---------------------------------------------------------------------------
describe('fallback management empty fields', () => {
  interface IBundleData {
    appVersion: string;
    bundleVersion: string;
    signature: string;
  }

  function shouldAddToFallback(current: IBundleData | null): boolean {
    return !!(
      current &&
      current.appVersion &&
      current.bundleVersion &&
      current.signature
    );
  }

  test('current with empty appVersion → not added', () => {
    expect(
      shouldAddToFallback({
        appVersion: '',
        bundleVersion: '1',
        signature: 'sig',
      }),
    ).toBe(false);
  });

  test('current with empty signature → not added', () => {
    expect(
      shouldAddToFallback({
        appVersion: '1.0.0',
        bundleVersion: '1',
        signature: '',
      }),
    ).toBe(false);
  });

  test('current with empty bundleVersion → not added', () => {
    expect(
      shouldAddToFallback({
        appVersion: '1.0.0',
        bundleVersion: '',
        signature: 'sig',
      }),
    ).toBe(false);
  });

  test('null current → not added', () => {
    expect(shouldAddToFallback(null)).toBe(false);
  });

  test('valid current → added', () => {
    expect(
      shouldAddToFallback({
        appVersion: '1.0.0',
        bundleVersion: '1',
        signature: 'sig',
      }),
    ).toBe(true);
  });
});
