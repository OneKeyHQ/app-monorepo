import { memo, useCallback, useLayoutEffect, useMemo } from 'react';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import { Keyboard, StyleSheet } from 'react-native';

import type {
  IIconProps,
  IKeyOfIcons,
  ISizableTextProps,
  IStackStyle,
} from '@onekeyhq/components';
import {
  Divider,
  Icon,
  ScrollView,
  SearchBar,
  XStack,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { DesktopTabItem } from '@onekeyhq/components/src/layouts/Navigation/Tab/TabBar/DesktopTabItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

import { useSettingsConfig } from './config';
import { ConfigContext } from './configContext';
import { SocialButtonGroup } from './CustomElement';
import { SettingList } from './SettingList';
import { SubSettings } from './SubSettings';
import { useIsTabNavigator } from './useIsTabNavigator';
import { useSearch } from './useSearch';

import type { ESettingsTabNames } from './config';
import type {
  BottomTabBarProps,
  BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';

const Tab = createBottomTabNavigator();

function TabItemView({
  isActive,
  onPress,
  options,
}: {
  isActive: boolean;
  onPress: () => void;
  options: BottomTabNavigationOptions & {
    tabbarOnPress?: () => void;
    trackId?: string;
    tabBarItemStyle?: IStackStyle;
    tabBarIconStyle?: IIconProps;
    tabBarLabelStyle?: ISizableTextProps;
    isHidden?: boolean;
    showDot?: boolean;
  };
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
    () =>
      !options.isHidden && options.tabBarLabel ? (
        <DesktopTabItem
          onPress={options.tabbarOnPress ?? onPress}
          trackId={options.trackId}
          aria-current={isActive ? 'page' : undefined}
          selected={isActive}
          tabBarStyle={options.tabBarStyle}
          tabBarItemStyle={options.tabBarItemStyle}
          tabBarIconStyle={options.tabBarIconStyle}
          tabBarLabelStyle={options.tabBarLabelStyle}
          showDot={options.showDot}
          // @ts-expect-error
          icon={options?.tabBarIcon?.(isActive) as IKeyOfIcons}
          label={options.tabBarLabel as string}
        />
      ) : null,
    [isActive, onPress, options],
  );

  return contentMemo;
}

function SideBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { routes } = state;
  const { onSearch, onFocus, previousTabRoute } = useSearch();
  const tabs = useMemo(
    () =>
      routes.map((route, index) => {
        const focus = index === state.index;
        const { options } = descriptors[route.key];
        const onPress = () => {
          Keyboard.dismiss();
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          previousTabRoute.current = route.name as ESettingsTabNames;
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

        return (
          <TabItemView
            key={route.key}
            onPress={onPress}
            isActive={focus}
            options={options as any}
          />
        );
      }),
    [routes, state.index, state.key, descriptors, navigation, previousTabRoute],
  );

  const { top, bottom } = useSafeAreaInsets();
  return (
    <YStack
      w={192}
      bg="$bgSubdued"
      pt={top}
      pb={bottom}
      borderRightWidth={StyleSheet.hairlineWidth}
      borderColor="$neutral3"
    >
      <XStack my="$2.5" px="$3">
        <SearchBar
          onSearchTextChange={onSearch}
          onFocus={onFocus}
          size="small"
        />
      </XStack>
      <Divider borderColor="$neutral3" />
      <YStack flex={1} pt="$3" px="$3">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ pb: '$10' }}
        >
          <YStack gap="$1">{tabs}</YStack>
        </ScrollView>
      </YStack>
      <Divider borderColor="$neutral3" />
      <YStack bg="$bgSubdued" px="$3">
        <SocialButtonGroup />
      </YStack>
    </YStack>
  );
}

function SettingsTabNavigator() {
  const settingsConfig = useSettingsConfig();
  const tabScreens = useMemo(() => {
    const items = settingsConfig.map((config) => {
      if (!config) {
        return null;
      }
      const { icon, title, name, Component, ...options } = config;
      return (
        <Tab.Screen
          key={title}
          name={name}
          component={(Component || SubSettings) as any}
          options={{
            ...(options as any),
            tabBarLabel: title,
            tabBarIcon: () => icon,
            tabBarPosition: 'left',
          }}
        />
      );
    });
    return items;
  }, [settingsConfig]);
  const tabBarCallback = useCallback(
    (props: BottomTabBarProps) => <SideBar {...props} />,
    [],
  );
  const contextValue = useMemo(() => {
    return { settingsConfig };
  }, [settingsConfig]);
  return (
    <ConfigContext.Provider value={contextValue}>
      <Tab.Navigator
        tabBar={tabBarCallback}
        screenOptions={{
          headerShown: false,
          freezeOnBlur: false,
          lazy: false,
        }}
      >
        {tabScreens}
      </Tab.Navigator>
    </ConfigContext.Provider>
  );
}

const MemoizedSettingsTabNavigator = memo(SettingsTabNavigator);

function SettingTab() {
  const isTabNavigator = useIsTabNavigator();
  const appNavigation = useAppNavigation();
  useLayoutEffect(() => {
    if (isTabNavigator) {
      appNavigation.setOptions({
        headerShown: !isTabNavigator,
      });
    }
  }, [appNavigation, isTabNavigator]);
  return isTabNavigator ? <MemoizedSettingsTabNavigator /> : <SettingList />;
}

export default memo(SettingTab);
