import { useCallback } from 'react';

import { useHandleAppStateActive } from '@onekeyhq/kit/src/hooks/useHandleAppStateActive';
import {
  getBadgeCountAsync,
  requestPermissionsAsync,
  setBadgeCountAsync,
} from '@onekeyhq/shared/src/modules3rdParty/expo-notifications';

export const StateActiveContainer = () => {
  const handler = useCallback(() => {
    const main = async () => {
      const badgeCount = await getBadgeCountAsync();
      if (badgeCount > 0) {
        const permissionsResult = await requestPermissionsAsync({
          ios: { allowBadge: true },
        });
        if (permissionsResult.granted) {
          await setBadgeCountAsync(0);
        }
      }
    };
    void main();
  }, []);
  // clear ios app notification badge
  useHandleAppStateActive(handler);
  return null;
};
