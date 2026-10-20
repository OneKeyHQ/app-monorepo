import type { ReactNode } from 'react';

import {
  Button,
  Icon,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
  usePopoverContext,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { POOLS_COPY } from '../poolsCopy';
import {
  EMPTY_POOLS_FILTER,
  POOL_CATEGORIES,
  POOL_FEE_OPTIONS,
  POOL_PROTOCOL_OPTIONS,
  countPanelFilters,
} from '../poolsFilter';
import { formatFeeTier, getPoolProtocolLabel } from '../poolsFormat';
import { UNISWAP_PROTOCOL } from '../usePoolsPortfolio';

import type {
  IPoolsCategory,
  IPoolsFeeOption,
  IPoolsFilter,
  IPoolsOptionCounts,
  IPoolsSortKey,
} from '../poolsFilter';

function chipTextColor(active: boolean, disabled: boolean) {
  if (disabled) {
    return '$textDisabled';
  }
  return active ? '$text' : '$textSubdued';
}

export function PoolsChip({
  label,
  active,
  onPress,
  testID,
  icon,
  large = false,
  disabled = false,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
  /** Shown before the label, e.g. a network avatar */
  icon?: ReactNode;
  /** Touch size, for sheets */
  large?: boolean;
  /** Greyed out and not tappable: picking it would leave no pools */
  disabled?: boolean;
}) {
  return (
    <XStack
      testID={testID}
      role="button"
      aria-disabled={disabled}
      ai="center"
      gap="$1.5"
      px={large ? '$3.5' : '$3'}
      py={large ? '$2' : '$1'}
      borderRadius="$full"
      bg={active ? '$bgStrong' : '$bgSubdued'}
      cursor={disabled ? 'default' : 'pointer'}
      userSelect="none"
      hoverStyle={
        disabled ? undefined : { bg: active ? '$bgStrong' : '$bgHover' }
      }
      pressStyle={disabled ? undefined : { opacity: 0.7 }}
      onPress={disabled ? undefined : onPress}
    >
      {icon ? <Stack opacity={disabled ? 0.4 : 1}>{icon}</Stack> : null}
      <SizableText size="$bodyMdMedium" color={chipTextColor(active, disabled)}>
        {label}
      </SizableText>
    </XStack>
  );
}

export type IPoolsListSort = {
  key: IPoolsSortKey;
  direction: 'asc' | 'desc';
};

// Short labels keep the four on one line; phones sort on the last 24 hours
const SORT_OPTIONS: { key: IPoolsSortKey; label: string }[] = [
  { key: 'tvl', label: POOLS_COPY.sortTvl },
  { key: 'apr', label: POOLS_COPY.sortApr },
  { key: 'volume', label: POOLS_COPY.volume },
  { key: 'fees', label: POOLS_COPY.fees },
];

export const POOLS_CATEGORY_LABELS: Record<IPoolsCategory, string> = {
  trending: POOLS_COPY.trending,
  new: POOLS_COPY.newPools,
  rwa: POOLS_COPY.rwa,
  stablecoins: POOLS_COPY.stablecoins,
  bluechips: POOLS_COPY.blueChips,
  altcoins: POOLS_COPY.altcoins,
};

function feeOptionLabel(option: IPoolsFeeOption) {
  return option === 'dynamic' ? POOLS_COPY.dynamic : formatFeeTier(option);
}

function toggle<T>(list: T[], item: T) {
  return list.includes(item)
    ? list.filter((value) => value !== item)
    : [...list, item];
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <YStack gap="$2.5">
      <SizableText size="$bodyMdMedium" color="$textSubdued">
        {title}
      </SizableText>
      <XStack gap="$2" flexWrap="wrap">
        {children}
      </XStack>
    </YStack>
  );
}

// Several can be on at once, so each selected one carries a check
function checkIcon(on: boolean) {
  return on ? <Icon name="CheckLargeOutline" size="$4" color="$icon" /> : null;
}

function PoolsFilterPanel({
  value,
  onChange,
  showCategory,
  sort,
  onSortChange,
  resultCount,
  optionCounts,
  isSheet,
}: {
  value: IPoolsFilter;
  onChange: (filter: IPoolsFilter) => void;
  showCategory: boolean;
  sort?: IPoolsListSort;
  onSortChange?: (sort: IPoolsListSort) => void;
  resultCount?: number;
  optionCounts?: IPoolsOptionCounts;
  isSheet: boolean;
}) {
  const { closePopover } = usePopoverContext();
  const count = countPanelFilters(value, { withCategory: showCategory });
  const clear = () => onChange({ ...EMPTY_POOLS_FILTER });
  return (
    <YStack gap="$5" px="$5" pt={isSheet ? undefined : '$5'} pb="$5">
      {/* The sheet brings its own title and close button */}
      {isSheet ? null : (
        <XStack ai="center" jc="space-between" minHeight="$8">
          <SizableText size="$headingMd">{POOLS_COPY.filters}</SizableText>
          {count ? (
            <Button
              testID="earn-pools-filter-clear"
              size="small"
              variant="tertiary"
              onPress={clear}
            >
              {POOLS_COPY.clearFilters}
            </Button>
          ) : null}
        </XStack>
      )}
      {sort && onSortChange ? (
        <FilterGroup title={POOLS_COPY.sortBy}>
          {SORT_OPTIONS.map((option) => {
            const active = sort.key === option.key;
            return (
              <PoolsChip
                key={option.key}
                testID={`earn-pools-sort-${option.key}`}
                label={option.label}
                large={isSheet}
                active={active}
                icon={
                  active ? (
                    <Icon
                      name={
                        sort.direction === 'desc'
                          ? 'ArrowBottomOutline'
                          : 'ArrowTopOutline'
                      }
                      size="$4"
                      color="$icon"
                    />
                  ) : undefined
                }
                // High to low first; the chosen one again turns it around
                onPress={() =>
                  onSortChange({
                    key: option.key,
                    direction:
                      active && sort.direction === 'desc' ? 'asc' : 'desc',
                  })
                }
              />
            );
          })}
        </FilterGroup>
      ) : null}
      {showCategory ? (
        <FilterGroup title={POOLS_COPY.type}>
          <PoolsChip
            testID="earn-pools-filter-category-all"
            label={POOLS_COPY.allPools}
            large={isSheet}
            active={!value.category}
            onPress={() => onChange({ ...value, category: undefined })}
          />
          {POOL_CATEGORIES.map((category) => {
            const on = value.category === category;
            return (
              <PoolsChip
                key={category}
                testID={`earn-pools-filter-category-${category}`}
                label={POOLS_CATEGORY_LABELS[category]}
                large={isSheet}
                active={on}
                disabled={!on && optionCounts?.category[category] === 0}
                onPress={() => onChange({ ...value, category })}
              />
            );
          })}
        </FilterGroup>
      ) : null}
      <FilterGroup title={POOLS_COPY.protocol}>
        {POOL_PROTOCOL_OPTIONS.map((option) => {
          const on = value.protocols.includes(option.key);
          return (
            <PoolsChip
              key={option.key}
              testID={`earn-pools-filter-protocol-${option.key}`}
              label={getPoolProtocolLabel(option)}
              large={isSheet}
              active={on}
              disabled={!on && optionCounts?.protocols[option.key] === 0}
              // The check takes the logo's place, so the chip keeps its width
              icon={
                checkIcon(on) ?? (
                  <Token
                    size="xxs"
                    tokenImageUri={UNISWAP_PROTOCOL.logoURI}
                    borderRadius="$full"
                  />
                )
              }
              onPress={() =>
                onChange({
                  ...value,
                  protocols: toggle(value.protocols, option.key),
                })
              }
            />
          );
        })}
      </FilterGroup>
      <FilterGroup title={POOLS_COPY.feeTier}>
        {POOL_FEE_OPTIONS.map((option) => {
          const on = value.feeTiers.includes(option);
          return (
            <PoolsChip
              key={option}
              testID={`earn-pools-filter-fee-${option}`}
              label={feeOptionLabel(option)}
              large={isSheet}
              active={on}
              disabled={!on && optionCounts?.feeTiers[String(option)] === 0}
              icon={checkIcon(on)}
              onPress={() =>
                onChange({
                  ...value,
                  feeTiers: toggle(value.feeTiers, option),
                })
              }
            />
          );
        })}
      </FilterGroup>
      {/* The sheet covers the list, so its button says what is behind it */}
      {isSheet ? (
        <XStack gap="$3" pt="$1">
          <Button
            testID="earn-pools-filter-clear"
            flex={1}
            size="large"
            variant="secondary"
            disabled={!count}
            onPress={clear}
          >
            {POOLS_COPY.clearFilters}
          </Button>
          <Button
            testID="earn-pools-filter-show"
            flex={2}
            size="large"
            variant="primary"
            disabled={!resultCount}
            onPress={() => void closePopover?.()}
          >
            {resultCount
              ? POOLS_COPY.showPools(resultCount)
              : POOLS_COPY.noPools}
          </Button>
        </XStack>
      ) : null}
    </YStack>
  );
}

/**
 * Protocol and fee tier behind one button; phones add the types and the
 * sort. Every tap applies at once: under the button on wide screens, in a
 * sheet on phones.
 */
export function PoolsFilterButton({
  value,
  onChange,
  showCategory = false,
  sort,
  onSortChange,
  resultCount,
  optionCounts,
  iconOnly = false,
  testID,
}: {
  value: IPoolsFilter;
  onChange: (filter: IPoolsFilter) => void;
  /** The types, where the row has no room for them */
  showCategory?: boolean;
  /** The list's sort, where the row has no room for it */
  sort?: IPoolsListSort;
  onSortChange?: (sort: IPoolsListSort) => void;
  /** Pools the list shows now, for the sheet's button */
  resultCount?: number;
  /** Pools each option would leave; options at zero are greyed out */
  optionCounts?: IPoolsOptionCounts;
  /** A round icon, for a row with no room for the word */
  iconOnly?: boolean;
  testID?: string;
}) {
  const { gtMd } = useMedia();
  const isSheet = platformEnv.isNative || !gtMd;
  const count = countPanelFilters(value, { withCategory: showCategory });
  const badge = count ? (
    <Stack
      minWidth={18}
      height={18}
      px="$1"
      borderRadius="$full"
      bg="$bgInverse"
      ai="center"
      jc="center"
    >
      <SizableText size="$bodySmMedium" color="$textInverse">
        {count}
      </SizableText>
    </Stack>
  ) : null;

  return (
    <Popover
      title={POOLS_COPY.filters}
      // The count widens the button leftward; its right edge stays put, so
      // the panel does not move under the pointer while you tap
      placement="bottom-end"
      floatingPanelProps={{ w: 340 }}
      renderTrigger={
        iconOnly ? (
          // eslint-disable-next-line props-checker/validator -- Popover's trigger wrapper handles the press
          <Stack
            testID={testID}
            role="button"
            aria-label={POOLS_COPY.filters}
            w={36}
            h={36}
            ai="center"
            jc="center"
            borderRadius="$full"
            bg={count ? '$bgActive' : '$bgStrong'}
            cursor="pointer"
            userSelect="none"
            hoverStyle={{ opacity: 0.8 }}
            pressStyle={{ opacity: 0.7 }}
          >
            <Icon
              name="SliderHorOutline"
              size="$5"
              color={count ? '$icon' : '$iconSubdued'}
            />
            {badge ? (
              <Stack position="absolute" top={-4} right={-4}>
                {badge}
              </Stack>
            ) : null}
          </Stack>
        ) : (
          // eslint-disable-next-line props-checker/validator -- Popover's trigger wrapper handles the press
          <XStack
            testID={testID}
            role="button"
            ai="center"
            gap="$1.5"
            px="$3"
            py="$1.5"
            borderRadius="$full"
            bg={count ? '$bgActive' : '$bgStrong'}
            cursor="pointer"
            userSelect="none"
            hoverStyle={{ opacity: 0.8 }}
            pressStyle={{ opacity: 0.7 }}
          >
            <Icon
              name="SliderHorOutline"
              size="$4"
              color={count ? '$icon' : '$iconSubdued'}
            />
            <SizableText size="$bodyMdMedium">{POOLS_COPY.filters}</SizableText>
            {badge}
          </XStack>
        )
      }
      renderContent={
        <PoolsFilterPanel
          value={value}
          onChange={onChange}
          showCategory={showCategory}
          sort={sort}
          onSortChange={onSortChange}
          resultCount={resultCount}
          optionCounts={optionCounts}
          isSheet={isSheet}
        />
      }
    />
  );
}
