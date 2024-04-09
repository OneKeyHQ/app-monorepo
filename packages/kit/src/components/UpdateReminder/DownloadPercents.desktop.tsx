import { useEffect, useState } from 'react';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

export function DownloadPercents() {
  const [percent, setPercent] = useState(0);
  useEffect(() => {
    window.desktopApi.downloadUpdate();
    window.desktopApi?.on?.(
      'update/downloading',
      (progress: {
        total: number;
        delta: number;
        transferred: number;
        percent: number;
        bytesPerSecond: number;
      }) => {
        console.log('update/downloading, progress: ', JSON.stringify(progress));
        setPercent(progress.percent);
      },
    );
    window.desktopApi.on('update/downloaded', () => {
      console.log('update/downloaded');
      void backgroundApiProxy.ServiceAppUpdate.readToInstall();
    });
  }, []);
  return `Downloading Package... ${percent}%`;
}
