import { useCallback, useEffect, useRef, useState } from 'react';

import Animated, {
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';

import {
  ButtonFrame,
  Icon,
  ScrollView,
  SizableText,
  XStack,
  getSharedButtonStyles,
  useTheme,
} from '@onekeyhq/components';
import type { IScrollViewRef } from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import type { LayoutChangeEvent } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

const AnimatedButton = Animated.createAnimatedComponent(ButtonFrame);

type ICategoryTab = { tabId: string; name: string };

function CategoryTab({
  tab,
  index,
  indexDecimal,
  selected,
  tabHeight,
  onLayout,
  onSelect,
}: {
  tab: ICategoryTab;
  index: number;
  indexDecimal: SharedValue<number>;
  selected: boolean;
  tabHeight: number;
  onLayout: (event: LayoutChangeEvent) => void;
  onSelect: (tabId: string) => void;
}) {
  const theme = useTheme();
  const { sharedFrameStyles } = getSharedButtonStyles({ variant: 'secondary' });
  const isStar = tab.tabId === 'favorites';
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  let inactiveBackground = theme.bgStrong.val;
  let activeBackground = theme.bgAccent.val;
  if (pressed) {
    inactiveBackground = theme.bgStrongActive.val;
    activeBackground = theme.bgAccentActive.val;
  } else if (hovered) {
    inactiveBackground = theme.bgStrongHover.val;
    activeBackground = theme.bgAccentHover.val;
  }
  const inactiveText = theme.text.val;
  const activeText = theme.textInverse.val;
  // Follow the pager's progress, including cancelled swipes, without waiting
  // for the selected category's React render after the transition settles.
  const backgroundStyle = useAnimatedStyle(() => ({
    backgroundColor: isStar
      ? inactiveBackground
      : interpolateColor(
          indexDecimal.value,
          [index - 1, index, index + 1],
          [inactiveBackground, activeBackground, inactiveBackground],
        ),
  }));
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      indexDecimal.value,
      [index - 1, index, index + 1],
      [inactiveText, activeText, inactiveText],
    ),
  }));
  const starStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - Math.abs(indexDecimal.value - index)),
  }));
  const inactiveStarStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(indexDecimal.value - index)),
  }));

  return (
    <AnimatedButton
      {...sharedFrameStyles}
      testID={`perps-simple-category-${tab.tabId}`}
      px="$2.5"
      py="$1"
      borderCurve="continuous"
      borderRadius="$full"
      flexShrink={0}
      mx="$0"
      my="$0"
      style={backgroundStyle}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      {...(isStar
        ? { width: tabHeight, height: tabHeight, px: '$0', py: '$0' }
        : {})}
      onLayout={onLayout}
      accessibilityRole="tab"
      accessibilityLabel={tab.name}
      accessibilityState={{ selected }}
      onPress={(event) => {
        event.stopPropagation();
        onSelect(tab.tabId);
        defaultLogger.ui.button.click({
          trackId: `perps-simple-category-${tab.tabId}`,
        });
      }}
    >
      {isStar ? (
        <XStack width="$5" height="$5" position="relative" pointerEvents="none">
          <Animated.View style={inactiveStarStyle}>
            <Icon name="StarSolid" size="$5" color="$iconSubdued" />
          </Animated.View>
          <Animated.View
            style={[{ position: 'absolute', top: 0, left: 0 }, starStyle]}
          >
            <Icon name="StarSolid" size="$5" color="$bgAccent" />
          </Animated.View>
        </XStack>
      ) : (
        <SizableText size="$bodyMdMedium" userSelect="none">
          <Animated.Text style={textStyle}>{tab.name}</Animated.Text>
        </SizableText>
      )}
    </AnimatedButton>
  );
}

export function SimpleMarketCategories({
  tabs,
  selectedId,
  onSelect,
  indexDecimal,
}: {
  indexDecimal: SharedValue<number>;
  tabs: { tabId: string; name: string }[];
  selectedId: string;
  onSelect: (tabId: string) => void;
}) {
  const [tabHeight, setTabHeight] = useState(32);
  const firstTextTabId = tabs.find((tab) => tab.tabId !== 'favorites')?.tabId;
  const scrollRef = useRef<IScrollViewRef>(null);
  const layouts = useRef(new Map<string, { x: number; width: number }>());
  const viewportWidth = useRef(0);
  const lastReveal = useRef<{ tabId: string; x: number } | null>(null);
  const revealTab = useCallback((tabId: string, force = false) => {
    const layout = layouts.current.get(tabId);
    if (!layout || !viewportWidth.current || !scrollRef.current) return;
    const x = Math.max(
      0,
      layout.x + layout.width / 2 - viewportWidth.current / 2,
    );
    // The selection effect follows a tap; avoid issuing the same alignment twice.
    if (
      !force &&
      lastReveal.current?.tabId === tabId &&
      lastReveal.current.x === x
    )
      return;
    lastReveal.current = { tabId, x };
    // Match Market's native tab bar: align directly without a second animation.
    scrollRef.current?.scrollTo({ x, animated: false });
  }, []);
  const revealSelected = useCallback(
    () => revealTab(selectedId),
    [revealTab, selectedId],
  );
  const handleSelect = useCallback(
    (tabId: string) => {
      onSelect(tabId);
      revealTab(tabId, true);
    },
    [onSelect, revealTab],
  );
  useEffect(revealSelected, [revealSelected]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      onScrollBeginDrag={() => {
        lastReveal.current = null;
      }}
      showsHorizontalScrollIndicator={false}
      onLayout={(event) => {
        viewportWidth.current = event.nativeEvent.layout.width;
        revealSelected();
      }}
    >
      <XStack gap="$3" py="$1" px="$5">
        {tabs.map((tab, index) => (
          <CategoryTab
            key={tab.tabId}
            tab={tab}
            index={index}
            indexDecimal={indexDecimal}
            selected={selectedId === tab.tabId}
            tabHeight={tabHeight}
            onSelect={handleSelect}
            onLayout={(event: LayoutChangeEvent) => {
              layouts.current.set(tab.tabId, event.nativeEvent.layout);
              if (
                tab.tabId === firstTextTabId &&
                event.nativeEvent.layout.height > 0
              ) {
                setTabHeight(event.nativeEvent.layout.height);
              }
              if (tab.tabId === selectedId) revealSelected();
            }}
          />
        ))}
      </XStack>
    </ScrollView>
  );
}
