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
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { POOLS_COPY } from '../poolsCopy';
import {
  EMPTY_POOLS_FILTER,
  POOL_FEE_TIERS,
  POOL_VERSIONS,
  countPanelFilters,
} from '../poolsFilter';
import { formatFeeTier } from '../poolsFormat';

import type {
  IPoolsCategory,
  IPoolsFilter,
  IPoolsSortKey,
} from '../poolsFilter';

export function PoolsChip({
  label,
  active,
  onPress,
  testID,
  icon,
  large = false,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
  /** Shown before the label, e.g. a network avatar */
  icon?: ReactNode;
  /** Touch size, for sheets */
  large?: boolean;
}) {
  return (
    <XStack
      testID={testID}
      role="button"
      ai="center"
      gap="$1.5"
      px={large ? '$3.5' : '$3'}
      py={large ? '$2' : '$1'}
      borderRadius="$full"
      bg={active ? '$bgStrong' : '$bgSubdued'}
      cursor="pointer"
      userSelect="none"
      hoverStyle={{ bg: active ? '$bgStrong' : '$bgHover' }}
      pressStyle={{ opacity: 0.7 }}
      onPress={onPress}
    >
      {icon}
      <SizableText
        size="$bodyMdMedium"
        color={active ? '$text' : '$textSubdued'}
      >
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

const CATEGORY_OPTIONS: { value?: IPoolsCategory; label: string }[] = [
  { label: POOLS_COPY.allPools },
  { value: 'rwa', label: POOLS_COPY.rwa },
  { value: 'stablecoins', label: POOLS_COPY.stablecoins },
];

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
  isSheet,
}: {
  value: IPoolsFilter;
  onChange: (filter: IPoolsFilter) => void;
  showCategory: boolean;
  sort?: IPoolsListSort;
  onSortChange?: (sort: IPoolsListSort) => void;
  resultCount?: number;
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
        <FilterGroup title={POOLS_COPY.assetType}>
          {CATEGORY_OPTIONS.map((option) => (
            <PoolsChip
              key={option.value ?? 'all'}
              testID={`earn-pools-filter-category-${option.value ?? 'all'}`}
              label={option.label}
              large={isSheet}
              active={value.category === option.value}
              onPress={() => onChange({ ...value, category: option.value })}
            />
          ))}
        </FilterGroup>
      ) : null}
      <FilterGroup title={POOLS_COPY.version}>
        {POOL_VERSIONS.map((version) => {
          const on = value.versions.includes(version);
          return (
            <PoolsChip
              key={version}
              testID={`earn-pools-filter-version-${version}`}
              label={version.toUpperCase()}
              large={isSheet}
              active={on}
              icon={checkIcon(on)}
              onPress={() =>
                onChange({
                  ...value,
                  versions: toggle(value.versions, version),
                })
              }
            />
          );
        })}
      </FilterGroup>
      <FilterGroup title={POOLS_COPY.feeTier}>
        {POOL_FEE_TIERS.map((feeTier) => {
          const on = value.feeTiers.includes(feeTier);
          return (
            <PoolsChip
              key={feeTier}
              testID={`earn-pools-filter-fee-${feeTier}`}
              label={formatFeeTier(feeTier)}
              large={isSheet}
              active={on}
              icon={checkIcon(on)}
              onPress={() =>
                onChange({
                  ...value,
                  feeTiers: toggle(value.feeTiers, feeTier),
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
 * Version and fee tier behind one button; phones add the asset types and
 * the sort. Every tap applies at once: under the button on wide screens,
 * in a sheet on phones.
 */
export function PoolsFilterButton({
  value,
  onChange,
  showCategory = false,
  sort,
  onSortChange,
  resultCount,
  iconOnly = false,
  testID,
}: {
  value: IPoolsFilter;
  onChange: (filter: IPoolsFilter) => void;
  /** RWA and Stablecoins, where the row has no room for them */
  showCategory?: boolean;
  /** The list's sort, where the row has no room for it */
  sort?: IPoolsListSort;
  onSortChange?: (sort: IPoolsListSort) => void;
  /** Pools the list shows now, for the sheet's button */
  resultCount?: number;
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
          isSheet={isSheet}
        />
      }
    />
  );
}
