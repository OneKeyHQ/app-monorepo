import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';

import {
  Dialog,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { POOLS_COPY } from '../poolsCopy';
import {
  EMPTY_POOLS_FILTER,
  POOL_FEE_TIERS,
  POOL_VERSIONS,
  countExtraFilters,
} from '../poolsFilter';
import { formatFeeTier } from '../poolsFormat';

import type { IPoolsFilter } from '../poolsFilter';

export function PoolsChip({
  label,
  active,
  onPress,
  testID,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
  /** Shown before the label, e.g. a network avatar */
  icon?: ReactNode;
}) {
  return (
    <XStack
      testID={testID}
      role="button"
      ai="center"
      gap="$1.5"
      px="$3"
      py="$1"
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

function PoolsFilterContent({
  value,
  showCategory,
  onApply,
}: {
  value: IPoolsFilter;
  showCategory: boolean;
  onApply: (filter: IPoolsFilter) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <YStack gap="$5">
      {showCategory ? (
        <FilterGroup title={POOLS_COPY.assetType}>
          <PoolsChip
            label={POOLS_COPY.allPools}
            active={!draft.category}
            onPress={() => setDraft({ ...draft, category: undefined })}
          />
          <PoolsChip
            label={POOLS_COPY.rwa}
            active={draft.category === 'rwa'}
            onPress={() => setDraft({ ...draft, category: 'rwa' })}
          />
          <PoolsChip
            label={POOLS_COPY.stablecoins}
            active={draft.category === 'stablecoins'}
            onPress={() => setDraft({ ...draft, category: 'stablecoins' })}
          />
        </FilterGroup>
      ) : null}
      <FilterGroup title={POOLS_COPY.version}>
        {POOL_VERSIONS.map((version) => (
          <PoolsChip
            key={version}
            label={version.toUpperCase()}
            active={draft.versions.includes(version)}
            onPress={() =>
              setDraft({ ...draft, versions: toggle(draft.versions, version) })
            }
          />
        ))}
      </FilterGroup>
      <FilterGroup title={POOLS_COPY.feeTier}>
        {POOL_FEE_TIERS.map((feeTier) => (
          <PoolsChip
            key={feeTier}
            label={formatFeeTier(feeTier)}
            active={draft.feeTiers.includes(feeTier)}
            onPress={() =>
              setDraft({ ...draft, feeTiers: toggle(draft.feeTiers, feeTier) })
            }
          />
        ))}
      </FilterGroup>
      <Dialog.Footer
        showCancelButton
        onCancelText={POOLS_COPY.clearFilters}
        onCancel={() => onApply(EMPTY_POOLS_FILTER)}
        onConfirmText={POOLS_COPY.apply}
        onConfirm={() => onApply(draft)}
      />
    </YStack>
  );
}

/** Version and fee tier (and category on desktop) behind one button */
export function PoolsFilterButton({
  value,
  onChange,
  showCategory = false,
  testID,
}: {
  value: IPoolsFilter;
  onChange: (filter: IPoolsFilter) => void;
  showCategory?: boolean;
  testID?: string;
}) {
  const count =
    countExtraFilters(value) + (showCategory && value.category ? 1 : 0);
  const open = useCallback(() => {
    Dialog.show({
      title: POOLS_COPY.filters,
      showFooter: false,
      renderContent: (
        <PoolsFilterContent
          value={value}
          showCategory={showCategory}
          onApply={onChange}
        />
      ),
    });
  }, [onChange, showCategory, value]);

  return (
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
      onPress={open}
    >
      <Icon name="SliderHorOutline" size="$4" color="$iconSubdued" />
      <SizableText size="$bodyMdMedium">
        {count ? `${POOLS_COPY.filters} ${count}` : POOLS_COPY.filters}
      </SizableText>
    </XStack>
  );
}
