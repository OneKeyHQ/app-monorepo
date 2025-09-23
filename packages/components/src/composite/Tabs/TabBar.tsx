import { useCallback, useMemo, useRef, useState } from 'react';

import {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useDebouncedCallback } from 'use-debounce';

import { Divider } from '../../content';
import { ListView } from '../../layouts';
import { SizableText, XStack, YStack } from '../../primitives';

import type { IListViewRef } from '../../layouts';
import type { IYStackProps } from '../../primitives';
import type { TabBarProps } from 'react-native-collapsible-tab-view';
import type { SharedValue } from 'react-native-reanimated';
import { LayoutChangeEvent } from 'react-native';

export function TabBarItem({
  name,
  isFocused,
  onPress,
  tabItemStyle,
  focusedTabStyle,
}: {
  name: string;
  isFocused: boolean;
  onPress: (name: string) => void;
  tabItemStyle?: IYStackProps;
  focusedTabStyle?: IYStackProps;
}) {
  const handlePress = useCallback(() => {
    onPress(name);
  }, [name, onPress]);
  return (
    <YStack
      h={44}
      // minWidth={52}
      ai="center"
      jc="center"
      ml={20}
      key={name}
      cursor="pointer"
      onPress={handlePress}
      position="relative"
      {...tabItemStyle}
      {...(isFocused ? focusedTabStyle : undefined)}
    >
      <SizableText
        size="$bodyLgMedium"
        color={isFocused ? '$text' : '$textSubdued'}
      >
        {name}
      </SizableText>
      {isFocused ? (
        <YStack
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          h="$0.5"
          bg="$text"
          borderRadius={1}
        />
      ) : null}
    </YStack>
  );
}

export type ITabBarProps = TabBarProps<string>;

export interface ITabBarItemProps {
  name: string;
  isFocused: boolean;
  onPress: (name: string) => void;
  tabItemStyle?: IYStackProps;
  focusedTabStyle?: IYStackProps;
}

export type IScrollableTabBarProps = Omit<
  Partial<ITabBarProps>,
  'focusedTab' | 'tabNames'
> & {
  focusedTab: SharedValue<string>;
  tabNames: string[];
  onTabPress: (name: string) => void;
  divider?: boolean;
  tabItemStyle?: IYStackProps;
  focusedTabStyle?: IYStackProps;
  renderItem?: (props: ITabBarItemProps, index: number) => React.ReactNode;
  scrollable?: boolean;

  containerStyle?: IYStackProps;
  renderToolbar?: ({ focusedTab }: { focusedTab: string }) => React.ReactNode;
};

export function ScrollableTabBar({
  onTabPress,
  tabNames,
  focusedTab,
  // eslint-disable-next-line react/prop-types
  renderToolbar,
  renderItem,
  divider = true,
  tabItemStyle,
  focusedTabStyle,
  // eslint-disable-next-line react/prop-types
  containerStyle,
  scrollable = false,
}: IScrollableTabBarProps) {
  const [currentTab, setCurrentTab] = useState<string>(focusedTab.value);
  const listViewRef = useRef<IListViewRef<string>>(null);
  const listViewTimerId = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToTab = useCallback(
    (tabName: string) => {
      if (listViewTimerId.current) {
        clearTimeout(listViewTimerId.current);
      }
      if (listViewRef.current) {
        const index = tabNames.findIndex((name) => name === tabName);
        listViewTimerId.current = setTimeout(() => {
          listViewRef.current?.scrollToIndex({
            index: index < 3 ? 0 : index,
          });
        }, 100);
      }
    },
    [tabNames],
  );

  const debouncedScrollToTab = useDebouncedCallback(scrollToTab, 50);
  const debouncedSetCurrentTab = useDebouncedCallback(setCurrentTab, 50);
  useAnimatedReaction(
    () => focusedTab.value,
    (result, previous) => {
      if (result !== previous && previous) {
        runOnJS(debouncedSetCurrentTab)(result);
        if (scrollable && listViewRef.current) {
          runOnJS(debouncedScrollToTab)(result);
        }
      }
    },
  );
  const handleRenderItem = useCallback(
    ({ item, index }: { item: string; index: number }) => {
      const name = item;
      return renderItem ? (
        renderItem(
          {
            name,
            isFocused: currentTab === name,
            onPress: onTabPress,
            tabItemStyle,
            focusedTabStyle,
          },
          index,
        )
      ) : (
        <TabBarItem
          key={name}
          name={name}
          isFocused={currentTab === name}
          onPress={onTabPress}
          tabItemStyle={tabItemStyle}
          focusedTabStyle={focusedTabStyle}
        />
      );
    },
    [currentTab, focusedTabStyle, onTabPress, renderItem, tabItemStyle],
  );

  return (
    <YStack
      position={'sticky' as any}
      top={0}
      bg="$bgApp"
      zIndex={10}
      userSelect="none"
      {...containerStyle}
    >
      <XStack alignItems="center" gap="$2" justifyContent="space-between">
        <ListView
          style={{
            flexShrink: 1,
          }}
          useFlashList
          data={tabNames}
          ref={listViewRef}
          horizontal
          pr="$4"
          contentContainerStyle={{
            pr: 16,
          }}
          renderItem={handleRenderItem as any}
          showsHorizontalScrollIndicator={false}
        />
        {renderToolbar ? (
          <XStack>{renderToolbar({ focusedTab: currentTab })}</XStack>
        ) : null}
      </XStack>
      {divider ? <Divider /> : null}
    </YStack>
  );
}

function AnimationTabBar({
  onTabPress,
  tabNames,
  focusedTab,
  renderToolbar,
  renderItem,
  divider = true,
  tabItemStyle,
  focusedTabStyle,
  containerStyle,
}: IScrollableTabBarProps) {
  const [currentTab, setCurrentTab] = useState<string>(focusedTab.value);
  const [tabLayouts, setTabLayouts] = useState<{
    [key: string]: { x: number; width: number };
  }>({});

  // Animated values for the indicator
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  const debouncedSetCurrentTab = useDebouncedCallback(setCurrentTab, 50);

  useAnimatedReaction(
    () => focusedTab.value,
    (result, previous) => {
      if (result !== previous && previous) {
        runOnJS(debouncedSetCurrentTab)(result);
        // Update indicator position when tab changes
        const layout = tabLayouts[result];
        if (layout) {
          indicatorX.value = withTiming(layout.x, { duration: 250 });
          indicatorWidth.value = withTiming(layout.width, { duration: 250 });
        }
      }
    },
  );

  const handleTabLayout = useCallback(
    (name: string, x: number, width: number) => {
      setTabLayouts((prev) => ({
        ...prev,
        [name]: { x, width },
      }));

      // Initialize indicator position for the first focused tab
      if (name === currentTab && indicatorX.value === 0) {
        indicatorX.value = x;
        indicatorWidth.value = width;
      }
    },
    [currentTab, indicatorX, indicatorWidth],
  );

  const AnimatedTabBarItem = useCallback(
    ({
      name,
      isFocused,
      onPress: onPressTab,
      tabItemStyle: itemStyle,
      focusedTabStyle: focusedStyle,
    }: ITabBarItemProps) => {
      const handlePress = () => {
        onPressTab(name);
      };

      const handleLayout = (event: LayoutChangeEvent) => {
        const { x, width } = event.nativeEvent.layout;
        handleTabLayout(name, x, width);
      };

      return (
        <YStack
          h={44}
          ai="center"
          jc="center"
          ml={20}
          key={name}
          cursor="pointer"
          onPress={handlePress}
          position="relative"
          onLayout={handleLayout}
          {...itemStyle}
          {...(isFocused ? focusedStyle : undefined)}
        >
          <SizableText
            size="$bodyLgMedium"
            color={isFocused ? '$text' : '$textSubdued'}
          >
            {name}
          </SizableText>
        </YStack>
      );
    },
    [handleTabLayout],
  );

  const tabItems = useMemo(() => {
    return tabNames.map((name, index) =>
      renderItem ? (
        renderItem(
          {
            name,
            isFocused: currentTab === name,
            onPress: onTabPress,
            tabItemStyle,
            focusedTabStyle,
          },
          index,
        )
      ) : (
        <AnimatedTabBarItem
          key={name}
          name={name}
          isFocused={currentTab === name}
          onPress={onTabPress}
          tabItemStyle={tabItemStyle}
          focusedTabStyle={focusedTabStyle}
        />
      ),
    );
  }, [
    currentTab,
    focusedTabStyle,
    onTabPress,
    renderItem,
    tabItemStyle,
    tabNames,
    AnimatedTabBarItem,
  ]);

  const indicatorStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: indicatorX.value }],
      width: indicatorWidth.value,
    };
  });

  return (
    <YStack
      userSelect="none"
      cursor="pointer"
      pointerEvents="box-none"
      bg="$bgApp"
      className="onekey-tabs-header"
      position={'sticky' as any}
      top={0}
      zIndex={10}
      {...containerStyle}
    >
      <XStack ai="center" jc="space-between">
        <XStack position="relative">
          {tabItems}
          {/* Animated indicator */}
          <YStack
            position="absolute"
            bottom={0}
            h="$0.5"
            bg="$text"
            borderRadius={1}
            style={indicatorStyle}
          />
        </XStack>
        {renderToolbar?.({ focusedTab: currentTab })}
      </XStack>
      {divider ? <Divider /> : null}
    </YStack>
  );
}

export function TabBar({
  scrollable = false,
  ...props
}: IScrollableTabBarProps) {
  if (scrollable) {
    return <ScrollableTabBar {...props} scrollable={scrollable} />;
  }
  return <AnimationTabBar {...props} />;
}
