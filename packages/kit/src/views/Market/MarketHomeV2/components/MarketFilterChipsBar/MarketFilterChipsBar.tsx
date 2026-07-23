import { useState } from 'react';
import type { ReactNode } from 'react';

import {
  Divider,
  Icon,
  LinearGradient,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import { LazyTooltip } from '@onekeyhq/components/src/actions/LazyTooltip';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import {
  MARKET_FILTER_CHIPS,
  MARKET_FILTER_DIMENSION_MAP,
  findActiveMarketFilterChip,
  getMarketFilterOption,
} from './marketListFilterConfig';
import { useMarketListFilter } from './MarketListFilterContext';
import { TierPill } from './TierPill';

import type {
  EMarketFilterDimension,
  IMarketFilterChip,
  IMarketListSortState,
} from './marketListFilterTypes';
import type { IMarketTimeRangeValue } from '../../types';

const TIME_RANGE_OPTIONS: IMarketTimeRangeValue[] = ['5m', '1h', '4h', '24h'];

// The Popover's own Trigger wrapper drives the open-on-press behavior; this
// noop only exists so the trigger XStack keeps a Pressable press state for
// hoverStyle/pressStyle to animate against.
const noop = () => undefined;

// Sortable column dataIndex -> chip copy. The chip has no column header next
// to it, so it has to name the column itself.
const SORT_COLUMN_LABELS: Record<string, string> = {
  name: 'Token age',
  price: 'Price',
  change24h: 'Change',
  marketCap: 'Market cap',
  liquidity: 'Liquidity',
  transactions: 'Txns',
  holders: 'Holders',
  turnover: 'Turnover',
};

const SORT_DIRECTION_LABELS: Record<'asc' | 'desc', string> = {
  desc: 'High to Low',
  asc: 'Low to High',
};

// Rounded pill shared by time-range buttons, quick chips and the Filters
// trigger. Figma: min-w 32 / px 7 / py 5 / radius full / bodySm-medium
// subdued; selected state = bg strong + primary text color.
export function MarketToolbarPill({
  label,
  icon,
  selected,
  trailing,
  onPress,
  testID,
}: {
  label: string;
  icon?: IKeyOfIcons;
  selected?: boolean;
  trailing?: ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <XStack
      alignItems="center"
      justifyContent="center"
      gap="$1"
      minWidth={32}
      px={7}
      py={5}
      borderRadius="$full"
      bg={selected ? '$bgStrong' : undefined}
      hoverStyle={{ bg: selected ? '$bgStrongHover' : '$bgHover' }}
      pressStyle={{ bg: '$bgStrongActive' }}
      userSelect="none"
      onPress={onPress ?? noop}
      role="button"
      testID={testID}
    >
      {icon ? <Icon name={icon} size="$4" color="$iconSubdued" /> : null}
      <SizableText
        size="$bodySmMedium"
        color={selected ? '$text' : '$textSubdued'}
      >
        {label}
      </SizableText>
      {trailing}
    </XStack>
  );
}

// 16px icon in a 24px round hover hit-zone (Figma IconButton spec).
function SmallRoundIconButton({
  icon,
  onPress,
  testID,
}: {
  icon: IKeyOfIcons;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <XStack
      alignItems="center"
      justifyContent="center"
      width={24}
      height={24}
      borderRadius="$full"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={onPress}
      role="button"
      testID={testID}
    >
      <Icon name={icon} size="$4" color="$iconSubdued" />
    </XStack>
  );
}

// Figma 25053-6035: text-button whose hover state recolors the label and
// broom icon (no background), with a pointer cursor.
function ClearTextButton({
  onPress,
  testID,
}: {
  onPress: () => void;
  testID?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <XStack
      alignItems="center"
      gap="$1"
      p="$0.5"
      cursor="pointer"
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      onPress={onPress}
      role="button"
      testID={testID}
    >
      <Icon
        name="BroomOutline"
        size="$4"
        color={isHovered ? '$icon' : '$iconSubdued'}
      />
      <SizableText
        size="$bodySmMedium"
        color={isHovered ? '$text' : '$textSubdued'}
      >
        Clear
      </SizableText>
    </XStack>
  );
}

// The fade must hide the text under the × — it fades to the chip's EFFECTIVE
// surface (its translucent bg token composited over bgApp), precomputed per
// theme as a hex (theme.*.val is not a reliable color string on web). The fade
// only appears while the chip is highlighted (hover/open), so the target is the
// hovered surface: bgStrongHover over bgApp = light #E8E8E8 / dark #282828
// (grayA4 over bgApp). Recompute if grayA4 changes.
const CHIP_MASK_HEX_HOVER = { light: '#e8e8e8', dark: '#282828' };

// Figma 25141-48129: 6px inset inside the bordered toolbar, so a 26px pill row
// makes the box 40px tall (26 + 6*2 + 1px border each side).
const TOOLBAR_PADDING = 6;

// Remove hit-target + fade geometry. The overlays sit ON TOP of the value
// text, so revealing the × never changes the chip width (no layout jitter).
// The gradient keeps a solid plateau over the right ~55% so the × always sits
// on an opaque patch; only the left edge fades, blending into the text.
const CHIP_REMOVE_WIDTH = 26;
const CHIP_FADE_WIDTH = 34;
const CHIP_HORIZONTAL_PADDING = 10;
const CHIP_FADE_START: [number, number] = [0, 0];
const CHIP_FADE_END: [number, number] = [1, 0];
const CHIP_FADE_LOCATIONS: [number, number, number] = [0, 0.45, 1];

// Figma 25099-6710 / 25116-6318: bg-strong capsule, h 26 / radius full, label
// regular + value medium; the body opens a popover on press (highlighting to
// bg-strong-hover with a pointer), and hover fades in a remove control over the
// right edge. Both the sort chip and the filter chips use this, so they read
// as one consistent control.
function ConditionChipShell({
  label,
  value,
  isOpen,
  onRemove,
  testID,
  removeTestID,
}: {
  label: string;
  value: string;
  isOpen?: boolean;
  onRemove: () => void;
  testID?: string;
  removeTestID?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isRemoveHovered, setIsRemoveHovered] = useState(false);
  const themeVariant = useThemeVariant();
  const themeKey = themeVariant === 'dark' ? 'dark' : 'light';
  const showRemove = isHovered || isOpen;
  // The fade only shows while the body is highlighted (hover/open), so it
  // targets the hover surface.
  const maskHex = CHIP_MASK_HEX_HOVER[themeKey];
  return (
    <XStack
      alignItems="center"
      gap="$1"
      height={26}
      px={CHIP_HORIZONTAL_PADDING}
      borderRadius="$full"
      overflow="hidden"
      bg={showRemove ? '$bgStrongHover' : '$bgStrong'}
      userSelect="none"
      cursor="pointer"
      pressStyle={{ bg: '$bgStrongActive' }}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      onPress={noop}
      role="button"
      testID={testID}
    >
      <SizableText size="$bodySm" color="$text">
        {label}
      </SizableText>
      <SizableText size="$bodySmMedium" color="$text">
        {value}
      </SizableText>
      {showRemove ? (
        <>
          <LinearGradient
            position="absolute"
            top={0}
            bottom={0}
            right={0}
            width={CHIP_FADE_WIDTH}
            pointerEvents="none"
            colors={[`${maskHex}00`, maskHex, maskHex]}
            locations={CHIP_FADE_LOCATIONS}
            start={CHIP_FADE_START}
            end={CHIP_FADE_END}
          />
          <Stack
            position="absolute"
            top={0}
            bottom={0}
            right={0}
            zIndex={10}
            width={CHIP_REMOVE_WIDTH}
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            onHoverIn={() => setIsRemoveHovered(true)}
            onHoverOut={() => setIsRemoveHovered(false)}
            onPress={(event) => {
              // The chip body opens the tier popover; the × must not.
              event.stopPropagation();
              onRemove();
            }}
            role="button"
            testID={removeTestID}
          >
            {/* Recolor on hover, matching the popover's Clear button, so the
                close target reads as distinct from the pill body. */}
            <Icon
              name="CrossedSmallOutline"
              size="$4"
              color={isRemoveHovered ? '$icon' : '$iconSubdued'}
            />
          </Stack>
        </>
      ) : null}
    </XStack>
  );
}

type ITierPopoverOption = { id: string; label: string; disabled?: boolean };

// Wide enough that three tiers share a row without the widest floor label
// ("100K+"/"500K+") getting truncated: 3 pills (~72px incl. border + px 11)
// + 2 gaps (8) + popover px (14) each side.
const TIER_POPOVER_WIDTH = 264;

// Figma tier popover (25117-6453 / 25117-6494): 240 wide, header = dimension
// label + Clear text button, then pills that share the row equally. Three or
// fewer options sit on one line; four wrap to a 2x2 grid (the pill floor drops
// to 0 so three can fit, matching the design's min-w-px pills).
function TierPopoverContent({
  title,
  options,
  selectedOptionId,
  onSelect,
  onClear,
  testIdPrefix,
}: {
  title: string;
  options: ITierPopoverOption[];
  selectedOptionId?: string;
  onSelect: (optionId: string) => void;
  onClear: () => void;
  testIdPrefix: string;
}) {
  const columns = options.length === 4 ? 2 : options.length;
  const rows: ITierPopoverOption[][] = [];
  for (let i = 0; i < options.length; i += columns) {
    rows.push(options.slice(i, i + columns));
  }
  return (
    <YStack pt="$3" pb={14} px={14} gap="$3">
      <XStack alignItems="center" justifyContent="space-between" pr="$1">
        <SizableText size="$bodySmMedium" color="$textSubdued">
          {title}
        </SizableText>
        <ClearTextButton onPress={onClear} testID={`${testIdPrefix}-clear`} />
      </XStack>
      <YStack gap="$2">
        {rows.map((row) => (
          <XStack key={row[0].id} gap="$2">
            {row.map((option) => (
              <TierPill
                key={option.id}
                grow
                minWidth={0}
                label={option.label}
                selected={option.id === selectedOptionId}
                disabled={option.disabled}
                onPress={() => onSelect(option.id)}
                testID={`${testIdPrefix}-${option.id}`}
              />
            ))}
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

// A dimension's applied tier. Body opens the tier popover (single-select
// snap), × removes the dimension.
function FilterConditionChip({
  dimensionId,
  optionId,
  isOpen,
  onOpenChange,
  onSelectOption,
  onRemove,
}: {
  dimensionId: EMarketFilterDimension;
  optionId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectOption: (optionId: string) => void;
  onRemove: () => void;
}) {
  const dimension = MARKET_FILTER_DIMENSION_MAP.get(dimensionId);
  const option = getMarketFilterOption(dimensionId, optionId);
  if (!dimension || !option) {
    return null;
  }
  return (
    <Popover
      title={dimension.label}
      open={isOpen}
      onOpenChange={onOpenChange}
      floatingPanelProps={{
        width: TIER_POPOVER_WIDTH,
        minWidth: TIER_POPOVER_WIDTH,
        maxWidth: TIER_POPOVER_WIDTH,
      }}
      renderTrigger={
        <ConditionChipShell
          label={dimension.label}
          value={option.chipLabel}
          isOpen={isOpen}
          onRemove={onRemove}
          testID={`market-filter-chip-${dimensionId}`}
          removeTestID={`market-filter-chip-${dimensionId}-remove`}
        />
      }
      renderContent={
        <TierPopoverContent
          title={dimension.label}
          options={dimension.options}
          selectedOptionId={option.id}
          onSelect={onSelectOption}
          onClear={onRemove}
          testIdPrefix={`market-filter-tier-${dimensionId}`}
        />
      }
    />
  );
}

// The active sort, shown as a peer of the filter conditions: the sort is part
// of "how you are seeing this table", so leaving it implicit would hide half
// the applied state. Same state machine as the column header (P1-10). It opens
// a direction dropdown for consistency with the filter chips, but the ascending
// option is disabled — the quick-sort scenario is descending only.
function SortConditionChip({
  sortState,
  isOpen,
  onOpenChange,
  onSelectDirection,
  onRemove,
}: {
  sortState: IMarketListSortState;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectDirection: (direction: 'asc' | 'desc') => void;
  onRemove: () => void;
}) {
  const { sortBy, sortType } = sortState;
  if (!sortBy || !sortType) {
    return null;
  }
  const columnLabel = SORT_COLUMN_LABELS[sortBy] ?? sortBy;
  return (
    <Popover
      title={columnLabel}
      open={isOpen}
      onOpenChange={onOpenChange}
      floatingPanelProps={{
        width: TIER_POPOVER_WIDTH,
        minWidth: TIER_POPOVER_WIDTH,
        maxWidth: TIER_POPOVER_WIDTH,
      }}
      renderTrigger={
        <ConditionChipShell
          label={columnLabel}
          value={SORT_DIRECTION_LABELS[sortType]}
          isOpen={isOpen}
          onRemove={onRemove}
          testID="market-filter-chip-sort"
          removeTestID="market-filter-chip-sort-remove"
        />
      }
      renderContent={
        <TierPopoverContent
          title={columnLabel}
          options={[
            { id: 'desc', label: SORT_DIRECTION_LABELS.desc },
            { id: 'asc', label: SORT_DIRECTION_LABELS.asc, disabled: true },
          ]}
          selectedOptionId={sortType}
          onSelect={(id) => onSelectDirection(id as 'asc' | 'desc')}
          onClear={onRemove}
          testIdPrefix="market-filter-tier-sort"
        />
      }
    />
  );
}

// Quick chips look alike whether they sort or filter; the difference is
// disclosed in the tooltip rather than encoded in the styling (P2-9).
function QuickChip({
  chip,
  onPress,
}: {
  chip: IMarketFilterChip;
  onPress: () => void;
}) {
  return (
    <LazyTooltip
      placement="top"
      onPress={onPress}
      renderTrigger={
        <MarketToolbarPill
          label={chip.label}
          icon={chip.icon}
          testID={`market-filter-chip-quick-${chip.id}`}
        />
      }
      renderContent={chip.tooltip}
    />
  );
}

export function MarketFilterChipsBar({
  timeRange,
  onTimeRangeChange,
  filtersTrigger,
}: {
  timeRange: IMarketTimeRangeValue;
  onTimeRangeChange: (v: IMarketTimeRangeValue) => void;
  // Filters modal trigger slot rendered at the right edge.
  filtersTrigger?: ReactNode;
}) {
  const { filterState, sortState, applyConditions, setSortState } =
    useMarketListFilter();
  const [openPopover, setOpenPopover] = useState<string | undefined>();

  const conditionEntries = Object.entries(filterState.conditions) as [
    EMarketFilterDimension,
    string,
  ][];
  const hasSort = Boolean(sortState.sortBy && sortState.sortType);
  const isExpanded = conditionEntries.length > 0 || hasSort;
  // Derived, not stored: whatever chip the live state happens to match.
  const activeChip = findActiveMarketFilterChip(
    filterState.conditions,
    sortState,
  );

  const handleQuickChipPress = (chip: IMarketFilterChip) => {
    defaultLogger.dex.list.dexFilterChip({
      action: 'presetClick',
      presetId: chip.id,
      conditionCount: Object.keys(chip.conditions).length,
    });
    if (chip.timeRange && chip.timeRange !== timeRange) {
      onTimeRangeChange(chip.timeRange);
    }
    applyConditions(chip.conditions, { sort: chip.sort });
  };

  const removeDimension = (dimensionId: EMarketFilterDimension) => {
    defaultLogger.dex.list.dexFilterChip({
      action: 'conditionRemove',
      field: dimensionId,
    });
    const next = { ...filterState.conditions };
    delete next[dimensionId];
    applyConditions(next);
    setOpenPopover(undefined);
  };

  return (
    // Figma 25141-48128: the trending controls sit in the same bordered
    // toolbar the Favorites/Stocks/Perps sub-category bars use. 12px above
    // (the sticky-portal wrapper supplies the 12px below), 6px inner padding,
    // so the block measures 64px top-to-bottom like the design.
    <Stack pt="$3">
      <XStack
        alignItems="center"
        justifyContent="space-between"
        p={TOOLBAR_PADDING}
        borderWidth={1}
        borderColor="$neutral4"
        borderRadius="$3"
        maxWidth="100%"
        overflow="hidden"
      >
        {/* Fixed row height so swapping quick chips <-> condition chips
            (different intrinsic pill heights) never shifts the table below. */}
        <XStack alignItems="center" gap={10} height={26}>
          <XStack gap="$0.5">
            {TIME_RANGE_OPTIONS.map((option) => (
              <MarketToolbarPill
                key={option}
                label={option}
                selected={option === timeRange}
                onPress={() => onTimeRangeChange(option)}
                testID={`market-filter-time-range-${option}`}
              />
            ))}
          </XStack>
          <Divider vertical h="$4" />
          {isExpanded ? (
            <XStack
              alignItems="center"
              px="$0.5"
              gap="$0.5"
              // Subtle fade + slide as the quick chips morph into condition pills
              // (app-idiomatic "quick" spring, opacity/transform only).
              animation="quick"
              animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
              enterStyle={{ opacity: 0, x: -4 }}
            >
              {/* Group anchor: the matched chip's icon, or a generic filter
                glyph once the conditions no longer spell out a chip. */}
              <XStack p="$1" alignItems="center">
                <Icon
                  name={activeChip?.icon ?? 'Filter1Outline'}
                  size="$4"
                  color="$iconSubdued"
                />
              </XStack>
              <XStack gap="$0.5" alignItems="center">
                <SortConditionChip
                  sortState={sortState}
                  isOpen={openPopover === 'sort'}
                  onOpenChange={(open) =>
                    setOpenPopover(open ? 'sort' : undefined)
                  }
                  onSelectDirection={(direction) => {
                    defaultLogger.dex.list.dexFilterChip({
                      action: 'conditionChange',
                      field: 'sort',
                      value: direction,
                    });
                    setSortState((prev) => ({ ...prev, sortType: direction }));
                    setOpenPopover(undefined);
                  }}
                  onRemove={() => {
                    defaultLogger.dex.list.dexFilterChip({
                      action: 'conditionRemove',
                      field: 'sort',
                    });
                    setSortState({});
                    setOpenPopover(undefined);
                  }}
                />
                {conditionEntries.map(([dimensionId, optionId]) => (
                  <FilterConditionChip
                    key={dimensionId}
                    dimensionId={dimensionId}
                    optionId={optionId}
                    isOpen={openPopover === dimensionId}
                    onOpenChange={(open) =>
                      setOpenPopover(open ? dimensionId : undefined)
                    }
                    onSelectOption={(nextOptionId) => {
                      defaultLogger.dex.list.dexFilterChip({
                        action: 'conditionChange',
                        field: dimensionId,
                        value: nextOptionId,
                      });
                      applyConditions({
                        ...filterState.conditions,
                        [dimensionId]: nextOptionId,
                      });
                      setOpenPopover(undefined);
                    }}
                    onRemove={() => removeDimension(dimensionId)}
                  />
                ))}
              </XStack>
              <XStack alignItems="center">
                <SmallRoundIconButton
                  icon="CrossedSmallOutline"
                  onPress={() => {
                    defaultLogger.dex.list.dexFilterChip({
                      action: 'clearAll',
                    });
                    applyConditions({});
                  }}
                  testID="market-filter-chips-clear-all"
                />
              </XStack>
            </XStack>
          ) : (
            <XStack
              gap="$0.5"
              animation="quick"
              animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
              enterStyle={{ opacity: 0, x: -4 }}
            >
              {MARKET_FILTER_CHIPS.map((chip) => (
                <QuickChip
                  key={chip.id}
                  chip={chip}
                  onPress={() => handleQuickChipPress(chip)}
                />
              ))}
            </XStack>
          )}
        </XStack>
        {filtersTrigger}
      </XStack>
    </Stack>
  );
}
