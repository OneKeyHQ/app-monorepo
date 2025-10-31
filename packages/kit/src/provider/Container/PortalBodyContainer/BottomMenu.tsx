import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  EPortalContainerConstantName,
  Icon,
  Portal,
  SizableText,
  Stack,
  YStack,
  useIsIpadLandscape,
  useMedia,
} from '@onekeyhq/components';
import { DesktopTabItem } from '@onekeyhq/components/src/layouts/Navigation/Tab/TabBar/DesktopTabItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppSideBarStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useNotificationsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/notifications';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';
import { shortcutsKeys } from '@onekeyhq/shared/src/shortcuts/shortcutsKeys.enum';

function _NotificationButton() {
  const appNavigation = useAppNavigation();
  const openNotificationsModal = useCallback(async () => {
    appNavigation.pushModal(EModalRoutes.NotificationsModal, {
      screen: EModalNotificationsRoutes.NotificationList,
    });
  }, [appNavigation]);
  const [{ firstTimeGuideOpened, badge }] = useNotificationsAtom();
  return (
    <DesktopTabItem
      key="notifications"
      testID="headerRightNotificationsButton"
      onPress={openNotificationsModal}
      trackId="wallet-notification"
    >
      <Icon name="BellOutline" size="$5" color="$iconSubdued" />
      {!firstTimeGuideOpened || badge ? (
        <Stack
          position="absolute"
          right="$-0.5"
          top="$-0.5"
          p="$0.5"
          pointerEvents="none"
          bg="$bgApp"
          borderRadius="$full"
        >
          <Stack
            alignItems="center"
            justifyContent="center"
            minWidth="$4"
            h="$4"
            px="$1"
            bg="$bgCriticalStrong"
            borderRadius="$full"
          >
            {!firstTimeGuideOpened ? (
              <Stack
                width="$1"
                height="$1"
                backgroundColor="white"
                borderRadius="$full"
              />
            ) : (
              <SizableText color="$textOnColor" size="$headingXxs">
                {badge && badge > 99 ? '99+' : badge}
              </SizableText>
            )}
          </Stack>
        </Stack>
      ) : null}
    </DesktopTabItem>
  );
}

function BaseBottomMenu({ isCollapse }: { isCollapse: boolean }) {
  const intl = useIntl();
  const appNavigation = useAppNavigation();
  const openSettingPage = useCallback(() => {
    appNavigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListModal,
    });
  }, [appNavigation]);

  return (
    <YStack
      px="$3"
      py="$1.5"
      borderColor="$borderSubdued"
      borderTopWidth={StyleSheet.hairlineWidth}
      borderRightWidth={StyleSheet.hairlineWidth}
      bg="$bgSidebar"
      gap="$2"
      alignItems={isCollapse ? 'center' : undefined}
    >
      <DesktopTabItem
        onPress={openSettingPage}
        selected={false}
        icon="SettingsOutline"
        label={
          isCollapse
            ? ''
            : intl.formatMessage({
                id: ETranslations.settings_settings,
              })
        }
        shortcutKey={[shortcutsKeys.CmdOrCtrl, ',']}
        testID="setting"
      />
    </YStack>
  );
}

export function BottomMenu() {
  const { gtMd } = useMedia();
  const isIpadLandscape = useIsIpadLandscape();
  const [{ isCollapsed }] = useAppSideBarStatusAtom();
  const isShowBottomMenu = platformEnv.isNativeIOSPad ? isIpadLandscape : gtMd;
  return isShowBottomMenu ? (
    <Portal.Body container={EPortalContainerConstantName.SIDEBAR_BANNER}>
      <BaseBottomMenu isCollapse={isCollapsed} />
    </Portal.Body>
  ) : null;
}
