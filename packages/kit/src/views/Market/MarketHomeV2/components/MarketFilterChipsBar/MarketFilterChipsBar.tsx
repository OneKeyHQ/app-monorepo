import { useState } from 'react';
import type { ReactNode } from 'react';

import {
  Divider,
  Icon,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import {
  MARKET_FILTER_DIMENSION_MAP,
  MARKET_FILTER_PRESETS,
  getMarketFilterOption,
} from './marketListFilterConfig';
import { useMarketListFilter } from './MarketListFilterContext';
import { TierPill } from './TierPill';

import type { EMarketFilterDimension } from './marketListFilterTypes';
import type { IMarketTimeRangeValue } from '../../types';

const TIME_RANGE_OPTIONS: IMarketTimeRangeValue[] = ['5m', '1h', '4h', '24h'];

// The Popover's own Trigger wrapper drives the open-on-press behavior; this
// noop only exists so the trigger XStack keeps a Pressable press state for
// hoverStyle/pressStyle to animate against.
const noop = () => undefined;

// Rounded pill shared by time-range buttons, presets and the Filters trigger.
// Figma: min-w 32 / px 7 / py 5 / radius full / bodySm-medium subdued;
// selected state = bg strong + primary text color.
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

// Figma tier popover (25053-6035): 240 wide, two-column grid of pills
// (min-w 72, grow), header = dimension label + Clear text button.
function TierPopoverContent({
  dimensionId,
  selectedOptionId,
  onSelect,
  onClear,
}: {
  dimensionId: EMarketFilterDimension;
  selectedOptionId: string;
  onSelect: (optionId: string) => void;
  onClear: () => void;
}) {
  const dimension = MARKET_FILTER_DIMENSION_MAP.get(dimensionId);
  if (!dimension) {
    return null;
  }
  return (
    <YStack pt="$3" pb={14} px={14} gap="$3">
      <XStack alignItems="center" justifyContent="space-between" pr="$1">
        <SizableText size="$bodySm" color="$textSubdued">
          {dimension.label}
        </SizableText>
        <ClearTextButton
          onPress={onClear}
          testID={`market-filter-tier-${dimensionId}-clear`}
        />
      </XStack>
      <XStack flexWrap="wrap" gap="$2">
        {dimension.options.map((option) => (
          <TierPill
            key={option.id}
            grow
            label={option.label}
            selected={option.id === selectedOptionId}
            onPress={() => onSelect(option.id)}
            testID={`market-filter-tier-${dimensionId}-${option.id}`}
          />
        ))}
      </XStack>
    </YStack>
  );
}

// Condition chip: bg-strong pill whose body opens the tier popover. Per the
// design there is no per-chip remove; removal happens via the popover Clear
// or the trailing group ✕. Label pairs a regular-weight dimension name with
// a medium-weight tier value.
function ConditionChip({
  dimensionId,
  optionId,
  isOpen,
  onOpenChange,
  onSelectOption,
  onClearDimension,
}: {
  dimensionId: EMarketFilterDimension;
  optionId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectOption: (optionId: string) => void;
  onClearDimension: () => void;
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
        <XStack
          alignItems="center"
          gap="$1"
          px={9}
          height={26}
          borderRadius="$full"
          bg="$bgStrong"
          hoverStyle={{ bg: '$bgStrongHover' }}
          pressStyle={{ bg: '$bgStrongActive' }}
          userSelect="none"
          onPress={noop}
          role="button"
          testID={`market-filter-chip-${dimensionId}`}
        >
          <SizableText size="$bodySm" color="$textSubdued">
            {dimension.label}
          </SizableText>
          <SizableText size="$bodySmMedium" color="$textSubdued">
            {option.chipLabel}
          </SizableText>
        </XStack>
      }
      renderContent={
        <TierPopoverContent
          dimensionId={dimensionId}
          selectedOptionId={optionId}
          onSelect={onSelectOption}
          onClear={onClearDimension}
        />
      }
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
  // Filters popover trigger slot rendered at the right edge (Task 8 wires it).
  filtersTrigger?: ReactNode;
}) {
  const { filterState, setFilterState } = useMarketListFilter();
  const [openDimension, setOpenDimension] = useState<
    EMarketFilterDimension | undefined
  >();
  const conditionEntries = Object.entries(filterState.conditions) as [
    EMarketFilterDimension,
    string,
  ][];
  const hasConditions =
    conditionEntries.length > 0 || Boolean(filterState.activePresetId);
  const activePreset = MARKET_FILTER_PRESETS.find(
    (preset) => preset.id === filterState.activePresetId,
  );

  const removeDimension = (dimensionId: EMarketFilterDimension) => {
    defaultLogger.dex.list.dexFilterChip({
      action: 'conditionRemove',
      field: dimensionId,
    });
    const nextConditions = { ...filterState.conditions };
    delete nextConditions[dimensionId];
    setFilterState({
      conditions: nextConditions,
      activePresetId:
        Object.keys(nextConditions).length > 0
          ? filterState.activePresetId
          : undefined,
    });
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
      {/* Fixed row height so swapping presets <-> condition chips (different
          intrinsic pill heights) never shifts the toolbar/table below. */}
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
        {!hasConditions ? (
          <XStack gap="$0.5">
            {MARKET_FILTER_PRESETS.map((preset) => (
              <MarketToolbarPill
                key={preset.id}
                label={preset.label}
                icon={preset.icon}
                onPress={() => {
                  defaultLogger.dex.list.dexFilterChip({
                    action: 'presetClick',
                    presetId: preset.id,
                  });
                  setFilterState({
                    conditions: preset.conditions,
                    activePresetId: preset.id,
                  });
                }}
                testID={`market-filter-preset-${preset.id}`}
              />
            ))}
          </XStack>
        ) : (
          <XStack alignItems="center" px="$0.5" gap="$0.5">
            {/* Group anchor icon: active preset's icon, or a generic filter
                glyph when conditions came from the Filters popover. */}
            <XStack p="$1" alignItems="center">
              <Icon
                name={activePreset?.icon ?? 'Filter1Outline'}
                size="$4"
                color="$iconSubdued"
              />
            </XStack>
            <XStack gap="$0.5" alignItems="center">
              {conditionEntries.map(([dimensionId, optionId]) => (
                <ConditionChip
                  key={dimensionId}
                  dimensionId={dimensionId}
                  optionId={optionId}
                  isOpen={openDimension === dimensionId}
                  onOpenChange={(open) =>
                    setOpenDimension(open ? dimensionId : undefined)
                  }
                  onSelectOption={(nextOptionId) => {
                    defaultLogger.dex.list.dexFilterChip({
                      action: 'conditionChange',
                      field: dimensionId,
                      value: nextOptionId,
                    });
                    setFilterState({
                      ...filterState,
                      conditions: {
                        ...filterState.conditions,
                        [dimensionId]: nextOptionId,
                      },
                    });
                    setOpenDimension(undefined);
                  }}
                  onClearDimension={() => {
                    removeDimension(dimensionId);
                    setOpenDimension(undefined);
                  }}
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
                  setFilterState({ conditions: {}, activePresetId: undefined });
                }}
                testID="market-filter-chips-clear-all"
              />
            </XStack>
          </XStack>
        )}
      </XStack>
      {filtersTrigger}
    </XStack>
  );
}
