import { useCallback } from 'react';

import { useDownloadProgress } from '@onekeyhq/shared/src/modules3rdParty/downloadModule';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

export function DownloadPercents() {
  const onDownloaded = useCallback(() => {
    void backgroundApiProxy.serviceAppUpdate.readyToInstall();
  }, []);
  const percent = useDownloadProgress(onDownloaded);
  return `Downloading Package... ${percent}%`;
}
