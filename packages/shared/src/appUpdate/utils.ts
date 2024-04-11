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
  const changeLog = changeLogs?.find((v) => v.version === latestVersion);
  return {
    latestVersion,
    changeLog: changeLog?.locale,
    isForceUpdate: !!(miniVersion ?? minVersion),
  };
};
