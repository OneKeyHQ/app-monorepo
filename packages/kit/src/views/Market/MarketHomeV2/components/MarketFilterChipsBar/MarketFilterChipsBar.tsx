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
  MARKET_FILTER_FIELD_CONFIG_MAP,
  MARKET_FILTER_PRESETS,
} from './marketListFilterConfig';
import { useMarketListFilter } from './MarketListFilterContext';

import type { EMarketFilterField } from './marketListFilterTypes';
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

// Figma tier popover: 240 wide, wrap grid of pill buttons (min-w 72, px 11,
// py 5, bodyMd-medium); selected = bg active + active border. Header row is
// the field label plus a broom "Clear" action.
function TierPopoverContent({
  field,
  value,
  onSelect,
  onClear,
}: {
  field: EMarketFilterField;
  value: number;
  onSelect: (tierValue: number) => void;
  onClear: () => void;
}) {
  const config = MARKET_FILTER_FIELD_CONFIG_MAP.get(field);
  if (!config) {
    return null;
  }
  return (
    <YStack pt="$3" pb={14} px={14} gap="$3" width={240}>
      <XStack alignItems="center" justifyContent="space-between" pr="$1">
        <SizableText size="$bodySm" color="$textSubdued">
          {config.label}
        </SizableText>
        <XStack
          alignItems="center"
          gap="$1"
          p="$0.5"
          borderRadius="$full"
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          onPress={onClear}
          role="button"
          testID={`market-filter-tier-${field}-clear`}
        >
          <Icon name="BroomOutline" size="$4" color="$iconSubdued" />
          <SizableText size="$bodySmMedium" color="$textSubdued">
            Clear
          </SizableText>
        </XStack>
      </XStack>
      <XStack flexWrap="wrap" gap="$2">
        {config.tiers.map((tier) => {
          const isSelected = tier.value === value;
          return (
            <XStack
              key={tier.value}
              flexGrow={1}
              flexBasis={0}
              minWidth={72}
              alignItems="center"
              justifyContent="center"
              px={11}
              py={5}
              borderRadius="$full"
              borderWidth={1}
              borderColor={isSelected ? '$borderActive' : '$transparent'}
              bg={isSelected ? '$bgActive' : '$bgStrong'}
              hoverStyle={{ bg: '$bgStrongHover' }}
              pressStyle={{ bg: '$bgStrongActive' }}
              userSelect="none"
              onPress={() => onSelect(tier.value)}
              role="button"
              testID={`market-filter-tier-${field}-${tier.value}`}
            >
              <SizableText size="$bodyMdMedium" color="$text">
                {tier.label}
              </SizableText>
            </XStack>
          );
        })}
      </XStack>
    </YStack>
  );
}

// Condition chip: bg-strong pill whose body opens the tier popover. Per the
// design there is no per-chip remove; removal happens via the popover Clear
// or the trailing group ✕. Label pairs a regular-weight field name with a
// medium-weight value.
function ConditionChip({
  field,
  value,
  isOpen,
  onOpenChange,
  onSelectTier,
  onClearField,
}: {
  field: EMarketFilterField;
  value: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTier: (tierValue: number) => void;
  onClearField: () => void;
}) {
  const config = MARKET_FILTER_FIELD_CONFIG_MAP.get(field);
  if (!config) {
    return null;
  }
  return (
    <Popover
      title={config.label}
      open={isOpen}
      onOpenChange={onOpenChange}
      renderTrigger={
        <XStack
          alignItems="center"
          gap="$1"
          px={9}
          py={3}
          borderRadius="$full"
          bg="$bgStrong"
          hoverStyle={{ bg: '$bgStrongHover' }}
          pressStyle={{ bg: '$bgStrongActive' }}
          userSelect="none"
          onPress={noop}
          role="button"
          testID={`market-filter-chip-${field}`}
        >
          <SizableText size="$bodySm" color="$textSubdued">
            {config.label}
          </SizableText>
          <SizableText size="$bodySmMedium" color="$textSubdued">
            {config.formatValue(value)}
          </SizableText>
        </XStack>
      }
      renderContent={
        <TierPopoverContent
          field={field}
          value={value}
          onSelect={onSelectTier}
          onClear={onClearField}
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
  const [openField, setOpenField] = useState<EMarketFilterField | undefined>();
  const conditionEntries = Object.entries(filterState.conditions) as [
    EMarketFilterField,
    number,
  ][];
  const hasConditions =
    conditionEntries.length > 0 || Boolean(filterState.activePresetId);
  const activePreset = MARKET_FILTER_PRESETS.find(
    (preset) => preset.id === filterState.activePresetId,
  );

  const removeField = (field: EMarketFilterField) => {
    defaultLogger.dex.list.dexFilterChip({
      action: 'conditionRemove',
      field,
    });
    const nextConditions = { ...filterState.conditions };
    delete nextConditions[field];
    setFilterState({
      conditions: nextConditions,
      activePresetId:
        Object.keys(nextConditions).length > 0
          ? filterState.activePresetId
          : undefined,
    });
  };

  return (
    <XStack alignItems="center" justifyContent="space-between" pt="$3" pb={10}>
      <XStack alignItems="center" gap={10}>
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
              {conditionEntries.map(([field, value]) => (
                <ConditionChip
                  key={field}
                  field={field}
                  value={value}
                  isOpen={openField === field}
                  onOpenChange={(open) =>
                    setOpenField(open ? field : undefined)
                  }
                  onSelectTier={(tierValue) => {
                    defaultLogger.dex.list.dexFilterChip({
                      action: 'conditionChange',
                      field,
                      value: tierValue,
                    });
                    setFilterState({
                      ...filterState,
                      conditions: {
                        ...filterState.conditions,
                        [field]: tierValue,
                      },
                    });
                    setOpenField(undefined);
                  }}
                  onClearField={() => {
                    removeField(field);
                    setOpenField(undefined);
                  }}
                />
              ))}
            </XStack>
            <XStack p="$1" alignItems="center">
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
