import { memo, useCallback } from 'react';

import { SizableText, Stack } from '../../primitives';

import { TodayDot } from './TodayDot';
import { getCellStateStyles } from './utils';

import type { IDayCellProps } from './type';

const CELL_SIZE = '$10'; // 40px
const RANGE_RADIUS = '$2';

interface IBandShape {
  left: '0%' | '50%';
  right: '0%' | '50%';
  roundLeft: boolean;
  roundRight: boolean;
}

const BAND_START: IBandShape = {
  left: '50%',
  right: '0%',
  roundLeft: false,
  roundRight: false,
};
const BAND_END: IBandShape = {
  left: '0%',
  right: '50%',
  roundLeft: false,
  roundRight: false,
};

/**
 * Background band that joins the selected (or previewed) range endpoints.
 * Endpoints only fill the half facing the range, so the band reads as one
 * continuous strip; it is rounded off at week-row and month edges.
 */
function getBandShape(
  part: 'start' | 'end' | 'middle' | null,
  capLeft: boolean,
  capRight: boolean,
): IBandShape | null {
  if (part === 'start') return capRight ? null : BAND_START;
  if (part === 'end') return capLeft ? null : BAND_END;
  if (part === 'middle') {
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
    capLeft = false,
    capRight = false,
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

    // Range decoration only applies to in-month days.
    const range = day.inCurrentMonth ? day.range : undefined;
    const isRangeStart = range === 'range-start';
    const isRangeEnd = range === 'range-end';
    const isPreviewStart = range === 'will-be-range-start';
    const isPreviewEnd = range === 'will-be-range-end';
    const isPreview =
      isPreviewStart || isPreviewEnd || range === 'will-be-in-range';

    // The anchor of an in-progress range is already `selected`; while
    // previewing, rehookify re-labels it as a will-be endpoint.
    const isSelected =
      (day.selected && day.inCurrentMonth) ||
      range === 'range-start range-end' ||
      isRangeStart ||
      isRangeEnd;
    const isEndpoint = isRangeStart || isRangeEnd;
    const isPreviewEndpoint = (isPreviewStart || isPreviewEnd) && !isSelected;

    let bandPart: 'start' | 'end' | 'middle' | null = null;
    if (isRangeStart || isPreviewStart) bandPart = 'start';
    else if (isRangeEnd || isPreviewEnd) bandPart = 'end';
    // Hovering the anchor itself previews a one-day range: no band.
    else if (
      range === 'in-range' ||
      (range === 'will-be-in-range' && !isSelected)
    )
      bandPart = 'middle';
    const band = getBandShape(bandPart, capLeft, capRight);

    const { color, bg, ...interactionStyles } = getCellStateStyles({
      disabled: day.disabled,
      selected: isSelected,
      muted: !day.inCurrentMonth,
    });

    // In full-width (range) layouts the endpoint stretches across the cell
    // and squares off the side that touches the band.
    const stretchEndpoint = !!fullWidth && isEndpoint;
    const squareRight = stretchEndpoint && band === BAND_START;
    const squareLeft = stretchEndpoint && band === BAND_END;

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
          width={stretchEndpoint ? '100%' : CELL_SIZE}
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
          // The pending end of a previewed range gets a solid tint, distinct
          // from the lighter preview band and from the today dot.
          bg={isPreviewEndpoint ? '$bgStrong' : bg}
          {...interactionStyles}
          onPress={handlePress}
          onHoverIn={onHoverIn ? handleHoverIn : undefined}
          aria-disabled={day.disabled}
          aria-selected={isSelected}
        >
          <SizableText
            size="$bodyMd"
            color={color}
            fontWeight={day.active || isSelected ? '600' : '400'}
            userSelect="none"
          >
            {day.day}
          </SizableText>
          {day.active && !isSelected ? (
            <TodayDot disabled={day.disabled} />
          ) : null}
        </Stack>
      </Stack>
    );
  },
);

DayCell.displayName = 'DayCell';
