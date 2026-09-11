import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  interpolatePageHeight,
  resolveActiveTabKey,
  resolveDefaultTabKey,
  resolveSettleIndex,
  resolveVisibleTabKeys,
} from './mobileDetailTabs.utils';

import type { IMobileDetailTabKey } from './mobileDetailTabs.utils';
import type { LayoutChangeEvent } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

const TAB_LABEL_IDS: Record<IMobileDetailTabKey, ETranslations> = {
  portfolio: ETranslations.global_portfolio,
  info: ETranslations.global_info,
  protocol: ETranslations.global_protocol,
};

// Critically damped and clamped: the page settles onto its slot without
// swinging past the neighbor, which would read as a mis-swipe.
const SETTLE_SPRING = {
  stiffness: 220,
  damping: 30,
  mass: 1,
  overshootClamping: true,
} as const;
// A drag has to commit horizontally before the pager claims it, and any clear
// vertical drift hands the touch back to the page scroll.
const PAN_ACTIVE_OFFSET_X: [number, number] = [-16, 16];
const PAN_FAIL_OFFSET_Y: [number, number] = [-12, 12];
// Past either end the page follows the finger at a third of the distance.
const OVERSCROLL_RESISTANCE = 0.33;
// Only until a page reports its own height, which happens on first layout.
const UNMEASURED_PAGE_HEIGHT = 200;

type ITabLayout = { x: number; width: number };

function TabBarItem({
  label,
  focused,
  onPress,
  onLayout,
}: {
  label: string;
  focused: boolean;
  onPress: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  return (
    <YStack
      h={40}
      ai="center"
      jc="center"
      cursor="pointer"
      userSelect="none"
      onPress={onPress}
      onLayout={onLayout}
    >
      <SizableText
        size="$bodyLgMedium"
        color={focused ? '$text' : '$textSubdued'}
        numberOfLines={1}
      >
        {label}
      </SizableText>
    </YStack>
  );
}

/**
 * One page of the pager. Absolutely positioned so pages can overlap during a
 * swipe, and shifted by its distance from the current progress: the finger
 * drags the page 1:1, the neighbor follows in from the side.
 */
function TabPage({
  index,
  isActive,
  progress,
  pageWidth,
  onContentLayout,
  children,
}: {
  index: number;
  isActive: boolean;
  progress: SharedValue<number>;
  pageWidth: number;
  onContentLayout: (height: number) => void;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const offset = index - progress.value;
    return {
      transform: [{ translateX: offset * pageWidth }],
      // A page that has fully left the viewport is hidden outright: Android
      // rounds the translation to whole pixels on its own, which left a
      // sliver of the next page's left edge inside the clipped container
      // (OK-62948). It shows again the moment a drag brings it back.
      opacity: Math.abs(offset) >= 1 ? 0 : 1,
    };
  }, [index, pageWidth]);
  return (
    // Every page stays mounted so it can slide in, but only the active one is
    // a page as far as touches and screen readers are concerned: the others
    // sit clipped off-screen, where VoiceOver / TalkBack would otherwise still
    // walk and activate their controls.
    <Animated.View
      pointerEvents={isActive ? 'auto' : 'none'}
      accessibilityElementsHidden={!isActive}
      importantForAccessibility={isActive ? 'auto' : 'no-hide-descendants'}
      style={[
        { position: 'absolute', top: 0, left: 0, width: pageWidth },
        style,
      ]}
    >
      <View
        onLayout={(event) => onContentLayout(event.nativeEvent.layout.height)}
      >
        {children}
      </View>
    </Animated.View>
  );
}

export function MobileDetailTabs({
  hasPortfolio,
  portfolioContent,
  infoContent,
  protocolContent,
}: {
  hasPortfolio: boolean;
  portfolioContent?: React.ReactNode;
  infoContent: React.ReactNode;
  protocolContent?: React.ReactNode;
}) {
  const intl = useIntl();
  const [selectedKey, setSelectedKey] = useState<
    IMobileDetailTabKey | undefined
  >(undefined);

  // The portfolio tab only exists once the account response says there is a
  // position, so visibility is data-driven and can change under a mounted page.
  const showPortfolio = hasPortfolio && Boolean(portfolioContent);
  // Likewise the protocol tab: a provider without intro data (Lista) gets no
  // tab rather than an empty page (OK-62925).
  const showProtocol = Boolean(protocolContent);

  const visibleKeys = useMemo(
    () =>
      resolveVisibleTabKeys({
        hasPortfolio: showPortfolio,
        hasProtocol: showProtocol,
      }),
    [showPortfolio, showProtocol],
  );

  const activeKey = useMemo(
    () =>
      resolveActiveTabKey({
        selectedKey,
        visibleKeys,
        defaultKey: resolveDefaultTabKey({ hasPortfolio: showPortfolio }),
      }),
    [selectedKey, visibleKeys, showPortfolio],
  );
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;

  const contents: Record<IMobileDetailTabKey, React.ReactNode> = {
    portfolio: portfolioContent ?? null,
    info: infoContent,
    protocol: protocolContent ?? null,
  };

  // Continuous page index: 1 is Info sitting in place, 1.4 is Info dragged
  // forty percent of the way towards Protocol. Everything animated below reads
  // this one value, so the pages, the underline and the height never disagree.
  const progress = useSharedValue(visibleKeys.indexOf(activeKey));
  const dragStartProgress = useSharedValue(0);
  // Set for the duration of a tab-bar tap's spring. The halfway commit below
  // is right for a finger drag, but a tap from Portfolio to Protocol sweeps
  // through Info, and committing it there would flash the wrong label and
  // leave selectedKey pointing at the in-between tab mid-flight.
  const tapTarget = useSharedValue<number | null>(null);
  // Measured by key rather than index: when the Portfolio tab appears, Info
  // moves from slot 0 to slot 1 and its measurements have to move with it.
  // The refs are the source of truth on the JS side; the shared values only
  // mirror them. The three pages report their layout in the same tick, and a
  // merge that reads the shared value back on the JS thread sees a stale copy,
  // so each write would drop the previous page's measurement.
  const pageHeightsRef = useRef<Partial<Record<IMobileDetailTabKey, number>>>(
    {},
  );
  const pageHeights = useSharedValue<
    Partial<Record<IMobileDetailTabKey, number>>
  >({});
  const tabLayoutsRef = useRef<
    Partial<Record<IMobileDetailTabKey, ITabLayout>>
  >({});
  const tabLayouts = useSharedValue<
    Partial<Record<IMobileDetailTabKey, ITabLayout>>
  >({});
  const [pageWidth, setPageWidth] = useState(0);

  const commitIndex = useCallback(
    (index: number) => {
      const key = visibleKeys[index];
      if (key) {
        setSelectedKey(key);
      }
    },
    [visibleKeys],
  );

  // A tab appearing or disappearing re-numbers the slots; put the pager on the
  // active tab's new slot without animating through the others.
  useEffect(() => {
    const index = visibleKeys.indexOf(activeKeyRef.current);
    if (index >= 0) {
      cancelAnimation(progress);
      progress.value = index;
    }
  }, [visibleKeys, progress]);

  const jumpTo = useCallback(
    (key: IMobileDetailTabKey) => {
      const index = visibleKeys.indexOf(key);
      if (index < 0) {
        return;
      }
      setSelectedKey(key);
      tapTarget.value = index;
      progress.value = withSpring(index, SETTLE_SPRING, (finished) => {
        'worklet';

        if (finished) {
          tapTarget.value = null;
        }
      });
    },
    [visibleKeys, progress, tapTarget],
  );

  // Mid-swipe the label switches at the halfway point, the way the underline
  // reads it.
  useAnimatedReaction(
    () => Math.round(progress.value),
    (rounded, previous) => {
      if (tapTarget.value !== null) {
        return;
      }
      if (previous !== null && rounded !== previous) {
        runOnJS(commitIndex)(rounded);
      }
    },
    [commitIndex],
  );

  const pageCount = visibleKeys.length;
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX(PAN_ACTIVE_OFFSET_X)
        .failOffsetY(PAN_FAIL_OFFSET_Y)
        .enabled(pageCount > 1 && pageWidth > 0)
        .onStart(() => {
          'worklet';

          // A finger taking over mid-tap resumes the halfway commits.
          cancelAnimation(progress);
          tapTarget.value = null;
          dragStartProgress.value = progress.value;
        })
        .onUpdate((event) => {
          'worklet';

          if (pageWidth <= 0) {
            return;
          }
          let next = dragStartProgress.value - event.translationX / pageWidth;
          const maxIndex = pageCount - 1;
          if (next < 0) {
            next *= OVERSCROLL_RESISTANCE;
          } else if (next > maxIndex) {
            next = maxIndex + (next - maxIndex) * OVERSCROLL_RESISTANCE;
          }
          progress.value = next;
        })
        .onEnd((event) => {
          'worklet';

          const target = resolveSettleIndex({
            progress: progress.value,
            velocityX: event.velocityX,
            count: pageCount,
          });
          progress.value = withSpring(target, SETTLE_SPRING);
          runOnJS(commitIndex)(target);
        }),
    [pageCount, pageWidth, progress, dragStartProgress, tapTarget, commitIndex],
  );

  const handleContainerLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setPageWidth((previous) => (previous === width ? previous : width));
  }, []);

  const handlePageLayout = useCallback(
    (key: IMobileDetailTabKey, height: number) => {
      if (pageHeightsRef.current[key] === height) {
        return;
      }
      pageHeightsRef.current = { ...pageHeightsRef.current, [key]: height };
      pageHeights.value = pageHeightsRef.current;
    },
    [pageHeights],
  );

  const handleTabLayout = useCallback(
    (key: IMobileDetailTabKey, event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      const current = tabLayoutsRef.current[key];
      if (current && current.x === x && current.width === width) {
        return;
      }
      tabLayoutsRef.current = { ...tabLayoutsRef.current, [key]: { x, width } };
      tabLayouts.value = tabLayoutsRef.current;
    },
    [tabLayouts],
  );

  const containerStyle = useAnimatedStyle(
    () => ({
      height: interpolatePageHeight({
        progress: progress.value,
        heights: visibleKeys.map((key) => pageHeights.value[key] ?? 0),
        fallback: UNMEASURED_PAGE_HEIGHT,
      }),
    }),
    [visibleKeys],
  );

  // The underline glides between the two tabs the finger is between, sized to
  // each label, rather than jumping when the page lands.
  const underlineStyle = useAnimatedStyle(() => {
    const layouts = visibleKeys.map((key) => tabLayouts.value[key]);
    const maxIndex = layouts.length - 1;
    const clamped = Math.max(0, Math.min(maxIndex, progress.value));
    const lower = layouts[Math.floor(clamped)];
    const upper = layouts[Math.ceil(clamped)];
    if (!lower || !upper) {
      return { opacity: 0, width: 0, transform: [{ translateX: 0 }] };
    }
    const fraction = clamped - Math.floor(clamped);
    return {
      opacity: 1,
      width: lower.width + (upper.width - lower.width) * fraction,
      transform: [{ translateX: lower.x + (upper.x - lower.x) * fraction }],
    };
  }, [visibleKeys]);

  return (
    <YStack gap="$6">
      <XStack
        gap="$5"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
        position="relative"
      >
        {visibleKeys.map((key) => (
          <TabBarItem
            key={key}
            label={intl.formatMessage({ id: TAB_LABEL_IDS[key] })}
            focused={activeKey === key}
            onPress={() => jumpTo(key)}
            onLayout={(event) => handleTabLayout(key, event)}
          />
        ))}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              bottom: 0,
              left: 0,
              height: 2,
              borderRadius: 1,
            },
            underlineStyle,
          ]}
        >
          <YStack flex={1} bg="$text" borderRadius={1} />
        </Animated.View>
      </XStack>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          onLayout={handleContainerLayout}
          style={[{ position: 'relative', overflow: 'hidden' }, containerStyle]}
        >
          {pageWidth > 0
            ? visibleKeys.map((key, index) => (
                <TabPage
                  key={key}
                  index={index}
                  isActive={key === activeKey}
                  progress={progress}
                  pageWidth={pageWidth}
                  onContentLayout={(height) => handlePageLayout(key, height)}
                >
                  {contents[key]}
                </TabPage>
              ))
            : null}
        </Animated.View>
      </GestureDetector>
    </YStack>
  );
}
