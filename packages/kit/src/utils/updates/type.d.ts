export type OS = 'any' | 'android' | 'ios' | 'mac' | 'linux' | 'win';

export type Distribution =
  | 'DIRECT'
  | 'GooglePlay'
  | 'AppStore'
  | 'FireFox'
  | 'Chrome';

export type Arch = 'any' | 'x86' | 'arm64' | 'x64';

export interface PackageInfo {
  os: OS;
  distribution: Distribution;
  arch: Arch;
  download: string;
}

export interface PackagesInfo {
  ios: PackageInfo[];
  android: PackageInfo[];
  desktop: PackageInfo[];
  extension: PackageInfo[];
}

export interface ReleasesInfo {
  version: string;
  forceVersion: string;
  buildNumber: string;
  changeLog: string;
  packages: PackagesInfo | undefined;
}

export interface VersionInfo {
  version: string;
  forceVersion: string;
  buildNumber: string;
  changeLog: string;
  package: PackageInfo;
}
