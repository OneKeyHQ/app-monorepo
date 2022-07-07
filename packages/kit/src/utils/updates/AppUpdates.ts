import * as Linking from 'expo-linking';
import semver from 'semver';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import store from '../../store';
import { getDefaultLocale } from '../locale';

import { getChangeLog, getPreReleaseInfo, getReleaseInfo } from './server';
import { PackageInfo, PackagesInfo, VersionInfo } from './type.d';

class AppUpdates {
  async checkAppUpdate(): Promise<VersionInfo | undefined> {
    const { enable, preReleaseUpdate } =
      store.getState().settings.devMode || {};

    const preUpdateMode = enable && preReleaseUpdate;

    let releasePackages: PackagesInfo | null;
    if (preUpdateMode) {
      releasePackages = await getPreReleaseInfo();
    } else {
      releasePackages = await getReleaseInfo();
    }

    let packageInfo: PackageInfo | undefined;
    if (platformEnv.isNativeAndroid) {
      if (platformEnv.isNativeAndroidGooglePlay) {
        packageInfo = releasePackages?.android?.find(
          (x) => x.os === 'android' && x.channel === 'GooglePlay',
        );
      } else {
        packageInfo = releasePackages?.android?.find(
          (x) => x.os === 'android' && x.channel === 'Direct',
        );
      }
    }

    if (platformEnv.isNativeIOS) {
      packageInfo = releasePackages?.ios?.find((x) => x.os === 'ios');
    }

    if (platformEnv.isDesktop) {
      if (platformEnv.isDesktopLinux) {
        packageInfo = releasePackages?.desktop?.find((x) => x.os === 'linux');
      }
      if (platformEnv.isDesktopMac) {
        packageInfo = releasePackages?.desktop?.find((x) => {
          if (platformEnv.isDesktopMacArm64) {
            return x.os === 'macos-arm64';
          }

          return x.os === 'macos-x64';
        });
      }
      if (platformEnv.isDesktopWin) {
        packageInfo = releasePackages?.desktop?.find((x) => x.os === 'win');
      }
    }

    if (platformEnv.isExtension) {
      if (platformEnv.isExtChrome) {
        packageInfo = releasePackages?.extension?.find(
          (x) => x.os === 'chrome',
        );
      }
      if (platformEnv.isExtFirefox) {
        packageInfo = releasePackages?.extension?.find(
          (x) => x.os === 'firefox',
        );
      }
    }

    if (packageInfo) {
      if (
        !packageInfo ||
        // localVersion >= releaseVersion
        semver.gte(
          store.getState().settings.version ?? '0.0.0',
          packageInfo.version,
        )
      ) {
        //  没有更新
        return undefined;
      }

      return {
        package: packageInfo,
      };
    }

    return undefined;
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
    oldVersion: string,
    newVersion: string,
  ): Promise<string | undefined> {
    const releaseInfo = await getChangeLog(oldVersion, newVersion);

    let locale = store.getState().settings.locale ?? 'en-US';
    if (locale === 'system') {
      locale = getDefaultLocale();
    }

    return releaseInfo?.[locale];
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
