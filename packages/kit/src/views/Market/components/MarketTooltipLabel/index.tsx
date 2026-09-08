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
 * Nothing happens on press, so the cursor stays `default`: DashText's own
 * `tooltip` prop would set `help`, which points at a question mark the design
 * does not use. Buttons take their tooltip from the button instead — they have
 * their own hover treatment and must not carry dashes.
 */
export function MarketTooltipLabel({
  children,
  tooltip,
  size = '$bodyMd',
  color = '$textSubdued',
  // `flex-start` shrinks the trigger to its text inside a column, where a
  // child would otherwise stretch to the column's width. It also opts the
  // item out of its row's alignment, so a caller sitting in a
  // baseline-aligned row has to hand that alignment back.
  alignSelf = 'flex-start',
  testID,
}: {
  children: ReactNode;
  tooltip: string;
  size?: ISizableTextProps['size'];
  color?: ISizableTextProps['color'];
  alignSelf?: 'flex-start' | 'baseline';
  testID?: string;
}) {
  return (
    <Stack alignSelf={alignSelf}>
      <Tooltip
        placement="top"
        renderTrigger={
          <DashText
            testID={testID}
            size={size}
            color={color}
            dashThickness={0.5}
            dashSpacing={0}
            dashColor={MARKET_TOOLTIP_DASH_COLOR}
            cursor="default"
          >
            {children}
          </DashText>
        }
        renderContent={<SizableText size="$bodySm">{tooltip}</SizableText>}
      />
    </Stack>
  );
}
