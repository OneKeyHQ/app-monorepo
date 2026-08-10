import { memo, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';

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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESettingsTabNames } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useSettingsConfig } from './config';
import { ConfigContext, useConfigContext } from './configContext';
import { SocialButtonGroup } from './CustomElement';
import { SettingList } from './SettingList';
import {
  getSettingsDisplayIcon,
  getSettingsDisplayTitle,
} from './settingsDisplay';
import {
  findSidebarOrphans,
  getDefaultSettingsTab,
  resolveSidebarItems,
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
  useEffect(() => {
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

    const selectedBackgroundColor =
      platformEnv.isDesktop && isActive
        ? (options.tabBarItemStyle?.backgroundColor ?? '$bgStrong')
        : undefined;
    let tabBarIconStyle = options.tabBarIconStyle as IIconProps | undefined;
    if (platformEnv.isDesktop) {
      tabBarIconStyle = {
        size: '$4.5',
        ...(isActive ? { color: '$iconStrong' } : undefined),
        ...tabBarIconStyle,
      };
    } else if (isActive) {
      tabBarIconStyle = {
        color: '$iconStrong',
        ...tabBarIconStyle,
      };
    }
    let tabBarLabelStyle = options.tabBarLabelStyle as
      | ISizableTextProps
      | undefined;
    if (platformEnv.isDesktop) {
      tabBarLabelStyle = {
        ...tabBarLabelStyle,
        mx: '$1.5',
      };
    } else if (isActive) {
      tabBarLabelStyle = {
        ...tabBarLabelStyle,
        size: '$bodyMdMedium',
      };
    }

    return (
      <DesktopTabItem
        onPress={options.tabbarOnPress ?? onPress}
        trackId={options.trackId}
        testID={options.testID}
        // Keep a stable 20px leading slot while desktop Settings renders an
        // optically lighter 18px glyph inside it.
        size="small"
        // 32px rows: 6px vertical padding around the 20px label line.
        py="$1.5"
        aria-current={isActive ? 'page' : undefined}
        selected={isActive}
        tabBarStyle={options.tabBarStyle}
        tabBarItemStyle={options.tabBarItemStyle}
        {...(selectedBackgroundColor
          ? { bg: selectedBackgroundColor }
          : undefined)}
        tabBarIconStyle={tabBarIconStyle}
        tabBarLabelStyle={tabBarLabelStyle}
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
  const { settingsConfig } = useConfigContext();
  const { onSearch, onFocus, previousTabRoute } = useSearch(settingsConfig);
  const activeRouteName = routes[state.index]?.name as
    | ESettingsTabNames
    | undefined;
  // Track the search-restore target from the navigator state so every
  // selection mechanism (sidebar press, promoted-item redirect, universal
  // search deep link, initial route) is covered by one write.
  useEffect(() => {
    if (activeRouteName && activeRouteName !== ESettingsTabNames.Search) {
      previousTabRoute.current = activeRouteName;
    }
  }, [activeRouteName, previousTabRoute]);
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
    return resolveSidebarItems(visibleNames).map((name) => {
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
    });
  }, [routes, state.index, state.key, descriptors, navigation]);

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
          <YStack gap="$0.5">{tabs}</YStack>
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
        ...options
      } = config;
      return (
        <Tab.Screen
          key={name}
          name={name}
          component={(Component || SubSettings) as any}
          options={{
            ...(options as any),
            // The sidebar keeps the outline icon in both states; TabItemView
            // applies the stronger semantic color to the selected state.
            tabBarLabel: getSettingsDisplayTitle({ title, mobileTitle }, true),
            tabBarIcon: () =>
              getSettingsDisplayIcon({ icon, mobileIcon }, true),
            // No trackId: DesktopTabItem would report it via the main tab
            // bar's `tabBarClick` server event, polluting that vocabulary.
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
    return { settingsConfig, insideTabNavigator: true };
  }, [settingsConfig]);
  const initialRouteName = useMemo(
    () => getDefaultSettingsTab(settingsConfig),
    [settingsConfig],
  );
  // Config-level drift guard: every visible category must appear in
  // SETTINGS_SIDEBAR_ORDER, or the sidebar would silently drop its tab.
  // Checked here (against the memoized config) rather than in SideBar so it
  // shares the exact source the Tab.Screens register from.
  useEffect(() => {
    if (!platformEnv.isDev) {
      return;
    }
    const orphans = findSidebarOrphans(
      settingsConfig
        .filter(Boolean)
        .filter((category) => !category.isHidden)
        .map((category) => category.name),
    );
    if (orphans.length) {
      console.warn(
        '[settings] visible tabs missing from SETTINGS_SIDEBAR_ORDER:',
        orphans,
      );
    }
  }, [settingsConfig]);
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
