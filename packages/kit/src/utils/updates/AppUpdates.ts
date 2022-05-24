import * as Linking from 'expo-linking';
import semver from 'semver';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import store from '../../store';

import { getPreReleaseInfo, getReleaseInfo } from './server';
import { PackageInfo, ReleasesInfo, VersionInfo } from './type.d';

class AppUpdates {
  async checkAppUpdate(): Promise<VersionInfo | undefined> {
    const { enable, preReleaseUpdate } =
      store.getState().settings.devMode || {};

    const preUpdateMode = enable && preReleaseUpdate;

    let releaseInfo: ReleasesInfo | null;
    if (preUpdateMode) {
      releaseInfo = await getPreReleaseInfo();
    } else {
      releaseInfo = await getReleaseInfo();
    }

    if (
      !releaseInfo ||
      // localVersion >= releaseVersion
      semver.gte(
        store.getState().settings.version ?? '0.0.0',
        releaseInfo.version,
      )
    ) {
      //  没有更新
      return;
    }

    let packageInfo: PackageInfo | undefined;
    if (platformEnv.isNativeAndroid) {
      if (platformEnv.isNativeAndroidGooglePlay) {
        packageInfo = releaseInfo.packages?.android?.find(
          (x) => x.os === 'android' && x.channel === 'GooglePlay',
        );
      } else {
        packageInfo = releaseInfo.packages?.android?.find(
          (x) => x.os === 'android' && x.channel === 'Direct',
        );
      }
    }

    if (platformEnv.isNativeIOS) {
      packageInfo = releaseInfo.packages?.ios?.find((x) => x.os === 'ios');
    }

    if (platformEnv.isDesktop) {
      if (platformEnv.isDesktopLinux) {
        packageInfo = releaseInfo.packages?.desktop?.find(
          (x) => x.os === 'linux',
        );
      }
      if (platformEnv.isDesktopMac) {
        packageInfo = releaseInfo.packages?.desktop?.find((x) => {
          if (platformEnv.isDesktopMacArm64) {
            return x.os === 'macos-arm64';
          }

          return x.os === 'macos-x64';
        });
      }
      if (platformEnv.isDesktopWin) {
        packageInfo = releaseInfo.packages?.desktop?.find(
          (x) => x.os === 'win',
        );
      }
    }

    if (platformEnv.isExtension) {
      if (platformEnv.isExtChrome) {
        packageInfo = releaseInfo.packages?.extension?.find(
          (x) => x.os === 'chrome',
        );
      }
      if (platformEnv.isExtFirefox) {
        packageInfo = releaseInfo.packages?.extension?.find(
          (x) => x.os === 'firefox',
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
    switch (versionInfo.package.channel) {
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
      case 'GooglePlay':
        Linking.canOpenURL('market://').then((supported) => {
          if (supported) {
            Linking.openURL('market://details?id=so.onekey.app.wallet');
          } else {
            this._openUrl(versionInfo.package.download);
          }
        });
        break;
      default:
        this._openUrl(versionInfo.package.download);
        break;
    }
  }

  async getChangeLog(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    oldVersion: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    newVersion: string,
  ): Promise<string | undefined> {
    const releaseInfo = await getReleaseInfo();
    return releaseInfo?.changeLog;
  }

  _openUrl(url: string) {
    if (platformEnv.isNative) {
      Linking.openURL(url);
    } else {
      window.open(url, '_blank');
    }
  }
}
const appUpdates = new AppUpdates();
export default appUpdates;
