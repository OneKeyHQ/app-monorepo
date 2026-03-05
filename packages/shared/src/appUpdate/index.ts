import semver from 'semver';

import platformEnv from '../platformEnv';

import { EAppUpdateStatus, EUpdateFileType } from './type';

import type { IAppUpdateInfo } from './type';

export * from './utils';
export * from './type';

// Read from platformEnv on each call so that mocked values take effect in tests.
const getAppVersion = () => platformEnv.version ?? '1.0.0';
const getAppBundleVersion = () => platformEnv.bundleVersion ?? '1';

interface IIsNeedUpdateParams {
  latestVersion?: string;
  jsBundleVersion?: string;
  status?: EAppUpdateStatus;
}

export const getUpdateFileType: (
  params: IIsNeedUpdateParams,
) => EUpdateFileType = ({
  latestVersion,
  jsBundleVersion,
}: IIsNeedUpdateParams) => {
  if (!latestVersion || !jsBundleVersion) {
    return EUpdateFileType.appShell;
  }
  if (
    latestVersion &&
    semver.gte(latestVersion, getAppVersion()) &&
    jsBundleVersion &&
    jsBundleVersion !== getAppBundleVersion()
  ) {
    return EUpdateFileType.jsBundle;
  }
  return EUpdateFileType.appShell;
};

export const gtVersion = (appVersion?: string, bundleVersion?: string) => {
  if (!appVersion) {
    return false;
  }
  if (bundleVersion) {
    return (
      semver.gte(appVersion ?? '', getAppVersion()) &&
      Number(bundleVersion) > Number(getAppBundleVersion())
    );
  }
  return semver.gt(appVersion ?? '', getAppVersion());
};

export const isNeedUpdate: (params: IIsNeedUpdateParams) => {
  shouldUpdate: boolean;
  fileType: EUpdateFileType;
} = ({ latestVersion, jsBundleVersion, status }: IIsNeedUpdateParams) => {
  // App shell version is equal to the latest version, check js bundle version
  if (
    jsBundleVersion &&
    latestVersion &&
    semver.gte(latestVersion, getAppVersion())
  ) {
    return {
      shouldUpdate: !!(
        latestVersion &&
        Number(jsBundleVersion) > Number(getAppBundleVersion() || 0) &&
        status !== EAppUpdateStatus.done
      ),
      fileType: EUpdateFileType.jsBundle,
    };
  }
  return {
    shouldUpdate: !!(
      latestVersion &&
      semver.gt(latestVersion, getAppVersion()) &&
      status !== EAppUpdateStatus.done
    ),
    fileType: EUpdateFileType.appShell,
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
    return getAppVersion();
  }
  return displayVersion(
    getAppVersion(),
    appUpdateInfo.previousAppVersion,
    getAppBundleVersion(),
  );
};

export const displayAppUpdateVersion = (
  appUpdateInfo: IAppUpdateInfo | undefined,
) => {
  if (!appUpdateInfo) {
    return getAppVersion();
  }
  return displayVersion(
    appUpdateInfo.latestVersion,
    getAppVersion(),
    appUpdateInfo.jsBundleVersion,
  );
};

export const isFirstLaunchAfterUpdated = (appUpdateInfo: IAppUpdateInfo) => {
  // App shell version is equal to the latest version, check js bundle version
  if (
    appUpdateInfo.jsBundleVersion &&
    appUpdateInfo.latestVersion &&
    semver.gte(getAppVersion(), appUpdateInfo.latestVersion)
  ) {
    return (
      appUpdateInfo.status !== EAppUpdateStatus.done &&
      Number(getAppBundleVersion()) >= Number(appUpdateInfo.jsBundleVersion)
    );
  }
  return (
    appUpdateInfo.status !== EAppUpdateStatus.done &&
    appUpdateInfo.latestVersion &&
    semver.gte(getAppVersion(), appUpdateInfo.latestVersion)
  );
};
