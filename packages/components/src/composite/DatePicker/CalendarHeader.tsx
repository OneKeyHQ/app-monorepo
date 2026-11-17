import { memo } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { IconButton } from '../../actions/IconButton';
import { useMedia } from '../../hooks';
import { SizableText, Stack, XStack } from '../../primitives';

import type { ICalendarHeaderProps } from './type';
import type { IIconButtonProps } from '../../actions/IconButton';
import type { IKeyOfIcons } from '../../primitives';

const titleHoverStyle = { bg: '$bgHover' } as const;
const titlePressStyle = { bg: '$bgActive' } as const;
// Android reserves extra font padding above the ascent (large for CJK fonts),
// which sinks the title below the visual center of the nav buttons row.
const titleTextStyle = platformEnv.isNativeAndroid
  ? ({ includeFontPadding: false } as const)
  : undefined;

// Directional hit slop: the paired chevrons overlap via IconButton's negative
// margin, and RN hit-testing lets the later sibling win overlapped areas, so
// the slop must only extend away from the neighbor (plus vertically).
const HIT_SLOP_EXPAND_LEFT = platformEnv.isNative
  ? { top: 8, bottom: 8, left: 8 }
  : undefined;
const HIT_SLOP_EXPAND_RIGHT = platformEnv.isNative
  ? { top: 8, bottom: 8, right: 8 }
  : undefined;

/**
 * Chevron, or a spacer with the same layout footprint when the header has no
 * such navigation (IconButton's negative margin leaves a 24px footprint), so
 * the remaining chevrons don't shift between drill-down levels.
 */
function NavButton({
  icon,
  onPress,
  disabled,
  hitSlop,
}: {
  icon: IKeyOfIcons;
  onPress?: () => void;
  disabled?: boolean;
  hitSlop?: IIconButtonProps['hitSlop'];
}) {
  if (!onPress) return <Stack width="$6" height="$6" />;
  return (
    // Internal navigation control; QA targets the calendar root.
    // oxlint-disable-next-line onekey/require-testid
    <IconButton
      icon={icon}
      variant="tertiary"
      size="medium"
      disabled={!!disabled}
      hitSlop={hitSlop}
      onPress={onPress}
    />
  );
}

/** Month / year title; reads as a button when it opens a drill-down view. */
function HeaderTitle({
  text,
  size,
  onPress,
}: {
  text: string;
  size: '$headingLg' | '$headingXl';
  onPress?: () => void;
}) {
  return (
    <Stack
      paddingHorizontal="$1"
      borderRadius="$2"
      pointerEvents={onPress ? 'auto' : 'none'}
      cursor="default"
      hoverStyle={onPress ? titleHoverStyle : undefined}
      pressStyle={onPress ? titlePressStyle : undefined}
      onPress={onPress}
    >
      <SizableText
        size={size}
        color="$text"
        userSelect="none"
        style={titleTextStyle}
      >
        {text}
      </SizableText>
    </Stack>
  );
}

export const CalendarHeader = memo(
  ({
    month,
    year,
    onPrevMonth,
    onNextMonth,
    onPrevYear,
    onNextYear,
    onMonthClick,
    onYearClick,
    mode,
    isPrevDisabled,
    isNextDisabled,
    isPrevYearDisabled,
    isNextYearDisabled,
  }: ICalendarHeaderProps) => {
    const media = useMedia();
    const titleSize = media.gtMd ? '$headingLg' : '$headingXl';
    const showMonthYear = mode !== 'month' && mode !== 'year';

    return (
      <Stack paddingHorizontal="$2" marginBottom="$3">
        {/* Title - absolute center */}
        <XStack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          justifyContent="center"
          alignItems="center"
          pointerEvents="box-none"
        >
          {showMonthYear && month ? (
            <HeaderTitle text={month} size={titleSize} onPress={onMonthClick} />
          ) : null}
          <HeaderTitle
            text={year}
            size={titleSize}
            onPress={showMonthYear ? onYearClick : undefined}
          />
        </XStack>
        {/* Buttons */}
        <XStack
          justifyContent="space-between"
          alignItems="center"
          pointerEvents="box-none"
        >
          <XStack alignItems="center">
            <NavButton
              icon="ChevronDoubleLeftOutline"
              onPress={onPrevYear}
              disabled={isPrevYearDisabled}
              hitSlop={HIT_SLOP_EXPAND_LEFT}
            />
            <NavButton
              icon="ChevronLeftSmallOutline"
              onPress={onPrevMonth}
              disabled={isPrevDisabled}
              hitSlop={HIT_SLOP_EXPAND_RIGHT}
            />
          </XStack>
          <XStack alignItems="center">
            <NavButton
              icon="ChevronRightSmallOutline"
              onPress={onNextMonth}
              disabled={isNextDisabled}
              hitSlop={HIT_SLOP_EXPAND_LEFT}
            />
            <NavButton
              icon="ChevronDoubleRightOutline"
              onPress={onNextYear}
              disabled={isNextYearDisabled}
              hitSlop={HIT_SLOP_EXPAND_RIGHT}
            />
          </XStack>
        </XStack>
      </Stack>
    );
  },
);

CalendarHeader.displayName = 'CalendarHeader';
