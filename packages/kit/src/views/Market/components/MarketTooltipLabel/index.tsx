import type { ReactNode } from 'react';

import { DashText, SizableText, Stack, Tooltip } from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';

// A step darker than DashText's own `$borderStrong` (neutral7) default, which
// reads too faint under the small subdued labels these sit beneath. Both
// themes carry the raw neutral ramp, so this follows light/dark like the
// semantic tokens do.
const MARKET_TOOLTIP_DASH_COLOR = '$neutral8';

/**
 * A label whose dashed underline is the whole hover affordance, matching the
 * stock list's Price column and the Perps rows.
 *
 * DashText's own `tooltip` prop is deliberately not used: it forces
 * `cursor: help`, a question mark the design does not use anywhere. Buttons
 * take their tooltip from the button instead — they have their own hover
 * treatment and must not carry dashes.
 */
export function MarketTooltipLabel({
  children,
  tooltip,
  size = '$bodyMd',
  color = '$textSubdued',
  // `flex-start` shrinks the trigger to its text inside a column, where a
  // child would otherwise stretch to the column's width. It also opts the
  // item out of whatever its row aligns on, so a caller inside a baseline- or
  // centre-aligned row has to hand that alignment back.
  alignSelf = 'flex-start',
  // `default` because nothing happens on press at most of these bindings. A
  // sortable table header is the exception: it does something on click, so it
  // keeps the pointer and the dashes are only the tooltip's affordance.
  cursor = 'default',
  // Interactive mode for its hover-intent delay (250ms open, 300ms close),
  // not for interactive content: a pointer passing over the label must not
  // flash the tooltip.
  hovering,
  testID,
}: {
  children: ReactNode;
  tooltip: string;
  size?: ISizableTextProps['size'];
  color?: ISizableTextProps['color'];
  alignSelf?: 'flex-start' | 'baseline' | 'center';
  cursor?: 'default' | 'pointer';
  hovering?: boolean;
  testID?: string;
}) {
  return (
    <Stack alignSelf={alignSelf}>
      <Tooltip
        placement="top"
        hovering={hovering}
        // Clone the dashed text instead of wrapping it: the default wrapper is
        // its own pressable and swallows the click, which costs a sortable
        // table header its sort whenever the pointer is over the label.
        triggerAsChild="except-style"
        renderTrigger={
          <DashText
            testID={testID}
            size={size}
            color={color}
            dashThickness={0.5}
            dashSpacing={0}
            dashColor={MARKET_TOOLTIP_DASH_COLOR}
            // The dashes are decoration, not layout: kept out of flow so a
            // label measures the same dashed or not, and shares its line with
            // plain siblings instead of riding above them.
            dashOverlay
            cursor={cursor}
          >
            {children}
          </DashText>
        }
        renderContent={<SizableText size="$bodySm">{tooltip}</SizableText>}
      />
    </Stack>
  );
}
