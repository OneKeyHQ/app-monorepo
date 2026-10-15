import { memo, useCallback, useMemo } from 'react';

import { SizableText, Stack } from '../../primitives';

import type { IDayCellProps } from './type';

const CELL_SIZE = '$10'; // 40px
const RANGE_RADIUS = '$2';

const pressStyleValue = { bg: '$bgActive' } as const;

type IBandShape = {
  left: '0%' | '50%';
  right: '0%' | '50%';
  roundLeft: boolean;
  roundRight: boolean;
} | null;

/**
 * Background band that joins the selected (or previewed) range endpoints.
 * Endpoints only fill the half facing the range, so the band reads as one
 * continuous strip; it is rounded off at week-row and month edges.
 */
function getBandShape({
  isStart,
  isEnd,
  isMiddle,
  isRowStart,
  isRowEnd,
  isMonthStart,
  isMonthEnd,
}: {
  isStart: boolean;
  isEnd: boolean;
  isMiddle: boolean;
  isRowStart: boolean;
  isRowEnd: boolean;
  isMonthStart: boolean;
  isMonthEnd: boolean;
}): IBandShape {
  const capLeft = isRowStart || isMonthStart;
  const capRight = isRowEnd || isMonthEnd;
  if (isStart) {
    return capRight
      ? null
      : { left: '50%', right: '0%', roundLeft: false, roundRight: false };
  }
  if (isEnd) {
    return capLeft
      ? null
      : { left: '0%', right: '50%', roundLeft: false, roundRight: false };
  }
  if (isMiddle) {
    return {
      left: '0%',
      right: '0%',
      roundLeft: capLeft,
      roundRight: capRight,
    };
  }
  return null;
}

export const DayCell = memo(
  ({
    day,
    onPress,
    onHoverIn,
    hideOutOfMonth,
    fullWidth,
    isRowStart = false,
    isRowEnd = false,
    isMonthStart = false,
    isMonthEnd = false,
  }: IDayCellProps) => {
    const handlePress = useCallback(() => {
      if (!day.disabled) {
        onPress(day.date);
      }
    }, [day.disabled, day.date, onPress]);

    const handleHoverIn = useCallback(() => {
      if (!day.disabled) {
        onHoverIn?.(day.date);
      }
    }, [day.disabled, day.date, onHoverIn]);

    const { range } = day;
    const visible = day.inCurrentMonth;
    const isSameDayRange = visible && range === 'range-start range-end';
    const isRangeStart = visible && range === 'range-start';
    const isRangeEnd = visible && range === 'range-end';
    const isInRange = visible && range === 'in-range';
    const isPreviewStart = visible && range === 'will-be-range-start';
    const isPreviewEnd = visible && range === 'will-be-range-end';
    const isPreviewMiddle = visible && range === 'will-be-in-range';
    const isPreview = isPreviewStart || isPreviewEnd || isPreviewMiddle;

    // The anchor day of an in-progress range is already `selected`; while
    // previewing, rehookify re-labels it as a will-be endpoint.
    const isSelected =
      (day.selected && visible) || isSameDayRange || isRangeStart || isRangeEnd;
    const isEndpoint = isRangeStart || isRangeEnd;
    const isPreviewEndpoint = (isPreviewStart || isPreviewEnd) && !isSelected;

    const band = useMemo(
      () =>
        getBandShape({
          isStart: isRangeStart || isPreviewStart,
          isEnd: isRangeEnd || isPreviewEnd,
          // Hovering the anchor itself previews a one-day range: no band.
          isMiddle: isInRange || (isPreviewMiddle && !isSelected),
          isRowStart,
          isRowEnd,
          isMonthStart,
          isMonthEnd,
        }),
      [
        isRangeStart,
        isPreviewStart,
        isRangeEnd,
        isPreviewEnd,
        isInRange,
        isPreviewMiddle,
        isSelected,
        isRowStart,
        isRowEnd,
        isMonthStart,
        isMonthEnd,
      ],
    );

    let textColor: '$text' | '$textDisabled' | '$textInverse' = '$text';
    if (day.disabled || !day.inCurrentMonth) {
      textColor = '$textDisabled';
    } else if (isSelected) {
      textColor = '$textInverse';
    }

    const hoverStyleValue = useMemo(() => {
      if (day.disabled) return undefined;
      if (isSelected) return { bg: '$bgPrimaryHover' } as const;
      return { bg: '$bgHover' } as const;
    }, [day.disabled, isSelected]);

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

    // In full-width (range) layouts the endpoint stretches across the cell
    // and squares off the side that touches the band.
    const squareRight = fullWidth && isEndpoint && band?.left === '50%';
    const squareLeft = fullWidth && isEndpoint && band?.right === '50%';

    return (
      <Stack
        flexBasis="14.28%"
        flexGrow={0}
        flexShrink={0}
        alignItems="center"
        justifyContent="center"
        height={CELL_SIZE}
      >
        {band ? (
          <Stack
            position="absolute"
            top={0}
            bottom={0}
            left={band.left}
            right={band.right}
            bg={isPreview ? '$bgHover' : '$bgStrong'}
            borderTopLeftRadius={band.roundLeft ? RANGE_RADIUS : 0}
            borderBottomLeftRadius={band.roundLeft ? RANGE_RADIUS : 0}
            borderTopRightRadius={band.roundRight ? RANGE_RADIUS : 0}
            borderBottomRightRadius={band.roundRight ? RANGE_RADIUS : 0}
            pointerEvents="none"
          />
        ) : null}
        <Stack
          width={fullWidth && isEndpoint ? '100%' : CELL_SIZE}
          height={CELL_SIZE}
          alignItems="center"
          justifyContent="center"
          borderRadius={RANGE_RADIUS}
          {...(squareRight && {
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
          })}
          {...(squareLeft && {
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
          })}
          bg={isSelected && !day.disabled ? '$bgPrimary' : 'transparent'}
          borderWidth={1}
          borderColor={isPreviewEndpoint ? '$borderStrong' : 'transparent'}
          cursor={day.disabled ? 'not-allowed' : 'pointer'}
          hoverStyle={hoverStyleValue}
          pressStyle={day.disabled || isSelected ? undefined : pressStyleValue}
          onPress={handlePress}
          onHoverIn={onHoverIn ? handleHoverIn : undefined}
          aria-disabled={day.disabled}
          aria-selected={isSelected}
        >
          <SizableText
            size="$bodyMd"
            color={textColor}
            fontWeight={day.active || isSelected ? '600' : '400'}
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
              bg={day.disabled ? '$textDisabled' : '$bgPrimary'}
            />
          ) : null}
        </Stack>
      </Stack>
    );
  },
);

DayCell.displayName = 'DayCell';
