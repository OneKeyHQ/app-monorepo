import { useEffect, useRef } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';

import { rootNavigationRef } from '@onekeyhq/components';
import {
  APP_MENU_GITHUB_URL,
  APP_MENU_HELP_CENTER_URL,
  APP_MENU_OFFICIAL_WEBSITE_URL,
  APP_MENU_X_URL,
} from '@onekeyhq/shared/src/consts/appMenuConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import mainMenu from '@onekeyhq/shared/src/modules/MainMenu';
import type { IMainMenuCommand } from '@onekeyhq/shared/src/modules/MainMenu';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../hooks/useAppNavigation';
import { useOnLock } from '../hooks/useOnLock';

import { showAboutDialog } from './showAboutDialog';

function isSettingsModalOnTop() {
  const routes = rootNavigationRef.current?.getRootState()?.routes;
  const topRoute = routes?.[routes.length - 1];
  // Once the modal navigator has mounted, its state names the focused modal;
  // `params.screen` only describes the initial navigation.
  const modalState = topRoute?.state;
  const focusedModal =
    modalState?.routes[modalState.index ?? modalState.routes.length - 1]?.name;
  return (
    (focusedModal ??
      (topRoute?.params as { screen?: string } | undefined)?.screen) ===
    EModalRoutes.SettingModal
  );
}

// The iPadOS menu bar (shown in resizable windows) mirrors the desktop app
// menu: About, Preferences and Lock Now, plus the desktop Help links.
export const useIPadMainMenu = platformEnv.isNativeIOSPad
  ? () => {
      const intl = useIntl();
      const navigation = useAppNavigation();
      const onLock = useOnLock();

      useEffect(() => {
        mainMenu.setConfig({
          aboutTitle: intl.formatMessage({
            id: ETranslations.menu_about_onekey_wallet,
          }),
          preferencesTitle: intl.formatMessage({
            id: ETranslations.menu_preferences,
          }),
          lockNowTitle: intl.formatMessage({
            id: ETranslations.menu_lock_now,
          }),
          helpLinks: [
            {
              title: intl.formatMessage({
                id: ETranslations.menu_visit_help_center,
              }),
              url: APP_MENU_HELP_CENTER_URL,
            },
            {
              title: intl.formatMessage({
                id: ETranslations.menu_official_website,
              }),
              url: APP_MENU_OFFICIAL_WEBSITE_URL,
            },
            { title: 'Github', url: APP_MENU_GITHUB_URL },
            { title: 'X', url: APP_MENU_X_URL },
          ],
        });
      }, [intl]);

      const handleCommandRef =
        useRef<(command: IMainMenuCommand) => void>(noop);
      handleCommandRef.current = (command) => {
        switch (command) {
          case 'about':
            showAboutDialog({
              intl,
              platformLabel: `iPadOS ${String(Platform.Version)}`,
            });
            break;
          case 'preferences':
            if (!isSettingsModalOnTop()) {
              navigation.pushModal(EModalRoutes.SettingModal, {
                screen: EModalSettingRoutes.SettingListModal,
              });
            }
            break;
          case 'lockNow':
            void onLock();
            break;
          default:
            break;
        }
      };

      useEffect(
        () =>
          mainMenu.addCommandListener((command) => {
            handleCommandRef.current(command);
          }),
        [],
      );
    }
  : noop;
