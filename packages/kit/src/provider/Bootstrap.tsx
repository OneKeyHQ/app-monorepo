import { useEffect } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import useAppNavigation from '../hooks/useAppNavigation';
import { useOnLock } from '../views/Setting/pages/List/DefaultSection';

const useOnLockCallback = platformEnv.isDesktop
  ? useOnLock
  : () => () => undefined;

export function Bootstrap() {
  const navigation = useAppNavigation();
  const onLock = useOnLockCallback();
  useEffect(() => {
    void backgroundApiProxy.serviceSetting.fetchCurrencyList();
    if (platformEnv.isDesktop) {
      window.desktopApi.on('update/checkForUpdates', () => {
        defaultLogger.update.app.log('checkForUpdates');
      });

      window.desktopApi.on('app/openSettings', () => {
        navigation.pushModal(EModalRoutes.SettingModal, {
          screen: EModalSettingRoutes.SettingListModal,
        });
      });

      window.desktopApi.on('app/lockNow', () => {
        void onLock();
      });
    }
  }, [navigation, onLock]);
  return null;
}
