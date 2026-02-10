import { useCallback, useMemo, useRef, useState } from 'react';

import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { useThrottledCallback } from 'use-debounce';

import { Divider } from '../../content';
import { ListView, ScrollView } from '../../layouts';
import { GradientMask, SizableText, XStack, YStack } from '../../primitives';

import type { IListViewRef } from '../../layouts';
import type { ISizableTextProps, IYStackProps } from '../../primitives';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import type { TabBarProps } from 'react-native-collapsible-tab-view';
import type { SharedValue } from 'react-native-reanimated';

export type ITabBarVariant = 'default' | 'pill';

export function TabBarItem({
  name,
  isFocused,
  onPress,
  tabItemStyle,
  focusedTabStyle,
  variant = 'default',
  textSize,
}: {
  name: string;
  isFocused: boolean;
  onPress: (name: string) => void;
  tabItemStyle?: IYStackProps;
  focusedTabStyle?: IYStackProps;
  variant?: ITabBarVariant;
  textSize?: ISizableTextProps['size'];
}) {
  const handlePress = useCallback(() => {
    onPress(name);
  }, [name, onPress]);

  const resolvedTextSize = textSize ?? '$bodyLgMedium';

  if (variant === 'pill') {
    return (
      <YStack
        ai="center"
        jc="center"
        px="$3.5"
        py="$1.5"
        borderRadius="$full"
        bg={isFocused ? '$bgPrimary' : '$bgStrong'}
        hoverStyle={isFocused ? undefined : { bg: '$bgHover' }}
        pressStyle={isFocused ? undefined : { bg: '$bgActive' }}
        key={name}
        onPress={handlePress}
        cursor="default"
        {...tabItemStyle}
        {...(isFocused ? focusedTabStyle : undefined)}
      >
        <SizableText
          size={resolvedTextSize}
          color={isFocused ? '$textInverse' : '$text'}
          userSelect="none"
        >
          {name}
        </SizableText>
      </YStack>
    );
  }

  return (
    <YStack
      h={44}
      // minWidth={52}
      ai="center"
      jc="center"
      ml="$pagePadding"
      key={name}
      onPress={handlePress}
      position="relative"
      {...tabItemStyle}
      {...(isFocused ? focusedTabStyle : undefined)}
    >
      <SizableText
        size={resolvedTextSize}
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
  containerStyle?: IYStackProps;
  renderToolbar?: ({ focusedTab }: { focusedTab: string }) => React.ReactNode;
}

export interface ITabBarItemProps {
  name: string;
  isFocused: boolean;
  onPress: (name: string) => void;
  tabItemStyle?: IYStackProps;
  focusedTabStyle?: IYStackProps;
  variant?: ITabBarVariant;
  textSize?: ISizableTextProps['size'];
}

const PILL_GRADIENT_THRESHOLD = 2;

function PillTabBarContent({
  tabItems,
  renderToolbar,
}: {
  tabItems: React.ReactNode;
  renderToolbar?: React.ReactNode;
}) {
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const scrollStateRef = useRef({
    scrollX: 0,
    containerWidth: 0,
    contentWidth: 0,
  });

  const updateGradientVisibility = useCallback(() => {
    const { scrollX, containerWidth, contentWidth } = scrollStateRef.current;
    const newShowLeft = scrollX > PILL_GRADIENT_THRESHOLD;
    const newShowRight =
      contentWidth > containerWidth &&
      scrollX < contentWidth - containerWidth - PILL_GRADIENT_THRESHOLD;

    setShowLeft((prev) => (prev !== newShowLeft ? newShowLeft : prev));
    setShowRight((prev) => (prev !== newShowRight ? newShowRight : prev));
  }, []);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollStateRef.current.scrollX = e.nativeEvent.contentOffset.x;
      updateGradientVisibility();
    },
    [updateGradientVisibility],
  );

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      scrollStateRef.current.containerWidth = e.nativeEvent.layout.width;
      updateGradientVisibility();
    },
    [updateGradientVisibility],
  );

  const handleContentSizeChange = useCallback(
    (width: number) => {
      scrollStateRef.current.contentWidth = width;
      updateGradientVisibility();
    },
    [updateGradientVisibility],
  );

  return (
    <XStack ai="center" jc="space-between">
      <XStack position="relative" flexShrink={1}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          onLayout={handleLayout}
          onContentSizeChange={handleContentSizeChange}
          contentContainerStyle={{
            gap: '$2',
            px: '$pagePadding',
            py: '$2',
          }}
        >
          {tabItems}
        </ScrollView>
        <GradientMask position="left" opacity={showLeft ? 1 : 0} />
        <GradientMask position="right" opacity={showRight ? 1 : 0} />
      </XStack>
      {renderToolbar}
    </XStack>
  );
}

// Prevent pager scroll event callbacks from modifying tabbar selected state
let tabClickCount = 0;
export function TabBar({
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
  variant = 'default',
  textSize,
}: Omit<Partial<ITabBarProps>, 'focusedTab' | 'tabNames'> & {
  focusedTab: SharedValue<string>;
  tabNames: string[];
  onTabPress: (name: string) => void;
  divider?: boolean;
  tabItemStyle?: IYStackProps;
  focusedTabStyle?: IYStackProps;
  renderItem?: (props: ITabBarItemProps, index: number) => React.ReactNode;
  scrollable?: boolean;
  variant?: ITabBarVariant;
  textSize?: ISizableTextProps['size'];
}) {
  const listViewRef = useRef<IListViewRef<string>>(null);
  const listViewTimerId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentTab, setCurrentTab] = useState<string>(focusedTab.value);

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

  const handleTabPress = useThrottledCallback((name: string) => {
    tabClickCount = Date.now();
    setCurrentTab(name);
    scrollToTab(name);
    onTabPress(name);
  }, 50);

  useAnimatedReaction(
    () => focusedTab.value,
    (result, previous) => {
      if (Date.now() - tabClickCount < 300) {
        return;
      }
      if (result !== previous && previous) {
        runOnJS(setCurrentTab)(result);
        if (scrollable && listViewRef.current) {
          runOnJS(scrollToTab)(result);
        }
      }
    },
  );

  const isPill = variant === 'pill';

  const tabItems = useMemo(() => {
    return tabNames.map((name, index) =>
      renderItem ? (
        renderItem(
          {
            name,
            isFocused: currentTab === name,
            onPress: handleTabPress,
            tabItemStyle,
            focusedTabStyle,
            variant,
            textSize,
          },
          index,
        )
      ) : (
        <TabBarItem
          key={name}
          name={name}
          isFocused={currentTab === name}
          onPress={handleTabPress}
          tabItemStyle={tabItemStyle}
          focusedTabStyle={focusedTabStyle}
          variant={variant}
          textSize={textSize}
        />
      ),
    );
  }, [
    currentTab,
    focusedTabStyle,
    handleTabPress,
    renderItem,
    tabItemStyle,
    tabNames,
    textSize,
    variant,
  ]);
  const content = useMemo(() => {
    if (scrollable) {
      return null;
    }
    if (isPill) {
      return (
        <PillTabBarContent
          tabItems={tabItems}
          renderToolbar={renderToolbar?.({ focusedTab: currentTab })}
        />
      );
    }
    return (
      <>
        <XStack ai="center" jc="space-between">
          <XStack>{tabItems}</XStack>
          {renderToolbar?.({ focusedTab: currentTab })}
        </XStack>
        {divider ? <Divider /> : null}
      </>
    );
  }, [currentTab, divider, isPill, renderToolbar, scrollable, tabItems]);

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
            variant,
            textSize,
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
          variant={variant}
          textSize={textSize}
        />
      );
    },
    [
      currentTab,
      focusedTabStyle,
      onTabPress,
      renderItem,
      tabItemStyle,
      textSize,
      variant,
    ],
  );

  return scrollable ? (
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
  ) : (
    <YStack
      userSelect="none"
      pointerEvents="box-none"
      bg="$bgApp"
      className="onekey-tabs-header"
      position={'sticky' as any}
      top={0}
      zIndex={10}
      {...containerStyle}
    >
      {content}
    </YStack>
  );
}
