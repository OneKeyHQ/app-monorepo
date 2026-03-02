import { memo } from 'react';

import { IconButton } from '../../actions/IconButton';
import { useMedia } from '../../hooks';
import { SizableText, Stack, XStack } from '../../primitives';

import type { ICalendarHeaderProps } from './type';

export const CalendarHeader = memo(
  ({
    month,
    year,
    onPrevMonth,
    onNextMonth,
    onMonthClick,
    onYearClick,
    mode,
    isPrevDisabled,
    isNextDisabled,
  }: ICalendarHeaderProps) => {
    const media = useMedia();
    const iconSize = 'medium' as const;
    const titleSize = media.gtMd ? '$headingLg' : '$headingXl';
    const showMonthYear = mode !== 'month' && mode !== 'year';

    const showPrevButton = onPrevMonth && !isPrevDisabled;
    const showNextButton = onNextMonth && !isNextDisabled;
    const yearClickable = showMonthYear && onYearClick;

    return (
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$2"
        marginBottom="$3"
        $md={{ marginTop: '$2' }}
      >
        {showPrevButton ? (
          <IconButton
            icon="ChevronLeftSmallOutline"
            variant="tertiary"
            size={iconSize}
            onPress={onPrevMonth}
          />
        ) : (
          <Stack width="$10" />
        )}
        <XStack gap="$1">
          {showMonthYear && month ? (
            <SizableText
              size={titleSize}
              color="$text"
              cursor="default"
              userSelect="none"
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
            onPress={yearClickable ? onYearClick : undefined}
            hoverStyle={yearClickable ? { color: '$textSubdued' } : undefined}
          >
            {year}
          </SizableText>
        </XStack>
        {showNextButton ? (
          <IconButton
            icon="ChevronRightSmallOutline"
            variant="tertiary"
            size={iconSize}
            onPress={onNextMonth}
          />
        ) : (
          <Stack width="$10" />
        )}
      </XStack>
    );
  },
);

CalendarHeader.displayName = 'CalendarHeader';
