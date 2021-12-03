import { Linking, NativeModules, Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

const { BuildConfigManager, InAppUpdate } = NativeModules;

// eslint-disable-next-line no-shadow
export enum UpdateTypes {
  IMMEDIATE = 1,
  FLEXIBLE = 0,
}

export interface AppUpdateVersionInfo {
  android: {
    website: VersionInfoWithDownload;
    googleplay: VersionInfo;
  };
  ios: {
    appstore: VersionInfo;
  };
}

export interface VersionInfo {
  versionCode: string;
  versionName: string;
  forceVersionCode: string | null;
}

export interface VersionInfoWithDownload extends VersionInfo {
  url: string;
  size: string;
}

export interface IOSAppStoreVersionInfo {
  resultCount: number;
  results: IOSAppStoreVersion[];
}

export interface IOSAppStoreVersion {
  features: string[];
  supportedDevices: string[];
  advisories: string[];
  minimumOsVersion: string;
  trackCensoredName: string;
  languageCodesISO2A: string[];
  fileSizeBytes: string;
  formattedPrice: string;
  contentAdvisoryRating: string;
  averageUserRatingForCurrentVersion: number;
  userRatingCountForCurrentVersion: number;
  averageUserRating: number;
  trackViewUrl: string;
  trackContentRating: string;
  currency: string;
  bundleId: string;
  trackId: number;
  trackName: string;
  releaseDate: string;
  primaryGenreName: string;
  genreIds: string[];
  isVppDeviceBasedLicensingEnabled: boolean;
  currentVersionReleaseDate: string;
  sellerName: string;
  releaseNotes: string;
  primaryGenreId: number;
  version: string;
  wrapperType: string;
  artistId: number;
  artistName: string;
  genres: string[];
  price: number;
  description: string;
  userRatingCount: number;
}

export type ChangeLogs = ChangeLog[];

export interface ChangeLog {
  versionName: string;
  title: string;
  changelog: string;
  timestamp: number;
}

class AppUpdates {
  checkAppUpdate(): Promise<{
    updateType: number;
    versionName: string;
    appStoreUrl: string | null; // iOS Only
  }> {
    switch (Platform.OS) {
      case 'android':
        if (this._checkGoogleChannel()) {
          return new Promise((resolve) => {
            InAppUpdate.checkUpdate();
            resolve({
              updateType: UpdateTypes.IMMEDIATE,
              versionName: '1.0.0',
              appStoreUrl: '',
            });
          });
        }
        return this._checkAppUpdate(true);
      case 'ios':
        return this._checkAppUpdate(false);
      default:
        throw new Error('Unsupported platforms');
    }
  }

  updateApp(
    updateType: UpdateTypes,
    appstoreUrl: string /* iOS、Android Website Only */,
  ): Promise<void | any> {
    switch (Platform.OS) {
      case 'android':
        if (!this._checkGoogleChannel()) {
          return Linking.openURL(appstoreUrl).catch((err) =>
            console.error('An error occurred', err),
          );
        }
        throw new Error('Unsupported platforms');
      case 'ios':
        return Linking.openURL(appstoreUrl).catch((err) =>
          console.error('An error occurred', err),
        );
      default:
        throw new Error('Unsupported platforms');
    }
  }

  // 检查app更新
  async _getIosAppStoreVersion(): Promise<IOSAppStoreVersion> {
    const bundleId = DeviceInfo.getBundleId();
    const versionResponse = await fetch(
      `https://itunes.apple.com/lookup?bundleId=${bundleId}`,
    );
    const response =
      (await versionResponse.json()) as unknown as IOSAppStoreVersionInfo;
    if (response.results.length > 0) {
      return response.results[0];
    }
    throw new Error('Failed to obtain the version');
  }

  // 版本对比进行更新
  _comparison(version1: string, version2: string): number {
    const arr1 = version1.split('.');
    const arr2 = version2.split('.');
    for (let i = 0; i < arr1.length; ) {
      if (arr1[i] === arr2[i]) {
        i += 1;
      } else if (arr1[i] < arr2[i]) {
        return 1;
      } else {
        return -1;
      }
    }
    return 0;
  }

  _checkGoogleChannel(): boolean {
    return BuildConfigManager.getChannel() === 'GooglePlay';
  }

  async _checkAppUpdate(isAndroid: boolean): Promise<{
    updateType: number;
    versionName: string;
    appStoreUrl: string;
  }> {
    const updateRequest = await fetch(
      'https://data.onekey.so/version.json?a=3',
    );
    const updateInfo =
      (await updateRequest.json()) as unknown as AppUpdateVersionInfo;

    let appStoreVersion: VersionInfo;
    if (isAndroid) {
      appStoreVersion = updateInfo.android.website;
    } else {
      appStoreVersion = updateInfo.ios.appstore;
    }

    const buildNumber = DeviceInfo.getBuildNumber();
    const currentBuildNumber = Number(buildNumber);

    let appStoreVersionInfo: IOSAppStoreVersion | null = null;
    if (!isAndroid) {
      appStoreVersionInfo = await this._getIosAppStoreVersion();

      if (
        this._comparison(
          appStoreVersionInfo.version,
          appStoreVersion.versionName,
        ) < 0
      ) {
        throw new Error(
          JSON.stringify({ 'code': 1000, 'message': 'No update available' }),
        );
      }
    }

    let storeUrl = '';
    if (isAndroid) {
      if (!this._checkGoogleChannel()) {
        storeUrl = (appStoreVersion as VersionInfoWithDownload).url;
      }
    } else {
      storeUrl = appStoreVersionInfo?.trackViewUrl ?? '';
    }

    if (Number(appStoreVersion.forceVersionCode ?? 0) > currentBuildNumber) {
      // 强制更新
      return {
        updateType: UpdateTypes.IMMEDIATE,
        versionName: appStoreVersion.versionName,
        appStoreUrl: storeUrl,
      };
    }

    if (Number(appStoreVersion.versionCode) > currentBuildNumber) {
      // 更新
      return {
        updateType: UpdateTypes.FLEXIBLE,
        versionName: appStoreVersion.versionName,
        appStoreUrl: storeUrl,
      };
    }

    throw new Error(
      JSON.stringify({ 'code': 1000, 'message': 'No update available' }),
    );
  }
}

export default AppUpdates;
