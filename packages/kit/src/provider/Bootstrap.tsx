import { useCallback, useEffect, useRef } from 'react';

import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import { Dialog, rootNavigationRef } from '@onekeyhq/components';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { ERootRoutes } from '@onekeyhq/shared/src/routes/root';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { useWebAuthActions } from '../components/BiologyAuthComponent/hooks/useWebAuthActions';
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
      const useOnLockRef = useRef(onLock);
      useOnLockRef.current = onLock;

      const { checkForUpdates, toUpdatePreviewPage } = useAppUpdateInfoCallback(
        false,
        false,
      );
      const isCheckingUpdate = useRef(false);

      const onCheckUpdate = useCallback(async () => {
        defaultLogger.update.app.log('checkForUpdates');
        if (isCheckingUpdate.current) {
          return;
        }
        isCheckingUpdate.current = true;
        const { isNeedUpdate, response } = await checkForUpdates();
        if (isNeedUpdate || response === undefined) {
          toUpdatePreviewPage(true, response);
          isCheckingUpdate.current = false;
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
      }, [checkForUpdates, intl, toUpdatePreviewPage]);

      const onCheckUpdateRef = useRef(onCheckUpdate);
      onCheckUpdateRef.current = onCheckUpdate;

      const openSettings = useCallback(
        (isMainWindowVisible: boolean) => {
          const openSettingPage = () => {
            navigation.pushModal(EModalRoutes.SettingModal, {
              screen: EModalSettingRoutes.SettingListModal,
            });
          };

          // close Settings page When MainWindow is visible
          if (isMainWindowVisible) {
            const routeState = rootNavigationRef.current?.getRootState();
            if (routeState) {
              const route = routeState.routes[routeState.routes.length - 1];
              if (
                route &&
                (route.params as { screen: string })?.screen ===
                  EModalRoutes.SettingModal
              ) {
                if (route.name === ERootRoutes.Modal) {
                  const routeLength =
                    route.state?.routes?.[0]?.state?.routes.length || 1;
                  for (let i = 0; i < routeLength; i += 1)
                    setTimeout(() => {
                      rootNavigationRef.current?.goBack();
                    }, 10);
                  return;
                }
              }
            }
          }

          openSettingPage();
        },
        [navigation],
      );

      const openSettingsRef = useRef(openSettings);
      openSettingsRef.current = openSettings;

      useEffect(() => {
        if (platformEnv.isDesktop) {
          window.desktopApi.on('update/checkForUpdates', () => {
            void onCheckUpdateRef.current();
          });

          const debounceOpenSettings = debounce((isVisible: boolean) => {
            openSettingsRef.current(isVisible);
          }, 250);
          window.desktopApi.on('app/openSettings', debounceOpenSettings);

          window.desktopApi.on('app/lockNow', () => {
            void useOnLockRef.current();
          });
        }
      }, []);
    }
  : () => undefined;

const useExtEvents = platformEnv.isExtension
  ? () => {
      const { verifiedPasswordWebAuth, checkWebAuth } = useWebAuthActions();
      const [{ webAuthCredentialId }] = usePasswordPersistAtom();
      useEffect(() => {
        const verifyPassKey = async () => {
          if (window.location.href.includes('passkey=true')) {
            console.log('verifiedPasswordWebAuth');
            const hasCachedPassword =
              webAuthCredentialId &&
              !!(await backgroundApiProxy.servicePassword.getCachedPassword());
            if (hasCachedPassword) {
              await verifiedPasswordWebAuth();
            } else {
              await checkWebAuth();
            }
          }
        };
        void verifyPassKey();
      }, [checkWebAuth, verifiedPasswordWebAuth, webAuthCredentialId]);
    }
  : () => undefined;

export function Bootstrap() {
  useEffect(() => {
    void backgroundApiProxy.serviceSetting.fetchCurrencyList();
  }, []);
  useDesktopEvents();
  useExtEvents();
  return null;
}
