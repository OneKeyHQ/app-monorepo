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
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { ESettingsTabNames } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useSettingsConfig } from './config';
import { ConfigContext } from './configContext';
import { SocialButtonGroup } from './CustomElement';
import { SettingList } from './SettingList';
import {
  getDefaultSettingsTab,
  resolveSidebarGroups,
} from './settingsRootLayout';
import { SubSettings } from './SubSettings';
import { useIsTabNavigator } from './useIsTabNavigator';
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
    testID?: string;
    tabBarItemStyle?: IStackStyle;
    tabBarIconStyle?: IIconProps;
    tabBarLabelStyle?: ISizableTextProps;
    isHidden?: boolean;
    showDot?: boolean;
    renderTabItem?: React.ComponentType<{
      selected?: boolean;
      onPress?: () => void;
    }>;
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

  const contentMemo = useMemo(() => {
    if (options.isHidden) {
      return null;
    }

    // Use custom tab item renderer if provided
    if (options.renderTabItem) {
      const CustomTabItem = options.renderTabItem;
      return (
        <CustomTabItem
          selected={isActive}
          onPress={options.tabbarOnPress ?? onPress}
        />
      );
    }

    if (!options.tabBarLabel) {
      return null;
    }

    return (
      <DesktopTabItem
        onPress={options.tabbarOnPress ?? onPress}
        trackId={options.trackId}
        testID={options.testID}
        // 32px rows: 6px vertical padding around the 20px label line.
        py="$1.5"
        aria-current={isActive ? 'page' : undefined}
        selected={isActive}
        tabBarStyle={options.tabBarStyle}
        tabBarItemStyle={options.tabBarItemStyle}
        tabBarIconStyle={options.tabBarIconStyle}
        // Selected rows emphasize the label with the medium weight.
        tabBarLabelStyle={
          isActive
            ? {
                size: '$bodyMdMedium',
                ...(options.tabBarLabelStyle as ISizableTextProps | undefined),
              }
            : options.tabBarLabelStyle
        }
        showDot={options.showDot}
        // @ts-expect-error
        icon={options?.tabBarIcon?.(isActive) as IKeyOfIcons}
        label={options.tabBarLabel as string}
      />
    );
  }, [isActive, onPress, options]);

  return contentMemo;
}

function SideBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { routes } = state;
  const { onSearch, onFocus, previousTabRoute } = useSearch();
  const tabs = useMemo(() => {
    const routeEntries = new Map(
      routes.map((route, index) => [route.name, { route, index }] as const),
    );
    const visibleNames = routes
      .filter(
        (route) =>
          !(descriptors[route.key].options as { isHidden?: boolean }).isHidden,
      )
      .map((route) => route.name);
    // Sidebar groups mirror the mobile settings home cards.
    return resolveSidebarGroups(visibleNames).map((group, groupIndex) => (
      <YStack key={groupIndex} gap="$1">
        {group.map((name) => {
          const entry = routeEntries.get(name);
          if (!entry) {
            return null;
          }
          const { route, index } = entry;
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
            <YStack key={route.key} w="100%">
              <TabItemView
                onPress={onPress}
                isActive={focus}
                options={options as any}
              />
            </YStack>
          );
        })}
      </YStack>
    ));
  }, [
    routes,
    state.index,
    state.key,
    descriptors,
    navigation,
    previousTabRoute,
  ]);

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
      const {
        icon,
        mobileIcon,
        title,
        mobileTitle,
        name,
        Component,
        tabBarIconStyle,
        ...options
      } = config;
      return (
        <Tab.Screen
          key={name}
          name={name}
          component={(Component || SubSettings) as any}
          options={{
            ...(options as any),
            // Sidebar copy and icons follow the mobile naming; the selected
            // state uses the solid variant. TabItemView invokes tabBarIcon
            // with a boolean focus flag.
            tabBarLabel: mobileTitle ?? title,
            tabBarIcon: (focused: boolean) =>
              focused ? icon : (mobileIcon ?? icon),
            // 16px sidebar icons; per-category styles (e.g. Dev critical
            // colors) still win.
            tabBarIconStyle: { size: '$4', ...tabBarIconStyle } as IIconProps,
            trackId: name,
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
  const initialRouteName = useMemo(
    () => getDefaultSettingsTab(settingsConfig),
    [settingsConfig],
  );
  return (
    <ConfigContext.Provider value={contextValue}>
      <Tab.Navigator
        initialRouteName={initialRouteName}
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
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
    >
      {isTabNavigator ? <MemoizedSettingsTabNavigator /> : <SettingList />}
    </AccountSelectorProviderMirror>
  );
}

export default memo(SettingTab);
