import semver from 'semver';

import platformEnv from '../platformEnv';

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
    decision.decision === 'jsBundleRollback'
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
    decision.decision === 'jsBundleRollback'
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
    decision.decision === 'jsBundleRollback'
      ? EUpdateFileType.jsBundle
      : EUpdateFileType.appShell;
  const shouldUpdate =
    status !== EAppUpdateStatus.done &&
    (decision.decision === 'appShellUpdate' ||
      decision.decision === 'jsBundleUpgrade');
  const isRollback = decision.decision === 'jsBundleRollback';
  return {
    shouldUpdate,
    fileType,
    isRollback,
  };
};

const displayVersion = (
  newVersion?: string,
  latestVersion?: string,
  bundleVersion?: string,
) => {
  if (!newVersion) {
    return latestVersion;
  }
  return newVersion === latestVersion
    ? `${newVersion}(${encodeBundleVersionForDisplay(bundleVersion ?? '1')})`
    : newVersion;
};

export const displayWhatsNewVersion = (
  appUpdateInfo: IAppUpdateInfo | undefined,
) => {
  if (!appUpdateInfo) {
    return APP_VERSION;
  }
  return displayVersion(
    APP_VERSION,
    appUpdateInfo.previousAppVersion,
    APP_BUNDLE_VERSION,
  );
};

export const displayAppUpdateVersion = (
  appUpdateInfo: IAppUpdateInfo | undefined,
) => {
  if (!appUpdateInfo) {
    return APP_VERSION;
  }
  return displayVersion(
    appUpdateInfo.latestVersion,
    APP_VERSION,
    appUpdateInfo.jsBundleVersion,
  );
};

export const isFirstLaunchAfterUpdated = (appUpdateInfo: IAppUpdateInfo) => {
  // App shell version is equal to the latest version, check js bundle version
  if (
    appUpdateInfo.jsBundleVersion &&
    appUpdateInfo.latestVersion &&
    semver.gte(APP_VERSION, appUpdateInfo.latestVersion)
  ) {
    return (
      appUpdateInfo.status !== EAppUpdateStatus.done &&
      Number(APP_BUNDLE_VERSION) >= Number(appUpdateInfo.jsBundleVersion)
    );
  }
  return (
    appUpdateInfo.status !== EAppUpdateStatus.done &&
    appUpdateInfo.latestVersion &&
    semver.gte(APP_VERSION, appUpdateInfo.latestVersion)
  );
};
