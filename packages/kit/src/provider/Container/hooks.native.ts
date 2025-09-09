import { useEffect, useRef } from 'react';

import launchOptionsManager from '@onekeyhq/shared/src/modules/LaunchOptionsManager';

export const useInitialNotification = () => {
  const coldStartRef = useRef(true);
  useEffect(() => {
    setTimeout(async () => {
      if (coldStartRef.current) {
        coldStartRef.current = false;
        const launchOptions = await launchOptionsManager.getLaunchOptions();
        alert(`initialNotification: ${JSON.stringify(launchOptions)}`);
      }
    }, 650);
  }, []);
};
