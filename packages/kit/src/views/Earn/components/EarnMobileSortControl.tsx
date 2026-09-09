import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, Icon, SizableText, XStack } from '@onekeyhq/components';
import type { IActionListItemProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export type IEarnSortDirection = 'asc' | 'desc';

export type IEarnSortOption = {
  label: string;
  triggerLabel?: string;
  value: string;
  direction?: IEarnSortDirection;
};

type IEarnMobileSortControlProps = {
  sortKey: string;
  sortDirection: IEarnSortDirection;
  options: IEarnSortOption[];
  onSortChange: (key: string, direction: IEarnSortDirection) => void;
  compact?: boolean;
  testID?: string;
  getOptionTestID?: (option: IEarnSortOption) => string;
};

export function EarnMobileSortControl({
  sortKey,
  sortDirection,
  options,
  onSortChange,
  compact = false,
  testID,
  getOptionTestID,
}: IEarnMobileSortControlProps) {
  const intl = useIntl();

  const selectedOption = useMemo(
    () =>
      options.find(
        (option) =>
          option.value === sortKey &&
          (option.direction ?? sortDirection) === sortDirection,
      ) ??
      options.find((option) => option.value === sortKey) ??
      options[0],
    [options, sortDirection, sortKey],
  );

  const handleSelect = useCallback(
    (option: IEarnSortOption) => {
      onSortChange(option.value, option.direction ?? 'desc');
    },
    [onSortChange],
  );

  const handlePress = useCallback(() => {
    ActionList.show({
      title: intl.formatMessage({ id: ETranslations.market_sort_by }),
      items: options.map<IActionListItemProps>((option) => ({
        testID: getOptionTestID?.(option),
        label: option.label,
        extra:
          option.value === sortKey &&
          (option.direction ?? sortDirection) === sortDirection ? (
            <Icon name="CheckRadioSolid" size="$5" color="$icon" />
          ) : undefined,
        onPress: () => handleSelect(option),
      })),
    });
  }, [getOptionTestID, handleSelect, intl, options, sortDirection, sortKey]);

  if (!options.length || !selectedOption) {
    return null;
  }

  const control = (
    <XStack
      testID={testID}
      role="button"
      ai="center"
      gap={compact ? '$1' : '$2'}
      py={compact ? '$0' : '$1'}
      hitSlop={compact ? 8 : undefined}
      userSelect="none"
      hoverStyle={{ opacity: 0.7 }}
      pressStyle={{ opacity: 0.5 }}
      onPress={handlePress}
    >
      <Icon
        name="FilterSortSolid"
        size={compact ? '$3' : '$4.5'}
        color="$iconSubdued"
        rotate={sortDirection === 'asc' ? '180deg' : '0deg'}
      />
      <SizableText
        size={compact ? '$bodySmMedium' : '$bodyMd'}
        color="$textSubdued"
      >
        {selectedOption.triggerLabel ?? selectedOption.label}
      </SizableText>
      <Icon
        name="ChevronDownSmallOutline"
        size={compact ? '$4' : '$4.5'}
        color="$iconSubdued"
      />
    </XStack>
  );

  return compact ? (
    control
  ) : (
    <XStack px="$pagePadding" pb="$2">
      {control}
    </XStack>
  );
}
