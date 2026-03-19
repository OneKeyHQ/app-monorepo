import semver from 'semver';

import platformEnv from '../platformEnv';
import { syncStorage } from '../storage/instance/syncStorageInstance';
import { EAppSyncStorageKeys } from '../storage/syncStorageKeys';

import { EAppUpdateStatus, EUpdateFileType } from './type';

import type { IAppUpdateInfo, IResolvedUpdateDecision } from './type';

export * from './utils';
export * from './type';

const APP_VERSION = platformEnv.version ?? '1.0.0';
const APP_BUNDLE_VERSION = platformEnv.bundleVersion ?? '1';

export function encodeBundleVersionForDisplay(version: string): string {
  // BUNDLE_VERSION is seconds since 2026-01-01T00:00:00Z epoch, base36 encode for short display
  const num = Number(version);
  if (/^\d+$/.test(version) && Number.isSafeInteger(num) && num > 99_999) {
    return num.toString(36);
  }
  return version;
}

interface IIsNeedUpdateParams {
  latestVersion?: string;
  jsBundleVersion?: string;
  status?: EAppUpdateStatus;
}

export interface IResolveUpdateDecisionParams {
  currentAppVersion?: string;
  currentBundleVersion?: string;
  remoteAppVersion?: string;
  remoteBundleVersion?: string;
  allowRollback?: boolean;
  /** Whether the app is currently running a downloaded JS bundle (not the builtin one). */
  hasActiveCustomBundle?: boolean;
}

function parseBundleVersion(version?: string): number | undefined {
  if (version === undefined || version === null || version === '') {
    return undefined;
  }
  if (!/^\d+$/.test(String(version))) {
    return undefined;
  }
  const parsed = Number(version);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
}

export function resolveUpdateDecision({
  currentAppVersion,
  currentBundleVersion,
  remoteAppVersion,
  remoteBundleVersion,
  allowRollback = true,
  hasActiveCustomBundle = false,
}: IResolveUpdateDecisionParams): IResolvedUpdateDecision {
  const currentValid = semver.valid(currentAppVersion || '');
  if (!currentValid) {
    return {
      decision: 'invalidLocal',
      isValid: false,
      reason: 'invalid_current_app_version',
    };
  }
  const remoteValid = semver.valid(remoteAppVersion || '');
  if (!remoteValid) {
    return {
      decision: 'invalidRemote',
      isValid: false,
      reason: 'invalid_remote_app_version',
    };
  }

  // App version comparisons first — bundle versions only matter when app
  // versions are equal.
  if (semver.gt(remoteValid, currentValid)) {
    return {
      decision: 'appShellUpdate',
      isValid: true,
      reason: 'remote_app_version_newer',
    };
  }
  if (semver.lt(remoteValid, currentValid)) {
    return {
      decision: 'staleRemote',
      isValid: true,
      reason: 'remote_app_version_older',
    };
  }

  // App versions are equal — compare bundle versions.
  const currentBundle = parseBundleVersion(currentBundleVersion || '0');
  // Do NOT default remoteBundleVersion to '0' — undefined means the server
  // did not provide a bundle version.  Defaulting to '0' would falsely
  // trigger jsBundleRollback when the current bundle is >= 1.
  const remoteBundle = remoteBundleVersion
    ? parseBundleVersion(remoteBundleVersion)
    : undefined;
  if (currentBundle === undefined) {
    return {
      decision: 'invalidLocal',
      isValid: false,
      reason: 'invalid_current_bundle_version',
    };
  }
  if (remoteBundle === undefined) {
    // Distinguish "server omitted jsBundleVersion" from "server sent a
    // malformed value like 'abc'".  Only trigger rollback-to-builtin when
    // the field was genuinely absent or empty — not on parse failures.
    const remoteWasAbsent =
      remoteBundleVersion === undefined ||
      remoteBundleVersion === null ||
      remoteBundleVersion === '';
    if (remoteWasAbsent && hasActiveCustomBundle && allowRollback) {
      return {
        decision: 'jsBundleRollbackToBuiltin',
        isValid: true,
        reason: 'remote_bundle_not_available_rollback_to_builtin',
      };
    }
    return {
      decision: 'none',
      isValid: true,
      reason: 'remote_bundle_version_not_available',
    };
  }
  if (remoteBundle > currentBundle) {
    return {
      decision: 'jsBundleUpgrade',
      isValid: true,
      reason: 'remote_bundle_version_newer',
    };
  }
  if (remoteBundle < currentBundle) {
    return {
      decision: allowRollback ? 'jsBundleRollback' : 'staleRemote',
      isValid: true,
      reason: allowRollback
        ? 'remote_bundle_version_older_with_rollback'
        : 'remote_bundle_version_older_without_rollback',
    };
  }

  return {
    decision: 'none',
    isValid: true,
    reason: 'remote_matches_current',
  };
}

export const getUpdateFileType: (
  params: IIsNeedUpdateParams,
) => EUpdateFileType = ({
  latestVersion,
  jsBundleVersion,
}: IIsNeedUpdateParams) => {
  const decision = resolveUpdateDecision({
    currentAppVersion: APP_VERSION,
    currentBundleVersion: APP_BUNDLE_VERSION,
    remoteAppVersion: latestVersion,
    remoteBundleVersion: jsBundleVersion,
    allowRollback: true,
  });
  if (
    decision.decision === 'jsBundleUpgrade' ||
    decision.decision === 'jsBundleRollback' ||
    decision.decision === 'jsBundleRollbackToBuiltin'
  ) {
    return EUpdateFileType.jsBundle;
  }
  return EUpdateFileType.appShell;
};

export const gtVersion = (appVersion?: string, bundleVersion?: string) => {
  const decision = resolveUpdateDecision({
    currentAppVersion: APP_VERSION,
    currentBundleVersion: APP_BUNDLE_VERSION,
    remoteAppVersion: appVersion,
    remoteBundleVersion: bundleVersion,
    allowRollback: true,
  });
  return (
    decision.decision === 'appShellUpdate' ||
    decision.decision === 'jsBundleUpgrade' ||
    decision.decision === 'jsBundleRollback' ||
    decision.decision === 'jsBundleRollbackToBuiltin'
  );
};

export const isNeedUpdate: (params: IIsNeedUpdateParams) => {
  shouldUpdate: boolean;
  fileType: EUpdateFileType;
  isRollback: boolean;
} = ({ latestVersion, jsBundleVersion, status }: IIsNeedUpdateParams) => {
  const decision = resolveUpdateDecision({
    currentAppVersion: APP_VERSION,
    currentBundleVersion: APP_BUNDLE_VERSION,
    remoteAppVersion: latestVersion,
    remoteBundleVersion: jsBundleVersion,
    allowRollback: true,
  });
  const fileType =
    decision.decision === 'jsBundleUpgrade' ||
    decision.decision === 'jsBundleRollback' ||
    decision.decision === 'jsBundleRollbackToBuiltin'
      ? EUpdateFileType.jsBundle
      : EUpdateFileType.appShell;
  const shouldUpdate =
    status !== EAppUpdateStatus.done &&
    (decision.decision === 'appShellUpdate' ||
      decision.decision === 'jsBundleUpgrade');
  const isRollback =
    decision.decision === 'jsBundleRollback' ||
    decision.decision === 'jsBundleRollbackToBuiltin';
  return {
    shouldUpdate,
    fileType,
    isRollback,
  };
};

export const displayFullVersion = (
  version?: string,
  buildNumber?: string,
  bundleVersion?: string,
) => {
  const ver = version ?? APP_VERSION;
  const parts = [ver];
  if (buildNumber) {
    parts.push(` ${buildNumber}`);
  }
  if (bundleVersion) {
    parts.push(`(${encodeBundleVersionForDisplay(bundleVersion)})`);
  }
  return parts.join('');
};

export function isLastUpdateJsBundle(): boolean {
  const data = syncStorage.getObject<IWhatsNewShownData>(
    EAppSyncStorageKeys.onekey_whats_new_shown,
  );
  return data?.isJsBundleUpdate === true;
}

export const displayWhatsNewVersion = () =>
  displayFullVersion(
    APP_VERSION,
    undefined,
    isLastUpdateJsBundle() ? APP_BUNDLE_VERSION : undefined,
  );

export const displayAppUpdateVersion = (
  appUpdateInfo: IAppUpdateInfo | undefined,
) => {
  if (!appUpdateInfo) {
    return APP_VERSION;
  }
  const fileType = getUpdateFileType(appUpdateInfo);
  return displayFullVersion(
    appUpdateInfo.latestVersion,
    undefined,
    fileType === EUpdateFileType.jsBundle
      ? appUpdateInfo.jsBundleVersion
      : undefined,
  );
};

interface IWhatsNewShownData {
  appVersion: string;
  bundleVersions: string[];
  isJsBundleUpdate?: boolean;
}

export const isWhatsNewShown = (): boolean => {
  const data = syncStorage.getObject<IWhatsNewShownData>(
    EAppSyncStorageKeys.onekey_whats_new_shown,
  );
  if (!data || data.appVersion !== APP_VERSION) {
    return false;
  }
  if (!Array.isArray(data.bundleVersions)) {
    return false;
  }
  return data.bundleVersions.map(String).includes(String(APP_BUNDLE_VERSION));
};

export const markWhatsNewShown = (isJsBundleUpdate?: boolean): void => {
  const bundleVersion = String(APP_BUNDLE_VERSION);
  const data = syncStorage.getObject<IWhatsNewShownData>(
    EAppSyncStorageKeys.onekey_whats_new_shown,
  );
  if (!data || data.appVersion !== APP_VERSION) {
    syncStorage.setObject(EAppSyncStorageKeys.onekey_whats_new_shown, {
      appVersion: APP_VERSION,
      bundleVersions: [bundleVersion],
      isJsBundleUpdate,
    });
    return;
  }
  const versions = Array.isArray(data.bundleVersions)
    ? data.bundleVersions.map(String)
    : [];
  if (!versions.includes(bundleVersion)) {
    versions.push(bundleVersion);
  }
  syncStorage.setObject(EAppSyncStorageKeys.onekey_whats_new_shown, {
    ...data,
    bundleVersions: versions,
    isJsBundleUpdate,
  });
};

export const isFirstLaunchAfterUpdated = (appUpdateInfo: IAppUpdateInfo) => {
  // App shell version is equal to the latest version, check js bundle version
  if (
    appUpdateInfo.jsBundleVersion &&
    appUpdateInfo.latestVersion &&
    semver.gte(APP_VERSION, appUpdateInfo.latestVersion)
  ) {
    const currentBundle = Number(APP_BUNDLE_VERSION);
    const targetBundle = Number(appUpdateInfo.jsBundleVersion);
    // For rollback targets, use exact match — being higher than the target
    // means the rollback hasn't been applied yet.
    // For upgrades, use >= — the user may have overshot the target version
    // (e.g., via a store update that includes a newer bundle).
    const bundleMatches = appUpdateInfo.isRollbackTarget
      ? currentBundle === targetBundle
      : currentBundle >= targetBundle;
    return appUpdateInfo.status !== EAppUpdateStatus.done && bundleMatches;
  }
  return (
    appUpdateInfo.status !== EAppUpdateStatus.done &&
    appUpdateInfo.latestVersion &&
    semver.gte(APP_VERSION, appUpdateInfo.latestVersion)
  );
};
