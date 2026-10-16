import { Stack } from '../../primitives';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '../../utils/animationConstants';

import { PeriodCell } from './PeriodCell';
import { useSlideDirection } from './useSlideDirection';
import { getEnterStyle } from './utils';

export interface IPeriodGridItem {
  /** `$date.getTime()`; identifies the cell to the press handler. */
  value: number;
  label: string | number;
  selected: boolean;
  isNow: boolean;
  disabled: boolean;
}

/**
 * 3-column month / year grid. `slidePosition` is the ordinal of the page
 * (year for months, first year for a decade); the page slides in from the
 * side it was paged to.
 */
export function PeriodGrid({
  items,
  slidePosition,
  onPress,
}: {
  items: IPeriodGridItem[];
  slidePosition: number;
  onPress: (value: number) => void;
}) {
  const direction = useSlideDirection(slidePosition);

  return (
    // No horizontal padding: cells span the same width as the day grid, so
    // edges line up with the header chevrons on every drill-down level.
    <Stack
      key={slidePosition}
      flexWrap="wrap"
      flexDirection="row"
      columnGap="$2"
      rowGap="$3"
      transition="quick"
      animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
      enterStyle={getEnterStyle(direction)}
    >
      {items.map((item) => (
        <PeriodCell
          key={item.value}
          value={item.value}
          label={item.label}
          selected={item.selected}
          isNow={item.isNow}
          disabled={item.disabled}
          onPress={onPress}
        />
      ))}
    </Stack>
  );
}
