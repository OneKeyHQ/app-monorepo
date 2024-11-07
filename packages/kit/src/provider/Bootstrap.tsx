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
import type { IDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getEndpointsMapByDevSettings } from '@onekeyhq/shared/src/config/endpointsMap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { configure as configureNetInfo } from '@onekeyhq/shared/src/modules3rdParty/@react-native-community/netinfo';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getRequestHeaders } from '@onekeyhq/shared/src/request/Interceptor';
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

const checkNetInfo = async (devSettings: IDevSettingsPersistAtom) => {
  const endpoints = getEndpointsMapByDevSettings(devSettings);
  const headers = await getRequestHeaders();
  configureNetInfo({
    reachabilityUrl: `${endpoints.wallet}/wallet/v1/health`,
    reachabilityMethod: 'GET',
    reachabilityHeaders: headers,
    reachabilityTest: async (response) => response.status === 200,
    reachabilityLongTimeout: 60 * 1000,
    reachabilityShortTimeout: 5 * 1000,
    reachabilityRequestTimeout: 10 * 1000,
    reachabilityShouldRun: () => true,
    // met iOS requirements to get SSID. Will leak memory if set to true without meeting requirements.
    shouldFetchWiFiSSID: true,
    useNativeReachability: false,
  });
};
const useNetInfo = () => {
  const [devSettings] = useDevSettingsPersistAtom();
  useEffect(() => {
    void checkNetInfo(devSettings);
  }, [devSettings]);
};

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
              id: ETranslations.update_app_update_latest_version,
            }),
            tone: 'success',
            icon: 'Ai3StarSolid',
            description: intl.formatMessage({
              id: ETranslations.update_app_up_to_date,
            }),
            onClose: () => {
              isCheckingUpdate.current = false;
            },
            onConfirmText: intl.formatMessage({
              id: ETranslations.global_ok,
            }),
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
        globalThis.desktopApi.on(ipcMessageKeys.CHECK_FOR_UPDATES, () => {
          void onCheckUpdateRef.current();
        });

        const debounceOpenSettings = debounce((isVisible: boolean) => {
          openSettingsRef.current(isVisible);
        }, 250);
        globalThis.desktopApi.on(
          ipcMessageKeys.APP_OPEN_SETTINGS,
          debounceOpenSettings,
        );

        globalThis.desktopApi.on(ipcMessageKeys.APP_LOCK_NOW, () => {
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

const useAboutVersion = () => {
  const intl = useIntl();
  useEffect(() => {
    if (platformEnv.isDesktop && !platformEnv.isDesktopMac) {
      desktopApi.on(ipcMessageKeys.SHOW_ABOUT_WINDOW, () => {
        const versionString = intl.formatMessage(
          {
            id: ETranslations.settings_version_versionnum,
          },
          {
            'versionNum': ` ${process.env.VERSION || 1}(${
              platformEnv.buildNumber || 1
            })`,
          },
        );
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
                  {`${globalThis.desktopApi.platform}-${
                    globalThis.desktopApi.arch || 'unknown'
                  }`}
                </SizableText>
                <SizableText size="$bodySm">{versionString}</SizableText>
                <SizableText size="$bodySm">Copyright © OneKey</SizableText>
              </YStack>
            </YStack>
          ),
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

export const useFetchCurrencyList = () => {
  useEffect(() => {
    void backgroundApiProxy.serviceSetting.fetchCurrencyList();
  }, []);
};

export function Bootstrap() {
  useFetchCurrencyList();
  useAboutVersion();
  useNetInfo();
  useDesktopEvents();
  return null;
}
