import { useEffect, useState } from 'react';

import {
  Badge,
  Button,
  Icon,
  Popover,
  ScrollView,
  SegmentControl,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { MARKET_FILTER_FIELD_CONFIGS } from './marketListFilterConfig';
import { useMarketListFilter } from './MarketListFilterContext';
import { EMarketFilterField } from './marketListFilterTypes';

import type {
  IMarketFilterTier,
  IMarketListFilterConditions,
} from './marketListFilterTypes';
import type { IMarketTimeRangeValue } from '../../types';

const TIME_RANGE_OPTIONS: IMarketTimeRangeValue[] = ['5m', '1h', '4h', '24h'];

// Keeps the SegmentControl tabs and Reset/Confirm footer always visible by
// capping only the scrollable tier-rows section. Matches the precedent set
// by NETWORKS_SEARCH_PANEL_MAX_HEIGHT for popovers in this feature area.
// Keep tabs and footer reachable even in short windows (~450px viewport).
const MARKET_FILTERS_POPOVER_CONTENT_MAX_HEIGHT = 300;

const AUDIT_TIER_OPTIONS: IMarketFilterTier[] = [
  { label: '≤ 10%', value: 10 },
  { label: '≤ 30%', value: 30 },
  { label: '≤ 50%', value: 50 },
];

const AUDIT_ROW_LABELS = [
  'Top10 holding %',
  'Dev holding %',
  'Suspicious holding %',
  'Bundle holding %',
];

const AUDIT_ROW_TEST_IDS = [
  'top10-holding',
  'dev-holding',
  'suspicious-holding',
  'bundle-holding',
];

// The Popover's own Trigger wrapper drives the open-on-press behavior; this
// noop only exists so the trigger XStack keeps a Pressable press state for
// hoverStyle/pressStyle to animate against (mirrors MarketFilterChipsBar.tsx).
const noop = () => undefined;

function FieldTierRow({
  label,
  tiers,
  selectedValue,
  disabled,
  trailing,
  onSelect,
  testIDPrefix,
}: {
  label: string;
  tiers: IMarketFilterTier[];
  selectedValue?: number;
  disabled?: boolean;
  trailing?: string;
  onSelect?: (value: number | undefined) => void;
  testIDPrefix: string;
}) {
  return (
    <XStack alignItems="center" justifyContent="space-between" py="$2" gap="$2">
      <SizableText size="$bodyMd" w={110}>
        {label}
      </SizableText>
      <XStack gap="$1" flexWrap="wrap" flex={1} justifyContent="flex-end">
        {tiers.map((tier) => (
          <Button
            key={tier.value}
            size="small"
            disabled={disabled}
            variant={tier.value === selectedValue ? 'primary' : 'tertiary'}
            onPress={() =>
              onSelect?.(tier.value === selectedValue ? undefined : tier.value)
            }
            testID={`${testIDPrefix}-${tier.value}`}
          >
            {tier.label}
          </Button>
        ))}
        {trailing ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {trailing}
          </SizableText>
        ) : null}
      </XStack>
    </XStack>
  );
}

export function MarketFiltersPopover({
  timeRange,
  onTimeRangeChange,
}: {
  timeRange: IMarketTimeRangeValue;
  onTimeRangeChange: (v: IMarketTimeRangeValue) => void;
}) {
  const { filterState, setFilterState, activeConditionCount } =
    useMarketListFilter();
  const [isOpen, setIsOpen] = useState(false);
  const [tabIndex, setTabIndex] = useState<number>(0);
  const [draft, setDraft] = useState<IMarketListFilterConditions>({});

  // Draft mode: re-sync from context on every open so chip-bar edits (e.g.
  // removing a condition) made while the popover was closed aren't lost.
  useEffect(() => {
    if (isOpen) {
      setDraft({ ...filterState.conditions });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <Popover
      title="Filters"
      open={isOpen}
      onOpenChange={setIsOpen}
      renderTrigger={
        <XStack
          alignItems="center"
          gap="$1"
          px="$2.5"
          py="$1.5"
          borderRadius="$full"
          bg={activeConditionCount > 0 ? '$bgStrong' : undefined}
          hoverStyle={{ bg: '$bgStrongHover' }}
          pressStyle={{ bg: '$bgStrongActive' }}
          onPress={noop}
          role="button"
          testID="market-filters-popover-trigger"
        >
          <SizableText size="$bodySmMedium" color="$text">
            Filters
          </SizableText>
          {activeConditionCount > 0 ? (
            <Badge badgeType="default" badgeSize="sm">
              <Badge.Text>{activeConditionCount}</Badge.Text>
            </Badge>
          ) : null}
          <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
        </XStack>
      }
      renderContent={
        <YStack p="$4" gap="$3" width="100%">
          <SegmentControl
            value={tabIndex}
            onChange={(v) => setTabIndex(v as number)}
            options={[
              {
                label: 'Metrics',
                value: 0,
                testID: 'market-filters-popover-tab-metrics',
              },
              {
                label: 'Audit',
                value: 1,
                testID: 'market-filters-popover-tab-audit',
              },
            ]}
          />
          <ScrollView
            maxHeight={MARKET_FILTERS_POPOVER_CONTENT_MAX_HEIGHT}
            showsVerticalScrollIndicator={false}
          >
            {tabIndex === 0 ? (
              <YStack>
                <XStack
                  alignItems="center"
                  justifyContent="space-between"
                  py="$2"
                  flexWrap="wrap"
                  gap="$2"
                >
                  <SizableText size="$bodyMd" w={110}>
                    Time range
                  </SizableText>
                  <XStack gap="$1" flexWrap="wrap">
                    {TIME_RANGE_OPTIONS.map((option) => (
                      <Button
                        key={option}
                        size="small"
                        variant={option === timeRange ? 'primary' : 'tertiary'}
                        onPress={() => onTimeRangeChange(option)}
                        testID={`market-filters-popover-time-range-${option}`}
                      >
                        {option}
                      </Button>
                    ))}
                  </XStack>
                </XStack>
                {MARKET_FILTER_FIELD_CONFIGS.map((config) => (
                  <FieldTierRow
                    key={config.field}
                    label={config.label}
                    tiers={config.tiers}
                    selectedValue={draft[config.field]}
                    trailing={
                      config.field === EMarketFilterField.InflowUsdMin
                        ? 'Local demo: no data source yet'
                        : undefined
                    }
                    onSelect={(value) => {
                      setDraft((prev) => {
                        const next = { ...prev };
                        if (value === undefined) {
                          delete next[config.field];
                        } else {
                          next[config.field] = value;
                        }
                        return next;
                      });
                    }}
                    testIDPrefix={`market-filters-popover-field-${config.field}`}
                  />
                ))}
              </YStack>
            ) : (
              <YStack gap="$2" py="$2">
                {AUDIT_ROW_LABELS.map((label, index) => (
                  <FieldTierRow
                    key={label}
                    label={label}
                    disabled
                    tiers={AUDIT_TIER_OPTIONS}
                    testIDPrefix={`market-filters-popover-audit-${AUDIT_ROW_TEST_IDS[index]}`}
                  />
                ))}
                <SizableText size="$bodySm" color="$textSubdued">
                  Pending Spike A#8 boolean-direction verification
                </SizableText>
              </YStack>
            )}
          </ScrollView>
          <XStack gap="$3" pt="$2">
            <Button
              flex={1}
              variant="secondary"
              onPress={() => setDraft({})}
              testID="market-filters-popover-reset"
            >
              Reset
            </Button>
            <Button
              flex={1}
              variant="primary"
              onPress={() => {
                defaultLogger.dex.list.dexFilterChip({
                  action: 'popoverConfirm',
                  conditionCount: Object.keys(draft).length,
                });
                setFilterState({
                  conditions: draft,
                  activePresetId: undefined,
                });
                setIsOpen(false);
              }}
              testID="market-filters-popover-confirm"
            >
              Confirm
            </Button>
          </XStack>
        </YStack>
      }
    />
  );
}
