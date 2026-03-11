import semver from 'semver';

import platformEnv from '../platformEnv';

import { EAppUpdateStatus, EUpdateFileType } from './type';

import type {
  IAppUpdateInfo,
  IResolvedUpdateDecision,
  IUpdateTargetForPriority,
} from './type';

export * from './utils';
export * from './type';

const APP_VERSION = platformEnv.version ?? '1.0.0';
const APP_BUNDLE_VERSION = platformEnv.bundleVersion ?? '1';

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

export function getTargetVersionKey(appVersion: string, bundleVersion: string) {
  return `${appVersion}:${bundleVersion}`;
}

export function compareTargetPriority(
  a: IUpdateTargetForPriority,
  b: IUpdateTargetForPriority,
) {
  const aAppValid = semver.valid(a.appVersion);
  const bAppValid = semver.valid(b.appVersion);
  if (aAppValid && bAppValid && !semver.eq(aAppValid, bAppValid)) {
    return semver.gt(aAppValid, bAppValid) ? 1 : -1;
  }
  if (aAppValid && !bAppValid) {
    return 1;
  }
  if (!aAppValid && bAppValid) {
    return -1;
  }

  const aBundle = parseBundleVersion(a.bundleVersion);
  const bBundle = parseBundleVersion(b.bundleVersion);
  if (aBundle !== undefined && bBundle !== undefined && aBundle !== bBundle) {
    return aBundle > bBundle ? 1 : -1;
  }
  if (aBundle !== undefined && bBundle === undefined) {
    return 1;
  }
  if (aBundle === undefined && bBundle !== undefined) {
    return -1;
  }

  const aRollbackPriority = Number(a.rollbackPolicyPriority ?? 0);
  const bRollbackPriority = Number(b.rollbackPolicyPriority ?? 0);
  if (aRollbackPriority !== bRollbackPriority) {
    return aRollbackPriority > bRollbackPriority ? 1 : -1;
  }

  const aActionPriority = Number(a.actionPriority ?? 0);
  const bActionPriority = Number(b.actionPriority ?? 0);
  if (aActionPriority !== bActionPriority) {
    return aActionPriority > bActionPriority ? 1 : -1;
  }

  return 0;
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
      decision: 'invalidRemote',
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

  const currentBundle = parseBundleVersion(currentBundleVersion || '0');
  const remoteBundle = parseBundleVersion(remoteBundleVersion || '0');
  if (currentBundle === undefined || remoteBundle === undefined) {
    return {
      decision: 'invalidRemote',
      isValid: false,
      reason: 'invalid_bundle_version',
    };
  }

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
    decision.decision === 'jsBundleUpgrade'
  );
};

export const isNeedUpdate: (params: IIsNeedUpdateParams) => {
  shouldUpdate: boolean;
  fileType: EUpdateFileType;
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
      decision.decision === 'jsBundleUpgrade' ||
      decision.decision === 'jsBundleRollback');
  return {
    shouldUpdate,
    fileType,
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
    ? `${newVersion}(${bundleVersion ?? 1})`
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
