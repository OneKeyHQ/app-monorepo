import { useEffect, useRef } from 'react';

import { CommonActions } from '@react-navigation/routers';
import { useIntl } from 'react-intl';

import { Dialog, rootNavigationRef } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { ERootRoutes } from '@onekeyhq/shared/src/routes/root';

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
      const intl = useIntl();
      const navigation = useAppNavigation();
      const onLock = useOnLockCallback();
      const { checkForUpdates, toUpdatePreviewPage } = useAppUpdateInfoCallback(
        false,
        false,
      );
      const isCheckingUpdate = useRef(false);
      useEffect(() => {
        if (platformEnv.isDesktop) {
          window.desktopApi.on('update/checkForUpdates', async () => {
            defaultLogger.update.app.log('checkForUpdates');
            if (isCheckingUpdate.current) {
              return;
            }
            isCheckingUpdate.current = true;
            const { isNeedUpdate, response } = await checkForUpdates();
            if (isNeedUpdate || response === undefined) {
              toUpdatePreviewPage(true, response);
            } else {
              Dialog.confirm({
                title: intl.formatMessage({
                  id: ETranslations.update_app_update,
                }),
                description: intl.formatMessage({
                  id: ETranslations.update_app_up_to_date,
                }),
                onClose: () => {
                  isCheckingUpdate.current = false;
                },
              });
            }
          });

          window.desktopApi.on('app/openSettings', () => {
            const openSettingPage = () => {
              navigation.pushModal(EModalRoutes.SettingModal, {
                screen: EModalSettingRoutes.SettingListModal,
              });
            };
            const routeState = rootNavigationRef.current?.getRootState();
            if (routeState) {
              const route = routeState.routes[routeState.routes.length - 1];
              if (
                route &&
                (route.params as { screen: string })?.screen ===
                  EModalRoutes.SettingModal
              ) {
                if (route.name === ERootRoutes.Modal) {
                  const routeLength = route.state?.routes?.[0]?.state?.routes.length || 1;
                  for (let i = 0; i < routeLength; i += 1)
                    setTimeout(() => {
                      rootNavigationRef.current?.goBack();
                    }, 10);
                  return;
                }
              }
            }
            openSettingPage();
          });

          window.desktopApi.on('app/lockNow', () => {
            void onLock();
          });
        }
      }, [checkForUpdates, intl, navigation, onLock, toUpdatePreviewPage]);
    }
  : () => undefined;

export function Bootstrap() {
  useEffect(() => {
    void backgroundApiProxy.serviceSetting.fetchCurrencyList();
  }, []);
  useDesktopEvents();
  return null;
}
