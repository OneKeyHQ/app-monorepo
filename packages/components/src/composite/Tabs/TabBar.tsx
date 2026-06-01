import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useThrottledCallback } from 'use-debounce';

import { Divider } from '../../content';
import { ListView, ScrollView } from '../../layouts';
import { GradientMask, SizableText, XStack, YStack } from '../../primitives';
import { useTheme } from '../../shared/tamagui';
import { fs } from '../../utils/scale';

import type { IListViewRef } from '../../layouts';
import type { ISizableTextProps, IYStackProps } from '../../primitives';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import type { TabBarProps } from 'react-native-collapsible-tab-view';
import type { SharedValue } from 'react-native-reanimated';

type IItemLayout = { x: number; width: number };
type IReadonlySharedValue<T> = { readonly value: T };

const TAB_HOVER_STYLE = { bg: '$bgHover' } as const;
const TAB_PRESS_STYLE = { bg: '$bgActive' } as const;
const TAB_LIST_VIEW_STYLE = { flexShrink: 1 } as const;
const TAB_CONTENT_CONTAINER_STYLE = { pr: 16 } as const;
const PILL_SCROLL_CONTENT_STYLE = {
  px: '$pagePadding',
  py: '$2',
} as const;
const DIRECT_TAB_PRESS_ANIMATION_DURATION = 220;
const DIRECT_TAB_PRESS_NATIVE_SYNC_TIMEOUT = 900;

export type ITabBarVariant = 'default' | 'pill';

const animatedTextStyles = StyleSheet.create({
  text: {
    fontSize: fs(16),
    fontWeight: '500',
    lineHeight: fs(24),
    fontFamily: 'Roobert-Medium',
  },
});

function AnimatedPillText({
  name,
  index: tabIndex,
  indexDecimal,
}: {
  name: string;
  index: number;
  indexDecimal: IReadonlySharedValue<number>;
}) {
  const theme = useTheme();
  const activeColor = theme.textInverse.val;
  const inactiveColor = theme.text.val;

  const animatedColorStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      indexDecimal.value,
      [tabIndex - 1, tabIndex, tabIndex + 1],
      [inactiveColor, activeColor, inactiveColor],
    );
    return { color };
  });

  const combinedStyle = useMemo(
    () => [animatedTextStyles.text, animatedColorStyle],
    [animatedColorStyle],
  );

  return (
    <Animated.Text style={combinedStyle} numberOfLines={1}>
      {name}
    </Animated.Text>
  );
}

export function TabBarItem({
  name,
  isFocused,
  onPress,
  tabItemStyle,
  focusedTabStyle,
  variant = 'default',
  textSize,
  animatedPillIndicator,
  indexDecimal,
  index: tabIndex,
  testID,
}: ITabBarItemProps) {
  const handlePress = useCallback(() => {
    onPress(name);
  }, [name, onPress]);

  const resolvedTextSize = textSize ?? '$bodyLgMedium';

  if (variant === 'pill') {
    // When animatedPillIndicator is active, the sliding background is rendered
    // by AnimatedPillIndicator — items should be transparent so it shows through.
    let pillBg: string = 'transparent';
    if (!animatedPillIndicator && isFocused) {
      pillBg = '$bgPrimary';
    }

    const useAnimatedText =
      animatedPillIndicator &&
      indexDecimal !== undefined &&
      tabIndex !== undefined;

    return (
      <YStack
        testID={testID}
        ai="center"
        jc="center"
        px="$3.5"
        py="$1.5"
        borderRadius="$full"
        bg={pillBg}
        hoverStyle={
          isFocused || animatedPillIndicator ? undefined : TAB_HOVER_STYLE
        }
        pressStyle={
          isFocused || animatedPillIndicator ? undefined : TAB_PRESS_STYLE
        }
        key={name}
        onPress={handlePress}
        cursor="default"
        zIndex={1}
        {...tabItemStyle}
        {...(isFocused ? focusedTabStyle : undefined)}
      >
        {useAnimatedText ? (
          <AnimatedPillText
            name={name}
            index={tabIndex}
            indexDecimal={indexDecimal}
          />
        ) : (
          <SizableText
            size={resolvedTextSize}
            color={isFocused ? '$textInverse' : '$text'}
            userSelect="none"
          >
            {name}
          </SizableText>
        )}
      </YStack>
    );
  }

  return (
    <YStack
      testID={testID}
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

function AnimatedTabBarItem({
  name,
  index,
  indexDecimal,
  onPress,
  tabItemStyle,
  focusedTabStyle,
  isFocused,
  onItemLayout,
}: {
  name: string;
  index: number;
  indexDecimal: IReadonlySharedValue<number>;
  onPress: (name: string) => void;
  tabItemStyle?: IYStackProps;
  focusedTabStyle?: IYStackProps;
  isFocused: boolean;
  onItemLayout?: (index: number, layout: IItemLayout) => void;
}) {
  const handlePress = useCallback(() => {
    onPress(name);
  }, [name, onPress]);

  const theme = useTheme();
  const activeColor = theme.text.val;
  const inactiveColor = theme.textSubdued.val;

  const animatedTextStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      indexDecimal.value,
      [index - 1, index, index + 1],
      [inactiveColor, activeColor, inactiveColor],
    );
    return { color };
  });

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      onItemLayout?.(index, { x, width });
    },
    [index, onItemLayout],
  );

  const combinedTextStyle = useMemo(
    () => [animatedTextStyles.text, animatedTextStyle],
    [animatedTextStyle],
  );

  return (
    <YStack
      h={44}
      ai="center"
      jc="center"
      ml="$pagePadding"
      key={name}
      onPress={handlePress}
      position="relative"
      onLayout={handleLayout}
      {...tabItemStyle}
      {...(isFocused ? focusedTabStyle : undefined)}
    >
      <Animated.Text style={combinedTextStyle} numberOfLines={1}>
        {name}
      </Animated.Text>
    </YStack>
  );
}

function AnimatedIndicator({
  indexDecimal,
  itemsLayout,
}: {
  indexDecimal: IReadonlySharedValue<number>;
  itemsLayout: IItemLayout[];
}) {
  const theme = useTheme();
  const indicatorColor = theme.text.val;

  // Store layout data as SharedValues to avoid worklet recreation on re-render.
  const xValuesSV = useSharedValue<number[]>([]);
  const widthValuesSV = useSharedValue<number[]>([]);
  const countSV = useSharedValue(0);

  if (
    itemsLayout.length !== countSV.value ||
    itemsLayout.some(
      (v, i) =>
        xValuesSV.value[i] !== v.x || widthValuesSV.value[i] !== v.width,
    )
  ) {
    xValuesSV.value = itemsLayout.map((v) => v.x);
    widthValuesSV.value = itemsLayout.map((v) => v.width);
    countSV.value = itemsLayout.length;
  }

  const animatedStyle = useAnimatedStyle(() => {
    const count = countSV.value;
    const xs = xValuesSV.value;
    const ws = widthValuesSV.value;

    if (count < 2) {
      return count === 1
        ? { transform: [{ translateX: xs[0] }], width: ws[0] }
        : {};
    }
    const inputRange = xs.map((_, i) => i);
    const translateX = interpolate(
      indexDecimal.value,
      inputRange,
      xs,
      Extrapolation.CLAMP,
    );
    const width = interpolate(
      indexDecimal.value,
      inputRange,
      ws,
      Extrapolation.CLAMP,
    );
    return { transform: [{ translateX }], width };
  });

  const indicatorBaseStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      height: 2,
      borderRadius: 1,
      backgroundColor: indicatorColor,
    }),
    [indicatorColor],
  );

  const combinedIndicatorStyle = useMemo(
    () => [indicatorBaseStyle, animatedStyle],
    [indicatorBaseStyle, animatedStyle],
  );

  if (itemsLayout.length === 0) {
    return null;
  }

  return <Animated.View style={combinedIndicatorStyle} />;
}

function AnimatedPillTabBarItem({
  name,
  index,
  indexDecimal,
  onPress,
  onItemLayout,
}: {
  name: string;
  index: number;
  indexDecimal: IReadonlySharedValue<number>;
  onPress: (name: string) => void;
  onItemLayout?: (index: number, layout: IItemLayout) => void;
}) {
  const handlePress = useCallback(() => {
    onPress(name);
  }, [name, onPress]);

  const theme = useTheme();
  const activeColor = theme.textInverse.val;
  const inactiveColor = theme.text.val;

  const animatedTextStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      indexDecimal.value,
      [index - 1, index, index + 1],
      [inactiveColor, activeColor, inactiveColor],
    );
    return { color };
  });

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      onItemLayout?.(index, { x, width });
    },
    [index, onItemLayout],
  );

  const combinedPillTextStyle = useMemo(
    () => [animatedTextStyles.text, animatedTextStyle],
    [animatedTextStyle],
  );

  return (
    <YStack
      ai="center"
      jc="center"
      px="$3.5"
      py="$1.5"
      borderRadius="$full"
      key={name}
      onPress={handlePress}
      onLayout={handleLayout}
      cursor="default"
      zIndex={1}
    >
      <Animated.Text style={combinedPillTextStyle} numberOfLines={1}>
        {name}
      </Animated.Text>
    </YStack>
  );
}

function AnimatedPillIndicator({
  indexDecimal,
  itemsLayout,
}: {
  indexDecimal: IReadonlySharedValue<number>;
  itemsLayout: IItemLayout[];
}) {
  const theme = useTheme();
  const bgColor = theme.bgPrimary.val;

  // Store layout edges as SharedValues so the worklet never needs to be
  // recreated when itemsLayout changes — all reads stay on the UI thread.
  const leftEdgesSV = useSharedValue<number[]>([]);
  const rightEdgesSV = useSharedValue<number[]>([]);
  const countSV = useSharedValue(0);

  if (
    itemsLayout.length !== countSV.value ||
    itemsLayout.some(
      (v, i) =>
        leftEdgesSV.value[i] !== v.x || rightEdgesSV.value[i] !== v.x + v.width,
    )
  ) {
    leftEdgesSV.value = itemsLayout.map((v) => v.x);
    rightEdgesSV.value = itemsLayout.map((v) => v.x + v.width);
    countSV.value = itemsLayout.length;
  }

  const animatedStyle = useAnimatedStyle(() => {
    const count = countSV.value;
    const lefts = leftEdgesSV.value;
    const rights = rightEdgesSV.value;

    if (count < 2) {
      return count === 1
        ? { transform: [{ translateX: lefts[0] }], width: rights[0] - lefts[0] }
        : {};
    }

    const decimal = indexDecimal.value;
    const floorIdx = Math.floor(decimal);
    const ceilIdx = Math.ceil(decimal);
    const fraction = decimal - floorIdx;

    // At rest on a tab — no jelly needed
    if (floorIdx === ceilIdx || fraction === 0) {
      const idx = Math.max(0, Math.min(floorIdx, count - 1));
      return {
        transform: [{ translateX: lefts[idx] }],
        width: rights[idx] - lefts[idx],
      };
    }

    const safeFloor = Math.max(0, Math.min(floorIdx, count - 1));
    const safeCeil = Math.max(0, Math.min(ceilIdx, count - 1));

    const fromLeft = lefts[safeFloor];
    const fromRight = rights[safeFloor];
    const toLeft = lefts[safeCeil];
    const toRight = rights[safeCeil];

    // Jelly/elastic effect: leading edge moves faster, trailing edge lags.
    // ease-out (1-(1-t)^2): accelerates early — used for leading edge
    // ease-in  (t^2):       accelerates late  — used for trailing edge
    const easeOut = 1 - (1 - fraction) * (1 - fraction);
    const easeIn = fraction * fraction;

    const left = fromLeft + (toLeft - fromLeft) * easeIn;
    const right = fromRight + (toRight - fromRight) * easeOut;

    return { transform: [{ translateX: left }], width: right - left };
  });

  const pillBaseStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      top: 0,
      left: 0,
      bottom: 0,
      borderRadius: 9999,
      backgroundColor: bgColor,
    }),
    [bgColor],
  );

  const combinedPillStyle = useMemo(
    () => [pillBaseStyle, animatedStyle],
    [pillBaseStyle, animatedStyle],
  );

  if (itemsLayout.length === 0) {
    return null;
  }

  return <Animated.View style={combinedPillStyle} />;
}

export interface ITabBarProps extends TabBarProps<string> {
  containerStyle?: IYStackProps;
  renderToolbar?: ({ focusedTab }: { focusedTab: string }) => React.ReactNode;
  directTabPressAnimation?: boolean;
}

export interface ITabBarItemProps {
  name: string;
  isFocused: boolean;
  onPress: (name: string) => void;
  tabItemStyle?: IYStackProps;
  focusedTabStyle?: IYStackProps;
  variant?: ITabBarVariant;
  textSize?: ISizableTextProps['size'];
  // When true, the pill background is handled by AnimatedPillIndicator,
  // so TabBarItem should not render its own background color.
  animatedPillIndicator?: boolean;
  // Provided when animatedPillIndicator is true for UI-thread text color.
  indexDecimal?: SharedValue<number>;
  index?: number;
  testID?: string;
}

const PILL_GRADIENT_THRESHOLD = 2;

function PillTabBarContent({
  tabItems,
  pillIndicator,
  renderToolbar,
}: {
  tabItems: React.ReactNode;
  pillIndicator?: React.ReactNode;
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
          contentContainerStyle={PILL_SCROLL_CONTENT_STYLE}
        >
          <XStack position="relative" gap="$2" ai="center">
            {pillIndicator}
            {tabItems}
          </XStack>
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
  indexDecimal,
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
  directTabPressAnimation = false,
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
  indexDecimal?: SharedValue<number>;
  directTabPressAnimation?: boolean;
}) {
  const listViewRef = useRef<IListViewRef<string>>(null);
  const listViewTimerId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const directTabPressTimerId = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [currentTab, setCurrentTab] = useState<string>(focusedTab.value);
  const [itemsLayout, setItemsLayout] = useState<IItemLayout[]>([]);
  const itemsLayoutRef = useRef<Map<number, IItemLayout>>(new Map());

  const useAnimatedDefault =
    !!indexDecimal &&
    variant === 'default' &&
    !scrollable &&
    !renderItem &&
    !textSize;
  // iOS collapsible-tab-view can report intermediate focused tabs when
  // jumping across non-adjacent tabs. Keep this opt-in because it decouples
  // the tab bar indicator from the native pager while the jump settles.
  const useDirectTabPressAnimation =
    directTabPressAnimation && useAnimatedDefault;
  const displayIndexDecimal = useSharedValue(indexDecimal?.value ?? 0);
  const directTabPressTargetIndex = useSharedValue(-1);
  const directTabPressStartedAt = useSharedValue(0);
  const animatedDefaultIndexDecimal = useDerivedValue(() => {
    if (useDirectTabPressAnimation && directTabPressTargetIndex.value >= 0) {
      return displayIndexDecimal.value;
    }
    return indexDecimal?.value ?? 0;
  });

  const useAnimatedPill =
    !!indexDecimal &&
    variant === 'pill' &&
    !scrollable &&
    !renderItem &&
    !textSize;

  // Pill indicator (background slide) should animate even when renderItem is
  // provided — only the text rendering needs the guard.
  const useAnimatedPillIndicator =
    !!indexDecimal && variant === 'pill' && !scrollable;

  const handleItemLayout = useCallback(
    (index: number, layout: IItemLayout) => {
      itemsLayoutRef.current.set(index, layout);
      // Clean stale entries from removed tabs
      for (const key of itemsLayoutRef.current.keys()) {
        if (key >= tabNames.length) {
          itemsLayoutRef.current.delete(key);
        }
      }
      if (itemsLayoutRef.current.size === tabNames.length) {
        const layouts: IItemLayout[] = [];
        for (let i = 0; i < tabNames.length; i += 1) {
          const l = itemsLayoutRef.current.get(i);
          if (l) {
            layouts.push(l);
          }
        }
        setItemsLayout(layouts);
      }
    },
    [tabNames.length],
  );

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

  const clearDirectTabPressTimer = useCallback(() => {
    if (directTabPressTimerId.current) {
      clearTimeout(directTabPressTimerId.current);
      directTabPressTimerId.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearDirectTabPressTimer();
    },
    [clearDirectTabPressTimer],
  );

  const handleTabPress = useThrottledCallback((name: string) => {
    clearDirectTabPressTimer();
    const targetIndex = tabNames.findIndex((tabName) => tabName === name);
    const currentIndex = tabNames.findIndex(
      (tabName) => tabName === focusedTab.value,
    );
    const shouldAnimateDirectPress =
      useDirectTabPressAnimation &&
      indexDecimal &&
      targetIndex >= 0 &&
      currentIndex >= 0 &&
      Math.abs(targetIndex - currentIndex) > 1;

    if (shouldAnimateDirectPress) {
      directTabPressTargetIndex.value = targetIndex;
      directTabPressStartedAt.value = Date.now();
      displayIndexDecimal.value = indexDecimal.value;
      displayIndexDecimal.value = withTiming(targetIndex, {
        duration: DIRECT_TAB_PRESS_ANIMATION_DURATION,
      });
      directTabPressTimerId.current = setTimeout(() => {
        directTabPressTimerId.current = null;
        if (directTabPressTargetIndex.value !== targetIndex) {
          return;
        }
        directTabPressTargetIndex.value = -1;
        directTabPressStartedAt.value = 0;
        setCurrentTab(focusedTab.value);
      }, DIRECT_TAB_PRESS_NATIVE_SYNC_TIMEOUT);
    } else if (useDirectTabPressAnimation) {
      directTabPressTargetIndex.value = -1;
      directTabPressStartedAt.value = 0;
    }
    tabClickCount = Date.now();
    setCurrentTab(name);
    scrollToTab(name);
    onTabPress(name);
  }, 50);

  useAnimatedReaction(
    () => focusedTab.value,
    (result, previous) => {
      const targetIndex = directTabPressTargetIndex.value;
      const resultIndex = tabNames.findIndex((tabName) => tabName === result);
      const shouldHoldDirectTarget =
        useDirectTabPressAnimation &&
        targetIndex >= 0 &&
        resultIndex >= 0 &&
        resultIndex !== targetIndex &&
        Date.now() - directTabPressStartedAt.value <
          DIRECT_TAB_PRESS_NATIVE_SYNC_TIMEOUT;

      if (shouldHoldDirectTarget) {
        return;
      }

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
    [
      directTabPressStartedAt,
      directTabPressTargetIndex,
      tabNames,
      useDirectTabPressAnimation,
    ],
  );

  useAnimatedReaction(
    () => {
      if (!indexDecimal) {
        return null;
      }
      return indexDecimal.value;
    },
    (result) => {
      if (result === null) {
        return;
      }

      if (!useDirectTabPressAnimation) {
        return;
      }

      const targetIndex = directTabPressTargetIndex.value;
      if (targetIndex < 0) {
        return;
      }

      const hasReachedTarget = Math.abs(result - targetIndex) < 0.001;
      const hasTimedOut =
        Date.now() - directTabPressStartedAt.value >
        DIRECT_TAB_PRESS_NATIVE_SYNC_TIMEOUT;

      if (hasReachedTarget || hasTimedOut) {
        directTabPressTargetIndex.value = -1;
        directTabPressStartedAt.value = 0;
        runOnJS(clearDirectTabPressTimer)();
      }
    },
    [
      clearDirectTabPressTimer,
      directTabPressStartedAt,
      directTabPressTargetIndex,
      displayIndexDecimal,
      indexDecimal,
      useDirectTabPressAnimation,
    ],
  );

  const isPill = variant === 'pill';

  const tabItems = useMemo(() => {
    if (useAnimatedDefault && animatedDefaultIndexDecimal) {
      return tabNames.map((name, index) => (
        <AnimatedTabBarItem
          key={name}
          name={name}
          index={index}
          indexDecimal={animatedDefaultIndexDecimal}
          isFocused={currentTab === name}
          onPress={handleTabPress}
          tabItemStyle={tabItemStyle}
          focusedTabStyle={focusedTabStyle}
          onItemLayout={handleItemLayout}
        />
      ));
    }
    if (useAnimatedPill && indexDecimal) {
      return tabNames.map((name, index) => (
        <AnimatedPillTabBarItem
          key={name}
          name={name}
          index={index}
          indexDecimal={indexDecimal}
          onPress={handleTabPress}
          onItemLayout={handleItemLayout}
        />
      ));
    }
    // Only activate animated pill text/bg on items once the pill indicator
    // background is ready (all items have reported layout).  Before that,
    // the focused tab would get textInverse (white) color with no dark
    // background behind it, making the label invisible on cold start.
    const pillIndicatorReady = itemsLayout.length === tabNames.length;
    return tabNames.map((name, index) => {
      const hasAnimatedIndicator =
        useAnimatedPillIndicator && !!renderItem && pillIndicatorReady;
      const itemNode = renderItem ? (
        renderItem(
          {
            name,
            isFocused: currentTab === name,
            onPress: handleTabPress,
            tabItemStyle,
            focusedTabStyle,
            variant,
            textSize,
            animatedPillIndicator: hasAnimatedIndicator,
            indexDecimal: hasAnimatedIndicator ? indexDecimal : undefined,
            index: hasAnimatedIndicator ? index : undefined,
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
      );
      // Wrap with onLayout to collect layout data for animated pill indicator
      if (useAnimatedPillIndicator && renderItem) {
        return (
          <View
            key={name}
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
            onLayout={(e: LayoutChangeEvent) => {
              const { x, width } = e.nativeEvent.layout;
              handleItemLayout(index, { x, width });
            }}
          >
            {itemNode}
          </View>
        );
      }
      return itemNode;
    });
  }, [
    useAnimatedDefault,
    useAnimatedPill,
    useAnimatedPillIndicator,
    animatedDefaultIndexDecimal,
    indexDecimal,
    currentTab,
    focusedTabStyle,
    handleTabPress,
    handleItemLayout,
    itemsLayout,
    renderItem,
    tabItemStyle,
    tabNames,
    textSize,
    variant,
  ]);
  const pillIndicator = useMemo(() => {
    if (!useAnimatedPillIndicator || !indexDecimal) {
      return null;
    }
    if (itemsLayout.length !== tabNames.length) {
      return null;
    }
    return (
      <AnimatedPillIndicator
        indexDecimal={indexDecimal}
        itemsLayout={itemsLayout}
      />
    );
  }, [useAnimatedPillIndicator, indexDecimal, itemsLayout, tabNames.length]);

  const content = useMemo(() => {
    if (scrollable) {
      return null;
    }
    if (isPill) {
      return (
        <PillTabBarContent
          tabItems={tabItems}
          pillIndicator={pillIndicator}
          renderToolbar={renderToolbar?.({ focusedTab: currentTab })}
        />
      );
    }
    if (useAnimatedDefault && animatedDefaultIndexDecimal) {
      return (
        <>
          <XStack ai="center" jc="space-between">
            <XStack position="relative">
              {tabItems}
              {itemsLayout.length === tabNames.length ? (
                <AnimatedIndicator
                  indexDecimal={animatedDefaultIndexDecimal}
                  itemsLayout={itemsLayout}
                />
              ) : null}
            </XStack>
            {renderToolbar?.({ focusedTab: currentTab })}
          </XStack>
          {divider ? <Divider /> : null}
        </>
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
  }, [
    useAnimatedDefault,
    animatedDefaultIndexDecimal,
    itemsLayout,
    tabNames.length,
    currentTab,
    divider,
    isPill,
    pillIndicator,
    renderToolbar,
    scrollable,
    tabItems,
  ]);

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
          style={TAB_LIST_VIEW_STYLE}
          useFlashList
          data={tabNames}
          ref={listViewRef}
          horizontal
          pr="$4"
          contentContainerStyle={TAB_CONTENT_CONTAINER_STYLE}
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
