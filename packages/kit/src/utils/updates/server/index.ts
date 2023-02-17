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
    iosPackages.push({
      os: 'ios',
      channel: 'AppStore',
      download: releasesVersion.ios.url,
      version: releasesVersion.ios.version.join('.'),
      forceVersion: '0.0.0',
    });
  }

  if (releasesVersion?.android) {
    if (releasesVersion.android.googlePlay) {
      androidPackages.push({
        os: 'android',
        channel: 'GooglePlay',
        download: releasesVersion.android.googlePlay,
        version: releasesVersion.android.version.join('.'),
        forceVersion: '0.0.0',
      });
    }
    if (releasesVersion.android.url) {
      androidPackages.push({
        os: 'android',
        channel: 'Direct',
        download: releasesVersion.android.url,
        version: releasesVersion.android.version.join('.'),
        forceVersion: '0.0.0',
      });
    }
  }

  if (releasesVersion?.desktop) {
    if (releasesVersion.desktop.linux) {
      desktopPackages.push({
        os: 'linux',
        channel: 'Direct',
        download: releasesVersion.desktop.linux,
        version: releasesVersion.desktop.version.join('.'),
        forceVersion: '0.0.0',
      });
    }
    if (releasesVersion.desktop.macX64) {
      desktopPackages.push({
        os: 'macos-x64',
        channel: 'Direct',
        download: releasesVersion.desktop.macX64,
        version: releasesVersion.desktop.version.join('.'),
        forceVersion: '0.0.0',
      });
    }
    if (releasesVersion.desktop.macARM) {
      desktopPackages.push({
        os: 'macos-arm64',
        channel: 'Direct',
        download: releasesVersion.desktop.macARM,
        version: releasesVersion.desktop.version.join('.'),
        forceVersion: '0.0.0',
      });
    }
    if (releasesVersion.desktop.win) {
      desktopPackages.push({
        os: 'win',
        channel: 'Direct',
        download: releasesVersion.desktop.win,
        version: releasesVersion.desktop.version.join('.'),
        forceVersion: '0.0.0',
      });
    }
    if (releasesVersion.desktop.mas) {
      desktopPackages.push({
        os: 'mas',
        channel: 'AppStore',
        download: releasesVersion.desktop.mas.url,
        version: releasesVersion.desktop.mas.version.join('.'),
        forceVersion: '0.0.0',
      });
    }
  }

  if (releasesVersion?.ext) {
    if (releasesVersion.ext.chrome) {
      extPackages.push({
        os: 'chrome',
        channel: 'ChromeWebStore',
        download: releasesVersion.ext.chrome,
        version: '0.0.0',
        forceVersion: '0.0.0',
      });
    }
    if (releasesVersion.ext.firefox) {
      extPackages.push({
        os: 'firefox',
        channel: 'MozillaAddOns',
        download: releasesVersion.ext.firefox,
        version: '0.0.0',
        forceVersion: '0.0.0',
      });
    }
    if (releasesVersion.ext.edge) {
      extPackages.push({
        os: 'edge',
        channel: 'Direct',
        download: releasesVersion.ext.edge,
        version: '0.0.0',
        forceVersion: '0.0.0',
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
    .get<AppReleases>(`https://data.onekey.so/config.json?nocache=${key}`)
    .then((releasesVersionResponse) => {
      const releasesVersion = releasesVersionResponse.data;
      return handleReleaseInfo(releasesVersion);
    })
    .catch(() => null);
}

export async function getPreReleaseInfo(): Promise<PackagesInfo | null> {
  return getReleaseInfo()
    .then((packagesInfo) => {
      // modify version to 99.99.99
      packagesInfo?.ios?.forEach((packageInfo) => {
        packageInfo.version = '99.99.99';
      });
      packagesInfo?.android?.forEach((packageInfo) => {
        packageInfo.version = '99.99.99';
      });
      packagesInfo?.extension?.forEach((packageInfo) => {
        packageInfo.version = '99.99.99';
      });
      packagesInfo?.desktop?.forEach((packageInfo) => {
        packageInfo.version = '99.99.99';
      });
      return packagesInfo;
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
