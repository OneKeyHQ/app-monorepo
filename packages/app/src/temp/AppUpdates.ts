import {
  Linking,
  NativeEventEmitter,
  NativeModules,
  Platform,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';

const { AndroidUpdateModule } = NativeModules;

// eslint-disable-next-line no-shadow
export enum UpdateTypes {
  IMMEDIATE = 1,
  FLEXIBLE = 0,
}

// eslint-disable-next-line no-shadow
export enum AppUpdateState {
  UNKNOWN = 0,
  PENDING = 1,
  DOWNLOADING = 2,
  DOWNLOADED = 11,
  INSTALLING = 3,
  INSTALLED = 4,
  FAILED = 5,
  CANCELED = 6,
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
  on(): NativeEventEmitter {
    return new NativeEventEmitter(AndroidUpdateModule);
  }

  checkAppUpdate(): Promise<{
    updateType: number;
    versionName: string;
    appStoreUrl: string | null; // iOS Only
  }> {
    switch (Platform.OS) {
      case 'android':
        return AndroidUpdateModule.checkUpdateStatus();
      case 'ios':
        return this._checkIOSUpdate();
      default:
        throw new Error('Unsupported platforms');
    }
  }

  updateApp(
    updateType: UpdateTypes,
    appstoreUrl: string /* iOS Only */,
  ): Promise<void | any> {
    switch (Platform.OS) {
      case 'android':
        return AndroidUpdateModule.appUpdate(updateType);
      case 'ios':
        return Linking.openURL(appstoreUrl).catch((err) =>
          console.error('An error occurred', err),
        );
      default:
        throw new Error('Unsupported platforms');
    }
  }

  installUpdate(): Promise<void | any> {
    switch (Platform.OS) {
      case 'android':
        return AndroidUpdateModule.installUpdate();
      default:
        throw new Error('Unsupported platforms');
    }
  }

  cancelUpdate(): Promise<void | any> {
    switch (Platform.OS) {
      case 'android':
        return AndroidUpdateModule.cancelUpdate();
      default:
        throw new Error('Unsupported platforms');
    }
  }

  // 检查app更新
  async _getIosAppStoreVersion(): Promise<IOSAppStoreVersion> {
    const bundleId = DeviceInfo.getBundleId();
    const versionResponse = await fetch(
      // `https://itunes.apple.com/lookup?bundleId=${bundleId}`,
      `https://itunes.apple.com/lookup?bundleId=com.onekey.wallet`,
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

  async _checkIOSUpdate(): Promise<{
    updateType: number;
    versionName: string;
    appStoreUrl: string;
  }> {
    const updateRequest = await fetch(
      'https://data.onekey.so/version.json?a=3',
    );
    const updateInfo =
      (await updateRequest.json()) as unknown as AppUpdateVersionInfo;

    const appStoreVersion: VersionInfo = updateInfo.ios.appstore;
    const buildNumber = DeviceInfo.getBuildNumber();
    const currentBuildNumber = Number(buildNumber);

    const appStoreVersionInfo = await this._getIosAppStoreVersion();

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

    if (Number(appStoreVersion.forceVersionCode ?? 0) > currentBuildNumber) {
      // 强制更新
      return {
        updateType: UpdateTypes.IMMEDIATE,
        versionName: appStoreVersion.versionName,
        appStoreUrl: appStoreVersionInfo.trackViewUrl,
      };
    }

    if (Number(appStoreVersion.versionCode) > currentBuildNumber) {
      // 更新
      return {
        updateType: UpdateTypes.FLEXIBLE,
        versionName: appStoreVersion.versionName,
        appStoreUrl: appStoreVersionInfo.trackViewUrl,
      };
    }

    throw new Error(
      JSON.stringify({ 'code': 1000, 'message': 'No update available' }),
    );
  }
}

export default AppUpdates;
