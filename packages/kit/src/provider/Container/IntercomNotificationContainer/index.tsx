import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

import { rootNavigationRef, useOnRouterChange } from '@onekeyhq/components';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import { setIntercomInAppMessageVisibility } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/shared/src/utils/appVisibility';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import {
  type IIntercomNavigationState,
  shouldShowIntercomInAppMessages,
} from './visibility';

function updateVisibility(visible: boolean) {
  void setIntercomInAppMessageVisibility(visible).catch(() => {
    console.warn('Failed to update Intercom message visibility');
  });
}

export function IntercomNotificationContainer() {
  const [isLocked] = useAppIsLockedAtom();
  const [isRouteAllowed, setIsRouteAllowed] = useState(false);
  const handleRouterChange = useCallback(
    (state: IIntercomNavigationState | undefined) => {
      setIsRouteAllowed(shouldShowIntercomInAppMessages(false, state));
    },
    [],
  );
  useOnRouterChange(handleRouterChange);

  useEffect(() => {
    if (!platformEnv.isNativeMainThread) {
      return;
    }
    const syncForeground = (isForeground: boolean) => {
      void backgroundApiProxy.serviceNotification
        .setSupportNotificationForeground({ isForeground })
        .catch(() => {
          console.warn(
            'Failed to update support notification foreground state',
          );
        });
    };
    const unsubscribe = onVisibilityStateChange(syncForeground);
    syncForeground(getCurrentVisibilityState());
    return () => {
      unsubscribe();
      syncForeground(false);
    };
  }, []);

  useEffect(() => {
    const navigation = rootNavigationRef.current;
    if (!navigation) {
      return;
    }
    const syncRoute = () => handleRouterChange(navigation.getRootState());
    syncRoute();
    return navigation.addListener('ready', syncRoute);
  }, [handleRouterChange]);

  const visible = !isLocked && isRouteAllowed;
  useLayoutEffect(() => {
    updateVisibility(visible);
    return () => updateVisibility(false);
  }, [visible]);

  return null;
}
