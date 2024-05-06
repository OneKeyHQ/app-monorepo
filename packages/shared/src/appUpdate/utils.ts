
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
