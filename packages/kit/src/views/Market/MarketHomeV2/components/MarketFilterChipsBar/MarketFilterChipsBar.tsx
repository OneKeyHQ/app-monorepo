import { useState } from 'react';
import type { ReactNode } from 'react';

import {
  Button,
  Divider,
  IconButton,
  Popover,
  SizableText,
  XStack,
} from '@onekeyhq/components';

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
    <XStack flexWrap="wrap" gap="$2" p="$3" maxWidth={280}>
      {config.tiers.map((tier) => (
        <Button
          key={tier.value}
          size="small"
          variant={tier.value === value ? 'primary' : 'secondary'}
          onPress={() => onSelect(tier.value)}
          testID={`market-filter-tier-${field}-${tier.value}`}
        >
          {tier.label}
        </Button>
      ))}
      <Button
        size="small"
        variant="tertiary"
        onPress={onClear}
        testID={`market-filter-tier-${field}-clear`}
      >
        Clear
      </Button>
    </XStack>
  );
}

// Two separate hit-zones so the remove icon never has to fight the Popover
// trigger for the press event: the label area opens the tier popover, the
// IconButton (a Popover sibling, not a nested pressable inside it) removes
// the condition.
function ConditionChip({
  field,
  value,
  isOpen,
  onOpenChange,
  onSelectTier,
  onRemove,
}: {
  field: EMarketFilterField;
  value: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTier: (tierValue: number) => void;
  onRemove: () => void;
}) {
  const config = MARKET_FILTER_FIELD_CONFIG_MAP.get(field);
  if (!config) {
    return null;
  }
  return (
    <XStack alignItems="center" gap="$0.5" bg="$bgStrong" borderRadius="$full">
      <Popover
        title={config.label}
        open={isOpen}
        onOpenChange={onOpenChange}
        renderTrigger={
          <XStack
            alignItems="center"
            pl="$2.5"
            py="$1.5"
            borderRadius="$full"
            hoverStyle={{ bg: '$bgStrongHover' }}
            pressStyle={{ bg: '$bgStrongActive' }}
            onPress={noop}
            role="button"
            testID={`market-filter-chip-${field}`}
          >
            <SizableText size="$bodySmMedium" color="$text">
              {`${config.label} ${config.formatValue(value)}`}
            </SizableText>
          </XStack>
        }
        renderContent={
          <TierPopoverContent
            field={field}
            value={value}
            onSelect={onSelectTier}
            onClear={onRemove}
          />
        }
      />
      <IconButton
        icon="CrossedSmallOutline"
        size="small"
        variant="tertiary"
        onPress={onRemove}
        testID={`market-filter-chip-remove-${field}`}
      />
    </XStack>
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

  const removeField = (field: EMarketFilterField) => {
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
    <XStack alignItems="center" gap="$2" py="$2">
      <XStack gap="$1">
        {TIME_RANGE_OPTIONS.map((option) => (
          <Button
            key={option}
            size="small"
            variant="tertiary"
            bg={option === timeRange ? '$bgStrong' : undefined}
            onPress={() => onTimeRangeChange(option)}
            testID={`market-filter-time-range-${option}`}
          >
            {option}
          </Button>
        ))}
      </XStack>
      <Divider vertical h="$4" />
      {!hasConditions
        ? MARKET_FILTER_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              size="small"
              variant="tertiary"
              onPress={() =>
                setFilterState({
                  conditions: preset.conditions,
                  activePresetId: preset.id,
                })
              }
              testID={`market-filter-preset-${preset.id}`}
            >
              {preset.label}
            </Button>
          ))
        : null}
      {hasConditions ? (
        <>
          {conditionEntries.map(([field, value]) => (
            <ConditionChip
              key={field}
              field={field}
              value={value}
              isOpen={openField === field}
              onOpenChange={(open) => setOpenField(open ? field : undefined)}
              onSelectTier={(tierValue) => {
                setFilterState({
                  ...filterState,
                  conditions: {
                    ...filterState.conditions,
                    [field]: tierValue,
                  },
                });
                setOpenField(undefined);
              }}
              onRemove={() => {
                removeField(field);
                setOpenField(undefined);
              }}
            />
          ))}
          <IconButton
            icon="CrossedSmallOutline"
            size="small"
            variant="tertiary"
            onPress={() =>
              setFilterState({ conditions: {}, activePresetId: undefined })
            }
            testID="market-filter-chips-clear-all"
          />
        </>
      ) : null}
      <XStack flex={1} justifyContent="flex-end">
        {filtersTrigger}
      </XStack>
    </XStack>
  );
}
