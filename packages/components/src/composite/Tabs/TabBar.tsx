import { useCallback, useMemo, useRef, useState } from 'react';

import { useWindowDimensions } from 'react-native';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { useDebouncedCallback } from 'use-debounce';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Divider } from '../../content';
import { ScrollView } from '../../layouts';
import { SizableText, XStack, YStack } from '../../primitives';

import type { IScrollViewRef } from '../../layouts';
import type { IYStackProps } from '../../primitives';
import type { TabBarProps } from 'react-native-collapsible-tab-view';
import type { SharedValue } from 'react-native-reanimated';

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

export interface ITabBarProps extends TabBarProps<string> {
  renderToolbar?: ({ focusedTab }: { focusedTab: string }) => React.ReactNode;
}

export function TabBar({
  onTabPress,
  tabNames,
  focusedTab,
  renderToolbar,
  renderItem,
  divider = true,
  tabItemStyle,
  focusedTabStyle,
  scrollable = false,
}: Omit<Partial<ITabBarProps>, 'focusedTab' | 'tabNames'> & {
  focusedTab: SharedValue<string>;
  tabNames: string[];
  onTabPress: (name: string) => void;
  divider?: boolean;
  tabItemStyle?: IYStackProps;
  focusedTabStyle?: IYStackProps;
  renderItem?: (
    props: {
      name: string;
      isFocused: boolean;
      onPress: (name: string) => void;
      tabItemStyle?: IYStackProps;
      focusedTabStyle?: IYStackProps;
    },
    index: number,
  ) => React.ReactNode;
  scrollable?: boolean;
}) {
  const [currentTab, setCurrentTab] = useState<string>(focusedTab.value);
  const scrollViewRef = useRef<IScrollViewRef>(null);
  const scrollViewTimerId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const windowWidth = useWindowDimensions().width;

  const scrollToTab = useCallback(
    (tabName: string) => {
      if (scrollViewTimerId.current) {
        clearTimeout(scrollViewTimerId.current);
      }
      if (scrollViewRef.current) {
        const index = tabNames.findIndex((name) => name === tabName);
        const distance = 44 * index;
        scrollViewTimerId.current = setTimeout(() => {
          const diff = (windowWidth / 3) * 2 - distance;
          scrollViewRef.current?.scrollTo({
            x: diff > 0 ? 0 : distance,
            animated: true,
          });
        }, 100);
      }
    },
    [tabNames, windowWidth],
  );

  const debouncedScrollToTab = useDebouncedCallback(scrollToTab, 50);
  const debouncedSetCurrentTab = useDebouncedCallback(setCurrentTab, 50);
  useAnimatedReaction(
    () => focusedTab.value,
    (result, previous) => {
      if (result !== previous && previous) {
        runOnJS(debouncedSetCurrentTab)(result);
        if (scrollable && scrollViewRef.current) {
          runOnJS(debouncedScrollToTab)(result);
        }
      }
    },
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
        <TabBarItem
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
  ]);
  const content = useMemo(() => {
    return (
      <>
        <XStack ai="center" jc="space-between">
          <XStack>{tabItems}</XStack>
          {renderToolbar?.({ focusedTab: currentTab })}
        </XStack>
        {divider ? <Divider /> : null}
      </>
    );
  }, [currentTab, divider, renderToolbar, tabItems]);
  return scrollable ? (
    <ScrollView
      ref={scrollViewRef}
      horizontal
      userSelect="none"
      cursor="pointer"
      bg="$bgApp"
      pr="$4"
      contentContainerStyle={{
        pr: 16,
      }}
      className="onekey-tabs-header"
      position={'sticky' as any}
      top={0}
      zIndex={10}
      showsHorizontalScrollIndicator={false}
    >
      {content}
    </ScrollView>
  ) : (
    <YStack
      userSelect="none"
      cursor="pointer"
      bg="$bgApp"
      className="onekey-tabs-header"
      position={'sticky' as any}
      top={0}
      zIndex={10}
    >
      {content}
    </YStack>
  );
}
