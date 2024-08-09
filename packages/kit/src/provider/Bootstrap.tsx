import { useEffect } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { useAppUpdateInfo } from '../components/UpdateReminder/hooks';
import useAppNavigation from '../hooks/useAppNavigation';
import { useOnLock } from '../views/Setting/pages/List/DefaultSection';

const useOnLockCallback = platformEnv.isDesktop
  ? useOnLock
  : () => () => undefined;

const useAppUpdateInfoCallback = platformEnv.isDesktop
  ? useAppUpdateInfo
  : () => ({} as ReturnType<typeof useAppUpdateInfo>);

const useDesktopEvents = platformEnv.isDesktop
  ? () => {
      const navigation = useAppNavigation();
      const onLock = useOnLockCallback();
      const { checkForUpdates, toUpdatePreviewPage } = useAppUpdateInfoCallback(
        false,
        false,
      );
      useEffect(() => {
        if (platformEnv.isDesktop) {
          window.desktopApi.on('update/checkForUpdates', async () => {
            defaultLogger.update.app.log('checkForUpdates');
            const { isNeedUpdate, response } = await checkForUpdates();
            if (isNeedUpdate || response === undefined) {
              toUpdatePreviewPage(true, response);
            }
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
      }, [checkForUpdates, navigation, onLock, toUpdatePreviewPage]);
    }
  : () => undefined;

export function Bootstrap() {
  useEffect(() => {
    void backgroundApiProxy.serviceSetting.fetchCurrencyList();
  }, []);
  useDesktopEvents();
  return null;
}
