import { useState } from 'react';

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

// Uniform pill width: rows wrap naturally and leave trailing space instead
// of stretching to fill (per design); identical widths keep columns aligned.
// 84px is the widest value that still fits four pills plus gaps inside the
// dialog's 400px content frame.
const TIER_PILL_WIDTH = 84;

const AUDIT_TIER_LABELS = ['≤ 10%', '≤ 30%', '≤ 50%'];

const AUDIT_ROWS = [
  { label: 'Top10 holding %', testId: 'top10-holding' },
  { label: 'Dev holding %', testId: 'dev-holding' },
  { label: 'Suspicious holding %', testId: 'suspicious-holding' },
  { label: 'Bundle holding %', testId: 'bundle-holding' },
];

// Uniform fixed-width tier pills that wrap with trailing space.
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
      <SizableText size="$bodyMd" color="$textSubdued">
        {dimension.unit
          ? `${dimension.label} (${dimension.unit})`
          : dimension.label}
      </SizableText>
      <TierGrid
        items={dimension.options.map((option) => ({
          key: option.id,
          label: option.label,
          selected: option.id === selectedOptionId,
          onPress: () =>
            onSelect(option.id === selectedOptionId ? undefined : option.id),
          testID: `market-filters-modal-field-${dimension.id}-${option.id}`,
        }))}
      />
    </YStack>
  );
}

function GroupHeader({ label }: { label: string }) {
  return (
    <SizableText size="$headingSm" pt="$3">
      {label}
    </SizableText>
  );
}

// Modal body. Receives the committed state as a snapshot instead of reading
// the filter context: Dialog portals render outside the Market provider
// subtree, so context would resolve to the empty default there.
function MarketFiltersModalContent({
  initialConditions,
  onApply,
  onClose,
}: {
  initialConditions: IMarketListFilterConditions;
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
    <YStack gap="$2">
      {/* The Dialog frame has no built-in scroll; cap the section list so
          long group stacks scroll internally and the footer stays pinned. */}
      <ScrollView maxHeight={460} showsVerticalScrollIndicator={false}>
        {MARKET_FILTER_GROUP_ORDER.map((group, groupIndex) => {
          const dimensions = MARKET_FILTER_DIMENSIONS.filter(
            (dimension) => dimension.group === group,
          );
          return (
            <YStack key={group} gap="$2">
              {groupIndex > 0 ? <Divider mt="$3" /> : null}
              <GroupHeader label={MARKET_FILTER_GROUP_LABELS[group]} />
              {group === EMarketFilterGroup.Safety ? (
                <YStack>
                  {AUDIT_ROWS.map((row) => (
                    <YStack key={row.testId} py="$2" gap="$2">
                      <SizableText size="$bodyMd" color="$textSubdued">
                        {row.label}
                      </SizableText>
                      <TierGrid
                        items={AUDIT_TIER_LABELS.map((tierLabel) => ({
                          key: tierLabel,
                          label: tierLabel,
                          disabled: true,
                          testID: `market-filters-modal-audit-${row.testId}-${tierLabel}`,
                        }))}
                      />
                    </YStack>
                  ))}
                  <SizableText size="$bodySm" color="$textSubdued">
                    Pending Spike A#8 boolean-direction verification
                  </SizableText>
                </YStack>
              ) : (
                dimensions.map((dimension) => (
                  <DimensionRow
                    key={dimension.id}
                    dimension={dimension}
                    selectedOptionId={draft[dimension.id]}
                    onSelect={(optionId) => handleSelect(dimension, optionId)}
                  />
                ))
              )}
            </YStack>
          );
        })}
      </ScrollView>
      <XStack gap="$3" pt="$5" alignItems="center">
        <Button
          variant="tertiary"
          onPress={() => setDraft({})}
          testID="market-filters-modal-reset"
        >
          Reset
        </Button>
        <XStack flex={1} justifyContent="flex-end" gap="$3">
          <Button onPress={onClose} testID="market-filters-modal-cancel">
            Cancel
          </Button>
          <Button
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
            Apply
          </Button>
        </XStack>
      </XStack>
    </YStack>
  );
}

// Filters entry pill; opens the filter conditions modal. Lives inside the
// Market provider subtree, so it snapshots state/setters for the dialog.
export function MarketFiltersTrigger() {
  const { filterState, setFilterState, activeConditionCount } =
    useMarketListFilter();

  const handlePress = () => {
    const dialog = Dialog.show({
      title: 'Filters',
      showFooter: false,
      renderContent: (
        <MarketFiltersModalContent
          initialConditions={filterState.conditions}
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
