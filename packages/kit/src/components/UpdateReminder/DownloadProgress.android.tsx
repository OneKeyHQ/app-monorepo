import { useCallback } from 'react';

import { useDownloadProgress } from '@onekeyhq/shared/src/modules3rdParty/download-module';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

export function DownloadProgress() {
  const onDownloaded = useCallback(() => {
    void backgroundApiProxy.serviceAppUpdate.readyToInstall();
  }, []);
  const percent = useDownloadProgress(onDownloaded);
  return `Downloading Package... ${percent}%`;
}
