import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  EPortalContainerConstantName,
  Heading,
  Icon,
  Image,
  Portal,
  SizableText,
  Stack,
  YStack,
  useIsIpadLandscape,
  useMedia,
} from '@onekeyhq/components';
import { DesktopTabItem } from '@onekeyhq/components/src/layouts/Navigation/Tab/TabBar/DesktopTabItem';
import SidebarBannerImage from '@onekeyhq/kit/assets/sidebar-banner.png';
import { useSpotlight } from '@onekeyhq/kit/src/components/Spotlight';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useNotificationsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/notifications';
import { DOWNLOAD_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';
import { shortcutsKeys } from '@onekeyhq/shared/src/shortcuts/shortcutsKeys.enum';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { GestureResponderEvent } from 'react-native';

function BasicSidebarBanner() {
  const intl = useIntl();
  const { isFirstVisit, tourVisited } = useSpotlight(
    ESpotlightTour.oneKeyProBanner,
  );

  const openUrl = useCallback(() => {
    openUrlExternal('https://bit.ly/3LNVKAT');
  }, []);

  const onTourVisited = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation();
      void tourVisited();
    },
    [tourVisited],
  );

  return isFirstVisit ? (
    <Stack
      mt="$2"
      borderRadius="$2"
      borderCurve="continuous"
      bg="$bgStrong"
      overflow="hidden"
      userSelect="none"
      hoverStyle={{
        bg: '$gray6',
      }}
      pressStyle={{
        bg: '$gray7',
      }}
      onPress={openUrl}
    >
      <Stack>
        <Image h={103} source={SidebarBannerImage} />
        <Stack
          position="absolute"
          top="$2"
          right="$2"
          bg="$whiteA3"
          borderRadius="$full"
          hoverStyle={{
            bg: '$whiteA4',
          }}
          pressStyle={{
            bg: '$whiteA5',
          }}
          onPress={onTourVisited}
        >
          <Icon name="CrossedSmallOutline" size="$5" color="$whiteA7" />
        </Stack>
      </Stack>
      <Stack px="$3" py="$2.5">
        <Heading size="$bodySmMedium" pb="$0.5">
          OneKey Pro
        </Heading>
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.hw_banner_description })}
        </SizableText>
      </Stack>
    </Stack>
  ) : null;
}

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

function DownloadButton() {
  const intl = useIntl();
  const onPress = useCallback(() => {
    openUrlExternal(DOWNLOAD_URL);
  }, []);

  if (!platformEnv.isWeb) {
    return null;
  }

  return (
    <DesktopTabItem
      onPress={onPress}
      icon="DownloadOutline"
      selected={false}
      label={intl.formatMessage({
        id: ETranslations.global_download,
      })}
    />
  );
}

function BottomMenu() {
  const intl = useIntl();
  const appNavigation = useAppNavigation();
  const openSettingPage = useCallback(() => {
    appNavigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListModal,
    });
  }, [appNavigation]);

  return (
    <YStack
      p="$3"
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderSubdued"
      bg="$bgSidebar"
      gap="$2"
    >
      <DesktopTabItem
        onPress={openSettingPage}
        selected={false}
        icon="SettingsOutline"
        label={intl.formatMessage({
          id: ETranslations.settings_settings,
        })}
        shortcutKey={[shortcutsKeys.CmdOrCtrl, ',']}
        testID="setting"
      />
      <DownloadButton />
    </YStack>
  );
}

export function SidebarBanner() {
  const { gtMd } = useMedia();
  const isIpadLandscape = useIsIpadLandscape();
  const isShowBottomMenu = platformEnv.isNativeIOSPad ? isIpadLandscape : gtMd;
  return isShowBottomMenu ? (
    <Portal.Body container={EPortalContainerConstantName.SIDEBAR_BANNER}>
      <BottomMenu />
    </Portal.Body>
  ) : null;
}
