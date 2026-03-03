import { memo } from 'react';

import { IconButton } from '../../actions/IconButton';
import { useMedia } from '../../hooks';
import { SizableText, Stack, XStack } from '../../primitives';

import type { ICalendarHeaderProps } from './type';

function NavSpacer() {
  return <Stack width="$10" height="$6" />;
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
    const iconSize = 'medium' as const;
    const titleSize = media.gtMd ? '$headingLg' : '$headingXl';
    const showMonthYear = mode !== 'month' && mode !== 'year';

    const showPrevButton = onPrevMonth && !isPrevDisabled;
    const showNextButton = onNextMonth && !isNextDisabled;
    const showPrevYearButton = onPrevYear && !isPrevYearDisabled;
    const showNextYearButton = onNextYear && !isNextYearDisabled;
    const yearClickable = showMonthYear && onYearClick;

    return (
      <Stack paddingHorizontal="$2" marginBottom="$3" $md={{ marginTop: '$2' }}>
        {/* Title - absolute center */}
        <XStack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          justifyContent="center"
          alignItems="center"
          pointerEvents="none"
          gap="$1"
        >
          {showMonthYear && month ? (
            <SizableText
              size={titleSize}
              color="$text"
              cursor="default"
              userSelect="none"
              pointerEvents="auto"
              onPress={onMonthClick}
              hoverStyle={onMonthClick ? { color: '$textSubdued' } : undefined}
            >
              {month}
            </SizableText>
          ) : null}
          <SizableText
            size={titleSize}
            color="$text"
            cursor="default"
            userSelect="none"
            pointerEvents="auto"
            onPress={yearClickable ? onYearClick : undefined}
            hoverStyle={yearClickable ? { color: '$textSubdued' } : undefined}
          >
            {year}
          </SizableText>
        </XStack>
        {/* Buttons */}
        <XStack justifyContent="space-between" alignItems="center">
          <XStack alignItems="center">
            {showPrevYearButton ? (
              <IconButton
                icon="ChevronDoubleLeftOutline"
                variant="tertiary"
                size={iconSize}
                onPress={onPrevYear}
              />
            ) : (
              <NavSpacer />
            )}
            {showPrevButton ? (
              <IconButton
                icon="ChevronLeftSmallOutline"
                variant="tertiary"
                size={iconSize}
                onPress={onPrevMonth}
              />
            ) : (
              <NavSpacer />
            )}
          </XStack>
          <XStack alignItems="center">
            {showNextButton ? (
              <IconButton
                icon="ChevronRightSmallOutline"
                variant="tertiary"
                size={iconSize}
                onPress={onNextMonth}
              />
            ) : (
              <NavSpacer />
            )}
            {showNextYearButton ? (
              <IconButton
                icon="ChevronDoubleRightOutline"
                variant="tertiary"
                size={iconSize}
                onPress={onNextYear}
              />
            ) : (
              <NavSpacer />
            )}
          </XStack>
        </XStack>
      </Stack>
    );
  },
);

CalendarHeader.displayName = 'CalendarHeader';
