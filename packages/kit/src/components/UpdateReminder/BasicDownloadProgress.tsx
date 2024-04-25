import { useCallback } from 'react';

import { useDownloadProgress } from '@onekeyhq/shared/src/modules3rdParty/auto-update';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

export function DownloadProgress() {
  const onSuccess = useCallback(() => {
    void backgroundApiProxy.serviceAppUpdate.readyToInstall();
  }, []);
  const onFailed = useCallback((e: { message: string }) => {
    void backgroundApiProxy.serviceAppUpdate.notifyFailed(e);
  }, []);
  const percent = useDownloadProgress(onSuccess, onFailed);
  return `Downloading Package... ${percent}%`;
}
