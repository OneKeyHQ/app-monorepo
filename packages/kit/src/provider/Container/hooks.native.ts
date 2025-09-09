import { useEffect, useRef } from 'react';

import notifee from '@notifee/react-native';

export const useInitialNotification = () => {
  const coldStartRef = useRef(true);
  useEffect(() => {
    setTimeout(async () => {
      coldStartRef.current = false;
      if (coldStartRef.current) {
        const notifeeNotification = await notifee.getInitialNotification();
        alert(`notifeeNotification: ${JSON.stringify(notifeeNotification)}`);
      }
    }, 650);
  }, []);
};
