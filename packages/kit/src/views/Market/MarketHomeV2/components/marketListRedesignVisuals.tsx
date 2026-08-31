import type {
  ETableSortType,
  IKeyOfIcons,
  ITableColumnSortContext,
} from '@onekeyhq/components';
import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { LazyTooltip } from '@onekeyhq/components/src/actions/LazyTooltip';

// Shared row/header chrome for the redesigned market lists. Lives outside the
// column hooks because the spot table and the perps table build their columns
// separately but must look identical.

// Figma (24967-41343): the fixed left block pairs a 40px star cell (row px 8 +
// button px 4 + 16px icon + px 4) with the name cell.
export const REDESIGN_STAR_COLUMN_WIDTH = 40;
export const REDESIGN_STAR_ICON_SIZE = '$4';

// 40px token followed by a 14px gap before the text block.
export const REDESIGN_NAME_ICON_GAP = 14;

// Figma: 12px vertical padding around a 44px identity block = 68px rows.
// Shared so the spot and perps tables cannot drift apart.
export const REDESIGN_ROW_HEIGHT = 68;

// Figma: 14px sort glyph sitting 2px after the label. Rendered here (rather
// than by Column) so the label and the icon form a single hit target.
// Must be a size token — Icon ignores raw numbers and falls back to 24px.
const REDESIGN_SORT_ICON_SIZE = '$3.5';

export function renderRedesignSortIcon(order: ETableSortType | undefined) {
  let iconName: IKeyOfIcons = 'ChevronGrabberVerOutline';
  if (order === 'desc') {
    iconName = 'ChevronDownSmallOutline';
  } else if (order === 'asc') {
    iconName = 'ChevronTopSmallOutline';
  }
  return (
    <Icon
      name={iconName}
      size={REDESIGN_SORT_ICON_SIZE}
      color={order ? '$iconActive' : '$iconSubdued'}
    />
  );
}

export function renderRedesignHeaderTitle({
  label,
  tooltip,
  sortContext,
}: {
  label: string;
  tooltip?: string;
  sortContext: ITableColumnSortContext;
}) {
  const { order, onSortPress } = sortContext;
  const titleRow = (
    <XStack alignItems="center" gap={2} userSelect="none">
      <SizableText
        size="$bodySmMedium"
        color="$textSubdued"
        {...(tooltip
          ? {
              textDecorationLine: 'underline' as const,
              style: {
                textDecorationStyle: 'dotted',
                textUnderlinePosition: 'from-font',
              } as any,
            }
          : null)}
      >
        {label}
      </SizableText>
      {onSortPress ? renderRedesignSortIcon(order) : null}
    </XStack>
  );

  if (!tooltip) {
    return titleRow;
  }

  // Tooltip only adds the hover explainer. It must NOT take onSortPress: the
  // trigger renders inside HeaderColumn's Column, which already binds the same
  // handler, and neither stops propagation — forwarding it here made one click
  // sort twice and double-count dexSort. The press stays with the Column.
  return (
    <LazyTooltip
      placement="top"
      renderTrigger={titleRow}
      renderContent={tooltip}
    />
  );
}
