import { useCallback, useLayoutEffect, useMemo } from 'react';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Icon,
  NavCloseButton,
  SearchBar,
  SizableText,
  XStack,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { DesktopTabItem } from '@onekeyhq/components/src/layouts/Navigation/Tab/TabBar/DesktopTabItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useOnLock } from '../List/DefaultSection';

import { useIsTabNavigator, useSettingsConfig } from './config';
import { SettingList } from './SettingList';
import { SubSettings } from './SubSettings';
import { useSearch } from './useSearch';

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
    () => (
      <DesktopTabItem
        onPress={options.tabbarOnPress ?? onPress}
        trackId={options.trackId}
        aria-current={isActive ? 'page' : undefined}
        selected={isActive}
        tabBarStyle={options.tabBarStyle}
        // @ts-expect-error
        icon={options?.tabBarIcon?.(isActive) as IKeyOfIcons}
        label={(options.tabBarLabel ?? '') as string}
      />
    ),
    [isActive, onPress, options],
  );

  return contentMemo;
}

function SideBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { routes } = state;
  const intl = useIntl();
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

        return (
          <TabItemView
            key={route.key}
            onPress={onPress}
            isActive={focus}
            options={options}
          />
        );
      }),
    [routes, state.index, state.key, descriptors, navigation],
  );

  const onLock = useOnLock();
  const handleLock = useCallback(async () => {
    await onLock();
  }, [onLock]);
  const { top } = useSafeAreaInsets();
  const { onSearch } = useSearch();
  return (
    <YStack w={192} bg="$bg" pt={top} px="$3">
      <XStack h="$16" gap="$4" ai="center">
        <NavCloseButton />
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.global_settings })}
        </SizableText>
      </XStack>
      <SearchBar onSearchTextChange={onSearch} />
      <YStack flex={1} pt="$3">
        {tabs}
      </YStack>
      <TabItemView
        key="lock"
        onPress={handleLock}
        isActive={false}
        options={{
          tabBarIcon: () => 'LockOutline',
          tabBarLabel: intl.formatMessage({
            id: ETranslations.settings_lock_now,
          }),
        }}
      />
    </YStack>
  );
}

function SettingsTabNavigator() {
  const settingsConfig = useSettingsConfig();
  const tabScreens = useMemo(
    () =>
      settingsConfig.map((config) => {
        if (!config) {
          return null;
        }
        const { icon, title, ...options } = config;
        return (
          <Tab.Screen
            key={title}
            name={title}
            options={{
              ...options,
              tabBarLabel: title,
              tabBarIcon: () => icon,
              // @ts-expect-error BottomTabBar V7
              tabBarPosition: 'left',
            }}
          >
            {() => <SubSettings name={title} />}
          </Tab.Screen>
        );
      }),
    [settingsConfig],
  );
  const tabBarCallback = useCallback(
    (props: BottomTabBarProps) => <SideBar {...props} />,
    [],
  );
  return (
    <Tab.Navigator
      tabBar={tabBarCallback}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        // Native Load all tabs at once
        // Web Lazy load
        lazy: !platformEnv.isNative,
      }}
    >
      {tabScreens}
    </Tab.Navigator>
  );
}

export default function SettingTab() {
  const isTabNavigator = useIsTabNavigator();
  const appNavigation = useAppNavigation();
  useLayoutEffect(() => {
    if (isTabNavigator) {
      appNavigation.setOptions({
        headerShown: !isTabNavigator,
      });
    }
  }, [appNavigation, isTabNavigator]);
  return isTabNavigator ? <SettingsTabNavigator /> : <SettingList />;
}
