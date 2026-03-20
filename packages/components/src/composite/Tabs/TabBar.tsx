import { useCallback, useMemo, useRef, useState } from 'react';

import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
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
  indexDecimal: SharedValue<number>;
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

  return (
    <Animated.Text
      style={[animatedTextStyles.text, animatedColorStyle]}
      numberOfLines={1}
    >
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
}: ITabBarItemProps) {
  const handlePress = useCallback(() => {
    onPress(name);
  }, [name, onPress]);

  const resolvedTextSize = textSize ?? '$bodyLgMedium';

  if (variant === 'pill') {
    // When animatedPillIndicator is active, the sliding background is rendered
    // by AnimatedPillIndicator — items should be transparent so it shows through.
    let pillBg: string = '$bgStrong';
    if (animatedPillIndicator) {
      pillBg = 'transparent';
    } else if (isFocused) {
      pillBg = '$bgPrimary';
    }

    const useAnimatedText =
      animatedPillIndicator &&
      indexDecimal !== undefined &&
      tabIndex !== undefined;

    return (
      <YStack
        ai="center"
        jc="center"
        px="$3.5"
        py="$1.5"
        borderRadius="$full"
        bg={pillBg}
        hoverStyle={
          isFocused || animatedPillIndicator ? undefined : { bg: '$bgHover' }
        }
        pressStyle={
          isFocused || animatedPillIndicator ? undefined : { bg: '$bgActive' }
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
  indexDecimal: SharedValue<number>;
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
      <Animated.Text
        style={[animatedTextStyles.text, animatedTextStyle]}
        numberOfLines={1}
      >
        {name}
      </Animated.Text>
    </YStack>
  );
}

function AnimatedIndicator({
  indexDecimal,
  itemsLayout,
}: {
  indexDecimal: SharedValue<number>;
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

  if (itemsLayout.length === 0) {
    return null;
  }

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 2,
          borderRadius: 1,
          backgroundColor: indicatorColor,
        },
        animatedStyle,
      ]}
    />
  );
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
  indexDecimal: SharedValue<number>;
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
      <Animated.Text
        style={[animatedTextStyles.text, animatedTextStyle]}
        numberOfLines={1}
      >
        {name}
      </Animated.Text>
    </YStack>
  );
}

function AnimatedPillIndicator({
  indexDecimal,
  itemsLayout,
}: {
  indexDecimal: SharedValue<number>;
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

  if (itemsLayout.length === 0) {
    return null;
  }

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          borderRadius: 9999,
          backgroundColor: bgColor,
        },
        animatedStyle,
      ]}
    />
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
  // When true, the pill background is handled by AnimatedPillIndicator,
  // so TabBarItem should not render its own background color.
  animatedPillIndicator?: boolean;
  // Provided when animatedPillIndicator is true for UI-thread text color.
  indexDecimal?: SharedValue<number>;
  index?: number;
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
          contentContainerStyle={{
            px: '$pagePadding',
            py: '$2',
          }}
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
}) {
  const listViewRef = useRef<IListViewRef<string>>(null);
  const listViewTimerId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentTab, setCurrentTab] = useState<string>(focusedTab.value);
  const [itemsLayout, setItemsLayout] = useState<IItemLayout[]>([]);
  const itemsLayoutRef = useRef<Map<number, IItemLayout>>(new Map());

  const useAnimatedDefault =
    !!indexDecimal &&
    variant === 'default' &&
    !scrollable &&
    !renderItem &&
    !textSize;

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
    if (useAnimatedDefault && indexDecimal) {
      return tabNames.map((name, index) => (
        <AnimatedTabBarItem
          key={name}
          name={name}
          index={index}
          indexDecimal={indexDecimal}
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
    return tabNames.map((name, index) => {
      const hasAnimatedIndicator = useAnimatedPillIndicator && !!renderItem;
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
    indexDecimal,
    currentTab,
    focusedTabStyle,
    handleTabPress,
    handleItemLayout,
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
    if (useAnimatedDefault && indexDecimal) {
      return (
        <>
          <XStack ai="center" jc="space-between">
            <XStack position="relative">
              {tabItems}
              {itemsLayout.length === tabNames.length ? (
                <AnimatedIndicator
                  indexDecimal={indexDecimal}
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
    indexDecimal,
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
