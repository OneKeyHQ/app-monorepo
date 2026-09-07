import type { ReactNode } from 'react';

import { Stack } from '@onekeyhq/components';
import { ANIMATE_ONLY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

/**
 * Tamagui group set on the data rows of a list whose name cell reveals a second
 * subtitle on hover. Tamagui only accepts a group name as a literal style prop
 * key, so this constant and the `$group-marketTokenRow-hover` prop below must
 * be kept in sync by hand.
 *
 * `as const` keeps the literal type from widening to `string` when the name is
 * carried through a variable into an untyped row-props object.
 */
export const MARKET_TOKEN_ROW_GROUP_NAME = 'marketTokenRow' as const;

/**
 * A name-column subtitle that slides to a second line while the row is hovered
 * — the token age giving way to its contract address, a company name to the
 * tokens issued against it.
 *
 * The swap is CSS-only: the data row carries the Tamagui group, so both lines
 * render once and only the sliding wrapper reacts to the group's hover state.
 * Row-level JS hover state would mean a setState per row on every pointer move,
 * and the shared Table component exposes no row hover hook to piggyback on.
 */
export function MarketHoverRevealLine({
  resting,
  revealed,
  lineHeight,
}: {
  resting: ReactNode;
  /** Omitted when there is nothing to reveal; the resting line then stands alone. */
  revealed?: ReactNode;
  lineHeight: number;
}) {
  // Hover never fires on native, so the reveal would be unreachable there.
  // Touch-capable desktop browsers are deliberately not excluded: they still
  // have a pointer, and treating them as touch-only would hide the resting
  // line from every touchscreen laptop.
  if (!revealed || platformEnv.isNative) {
    return <>{resting}</>;
  }

  return (
    <Stack height={lineHeight} overflow="hidden" minWidth={0}>
      <Stack
        transition="quick"
        animateOnly={ANIMATE_ONLY_TRANSFORM}
        y={0}
        $group-marketTokenRow-hover={{ y: -lineHeight }}
      >
        {resting}
        {revealed}
      </Stack>
    </Stack>
  );
}
