import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';

import {
  Badge,
  SegmentControl,
  SizableText,
  Stack,
  XStack,
  YStack,
  fs,
  useMedia,
  useTheme,
} from '@onekeyhq/components';
import type { ISegmentControlProps } from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { LayoutChangeEvent } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

export type IEarnHomeMode = 'earn' | 'borrow';

const getBadgeTheme = ({
  themeVariant,
  isActive,
}: {
  themeVariant: 'light' | 'dark';
  isActive: boolean;
  // eslint-disable-next-line no-nested-ternary
}) => (isActive ? (themeVariant === 'light' ? 'dark' : 'light') : themeVariant);

const MarketSelectorDesktop = ({
  mode,
  onModeChange,
  backgroundColor,
  activeBackgroundColor,
}: {
  mode: IEarnHomeMode;
  onModeChange?: (mode: IEarnHomeMode) => void;
  backgroundColor?: ISegmentControlProps['slotBackgroundColor'];
  activeBackgroundColor?: ISegmentControlProps['activeBackgroundColor'];
}) => {
  const intl = useIntl();
  const themeVariant = useThemeVariant();

  const options = useMemo(() => {
    const renderLabel = (
      value: IEarnHomeMode,
      messageId: ETranslations,
      withBadge = false,
    ) => {
      const isActive = mode === value;
      const labelText = (
        <SizableText
          size="$bodyMdMedium"
          textAlign="center"
          color={isActive ? '$textInverse' : '$text'}
        >
          {intl.formatMessage({ id: messageId })}
        </SizableText>
      );
      if (!withBadge) {
        return labelText;
      }
      const badgeTheme = getBadgeTheme({ themeVariant, isActive });
      return (
        <XStack alignItems="center" justifyContent="center" gap="$2">
          {labelText}
          <Badge
            badgeSize="sm"
            badgeType="success"
            pointerEvents="none"
            theme={badgeTheme}
          >
            <Badge.Text>
              {intl.formatMessage({ id: ETranslations.explore_badge_new })}
            </Badge.Text>
          </Badge>
        </XStack>
      );
    };
    return [
      {
        label: renderLabel('earn', ETranslations.earn_title),
        value: 'earn' as const,
      },
      {
        label: renderLabel('borrow', ETranslations.global_borrow, true),
        value: 'borrow' as const,
      },
    ];
  }, [intl, mode, themeVariant]);

  const itemStyleProps = useMemo(() => {
    const baseProps = {
      elevation: 0,
      flexGrow: 1,
      flexBasis: 0,
      '$platform-native': {
        elevation: 0,
      },
      '$platform-web': {
        boxShadow: 'none',
      },
    };

    if (!backgroundColor) {
      return baseProps;
    }

    return {
      ...baseProps,
      hoverStyle: {
        bg: backgroundColor,
      },
      pressStyle: {
        bg: backgroundColor,
      },
    };
  }, [backgroundColor]);

  return (
    <Stack px="$pagePadding" pt="$5" pb="$1">
      <SegmentControl
        value={mode}
        options={options}
        width={264}
        onChange={(value) => onModeChange?.(value as IEarnHomeMode)}
        slotBackgroundColor={backgroundColor}
        activeBackgroundColor={activeBackgroundColor}
        segmentControlItemStyleProps={itemStyleProps}
      />
    </Stack>
  );
};

// Horizontal inset for the underline (matches $5 = 20)
const UNDERLINE_INSET = 20;

const animatedStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    position: 'relative',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 8,
    flexDirection: 'row',
    gap: 8,
  },
  tabText: {
    fontSize: fs(16),
    fontWeight: '600',
    fontFamily: 'Roobert-SemiBold',
    lineHeight: fs(24),
    textAlign: 'center',
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    borderRadius: 1,
  },
});

const AnimatedUnderline = ({
  pageScrollPosition,
  underlineColor,
  containerWidth,
}: {
  pageScrollPosition: SharedValue<number>;
  underlineColor: string;
  containerWidth: number;
}) => {
  const tabWidth = containerWidth / 2;
  const underlineWidth = tabWidth - UNDERLINE_INSET * 2;
  // Tab 0 underline left = UNDERLINE_INSET
  // Tab 1 underline left = tabWidth + UNDERLINE_INSET
  const underlineAnimatedStyle = useAnimatedStyle(() => ({
    left: interpolate(
      pageScrollPosition.value,
      [0, 1],
      [UNDERLINE_INSET, tabWidth + UNDERLINE_INSET],
    ),
    width: underlineWidth,
    backgroundColor: underlineColor,
  }));

  return (
    <Animated.View style={[animatedStyles.underline, underlineAnimatedStyle]} />
  );
};

const AnimatedTabBar = ({
  pageScrollPosition,
  onModeChange,
}: {
  pageScrollPosition: SharedValue<number>;
  onModeChange?: (mode: IEarnHomeMode) => void;
}) => {
  const intl = useIntl();
  const theme = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);

  const activeColor = theme.text.val;
  const inactiveColor = theme.textSubdued.val;
  const underlineColor = theme.text.val;

  const handlePressEarn = useCallback(() => {
    onModeChange?.('earn');
  }, [onModeChange]);

  const handlePressBorrow = useCallback(() => {
    onModeChange?.('borrow');
  }, [onModeChange]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  const earnTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      pageScrollPosition.value,
      [0, 1],
      [activeColor, inactiveColor],
    ),
  }));

  const borrowTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      pageScrollPosition.value,
      [0, 1],
      [inactiveColor, activeColor],
    ),
  }));

  return (
    <View style={animatedStyles.container} onLayout={handleLayout}>
      <Pressable style={animatedStyles.tabItem} onPress={handlePressEarn}>
        <Animated.Text style={[animatedStyles.tabText, earnTextStyle]}>
          {intl.formatMessage({ id: ETranslations.earn_title })}
        </Animated.Text>
      </Pressable>
      <Pressable style={animatedStyles.tabItem} onPress={handlePressBorrow}>
        <Animated.Text style={[animatedStyles.tabText, borrowTextStyle]}>
          {intl.formatMessage({ id: ETranslations.global_borrow })}
        </Animated.Text>
        <Badge badgeSize="sm" badgeType="success" pointerEvents="none">
          <Badge.Text>
            {intl.formatMessage({ id: ETranslations.explore_badge_new })}
          </Badge.Text>
        </Badge>
      </Pressable>
      {containerWidth > 0 ? (
        <AnimatedUnderline
          pageScrollPosition={pageScrollPosition}
          underlineColor={underlineColor}
          containerWidth={containerWidth}
        />
      ) : null}
    </View>
  );
};

const MarketSelectorMobile = ({
  mode,
  onModeChange,
  pageScrollPosition,
}: {
  mode: IEarnHomeMode;
  onModeChange?: (mode: IEarnHomeMode) => void;
  pageScrollPosition?: SharedValue<number>;
}) => {
  const intl = useIntl();

  const options = useMemo(() => {
    const renderLabel = (
      value: IEarnHomeMode,
      messageId: ETranslations,
      withBadge = false,
    ) => {
      const isActive = mode === value;
      return (
        <YStack
          w="100%"
          alignItems="center"
          justifyContent="center"
          pt="$1"
          pb="$2"
          position="relative"
        >
          <XStack alignItems="center" justifyContent="center" gap="$2">
            <SizableText
              size="$headingMd"
              textAlign="center"
              color={isActive ? '$textText' : '$text'}
            >
              {intl.formatMessage({ id: messageId })}
            </SizableText>
            {withBadge ? (
              <Badge badgeSize="sm" badgeType="success" pointerEvents="none">
                <Badge.Text>
                  {intl.formatMessage({ id: ETranslations.explore_badge_new })}
                </Badge.Text>
              </Badge>
            ) : null}
          </XStack>
          {isActive ? (
            <YStack
              position="absolute"
              bottom={0}
              left="$5"
              right="$5"
              h="$0.5"
              bg="$text"
              borderRadius={1}
            />
          ) : null}
        </YStack>
      );
    };
    return [
      {
        label: renderLabel('earn', ETranslations.earn_title),
        value: 'earn' as const,
      },
      {
        label: renderLabel('borrow', ETranslations.global_borrow, true),
        value: 'borrow' as const,
      },
    ];
  }, [intl, mode]);

  // When pageScrollPosition is available, render the animated tab bar
  if (pageScrollPosition) {
    return (
      <Stack px="$3" pt="$4">
        <AnimatedTabBar
          pageScrollPosition={pageScrollPosition}
          onModeChange={onModeChange}
        />
      </Stack>
    );
  }

  // Fallback: SegmentControl-based approach for web/tablet
  return (
    <Stack px="$3" pt="$4">
      <SegmentControl
        value={mode}
        options={options}
        fullWidth
        onChange={(value) => onModeChange?.(value as IEarnHomeMode)}
        slotBackgroundColor="$transparent"
        activeBackgroundColor="$transparent"
        borderRadius="$0"
        p="$0"
        segmentControlItemStyleProps={{
          borderRadius: 0,
          px: '$0',
          py: '$0',
          elevation: 0,
          hoverStyle: {
            bg: '$transparent',
          },
          pressStyle: {
            bg: '$transparent',
          },
          '$platform-native': {
            elevation: 0,
          },
          '$platform-web': {
            boxShadow: 'none',
          },
        }}
      />
    </Stack>
  );
};

export const MarketSelector = ({
  mode,
  onModeChange,
  backgroundColor,
  activeBackgroundColor,
  pageScrollPosition,
}: {
  mode: IEarnHomeMode;
  onModeChange?: (mode: IEarnHomeMode) => void;
  backgroundColor?: ISegmentControlProps['slotBackgroundColor'];
  activeBackgroundColor?: ISegmentControlProps['activeBackgroundColor'];
  pageScrollPosition?: SharedValue<number>;
}) => {
  const { gtMd } = useMedia();

  if (gtMd) {
    return (
      <MarketSelectorDesktop
        mode={mode}
        onModeChange={onModeChange}
        backgroundColor={backgroundColor}
        activeBackgroundColor={activeBackgroundColor}
      />
    );
  }

  return (
    <MarketSelectorMobile
      mode={mode}
      onModeChange={onModeChange}
      pageScrollPosition={pageScrollPosition}
    />
  );
};
