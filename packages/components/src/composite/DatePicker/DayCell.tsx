import { memo } from 'react';

import { SizableText, Stack } from '../../primitives';

import type { IDayCellProps } from './type';

const CELL_SIZE = '$10'; // 40px

export const DayCell = memo(
  ({ day, onPress, hideOutOfMonth, fullWidth }: IDayCellProps) => {
    const handlePress = () => {
      if (!day.disabled) {
        onPress(day.date);
      }
    };

    if (hideOutOfMonth && !day.inCurrentMonth) {
      return (
        <Stack
          flexBasis="14.28%"
          flexGrow={0}
          flexShrink={0}
          height={CELL_SIZE}
        />
      );
    }

    const isSameDayRange =
      day.inCurrentMonth && day.range === 'range-start range-end';
    const isInRange =
      day.inCurrentMonth &&
      !isSameDayRange &&
      (day.range === 'in-range' || day.range === 'will-be-in-range');
    const isRangeStart =
      day.inCurrentMonth && !isSameDayRange && day.range === 'range-start';
    const isRangeEnd =
      day.inCurrentMonth && !isSameDayRange && day.range === 'range-end';
    const isSelected = (day.selected && day.inCurrentMonth) || isSameDayRange;

    /* eslint-disable no-nested-ternary */
    const outerBorderRadius = isRangeStart
      ? {
          borderTopLeftRadius: '$2' as const,
          borderBottomLeftRadius: '$2' as const,
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
        }
      : isRangeEnd
        ? {
            borderTopRightRadius: '$2' as const,
            borderBottomRightRadius: '$2' as const,
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
          }
        : {};

    const innerBg = !day.disabled && isSelected ? '$bgPrimary' : 'transparent';
    const outerBg =
      isInRange || isRangeStart || isRangeEnd || day.disabled
        ? '$bgStrong'
        : 'transparent';
    const textColor =
      day.disabled || !day.inCurrentMonth
        ? '$textDisabled'
        : isSelected
          ? '$textInverse'
          : '$text';
    /* eslint-enable no-nested-ternary */

    return (
      <Stack
        flexBasis="14.28%"
        flexGrow={0}
        flexShrink={0}
        alignItems="center"
        justifyContent="center"
        height={CELL_SIZE}
        bg={outerBg}
        {...(day.disabled ? {} : outerBorderRadius)}
      >
        <Stack
          width={fullWidth ? '100%' : CELL_SIZE}
          height={CELL_SIZE}
          alignItems="center"
          justifyContent="center"
          borderRadius="$2"
          {...(isRangeStart && {
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
          })}
          {...(isRangeEnd && {
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
          })}
          bg={innerBg}
          hoverStyle={
            day.disabled
              ? {}
              : {
                  bg: isSelected ? innerBg : '$bgHover',
                }
          }
          onPress={handlePress}
        >
          <SizableText
            size="$bodyMd"
            color={textColor}
            fontWeight={day.active ? '600' : '400'}
            userSelect="none"
          >
            {day.day}
          </SizableText>
          {/* Today dot indicator */}
          {day.active && !isSelected ? (
            <Stack
              position="absolute"
              bottom="$0.5"
              width="$1"
              height="$1"
              borderRadius="$full"
              bg="$bgPrimary"
            />
          ) : null}
        </Stack>
      </Stack>
    );
  },
);

DayCell.displayName = 'DayCell';
