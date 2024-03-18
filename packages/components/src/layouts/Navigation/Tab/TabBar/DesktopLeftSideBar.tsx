import { useCallback, useMemo } from 'react';

import { CommonActions } from '@react-navigation/native';
import { MotiView } from 'moti';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { getTokens, useTheme } from 'tamagui';

import type { IActionListSection } from '@onekeyhq/components/src/actions';
import { Portal } from '@onekeyhq/components/src/hocs';
import useProviderSideBarValue from '@onekeyhq/components/src/hocs/Provider/hooks/useProviderSideBarValue';
import { useSafeAreaInsets } from '@onekeyhq/components/src/hooks';
import type {
  IKeyOfIcons,
  IXStackProps,
} from '@onekeyhq/components/src/primitives';
import {
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components/src/primitives';
import { DOWNLOAD_URL } from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
      borderWidth="$px"
      px="$3"
      py="$2"
      backgroundColor="$bgStrong"
      borderColor="$borderSubdued"
      borderRadius="$2"
      userSelect="none"
      onPress={onPress}
      {...props}
    >
      <SizableText size="$bodyMdMedium" flex={1}>
        {intl.formatMessage({ id: 'action__download' })}
      </SizableText>
      <XStack space="$1">
        <Icon name="AppleBrand" color="$iconSubdued" size="$5" />
        <Icon name="GooglePlayBrand" color="$iconSubdued" size="$5" />
        <Icon name="ChromeBrand" color="$iconSubdued" size="$5" />
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
  const { leftSidebarCollapsed: isCollapse } = useProviderSideBarValue();
  const { top } = useSafeAreaInsets(); // used for ipad
  const theme = useTheme();
  const getSizeTokens = getTokens().size;

  const sidebarWidth = getSizeTokens.sideBarWidth.val;

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

        if (platformEnv.isDesktop && route.name === extraConfig?.name) {
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
      extraConfig?.name,
      isCollapse,
      navigation,
    ],
  );

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
        />
      ) : null}
      <YStack
        flex={1}
        testID="Desktop-AppSideBar-Content-Container"
        // Need to replaced by HeaderHeightContext
        $platform-web={{
          h: platformEnv.isDesktopMac ? 'calc(100vh - 64px)' : '100vh',
        }}
      >
        <OneKeyLogo />
        <YStack flex={1} p="$3">
          {tabs}
          <DownloadButton mt="auto" />
        </YStack>
      </YStack>
    </MotiView>
  );
}
