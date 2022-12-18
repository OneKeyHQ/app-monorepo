import differenceInDays from 'date-fns/differenceInDays';
import * as Linking from 'expo-linking';
import semver from 'semver';

import { ToastManager } from '@onekeyhq/components';
import { formatMessage } from '@onekeyhq/components/src/Provider';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import store from '@onekeyhq/kit/src/store';
import {
  available,
  checking,
  downloading,
  error,
  notAvailable,
  ready,
} from '@onekeyhq/kit/src/store/reducers/autoUpdater';
import { setUpdateSetting } from '@onekeyhq/kit/src/store/reducers/settings';
import { getTimeStamp } from '@onekeyhq/kit/src/utils/helper';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getDefaultLocale } from '../locale';

import { getChangeLog, getPreReleaseInfo, getReleaseInfo } from './server';

import type { PackageInfo, PackagesInfo, VersionInfo } from './type.d';

class AppUpdates {
  addedListener = false;

  checkUpdate(isManual = false) {
    if (platformEnv.isMas) return;
    if (platformEnv.isDesktop) {
      this.checkDesktopUpdate(isManual);
      return;
    }

    return this.checkAppUpdate();
  }

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

  checkDesktopUpdate(isManual = false) {
    debugLogger.autoUpdate.debug('check desktop update');
    window.desktopApi.checkForUpdates(isManual);
  }

  openAppUpdate(versionInfo: VersionInfo): void {
    switch (versionInfo.package.channel) {
      case 'AppStore':
        Linking.canOpenURL('itms-apps://').then((supported) => {
          if (supported) {
            Linking.openURL('itms-apps://itunes.apple.com/app/id1609559473');
          } else {
            this._openUrl(versionInfo.package.download);
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
    if (!releaseInfo) return;

    let locale = store.getState().settings.locale ?? 'en-US';
    if (locale === 'system') {
      locale = getDefaultLocale();
    }

    return releaseInfo[locale];
  }

  _openUrl(url: string) {
    if (platformEnv.isNative) {
      Linking.openURL(url);
    } else {
      window.open(url, '_blank');
    }
  }

  skipVersionCheck(version: string) {
    const { updateLatestVersion = null, updateLatestTimeStamp = null } =
      store.getState().settings.updateSetting ?? {};

    debugLogger.autoUpdate.debug(
      'skipVersionCheck params updateLatestVersion: ',
      updateLatestVersion,
      ' , updateLatestTimeStamp: ',
      updateLatestTimeStamp,
      ' , version: ',
      version,
    );

    if (
      updateLatestVersion &&
      semver.valid(updateLatestVersion) &&
      semver.valid(version) &&
      semver.eq(updateLatestVersion, version) &&
      updateLatestTimeStamp
    ) {
      if (differenceInDays(getTimeStamp(), updateLatestTimeStamp) < 7) {
        debugLogger.autoUpdate.debug(
          'Last operation within 7 days, skip check',
        );
        return true;
      }
    }
    debugLogger.autoUpdate.debug('should not skip check version');
    return false;
  }

  addUpdaterListener() {
    if (this.addedListener) return;
    if (!platformEnv.isDesktop) return;
    this.addedListener = true;
    const { dispatch } = backgroundApiProxy;
    const { autoDownload = true } =
      store.getState().settings.updateSetting ?? {};
    window.desktopApi?.on?.('update/checking', () => {
      debugLogger.autoUpdate.debug('update/checking');
      dispatch(checking());
    });
    window.desktopApi?.on?.('update/available', ({ version }) => {
      debugLogger.autoUpdate.debug('update/available, version: ', version);
      dispatch(available({ version }));
      if (autoDownload && !this.skipVersionCheck(version)) {
        debugLogger.autoUpdate.debug(
          'update/available should download new version',
        );
        window.desktopApi.downloadUpdate();
      }
    });
    window.desktopApi?.on?.(
      'update/not-available',
      ({ version, isManualCheck }) => {
        debugLogger.autoUpdate.debug(
          'update/not-available, version: ',
          version,
        );
        dispatch(notAvailable({ version }));
        if (isManualCheck) {
          ToastManager.show({
            title: formatMessage({ id: 'msg__using_latest_release' }),
          });
        }
      },
    );
    window.desktopApi?.on?.(
      'update/error',
      ({ version, err, isNetworkError }) => {
        debugLogger.autoUpdate.debug('update/error, err: ', err);
        dispatch(error());
        if (isNetworkError) {
          dispatch(
            setUpdateSetting({
              updateLatestVersion: version,
              updateLatestTimeStamp: getTimeStamp(),
            }),
          );
        }
      },
    );
    window.desktopApi?.on?.('update/downloading', (progress: any) => {
      debugLogger.autoUpdate.debug(
        'update/downloading, progress: ',
        JSON.stringify(progress),
      );
      dispatch(downloading(progress));
    });
    window.desktopApi.on('update/downloaded', ({ version }) => {
      debugLogger.autoUpdate.debug('update/downloaded');
      dispatch(ready({ version }));
      dispatch(
        setUpdateSetting({
          updateLatestVersion: null,
          updateLatestTimeStamp: null,
        }),
      );
    });
  }
}
const appUpdates = new AppUpdates();
export default appUpdates;
