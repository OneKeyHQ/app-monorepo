import { useState } from 'react';
import type { ReactNode } from 'react';

import {
  Button,
  Dialog,
  Divider,
  Icon,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import {
  MARKET_FILTER_DIMENSIONS,
  MARKET_FILTER_GROUP_LABELS,
  MARKET_FILTER_GROUP_ORDER,
} from './marketListFilterConfig';
import { useMarketListFilter } from './MarketListFilterContext';
import { EMarketFilterGroup } from './marketListFilterTypes';
import { TierPill } from './TierPill';

import type {
  IMarketFilterDimensionConfig,
  IMarketListFilterConditions,
  IMarketListFilterState,
} from './marketListFilterTypes';
import type { IMarketTimeRangeValue } from '../../types';

const TIME_RANGE_OPTIONS: IMarketTimeRangeValue[] = ['5m', '1h', '4h', '24h'];

// Figma 25060-6052: label takes the remaining width on the left, controls sit
// in a fixed 232px column that wraps. Three pills per row (min 72px each);
// a four-option dimension wraps to 2x2 with wider pills.
const CONTROL_COLUMN_WIDTH = 232;
const ROW_LABEL_HEIGHT = 30;
const TIER_GAP = 6;
const TIME_RANGE_GAP = 4;
const TIME_RANGE_PILL_WIDTH = 40;
const TIER_COLUMNS_DEFAULT = 3;
const TIER_COLUMNS_FOR_FOUR_OPTIONS = 2;
const TIER_MIN_WIDTH_DEFAULT = 72;
const TIER_MIN_WIDTH_WIDE = 80;

function getTierColumns(optionCount: number) {
  return optionCount === 4
    ? TIER_COLUMNS_FOR_FOUR_OPTIONS
    : TIER_COLUMNS_DEFAULT;
}

const AUDIT_TIER_LABELS = ['≤ 10%', '≤ 30%', '≤ 50%'];

const AUDIT_ROWS = [
  { label: 'Top10 holding %', testId: 'top10-holding' },
  { label: 'Dev holding %', testId: 'dev-holding' },
  { label: 'Suspicious holding %', testId: 'suspicious-holding' },
  { label: 'Bundle holding %', testId: 'bundle-holding' },
];

// Equal-width pills laid out on a fixed column grid so every row lines up.
function TierGrid({
  items,
  columns,
}: {
  items: {
    key: string;
    label: string;
    selected?: boolean;
    disabled?: boolean;
    onPress?: () => void;
    testID?: string;
  }[];
  columns: number;
}) {
  const rows: (typeof items)[] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  const minWidth =
    columns === TIER_COLUMNS_FOR_FOUR_OPTIONS
      ? TIER_MIN_WIDTH_WIDE
      : TIER_MIN_WIDTH_DEFAULT;
  return (
    <YStack width={CONTROL_COLUMN_WIDTH} gap={TIER_GAP} flexShrink={0}>
      {rows.map((row) => (
        <XStack key={row[0].key} gap={TIER_GAP}>
          {row.map((item) => (
            <TierPill
              key={item.key}
              grow
              minWidth={minWidth}
              label={item.label}
              selected={item.selected}
              disabled={item.disabled}
              onPress={item.onPress}
              testID={item.testID}
            />
          ))}
          {row.length < columns
            ? Array.from({ length: columns - row.length }).map((_, index) => (
                <XStack
                  // eslint-disable-next-line react/no-array-index-key
                  key={`spacer-${index}`}
                  flexGrow={1}
                  flexBasis={0}
                />
              ))
            : null}
        </XStack>
      ))}
    </YStack>
  );
}

// Label on the left, controls in the fixed-width column on the right.
function FilterRow({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <XStack gap="$3" alignItems="flex-start" width="100%">
      <YStack
        flex={1}
        minWidth={0}
        minHeight={ROW_LABEL_HEIGHT}
        pr="$1"
        jc="center"
      >
        <SizableText size="$bodyMd" color="$textSubdued">
          {label}
        </SizableText>
        {note ? (
          <SizableText size="$bodyXs" color="$textDisabled">
            {note}
          </SizableText>
        ) : null}
      </YStack>
      {children}
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
    <FilterRow
      label={
        dimension.unit
          ? `${dimension.label} (${dimension.unit})`
          : dimension.label
      }
      note={dimension.note}
    >
      <TierGrid
        columns={getTierColumns(dimension.options.length)}
        items={dimension.options.map((option) => ({
          key: option.id,
          label: option.label,
          selected: option.id === selectedOptionId,
          onPress: () =>
            onSelect(option.id === selectedOptionId ? undefined : option.id),
          testID: `market-filters-modal-field-${dimension.id}-${option.id}`,
        }))}
      />
    </FilterRow>
  );
}

function GroupHeader({ label }: { label: string }) {
  return <SizableText size="$headingSm">{label}</SizableText>;
}

// Modal body. Receives the committed state as a snapshot instead of reading
// the filter context: Dialog portals render outside the Market provider
// subtree, so context would resolve to the empty default there.
function MarketFiltersModalContent({
  initialConditions,
  timeRange,
  onTimeRangeChange,
  onApply,
  onClose,
}: {
  initialConditions: IMarketListFilterConditions;
  timeRange: IMarketTimeRangeValue;
  onTimeRangeChange: (v: IMarketTimeRangeValue) => void;
  onApply: (next: IMarketListFilterState) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<IMarketListFilterConditions>({
    ...initialConditions,
  });

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
    <YStack gap="$5">
      {/* The Dialog frame has no built-in scroll; cap the section list so
          long group stacks scroll internally and the footer stays pinned. */}
      <ScrollView maxHeight={460} showsVerticalScrollIndicator={false}>
        <YStack gap="$6">
          {MARKET_FILTER_GROUP_ORDER.map((group, groupIndex) => {
            const dimensions = MARKET_FILTER_DIMENSIONS.filter(
              (dimension) => dimension.group === group,
            );
            return (
              <YStack key={group} gap="$4">
                {groupIndex > 0 ? <Divider mb="$2" /> : null}
                <GroupHeader label={MARKET_FILTER_GROUP_LABELS[group]} />
                <YStack gap="$6">
                  {group === EMarketFilterGroup.Metrics ? (
                    // Timeframe drives the whole list (not a filter condition),
                    // so it applies immediately and mirrors the toolbar segment
                    // - hence the plain (transparent) pill treatment.
                    <FilterRow label="Time frame">
                      <XStack
                        width={CONTROL_COLUMN_WIDTH}
                        gap={TIME_RANGE_GAP}
                        flexShrink={0}
                      >
                        {TIME_RANGE_OPTIONS.map((option) => (
                          <TierPill
                            key={option}
                            variant="plain"
                            minWidth={TIME_RANGE_PILL_WIDTH}
                            grow
                            label={option}
                            selected={option === timeRange}
                            onPress={() => onTimeRangeChange(option)}
                            testID={`market-filters-modal-time-range-${option}`}
                          />
                        ))}
                      </XStack>
                    </FilterRow>
                  ) : null}
                  {group === EMarketFilterGroup.Audit
                    ? AUDIT_ROWS.map((row) => (
                        <FilterRow key={row.testId} label={row.label}>
                          <TierGrid
                            columns={getTierColumns(AUDIT_TIER_LABELS.length)}
                            items={AUDIT_TIER_LABELS.map((tierLabel) => ({
                              key: tierLabel,
                              label: tierLabel,
                              disabled: true,
                              testID: `market-filters-modal-audit-${row.testId}-${tierLabel}`,
                            }))}
                          />
                        </FilterRow>
                      ))
                    : dimensions.map((dimension) => (
                        <DimensionRow
                          key={dimension.id}
                          dimension={dimension}
                          selectedOptionId={draft[dimension.id]}
                          onSelect={(optionId) =>
                            handleSelect(dimension, optionId)
                          }
                        />
                      ))}
                  {group === EMarketFilterGroup.Audit ? (
                    <SizableText size="$bodySm" color="$textSubdued">
                      Pending Spike A#8 boolean-direction verification
                    </SizableText>
                  ) : null}
                </YStack>
              </YStack>
            );
          })}
        </YStack>
      </ScrollView>
      {/* Figma footer: two equal-width actions, secondary Reset + primary
          Confirm (the dialog's own close button covers dismissal). */}
      <XStack gap="$2.5">
        <Button
          flex={1}
          size="medium"
          onPress={() => setDraft({})}
          testID="market-filters-modal-reset"
        >
          Reset
        </Button>
        <Button
          flex={1}
          size="medium"
          variant="primary"
          onPress={() => {
            defaultLogger.dex.list.dexFilterChip({
              action: 'popoverConfirm',
              conditionCount: Object.keys(draft).length,
            });
            onApply({ conditions: draft, activePresetId: undefined });
            onClose();
          }}
          testID="market-filters-modal-apply"
        >
          Confirm
        </Button>
      </XStack>
    </YStack>
  );
}

// Filters entry pill; opens the filter conditions modal. Lives inside the
// Market provider subtree, so it snapshots state/setters for the dialog.
export function MarketFiltersTrigger({
  timeRange,
  onTimeRangeChange,
}: {
  timeRange: IMarketTimeRangeValue;
  onTimeRangeChange: (v: IMarketTimeRangeValue) => void;
}) {
  const { filterState, setFilterState, activeConditionCount } =
    useMarketListFilter();

  const handlePress = () => {
    const dialog = Dialog.show({
      title: 'Filters',
      showFooter: false,
      renderContent: (
        <MarketFiltersModalContent
          initialConditions={filterState.conditions}
          timeRange={timeRange}
          onTimeRangeChange={onTimeRangeChange}
          onApply={setFilterState}
          onClose={() => {
            void dialog.close();
          }}
        />
      ),
    });
  };

  return (
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
      onPress={handlePress}
      role="button"
      testID="market-filters-modal-trigger"
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
  );
}
