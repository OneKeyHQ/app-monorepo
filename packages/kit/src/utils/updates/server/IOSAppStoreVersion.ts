import axios from 'axios';

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

// 检查 AppStore 更新
export function getIosAppStoreCurrentVersion(): Promise<IOSAppStoreVersion | null> {
  return axios
    .get<IOSAppStoreVersionInfo>(
      'https://itunes.apple.com/lookup?bundleId=so.onekey.wallet',
    )
    .then((res) => {
      const releasesVersions = res.data;
      return releasesVersions.results[0] ?? null;
    })
    .catch(() => null);
}
