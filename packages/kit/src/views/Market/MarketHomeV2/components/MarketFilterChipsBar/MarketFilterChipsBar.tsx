import { useMemo, useState } from 'react';
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

// bg-strong-hover is a translucent gray overlay, so a fade drawn in it would
// not actually hide the text underneath — the mask must fade to the chip's
// EFFECTIVE surface = bgStrongHover composited over bgApp. Both tokens are
// fixed, so the two composites are precomputed per theme rather than parsed
// from theme.*.val (which is not a reliable color string on web).
// light: #FFFFFF + grayA4 (#00000017) -> rgb(232); dark: #0f0f0f + grayA4
// dark (#ffffff1b) -> rgb(40). Recompute if those tokens change.
const CHIP_MASK_SOLID = { light: 'rgb(232,232,232)', dark: 'rgb(40,40,40)' };
const CHIP_MASK_TRANSPARENT = {
  light: 'rgba(232,232,232,0)',
  dark: 'rgba(40,40,40,0)',
};

function useChipMaskColors() {
  const themeVariant = useThemeVariant();
  const key = themeVariant === 'dark' ? 'dark' : 'light';
  return {
    solid: CHIP_MASK_SOLID[key],
    transparent: CHIP_MASK_TRANSPARENT[key],
  };
}

// Width of the remove hit-target and the gradient fade over the chip's right
// edge. The gradient sits ON TOP of the value text so revealing the × never
// changes the chip width (no layout jitter) — the text just fades out beneath.
const CHIP_REMOVE_WIDTH = 26;
const CHIP_FADE_WIDTH = 34;
const CHIP_FADE_START: [number, number] = [0, 0];
const CHIP_FADE_END: [number, number] = [1, 0];
// Solid for the last ~55% so the × always sits on an opaque patch.
const CHIP_FADE_LOCATIONS: [number, number, number] = [0, 0.45, 1];

// Figma 25099-6710 / 25116-6318: bg-strong capsule, h 26 / radius full / px 9,
// label regular + value medium. Hover swaps to bg-strong-hover and fades in a
// remove control over the right edge; the 26px hit-target and the gradient are
// overlays, so nothing about the chip's size changes on hover.
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
  const mask = useChipMaskColors();
  const showRemove = isHovered || isOpen;
  const fadeColors = useMemo(
    () => [mask.transparent, mask.solid, mask.solid],
    [mask],
  );
  return (
    <XStack
      alignItems="center"
      gap="$1"
      height={26}
      px={9}
      borderRadius="$full"
      overflow="hidden"
      bg={showRemove ? '$bgStrongHover' : '$bgStrong'}
      pressStyle={{ bg: '$bgStrongActive' }}
      userSelect="none"
      cursor="pointer"
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      onPress={noop}
      role="button"
      testID={testID}
    >
      <SizableText size="$bodySm" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText size="$bodySmMedium" color="$textSubdued">
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
            colors={fadeColors}
            locations={CHIP_FADE_LOCATIONS}
            start={CHIP_FADE_START}
            end={CHIP_FADE_END}
          />
          <Stack
            position="absolute"
            top={0}
            bottom={0}
            right={0}
            width={CHIP_REMOVE_WIDTH}
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            onPress={(event) => {
              // The chip body opens the tier popover; the × must not.
              event.stopPropagation();
              onRemove();
            }}
            role="button"
            testID={removeTestID}
          >
            <Icon name="CrossedSmallOutline" size="$4" color="$iconSubdued" />
          </Stack>
        </>
      ) : null}
    </XStack>
  );
}

// Figma tier popover (25053-6035): 240 wide, two-column grid of pills
// (min-w 72, grow), header = dimension label + Clear text button.
function TierPopoverContent({
  title,
  options,
  selectedOptionId,
  onSelect,
  onClear,
  testIdPrefix,
}: {
  title: string;
  options: { id: string; label: string }[];
  selectedOptionId?: string;
  onSelect: (optionId: string) => void;
  onClear: () => void;
  testIdPrefix: string;
}) {
  return (
    <YStack pt="$3" pb={14} px={14} gap="$3">
      <XStack alignItems="center" justifyContent="space-between" pr="$1">
        <SizableText size="$bodySm" color="$textSubdued">
          {title}
        </SizableText>
        <ClearTextButton onPress={onClear} testID={`${testIdPrefix}-clear`} />
      </XStack>
      <XStack flexWrap="wrap" gap="$2">
        {options.map((option) => (
          <TierPill
            key={option.id}
            grow
            label={option.label}
            selected={option.id === selectedOptionId}
            onPress={() => onSelect(option.id)}
            testID={`${testIdPrefix}-${option.id}`}
          />
        ))}
      </XStack>
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
      floatingPanelProps={{ width: 240, minWidth: 240, maxWidth: 240 }}
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
// the applied state. Same state machine as the column header (P1-10).
// This chip has no direction dropdown: the quick-sort scenario is descending
// only, and finer control lives on the column header itself.
function SortConditionChip({
  sortState,
  onRemove,
}: {
  sortState: IMarketListSortState;
  onRemove: () => void;
}) {
  const { sortBy, sortType } = sortState;
  if (!sortBy || !sortType) {
    return null;
  }
  const columnLabel = SORT_COLUMN_LABELS[sortBy] ?? sortBy;
  return (
    <ConditionChipShell
      label={columnLabel}
      value={SORT_DIRECTION_LABELS[sortType]}
      onRemove={onRemove}
      testID="market-filter-chip-sort"
      removeTestID="market-filter-chip-sort-remove"
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
    <XStack
      alignItems="center"
      justifyContent="space-between"
      pt="$3"
      pb={10}
      height={48}
      // The sticky-portal container pads 16px while the tab-bar controls above
      // pad 20px; this extra 4px keeps the Filters pill right-aligned with the
      // network selector above it.
      pr="$1"
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
          <XStack alignItems="center" px="$0.5" gap="$0.5">
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
                onRemove={() => {
                  defaultLogger.dex.list.dexFilterChip({
                    action: 'conditionRemove',
                    field: 'sort',
                  });
                  setSortState({});
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
                  defaultLogger.dex.list.dexFilterChip({ action: 'clearAll' });
                  applyConditions({});
                }}
                testID="market-filter-chips-clear-all"
              />
            </XStack>
          </XStack>
        ) : (
          <XStack gap="$0.5">
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
  );
}
