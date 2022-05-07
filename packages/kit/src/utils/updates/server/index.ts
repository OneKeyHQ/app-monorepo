import axios from 'axios';

import { PackageInfo, PackagesInfo, ReleasesInfo } from '../type';

import { ReleasesVersion } from './type';

export async function getReleaseInfo(): Promise<ReleasesInfo> {
  return axios
    .get<ReleasesVersion>(
      'https://api.github.com/repos/onekeyhq/app-monorepo/releases/latest',
    )
    .then((releasesVersionResponse) => {
      const releasesVersion = releasesVersionResponse.data;

      const iosPackages: PackageInfo[] = [
        {
          os: 'ios',
          arch: 'arm64',
          distribution: 'AppStore',
          download: 'itms-apps://itunes.apple.com/app/id1609559473',
        },
      ];

      const androidPackages: PackageInfo[] = [];
      const extPackages: PackageInfo[] = [];
      const desktopPackages: PackageInfo[] = [];

      releasesVersion.assets.forEach((x) => {
        console.log('forEach', x);

        // android
        if (x.name.indexOf('android.apk') !== -1) {
          androidPackages.push({
            os: 'android',
            arch: 'arm64',
            distribution: 'DIRECT',
            download: x.browser_download_url,
          });
        }

        // extension
        if (x.name.indexOf('firefox-addon.zip') !== -1) {
          extPackages.push({
            os: 'any',
            arch: 'any',
            distribution: 'FireFox',
            download: x.browser_download_url,
          });
        }

        if (x.name.indexOf('chrome-extension.zip') !== -1) {
          extPackages.push({
            os: 'any',
            arch: 'any',
            distribution: 'Chrome',
            download: x.browser_download_url,
          });
        }

        // desktop
        if (x.name.indexOf('linux-x86_64.AppImage') !== -1) {
          desktopPackages.push({
            os: 'linux',
            arch: 'x86',
            distribution: 'DIRECT',
            download: x.browser_download_url,
          });
        }
        if (x.name.indexOf('mac-arm64.dmg') !== -1) {
          desktopPackages.push({
            os: 'mac',
            arch: 'arm64',
            distribution: 'DIRECT',
            download: x.browser_download_url,
          });
        }
        if (x.name.indexOf('mac-x64.dmg') !== -1) {
          desktopPackages.push({
            os: 'mac',
            arch: 'x64',
            distribution: 'DIRECT',
            download: x.browser_download_url,
          });
        }

        if (x.name.indexOf('win-x64.exe') !== -1) {
          desktopPackages.push({
            os: 'win',
            arch: 'x64',
            distribution: 'DIRECT',
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
    });
}
