import axios from 'axios';

import { PackageInfo, PackagesInfo, ReleasesInfo } from '../type';

import { ReleasesVersion } from './GithubReleases';

function handleReleaseInfo(releasesVersion: ReleasesVersion): ReleasesInfo {
  const androidPackages: PackageInfo[] = [];
  const extPackages: PackageInfo[] = [];
  const desktopPackages: PackageInfo[] = [];
  const iosPackages: PackageInfo[] = [
    {
      os: 'ios',
      channel: 'AppStore',
      download:
        'https://apps.apple.com/app/onekey-open-source-wallet/id1609559473',
    },
  ];

  androidPackages.push({
    os: 'android',
    channel: 'GooglePlay',
    download:
      'https://play.google.com/store/apps/details?id=so.onekey.app.wallet',
  });

  releasesVersion.assets.forEach((x) => {
    // android
    if (x.name.indexOf('android.apk') !== -1) {
      androidPackages.push({
        os: 'android',
        channel: 'Direct',
        download: x.browser_download_url,
      });
    }

    // extension
    if (x.name.indexOf('firefox-addon.zip') !== -1) {
      extPackages.push({
        os: 'firefox',
        channel: 'MozillaAddOns',
        download: x.browser_download_url,
      });
    }

    if (x.name.indexOf('chrome-extension.zip') !== -1) {
      extPackages.push({
        os: 'chrome',
        channel: 'ChromeWebStore',
        download: x.browser_download_url,
      });
    }

    // desktop
    if (x.name.indexOf('linux-x86_64.AppImage') !== -1) {
      desktopPackages.push({
        os: 'linux',
        channel: 'Direct',
        download: x.browser_download_url,
      });
    }
    if (x.name.indexOf('mac-arm64.dmg') !== -1) {
      desktopPackages.push({
        os: 'macos-arm64',
        channel: 'Direct',
        download: x.browser_download_url,
      });
    }
    if (x.name.indexOf('mac-x64.dmg') !== -1) {
      desktopPackages.push({
        os: 'macos-x64',
        channel: 'Direct',
        download: x.browser_download_url,
      });
    }

    if (x.name.indexOf('win-x64.exe') !== -1) {
      desktopPackages.push({
        os: 'win',
        channel: 'Direct',
        download: x.browser_download_url,
      });
    }
  });

  const packagesInfo: PackagesInfo = {
    ios: iosPackages,
    android: androidPackages,
    extension: extPackages,
    desktop: desktopPackages,
  };

  return {
    version: releasesVersion.tag_name,
    forceVersion: '0',
    buildNumber: '1',
    changeLog: releasesVersion.body,
    packages: packagesInfo,
  };
}

export async function getPreReleaseInfo(): Promise<ReleasesInfo | null> {
  return axios
    .get<ReleasesVersion[]>(
      'https://api.github.com/repos/onekeyhq/app-monorepo/releases',
    )
    .then((res) => {
      const releasesVersions = res.data;
      const releasesVersion = releasesVersions.find((x) => x.prerelease);

      if (releasesVersion) return handleReleaseInfo(releasesVersion);
      return null;
    })
    .catch(() => null);
}

export async function getReleaseInfo(): Promise<ReleasesInfo | null> {
  return axios
    .get<ReleasesVersion>(
      'https://api.github.com/repos/onekeyhq/app-monorepo/releases/latest',
    )
    .then((releasesVersionResponse) => {
      const releasesVersion = releasesVersionResponse.data;
      return handleReleaseInfo(releasesVersion);
    })
    .catch(() => null);
}
