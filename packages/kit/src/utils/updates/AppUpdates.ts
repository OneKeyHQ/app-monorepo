import * as Linking from 'expo-linking';
import { NativeModules } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getReleaseInfo } from './server';
import { PackageInfo, VersionInfo } from './type.d';

const { BuildConfigManager } = NativeModules;
class AppUpdates {
  async checkAppUpdate(): Promise<VersionInfo | undefined> {
    const releaseInfo = await getReleaseInfo();

    if (
      this.compVersion(process.env.VERSION ?? '0.0.0', releaseInfo.version) >= 0
    ) {
      //  没有更新
      return;
    }

    console.log('sdfsdfsd s');

    let packageInfo: PackageInfo | undefined;
    if (platformEnv.isAndroid) {
      if (BuildConfigManager.getChannel() === 'GooglePlay') {
        packageInfo = releaseInfo.packages?.android?.find(
          (x) => x.os === 'android' && x.distribution === 'GooglePlay',
        );
      } else {
        packageInfo = releaseInfo.packages?.android?.find(
          (x) => x.os === 'android' && x.distribution === 'DIRECT',
        );
      }
    }

    if (platformEnv.isIOS) {
      packageInfo = releaseInfo.packages?.ios?.find((x) => x.os === 'ios');
    }

    if (platformEnv.isDesktop) {
      if (platformEnv.isLinux) {
        packageInfo = releaseInfo.packages?.desktop?.find(
          (x) => x.os === 'linux',
        );
      }
      if (platformEnv.isMac) {
        packageInfo = releaseInfo.packages?.desktop?.find(
          (x) => x.os === 'mac',
        );
      }
      if (platformEnv.isWindows) {
        packageInfo = releaseInfo.packages?.desktop?.find(
          (x) => x.os === 'win',
        );
      }
    }

    if (platformEnv.isExtension) {
      if (platformEnv.isChrome) {
        packageInfo = releaseInfo.packages?.extension?.find(
          (x) => x.os === 'any' && x.distribution === 'Chrome',
        );
      }
      if (platformEnv.isFirefox) {
        packageInfo = releaseInfo.packages?.extension?.find(
          (x) => x.os === 'any' && x.distribution === 'FireFox',
        );
      }
    }

    if (packageInfo) {
      return {
        version: releaseInfo.version,
        forceVersion: releaseInfo.forceVersion,
        buildNumber: releaseInfo.buildNumber,
        changeLog: releaseInfo.changeLog,
        package: packageInfo,
      };
    }
  }

  openAppUpdate(versionInfo: VersionInfo): void {
    switch (versionInfo.package.distribution) {
      case 'GooglePlay':
        Linking.canOpenURL('market://').then((supported) => {
          if (supported) {
            Linking.openURL('market://details?id=so.onekey.app.wallet');
          } else {
            this._openUrl(versionInfo.package.download);
          }
        });
        break;
      case 'AppStore':
        Linking.canOpenURL('itms-apps://').then((supported) => {
          if (supported) {
            Linking.openURL('itms-apps://itunes.apple.com/app/id1609559473');
          } else {
            this._openUrl(
              `https://apps.apple.com/app/onekey-open-source-wallet/${versionInfo.package.download}`,
            );
          }
        });
        break;
      default:
        this._openUrl(versionInfo.package.download);
    }
  }

  _openUrl(url: string) {
    if (platformEnv.isNative) {
      Linking.openURL(url);
    } else {
      window.open(url, '_blank');
    }
  }

  _formatVersion(version: string): string {
    return version.replace('V', '').replace('v', '');
  }

  /**
   *
   * @param version1
   * @param version2
   * @returns -1: version1 < version2 ; 0: version1 = version2 ; 1: version1 > version2
   */
  compVersion(version1: string, version2: string): number {
    const arr1 = this._formatVersion(version1).split('.');
    const arr2 = this._formatVersion(version2).split('.');

    const len = Math.max(arr1.length, arr2.length);
    for (let i = 0; i < len; ) {
      if (arr1[i] === arr2[i]) {
        i += 1;
      } else if (!arr1[i] || arr1[i] < arr2[i]) {
        return -1;
      } else {
        return 1;
      }
    }
    return 0;
  }
}
const appUpdates = new AppUpdates();
export default appUpdates;
