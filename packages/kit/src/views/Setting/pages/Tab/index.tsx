import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

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
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useSettingsConfig } from './config';
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
import type { TamaguiElement } from 'tamagui';

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

const sideBarTestID = 'SettingsTabNavigatorSideBar';
function BaseSideBar({ state, descriptors, navigation }: BottomTabBarProps) {
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
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (ref.current) {
      console.log('ref.current', ref.current);
      if (
        ref.current.parentElement &&
        ref.current.parentElement.style.display === 'none'
      ) {
        ref.current.parentElement.style.display = 'unset';
      }
    }
    const element = ref.current?.parentElement;

    // Monitor element display property changes
    if (element) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === 'attributes' &&
            mutation.attributeName === 'style'
          ) {
            const target = mutation.target as HTMLElement;
            if (target.style.display && target.style.display !== '') {
              target.style.display = '';
            }
          }
        });
      });

      observer.observe(element, {
        attributes: true,
        attributeFilter: ['style'],
      });

      // Return cleanup function for the observer
      return () => {
        // observer.disconnect();
        // console.log('unmount');
        // setTimeout(() => {
        //   if (element) {
        //     element.style.display = '';
        //   }
        // }, 0);
      };
    }
    return () => {
      console.log('unmount');
      setTimeout(() => {
        if (element) {
          element.style.display = '';
        }
      }, 0);
    };
  }, []);
  return (
    <YStack
      testID={sideBarTestID}
      w={192}
      ref={ref}
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

const SideBar = memo(BaseSideBar);

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
          options={{
            ...(options as any),
            tabBarLabel: title,
            tabBarIcon: () => icon,
            tabBarPosition: 'left',
          }}
        >
          {Component
            ? () => <Component name={title} settingsConfig={settingsConfig} />
            : () => (
                <SubSettings name={title} settingsConfig={settingsConfig} />
              )}
        </Tab.Screen>
      );
    });
    return items;
  }, [settingsConfig]);
  const tabBarCallback = useCallback((props: BottomTabBarProps) => {
    return <SideBar {...props} />;
  }, []);
  return useMemo(() => {
    return (
      <Tab.Navigator
        detachInactiveScreens={false}
        tabBar={tabBarCallback}
        screenOptions={{
          headerShown: false,
          freezeOnBlur: false,
          lazy: false,
        }}
      >
        {tabScreens}
      </Tab.Navigator>
    );
  }, [tabBarCallback, tabScreens]);
}

// Fix the issue where Suspense re-rendering injects display: none into the container
// causing the page to flicker
const usePreventFlicker = platformEnv.isNative
  ? () => {}
  : (isTabNavigator: boolean) => {
      useEffect(() => {
        if ('MutationObserver' in globalThis && isTabNavigator) {
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (
                mutation.type === 'attributes' &&
                mutation.attributeName === 'style'
              ) {
                const target = mutation.target as HTMLElement;
                if (target.style.display && target.style.display !== '') {
                  target.style.display = '';
                }
              }
            });
          });

          setTimeout(() => {
            const element = document.querySelector(
              '[data-testid="sideBarTestID"]',
            ) as HTMLElement;
            if (element && element.parentElement) {
              observer.observe(element.parentElement, {
                attributes: true,
                attributeFilter: ['style'],
                childList: false,
                subtree: false,
              });
            }
          }, 0);
          return () => {
            observer.disconnect();
          };
        }
      }, [isTabNavigator]);
    };

export default function SettingTab() {
  const isTabNavigator = useIsTabNavigator();
  const appNavigation = useAppNavigation();
  usePreventFlicker(isTabNavigator);
  useLayoutEffect(() => {
    if (isTabNavigator) {
      appNavigation.setOptions({
        headerShown: !isTabNavigator,
      });
    }
  }, [appNavigation, isTabNavigator]);
  return isTabNavigator ? <SettingsTabNavigator /> : <SettingList />;
}
