import { useCallback, useEffect, useRef } from 'react';

import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Dialog,
  Image,
  SizableText,
  YStack,
  rootNavigationRef,
  useShortcuts,
} from '@onekeyhq/components';
import { ipcMessageKeys } from '@onekeyhq/desktop/src-electron/config';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
  EModalSettingRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { ERootRoutes } from '@onekeyhq/shared/src/routes/root';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

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
        globalThis.desktopApi.on('update/checkForUpdates', () => {
          void onCheckUpdateRef.current();
        });

        const debounceOpenSettings = debounce((isVisible: boolean) => {
          openSettingsRef.current(isVisible);
        }, 250);
        globalThis.desktopApi.on('app/openSettings', debounceOpenSettings);

        globalThis.desktopApi.on('app/lockNow', () => {
          void useOnLockRef.current();
        });
      }, []);

      useShortcuts(undefined, (eventName) => {
        switch (eventName) {
          case EShortcutEvents.TabWallet:
            navigation.switchTab(ETabRoutes.Home);
            break;
          case EShortcutEvents.TabEarn:
            navigation.switchTab(ETabRoutes.Earn);
            break;
          case EShortcutEvents.TabSwap:
            navigation.switchTab(ETabRoutes.Swap);
            break;
          case EShortcutEvents.TabMarket:
            navigation.switchTab(ETabRoutes.Market);
            break;
          case EShortcutEvents.TabBrowser:
            navigation.switchTab(ETabRoutes.Discovery);
            break;
          case EShortcutEvents.NewTab:
          case EShortcutEvents.NewTab2:
            navigation.pushModal(EModalRoutes.DiscoveryModal, {
              screen: EDiscoveryModalRoutes.SearchModal,
            });
            break;
          default:
            break;
        }
      });
    }
  : () => undefined;

export function Bootstrap() {
  useEffect(() => {
    void backgroundApiProxy.serviceSetting.fetchCurrencyList();
    if (platformEnv.isDesktop && !platformEnv.isDesktopMac) {
      desktopApi.on(ipcMessageKeys.SHOW_ABOUT_WINDOW, () => {
        Dialog.show({
          showFooter: false,
          renderContent: (
            <YStack gap={4} alignItems="center" pt="$4">
              <Image
                source={require('../../assets/logo.png')}
                size={72}
                borderRadius="$full"
              />
              <YStack gap="$2" pt="$4" alignItems="center">
                <SizableText size="$heading2xl">OneKey</SizableText>
                <SizableText size="$bodySm">
                  Version {process.env.VERSION}({platformEnv.buildNumber})
                </SizableText>
                <SizableText size="$bodySm">Copyright © OneKey</SizableText>
              </YStack>
            </YStack>
          ),
        });
      });
    }
  }, []);
  useDesktopEvents();
  return null;
}
