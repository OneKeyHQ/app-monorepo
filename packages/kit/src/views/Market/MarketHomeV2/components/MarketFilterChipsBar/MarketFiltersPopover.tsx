import { useEffect, useState } from 'react';

import {
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

import { MARKET_FILTER_DIMENSIONS } from './marketListFilterConfig';
import { useMarketListFilter } from './MarketListFilterContext';
import { TierPill } from './TierPill';

import type {
  IMarketFilterDimensionConfig,
  IMarketListFilterConditions,
} from './marketListFilterTypes';
import type { IMarketTimeRangeValue } from '../../types';

const TIME_RANGE_OPTIONS: IMarketTimeRangeValue[] = ['5m', '1h', '4h', '24h'];

// Caps only the scrollable section so the Reset/Confirm footer stays
// reachable; sized so a 800px-tall window shows most rows without scrolling.
const MARKET_FILTERS_POPOVER_CONTENT_MAX_HEIGHT = 380;

const AUDIT_TIER_LABELS = ['Under 10%', 'Under 30%', 'Under 50%'];

const AUDIT_ROWS = [
  { label: 'Top10 holding %', testId: 'top10-holding' },
  { label: 'Dev holding %', testId: 'dev-holding' },
  { label: 'Suspicious holding %', testId: 'suspicious-holding' },
  { label: 'Bundle holding %', testId: 'bundle-holding' },
];

// The Popover's own Trigger wrapper drives the open-on-press behavior; this
// noop only exists so the trigger XStack keeps a Pressable press state for
// hoverStyle/pressStyle to animate against (mirrors MarketFilterChipsBar.tsx).
const noop = () => undefined;

// Uniform pill width: rows wrap naturally and leave trailing space instead
// of stretching to fill (per design). 96px fits the widest tier label
// ("100K-1M") and packs four per row inside the 440px panel.
const TIER_PILL_WIDTH = 96;

// Uniform fixed-width tier pills that wrap with trailing space; identical
// widths keep every row's columns aligned without stretching.
function TierGrid({
  items,
}: {
  items: {
    key: string;
    label: string;
    selected?: boolean;
    disabled?: boolean;
    onPress?: () => void;
    testID?: string;
  }[];
}) {
  return (
    <XStack gap="$2" flexWrap="wrap">
      {items.map((item) => (
        <TierPill
          key={item.key}
          width={TIER_PILL_WIDTH}
          label={item.label}
          selected={item.selected}
          disabled={item.disabled}
          onPress={item.onPress}
          testID={item.testID}
        />
      ))}
    </XStack>
  );
}

function DimensionRow({
  dimension,
  selectedOptionId,
  onSelect,
}: {
  dimension: IMarketFilterDimensionConfig;
  selectedOptionId?: string;
  onSelect: (optionId: string | undefined) => void;
}) {
  return (
    <YStack py="$2" gap="$2">
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
          {dimension.unit
            ? `${dimension.label} (${dimension.unit})`
            : dimension.label}
        </SizableText>
        {dimension.note ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {dimension.note}
          </SizableText>
        ) : null}
      </XStack>
      <TierGrid
        items={dimension.options.map((option) => ({
          key: option.id,
          label: option.label,
          selected: option.id === selectedOptionId,
          onPress: () =>
            onSelect(option.id === selectedOptionId ? undefined : option.id),
          testID: `market-filters-popover-field-${dimension.id}-${option.id}`,
        }))}
      />
    </YStack>
  );
}

function AuditPlaceholderRow({
  label,
  testId,
}: {
  label: string;
  testId: string;
}) {
  return (
    <YStack py="$2" gap="$2">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <TierGrid
        items={AUDIT_TIER_LABELS.map((tierLabel) => ({
          key: tierLabel,
          label: tierLabel,
          disabled: true,
          testID: `market-filters-popover-audit-${testId}-${tierLabel}`,
        }))}
      />
    </YStack>
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

  const primaryDimensions = MARKET_FILTER_DIMENSIONS.filter(
    (dimension) => !dimension.advanced,
  );
  const advancedDimensions = MARKET_FILTER_DIMENSIONS.filter(
    (dimension) => dimension.advanced,
  );

  const handleSelect = (
    dimension: IMarketFilterDimensionConfig,
    optionId: string | undefined,
  ) => {
    setDraft((prev) => {
      const next = { ...prev };
      if (optionId === undefined) {
        delete next[dimension.id];
      } else {
        next[dimension.id] = optionId;
      }
      return next;
    });
  };

  return (
    <Popover
      title="Filters"
      open={isOpen}
      onOpenChange={setIsOpen}
      placement="bottom-end"
      floatingPanelProps={{ width: 440, minWidth: 440, maxWidth: 440 }}
      renderTrigger={
        <XStack
          alignItems="center"
          justifyContent="center"
          gap="$1"
          minWidth={32}
          px={7}
          height={26}
          borderRadius="$full"
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          userSelect="none"
          onPress={noop}
          role="button"
          testID="market-filters-popover-trigger"
        >
          <Icon name="Filter1Outline" size="$4" color="$iconSubdued" />
          <SizableText size="$bodySmMedium" color="$textSubdued">
            Filters
          </SizableText>
          {activeConditionCount > 0 ? (
            <XStack
              minWidth={18}
              px="$1"
              py={1}
              borderRadius="$full"
              bg="$bgStrong"
              alignItems="center"
              justifyContent="center"
            >
              <SizableText size="$bodySmMedium" color="$textSubdued">
                {activeConditionCount}
              </SizableText>
            </XStack>
          ) : null}
          <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
        </XStack>
      }
      renderContent={
        <YStack p="$4" gap="$3" width="100%">
          <ScrollView
            maxHeight={MARKET_FILTERS_POPOVER_CONTENT_MAX_HEIGHT}
            showsVerticalScrollIndicator={false}
          >
            <YStack pb="$3">
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
            </YStack>
            {tabIndex === 0 ? (
              <YStack>
                <YStack py="$2" gap="$2">
                  <SizableText size="$bodyMd" color="$textSubdued">
                    Time range
                  </SizableText>
                  <TierGrid
                    items={TIME_RANGE_OPTIONS.map((option) => ({
                      key: option,
                      label: option,
                      selected: option === timeRange,
                      onPress: () => onTimeRangeChange(option),
                      testID: `market-filters-popover-time-range-${option}`,
                    }))}
                  />
                </YStack>
                {primaryDimensions.map((dimension) => (
                  <DimensionRow
                    key={dimension.id}
                    dimension={dimension}
                    selectedOptionId={draft[dimension.id]}
                    onSelect={(optionId) => handleSelect(dimension, optionId)}
                  />
                ))}
                <XStack pt="$3" pb="$1">
                  <SizableText size="$bodySm" color="$textSubdued">
                    More
                  </SizableText>
                </XStack>
                {advancedDimensions.map((dimension) => (
                  <DimensionRow
                    key={dimension.id}
                    dimension={dimension}
                    selectedOptionId={draft[dimension.id]}
                    onSelect={(optionId) => handleSelect(dimension, optionId)}
                  />
                ))}
              </YStack>
            ) : (
              <YStack gap="$2" py="$2">
                {AUDIT_ROWS.map((row) => (
                  <AuditPlaceholderRow
                    key={row.testId}
                    label={row.label}
                    testId={row.testId}
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
