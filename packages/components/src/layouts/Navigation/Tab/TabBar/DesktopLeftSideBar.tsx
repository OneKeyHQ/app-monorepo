import { useMemo } from 'react';

import { CommonActions } from '@react-navigation/native';
import { MotiView } from 'moti';
import { StyleSheet } from 'react-native';
import { getTokens, useTheme } from 'tamagui';

import { DesktopDragZoneAbsoluteBar } from '@onekeyhq/components/src/DesktopDragZoneBox';
import useSafeAreaInsets from '@onekeyhq/components/src/Provider/hooks/useSafeAreaInsets';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Icon } from '../../../Icon';
import { Portal } from '../../../Portal';
import useProviderSideBarValue from '../../../Provider/hooks/useProviderSideBarValue';
import { YStack } from '../../../Stack';

import { DesktopTabItem } from './DesktopTabItem';

import type { IActionListSection } from '../../../ActionList';
import type { IKeyOfIcons } from '../../../Icon';
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
      />
    ),
    [isActive, onPress, options, route.name],
  );

  return contentMemo;
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

        if (route.name === extraConfig?.name) {
          return (
            <YStack
              flex={1}
              key={route.key}
              onPress={() => {
                // Avoid re-rendering by checking if it's the current route.
                if (state.routeNames[state.index] !== extraConfig?.name) {
                  navigation.dispatch({
                    ...CommonActions.navigate({
                      name: extraConfig.name,
                      merge: true,
                    }),
                    target: state.key,
                  });
                }
              }}
            >
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
      state.routeNames,
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
        type: 'spring',
        damping: 20,
        mass: 0.1,
      }}
      style={{
        backgroundColor: theme.bgSidebar.val,
        paddingTop: top,
        borderRightColor: theme.neutral4.val,
        borderRightWidth: isCollapse ? 0 : StyleSheet.hairlineWidth,
        overflow: 'hidden',
      }}
    >
      {platformEnv.isDesktopMac && (
        <DesktopDragZoneAbsoluteBar
          position="relative"
          testID="Desktop-AppSideBar-DragZone"
        />
      )}
      <YStack
        flex={1}
        px="$3"
        pb="$3"
        testID="Desktop-AppSideBar-Content-Container"
        // Need to replaced by HeaderHeightContext
        pt={platformEnv.isDesktopMac ? undefined : '$3'}
        $platform-web={{
          h: platformEnv.isDesktopMac ? 'calc(100vh - 64px)' : '100vh',
        }}
      >
        {tabs}
      </YStack>
    </MotiView>
  );
}
