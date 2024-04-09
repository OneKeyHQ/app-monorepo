import { useEffect, useMemo } from 'react';

import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { isNeedUpdate } from '@onekeyhq/shared/src/appUpdate';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

export const useFetchAppUpdateInfo = () => {
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  useEffect(() => {
    void backgroundApiProxy.ServiceAppUpdate.fetchAppUpdateInfo();
  }, []);
  return useMemo(
    () =>
      isNeedUpdate(appUpdateInfo.version, appUpdateInfo.latestVersion)
        ? appUpdateInfo
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appUpdateInfo.version, appUpdateInfo.latestVersion],
  );
};
