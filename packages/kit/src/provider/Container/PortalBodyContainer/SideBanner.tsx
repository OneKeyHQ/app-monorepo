import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  EPortalContainerConstantName,
  HeaderIconButton,
  Heading,
  Icon,
  IconButton,
  Image,
  Portal,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  YStack,
  useIsIpadLandscape,
  useMedia,
} from '@onekeyhq/components';
import type { IIconButtonProps } from '@onekeyhq/components/src/actions';
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
import type { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
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

function BottomButton({
  onPress,
  title,
  shortcutKey,
  icon,
  testID,
}: {
  icon: IIconButtonProps['icon'];
  onPress: IIconButtonProps['onPress'];
  title: string;
  testID: IIconButtonProps['testID'];
  shortcutKey?: EShortcutEvents | string[];
}) {
  return (
    <Stack p="$2">
      <IconButton
        size="small"
        variant="tertiary"
        title={<Tooltip.Text shortcutKey={shortcutKey}>{title}</Tooltip.Text>}
        icon={icon}
        testID={testID}
        onPress={onPress}
      />
    </Stack>
  );
}

function NotificationButton() {
  const intl = useIntl();
  const appNavigation = useAppNavigation();
  const openNotificationsModal = useCallback(async () => {
    appNavigation.pushModal(EModalRoutes.NotificationsModal, {
      screen: EModalNotificationsRoutes.NotificationList,
    });
  }, [appNavigation]);
  const [{ firstTimeGuideOpened, badge }] = useNotificationsAtom();
  return (
    <Stack key="notifications" testID="headerRightNotificationsButton" m="$2">
      <HeaderIconButton
        size="small"
        title={intl.formatMessage({
          id: ETranslations.global_notifications,
        })}
        icon="BellOutline"
        onPress={openNotificationsModal}
        trackID="wallet-notification"
        // TODO onLongPress also trigger onPress
        // onLongPress={showNotificationPermissionsDialog}
      />
      {!firstTimeGuideOpened || badge ? (
        <Stack
          position="absolute"
          right="$-2.5"
          top="$-2"
          alignItems="flex-end"
          w="$10"
          pointerEvents="none"
        >
          <Stack
            bg="$bgApp"
            borderRadius="$full"
            borderWidth={2}
            borderColor="$transparent"
          >
            <Stack
              px="$1"
              borderRadius="$full"
              bg="$bgCriticalStrong"
              minWidth="$4"
              height="$4"
              alignItems="center"
              justifyContent="center"
            >
              {!firstTimeGuideOpened ? (
                <Stack
                  width="$1"
                  height="$1"
                  backgroundColor="white"
                  borderRadius="$full"
                />
              ) : (
                <SizableText color="$textOnColor" size="$bodySm">
                  {badge && badge > 99 ? '99+' : badge}
                </SizableText>
              )}
            </Stack>
          </Stack>
        </Stack>
      ) : null}
    </Stack>
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

  const openDownloadUrl = useCallback(() => {
    openUrlExternal(DOWNLOAD_URL);
  }, []);

  return (
    <YStack
      py="$3"
      px="$5"
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderSubdued"
      bg="$bgSidebar"
      gap="$2"
    >
      <XStack jc="space-between">
        <XStack gap="$2">
          <BottomButton
            title={intl.formatMessage({
              id: ETranslations.settings_settings,
            })}
            icon="SettingsOutline"
            testID="setting"
            onPress={openSettingPage}
            shortcutKey={[shortcutsKeys.CmdOrCtrl, ',']}
          />

          {/* notifications is not supported on web currently */}
          {platformEnv.isWeb ? null : <NotificationButton />}
        </XStack>
        {platformEnv.isWeb ? (
          <BottomButton
            title={intl.formatMessage({
              id: ETranslations.settings_settings,
            })}
            icon="DownloadOutline"
            testID="downloadApp"
            onPress={openDownloadUrl}
          />
        ) : null}
      </XStack>
      <BasicSidebarBanner />
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
