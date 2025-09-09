import { useEffect, useRef } from 'react';

import notifee from '@notifee/react-native';

export const useInitialNotification = () => {
  const coldStartRef = useRef(true);
  useEffect(() => {
    setTimeout(async () => {
      if (coldStartRef.current) {
        coldStartRef.current = false;
        const notifeeNotification = await notifee.getInitialNotification();
        alert(`notifeeNotification: ${JSON.stringify(notifeeNotification)}`);
      }
    }, 650);
  }, []);
};
