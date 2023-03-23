import axios from 'axios';

import type { PackageInfo, PackagesInfo } from '../type';
import type { AppReleases, Changelog } from './type';

function getForceUpdateVersion(params: {
  miniVersion?: number[];
  minVersion?: number[];
}): string | undefined {
  const { miniVersion, minVersion } = params;
  if (miniVersion) {
    return miniVersion.join('.');
  }
  if (minVersion) {
    return minVersion.join('.');
  }
  return undefined;
}

function handleReleaseInfo(
  releasesVersion: AppReleases | undefined,
): PackagesInfo {
  const androidPackages: PackageInfo[] = [];
  const extPackages: PackageInfo[] = [];
  const desktopPackages: PackageInfo[] = [];
  const iosPackages: PackageInfo[] = [];
  const webPackages: PackageInfo[] = [];

  if (releasesVersion?.ios) {
    const forceUpdateVersion = getForceUpdateVersion(releasesVersion.ios);
    const { url, version } = releasesVersion.ios;
    iosPackages.push({
      os: 'ios',
      channel: 'AppStore',
      download: url,
      version: version.join('.'),
      forceUpdateVersion,
    });
  }

  if (releasesVersion?.android) {
    const forceUpdateVersion = getForceUpdateVersion(releasesVersion.android);
    if (releasesVersion.android.google) {
      const { url, version } = releasesVersion.android.google;
      androidPackages.push({
        os: 'android',
        channel: 'GooglePlay',
        download: url,
        version: version.join('.'),
        forceUpdateVersion,
      });
    }
    if (releasesVersion.android.huawei) {
      const { url, version } = releasesVersion.android.huawei;
      androidPackages.push({
        os: 'android',
        channel: 'HuaweiAppGallery',
        download: url,
        version: version.join('.'),
        forceUpdateVersion,
      });
    }
    if (releasesVersion.android.url) {
      const { url, version } = releasesVersion.android;
      androidPackages.push({
        os: 'android',
        channel: 'Direct',
        download: url,
        version: version.join('.'),
        forceUpdateVersion,
      });
    }
  }

  if (releasesVersion?.desktop) {
    const forceUpdateVersion = getForceUpdateVersion(releasesVersion.desktop);
    if (releasesVersion.desktop.linux) {
      desktopPackages.push({
        os: 'linux',
        channel: 'Direct',
        download: releasesVersion.desktop.linux,
        version: releasesVersion.desktop.version.join('.'),
        forceUpdateVersion,
      });
    }
    if (releasesVersion.desktop.snapStore) {
      const { url, version } = releasesVersion.desktop.snapStore;
      desktopPackages.push({
        os: 'linux',
        channel: 'LinuxSnap',
        download: url,
        version: version.join('.'),
        forceUpdateVersion,
      });
    }

    if (releasesVersion.desktop.macX64) {
      desktopPackages.push({
        os: 'macos-x64',
        channel: 'Direct',
        download: releasesVersion.desktop.macX64,
        version: releasesVersion.desktop.version.join('.'),
        forceUpdateVersion,
      });
    }
    if (releasesVersion.desktop.macARM) {
      desktopPackages.push({
        os: 'macos-arm64',
        channel: 'Direct',
        download: releasesVersion.desktop.macARM,
        version: releasesVersion.desktop.version.join('.'),
        forceUpdateVersion,
      });
    }
    if (releasesVersion.desktop.win) {
      desktopPackages.push({
        os: 'win',
        channel: 'Direct',
        download: releasesVersion.desktop.win,
        version: releasesVersion.desktop.version.join('.'),
        forceUpdateVersion,
      });
    }
    if (releasesVersion.desktop.msStore) {
      const { url, version } = releasesVersion.desktop.msStore;
      desktopPackages.push({
        os: 'win',
        channel: 'MsWindowsStore',
        download: url,
        version: version.join('.'),
        forceUpdateVersion,
      });
    }
    if (releasesVersion.desktop.mas) {
      const { url, version } = releasesVersion.desktop.mas;
      desktopPackages.push({
        os: 'mas',
        channel: 'AppStore',
        download: url,
        version: version.join('.'),
        forceUpdateVersion,
      });
    }
  }

  if (releasesVersion?.ext) {
    const forceUpdateVersion = getForceUpdateVersion(releasesVersion.ext);
    if (releasesVersion.ext.chrome) {
      extPackages.push({
        os: 'chrome',
        channel: 'ChromeWebStore',
        download: releasesVersion.ext.chrome,
        version: forceUpdateVersion ?? '0.0.0',
        forceUpdateVersion,
      });
    }
    if (releasesVersion.ext.firefox) {
      extPackages.push({
        os: 'firefox',
        channel: 'MozillaAddOns',
        download: releasesVersion.ext.firefox,
        version: forceUpdateVersion ?? '0.0.0',
        forceUpdateVersion,
      });
    }
    if (releasesVersion.ext.edge) {
      extPackages.push({
        os: 'edge',
        channel: 'EdgeWebStore',
        download: releasesVersion.ext.edge,
        version: forceUpdateVersion ?? '0.0.0',
        forceUpdateVersion,
      });
    }
  }

  if (releasesVersion?.web) {
    const forceUpdateVersion = getForceUpdateVersion(releasesVersion.web);
    webPackages.push({
      os: 'website',
      channel: 'Direct',
      download: 'https://app.onekey.so',
      version: forceUpdateVersion ?? '0.0.0',
      forceUpdateVersion,
    });
  }

  return {
    ios: iosPackages,
    android: androidPackages,
    extension: extPackages,
    desktop: desktopPackages,
    web: webPackages,
  };
}

export async function getReleaseInfo(): Promise<PackagesInfo | null> {
  const key = Math.random().toString();
  return axios
    .get<AppReleases>(`https://data.onekey.so/config.json?nocache=${key}`)
    .then((releasesVersionResponse) => {
      const releasesVersion = releasesVersionResponse.data;
      return handleReleaseInfo(releasesVersion);
    });
}

export async function getPreReleaseInfo(): Promise<PackagesInfo | null> {
  const key = Math.random().toString();
  return axios
    .get<AppReleases>(`https://data.onekey.so/pre-config.json?nocache=${key}`)
    .then((releasesVersionResponse) => {
      const releasesVersion = releasesVersionResponse.data;
      return handleReleaseInfo(releasesVersion);
    });
}

export async function getChangeLog(
  oldVersion: string,
  newVersion: string,
  isPreRelease?: boolean,
): Promise<Changelog | undefined> {
  const key = Math.random().toString();

  let changelogUrl = `https://data.onekey.so/config.json`;
  if (isPreRelease) {
    changelogUrl = `https://data.onekey.so/pre-config.json`;
  }

  return axios
    .get<AppReleases>(`${changelogUrl}?nocache=${key}`)
    .then((releasesVersionResponse) => {
      const changeLogs = releasesVersionResponse.data.changelog;
      return (
        changeLogs.find((log) => log.version === newVersion)?.locale ??
        undefined
      );
    })
    .catch(() => undefined);
}
