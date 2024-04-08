import type { IPackageChangelog } from './type';

export const getVersionAndChangeLog = (
  {
    version,
    miniVersion,
    minVersion,
  }: {
    version?: number[];
    miniVersion?: number[];
    minVersion?: number[];
  },
  changeLogs: IPackageChangelog[],
) => {
  const latestVersion = (miniVersion ?? minVersion ?? version)?.join('.');
  const changelog = changeLogs?.find((v) => v.version === latestVersion);
  return {
    latestVersion,
    changelog,
    isForceUpdate: !!(miniVersion ?? minVersion),
  };
};
