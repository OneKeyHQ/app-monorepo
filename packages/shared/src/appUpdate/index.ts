import semver from 'semver';

export * from './handle';
export * from './type';

export const isNeedUpdate = (currentVersion?: string, latestVersion?: string) =>
  currentVersion && latestVersion && semver.gt(latestVersion, currentVersion);
