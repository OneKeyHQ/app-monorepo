import axios from 'axios';

import type { PackageInfo, PackagesInfo } from '../type';
import type { AppReleases, Changelog } from './type';

function handleReleaseInfo(
  releasesVersion: AppReleases | undefined,
): PackagesInfo {
  const androidPackages: PackageInfo[] = [];
  const extPackages: PackageInfo[] = [];
  const desktopPackages: PackageInfo[] = [];
  const iosPackages: PackageInfo[] = [];

  if (releasesVersion?.ios) {
    const forceUpdateVersion = releasesVersion.ios.miniVersion?.join('.');
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
    const forceUpdateVersion = releasesVersion.android.miniVersion?.join('.');
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
    const forceUpdateVersion = releasesVersion.desktop.miniVersion?.join('.');
    if (releasesVersion.desktop.linux) {
      desktopPackages.push({
        os: 'linux',
        channel: 'Direct',
        download: releasesVersion.desktop.linux,
        version: releasesVersion.desktop.version.join('.'),
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
      desktopPackages.push({
        os: 'win',
        channel: 'MsWindowsStore',
        download: releasesVersion.desktop.win,
        version: releasesVersion.desktop.version.join('.'),
        forceUpdateVersion,
      });
    }
    if (releasesVersion.desktop.mas) {
      desktopPackages.push({
        os: 'mas',
        channel: 'AppStore',
        download: releasesVersion.desktop.mas.url,
        version: releasesVersion.desktop.mas.version.join('.'),
        forceUpdateVersion,
      });
    }
  }

  if (releasesVersion?.ext) {
    const forceUpdateVersion = releasesVersion.ext.miniVersion?.join('.');
    if (releasesVersion.ext.chrome) {
      extPackages.push({
        os: 'chrome',
        channel: 'ChromeWebStore',
        download: releasesVersion.ext.chrome,
        version: '0.0.0',
        forceUpdateVersion,
      });
    }
    if (releasesVersion.ext.firefox) {
      extPackages.push({
        os: 'firefox',
        channel: 'MozillaAddOns',
        download: releasesVersion.ext.firefox,
        version: '0.0.0',
        forceUpdateVersion,
      });
    }
    if (releasesVersion.ext.edge) {
      extPackages.push({
        os: 'edge',
        channel: 'Direct',
        download: releasesVersion.ext.edge,
        version: '0.0.0',
        forceUpdateVersion,
      });
    }
  }

  return {
    ios: iosPackages,
    android: androidPackages,
    extension: extPackages,
    desktop: desktopPackages,
  };
}

export async function getReleaseInfo(): Promise<PackagesInfo | null> {
  const key = Math.random().toString();
  return axios
    .get<AppReleases>(`http://192.168.5.130/config.json?nocache=${key}`)
    .then((releasesVersionResponse) => {
      const releasesVersion = releasesVersionResponse.data;
      return handleReleaseInfo(releasesVersion);
    })
    .catch(() => null);
}

export async function getPreReleaseInfo(): Promise<PackagesInfo | null> {
  const key = Math.random().toString();
  return axios
    .get<AppReleases>(`http://192.168.5.130/pre-config.json?nocache=${key}`)
    .then((releasesVersionResponse) => {
      const releasesVersion = releasesVersionResponse.data;
      return handleReleaseInfo(releasesVersion);
    })
    .catch(() => null);
}

export async function getChangeLog(
  oldVersion: string,
  newVersion: string,
): Promise<Changelog | undefined> {
  const key = Math.random().toString();
  return axios
    .get<AppReleases>(`https://data.onekey.so/config.json?nocache=${key}`)
    .then((releasesVersionResponse) => {
      const changeLogs = releasesVersionResponse.data.changelog;
      return (
        changeLogs.find((log) => log.version === newVersion)?.locale ??
        undefined
      );
    })
    .catch(() => undefined);
}
