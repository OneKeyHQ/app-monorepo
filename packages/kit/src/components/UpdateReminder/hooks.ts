import { useEffect } from 'react';

import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

export const useFetchAppUpdateInfo = () => {
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  useEffect(() => {
    void backgroundApiProxy.ServiceAppUpdate.fetchAppUpdateInfo();
  }, []);
  console.log(appUpdateInfo);
  return appUpdateInfo;
};
