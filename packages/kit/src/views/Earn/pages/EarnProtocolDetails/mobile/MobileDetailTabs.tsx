import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  resolveActiveTabKey,
  resolveDefaultTabKey,
  resolveSwipeTargetKey,
  resolveVisibleTabKeys,
} from './mobileDetailTabs.utils';

import type { IMobileDetailTabKey } from './mobileDetailTabs.utils';
import type { LayoutChangeEvent } from 'react-native';

// A drag has to commit horizontally before the pan claims it, and any clear
// vertical drift hands the touch back to the page scroll.
const PAN_ACTIVE_OFFSET_X: [number, number] = [-24, 24];
const PAN_FAIL_OFFSET_Y: [number, number] = [-12, 12];

const TAB_LABEL_IDS: Record<IMobileDetailTabKey, ETranslations> = {
  portfolio: ETranslations.global_portfolio,
  info: ETranslations.global_info,
  protocol: ETranslations.global_protocol,
};

function TabBarItem({
  label,
  focused,
  onPress,
}: {
  label: string;
  focused: boolean;
  onPress: () => void;
}) {
  return (
    <YStack
      h={40}
      ai="center"
      jc="center"
      position="relative"
      cursor="pointer"
      userSelect="none"
      onPress={onPress}
    >
      <SizableText
        size="$bodyLgMedium"
        color={focused ? '$text' : '$textSubdued'}
        numberOfLines={1}
      >
        {label}
      </SizableText>
      {focused ? (
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

export function MobileDetailTabs({
  hasPortfolio,
  portfolioContent,
  infoContent,
  protocolContent,
}: {
  hasPortfolio: boolean;
  portfolioContent?: React.ReactNode;
  infoContent: React.ReactNode;
  protocolContent: React.ReactNode;
}) {
  const intl = useIntl();
  const [selectedKey, setSelectedKey] = useState<
    IMobileDetailTabKey | undefined
  >(undefined);

  // The portfolio tab only exists once the account response says there is a
  // position, so visibility is data-driven and can change under a mounted page.
  const showPortfolio = hasPortfolio && Boolean(portfolioContent);

  const visibleKeys = useMemo(
    () => resolveVisibleTabKeys({ hasPortfolio: showPortfolio }),
    [showPortfolio],
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

  const handleChange = useCallback((key: IMobileDetailTabKey) => {
    setSelectedKey(key);
  }, []);

  const [bodyWidth, setBodyWidth] = useState(0);
  const handleBodyLayout = useCallback((event: LayoutChangeEvent) => {
    setBodyWidth(event.nativeEvent.layout.width);
  }, []);

  const handleSwipe = useCallback(
    (translationX: number, velocityX: number) => {
      const target = resolveSwipeTargetKey({
        activeKey,
        visibleKeys,
        translationX,
        velocityX,
        width: bodyWidth,
      });
      if (target) {
        setSelectedKey(target);
      }
    },
    [activeKey, visibleKeys, bodyWidth],
  );

  // Swiping the body switches tabs (OK-62395). A pan rather than a pager: the
  // page keeps its own vertical scroll, nothing is nested, and the body swaps
  // the way it does on a tap. The chart sits above the tab bar, outside this
  // detector, so its horizontal drag is untouched; the page scroll wins
  // through failOffsetY, and the stack's edge swipe-back keeps its priority
  // as a native gesture.
  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX(PAN_ACTIVE_OFFSET_X)
        .failOffsetY(PAN_FAIL_OFFSET_Y)
        .enabled(visibleKeys.length > 1)
        .onEnd((event) => {
          'worklet';

          runOnJS(handleSwipe)(event.translationX, event.velocityX);
        }),
    [handleSwipe, visibleKeys.length],
  );

  const content = useMemo(() => {
    switch (activeKey) {
      case 'portfolio':
        return portfolioContent ?? null;
      case 'protocol':
        return protocolContent;
      case 'info':
      default:
        return infoContent;
    }
  }, [activeKey, portfolioContent, infoContent, protocolContent]);

  return (
    <YStack gap="$6">
      <XStack
        gap="$5"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
      >
        {visibleKeys.map((key) => (
          <TabBarItem
            key={key}
            label={intl.formatMessage({ id: TAB_LABEL_IDS[key] })}
            focused={activeKey === key}
            onPress={() => handleChange(key)}
          />
        ))}
      </XStack>
      <GestureDetector gesture={swipeGesture}>
        <YStack onLayout={handleBodyLayout}>{content}</YStack>
      </GestureDetector>
    </YStack>
  );
}
