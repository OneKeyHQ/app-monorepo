import { useCallback, useMemo } from 'react';

import { CommonActions, useNavigation } from '@react-navigation/native';
import { MotiView } from 'moti';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { getTokens, useMedia, useTheme } from 'tamagui';

import { type IActionListSection } from '@onekeyhq/components/src/actions';
import {
  EPortalContainerConstantName,
  Portal,
} from '@onekeyhq/components/src/hocs';
import useProviderSideBarValue from '@onekeyhq/components/src/hocs/Provider/hooks/useProviderSideBarValue';
import { useSafeAreaInsets } from '@onekeyhq/components/src/hooks';
import type {
  IKeyOfIcons,
  IXStackProps,
} from '@onekeyhq/components/src/primitives';
import {
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components/src/primitives';
import { DOWNLOAD_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EModalSettingRoutes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import { type EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { shortcutsKeys } from '@onekeyhq/shared/src/shortcuts/shortcutsKeys.enum';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { DesktopDragZoneAbsoluteBar } from '../../../DesktopDragZoneBox';

import { DesktopTabItem } from './DesktopTabItem';

import type { ITabNavigatorExtraConfig } from '../../Navigator/types';
import type {
  BottomTabBarProps,
  BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs/src/types';
import type { NavigationState } from '@react-navigation/routers/src/types';

function TabItemView({
  isActive,
  route,
  onPress,
  options,
}: {
  isActive: boolean;
  route: NavigationState['routes'][0];
  onPress: () => void;
  options: BottomTabNavigationOptions & {
    actionList?: IActionListSection[];
    shortcutKey?: EShortcutEvents;
  };
  isCollapse?: boolean;
}) {
  useMemo(() => {
    // @ts-expect-error
    const activeIcon = options?.tabBarIcon?.(true) as IKeyOfIcons;
    // @ts-expect-error
    const inActiveIcon = options?.tabBarIcon?.(false) as IKeyOfIcons;
    // Avoid icon jitter during lazy loading by prefetching icons.
    void Icon.prefetch(activeIcon, inActiveIcon);
  }, [options]);
  const contentMemo = useMemo(
    () => (
      <DesktopTabItem
        onPress={onPress}
        aria-current={isActive ? 'page' : undefined}
        selected={isActive}
        shortcutKey={options.shortcutKey}
        tabBarStyle={options.tabBarStyle}
        // @ts-expect-error
        icon={options?.tabBarIcon?.(isActive) as IKeyOfIcons}
        label={(options.tabBarLabel ?? route.name) as string}
        actionList={options.actionList}
        testID={route.name.toLowerCase()}
      />
    ),
    [isActive, onPress, options, route.name],
  );

  return contentMemo;
}

function DownloadButton(props: IXStackProps) {
  const intl = useIntl();
  const onPress = useCallback(() => {
    openUrlExternal(DOWNLOAD_URL);
  }, []);
  if (!platformEnv.isWeb) {
    return null;
  }
  return (
    <XStack
      mt="$2"
      px="$3"
      py="$2"
      backgroundColor="$bgStrong"
      borderRadius="$2"
      borderCurve="continuous"
      userSelect="none"
      onPress={onPress}
      hoverStyle={{
        bg: '$gray6',
      }}
      pressStyle={{
        bg: '$gray7',
      }}
      {...props}
    >
      <SizableText size="$bodyMdMedium" flex={1}>
        {intl.formatMessage({ id: ETranslations.global_download })}
      </SizableText>
      <XStack gap="$1" alignItems="center">
        <Icon name="AppleBrand" size="$5" y={-2} color="$iconSubdued" />
        <Icon name="GooglePlayBrand" size="$4.5" color="$iconSubdued" />
        <Icon name="ChromeBrand" size="$4.5" color="$iconSubdued" />
      </XStack>
    </XStack>
  );
}

function OneKeyLogo() {
  if (!platformEnv.isWeb) {
    return null;
  }
  return (
    <XStack px="$4" py="$3">
      <Icon name="OnekeyTextIllus" width={101} height={28} color="$text" />
    </XStack>
  );
}

export function DesktopLeftSideBar({
  navigation,
  state,
  descriptors,
  extraConfig,
}: BottomTabBarProps & {
  extraConfig?: ITabNavigatorExtraConfig<string>;
}) {
  const { routes } = state;
  const intl = useIntl();
  const { leftSidebarCollapsed: isCollapse } = useProviderSideBarValue();
  const { top } = useSafeAreaInsets(); // used for ipad
  const theme = useTheme();
  const getSizeTokens = getTokens().size;

  const sidebarWidth = getSizeTokens.sideBarWidth.val;

  const { gtMd } = useMedia();
  const isShowWebTabBar =
    platformEnv.isDesktop || (platformEnv.isNative && gtMd);
  const tabs = useMemo(
    () =>
      routes.map((route, index) => {
        const focus = index === state.index;
        const { options } = descriptors[route.key];
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!focus && !event.defaultPrevented) {
            navigation.dispatch({
              ...CommonActions.navigate({
                name: route.name,
                merge: true,
              }),
              target: state.key,
            });
          }
        };

        if (isShowWebTabBar && route.name === extraConfig?.name) {
          return (
            <YStack flex={1} key={route.key}>
              <Portal.Container name={Portal.Constant.WEB_TAB_BAR} />
            </YStack>
          );
        }

        return (
          <TabItemView
            key={route.key}
            route={route}
            onPress={onPress}
            isActive={focus}
            options={options}
            isCollapse={isCollapse}
          />
        );
      }),
    [
      routes,
      state.index,
      state.key,
      descriptors,
      isShowWebTabBar,
      extraConfig?.name,
      isCollapse,
      navigation,
    ],
  );

  const appNavigation = useNavigation<any>();
  const openSettingPage = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    appNavigation.navigate(ERootRoutes.Modal, {
      screen: EModalRoutes.SettingModal,
      params: EModalSettingRoutes.SettingListModal,
    });
  }, [appNavigation]);

  return (
    <MotiView
      testID="Desktop-AppSideBar-Container"
      animate={{ width: isCollapse ? 0 : sidebarWidth }}
      transition={{
        duration: 200,
        type: 'timing',
      }}
      style={{
        backgroundColor: theme.bgSidebar.val,
        paddingTop: top,
        borderRightColor: theme.neutral4.val,
        borderRightWidth: isCollapse ? 0 : StyleSheet.hairlineWidth,
        overflow: 'hidden',
      }}
    >
      {platformEnv.isDesktopMac ? (
        <DesktopDragZoneAbsoluteBar
          position="relative"
          testID="Desktop-AppSideBar-DragZone"
          h="$10"
        />
      ) : null}
      <YStack
        position="relative"
        flex={1}
        testID="Desktop-AppSideBar-Content-Container"
      >
        <MotiView
          animate={{ left: isCollapse ? -sidebarWidth : 0 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: sidebarWidth,
            bottom: 0,
          }}
          transition={{
            duration: 200,
            type: 'timing',
          }}
        >
          <YStack flex={1}>
            <OneKeyLogo />
            <YStack flex={1} p="$3">
              {tabs}
              <Stack mt="auto">
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
                <Portal name={EPortalContainerConstantName.SIDEBAR_BANNER} />
                <DownloadButton />
              </Stack>
            </YStack>
          </YStack>
        </MotiView>
      </YStack>
    </MotiView>
  );
}
