import type { IPackageChangelog } from './type';

export const getVersion = ({
  version,
  miniVersion,
  minVersion,
}: {
  version?: number[];
  miniVersion?: number[];
  minVersion?: number[];
}) => {
  const latestVersion = (miniVersion ?? minVersion ?? version)?.join('.');
  return {
    latestVersion,
    isForceUpdate: !!(miniVersion ?? minVersion),
  };
};

export const getChangeLog = (
  version: string,
  changeLogs: IPackageChangelog[],
) => {
  const changeLog = changeLogs?.find((v) => v.version === version);
  return changeLog?.locale;
};
