import { useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, Icon, SizableText, XStack } from '@onekeyhq/components';
import type { IActionListItemProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export type IEarnSortDirection = 'asc' | 'desc';

export type IEarnSortOption = {
  label: string;
  value: string;
};

type IEarnMobileSortControlProps = {
  sortKey: string;
  sortDirection: IEarnSortDirection;
  options: IEarnSortOption[];
  onSortChange: (key: string, direction: IEarnSortDirection) => void;
};

export function EarnMobileSortControl({
  sortKey,
  sortDirection,
  options,
  onSortChange,
}: IEarnMobileSortControlProps) {
  const intl = useIntl();

  const selectedOption = useMemo(
    () => options.find((option) => option.value === sortKey) ?? options[0],
    [options, sortKey],
  );

  const handleSelect = useCallback(
    (value: string) => {
      onSortChange(value, 'desc');
    },
    [onSortChange],
  );

  useEffect(() => {
    if (selectedOption && sortDirection !== 'desc') {
      onSortChange(selectedOption.value, 'desc');
    }
  }, [onSortChange, selectedOption, sortDirection]);

  const handlePress = useCallback(() => {
    ActionList.show({
      title: intl.formatMessage({ id: ETranslations.market_sort_by }),
      items: options.map<IActionListItemProps>((option) => ({
        label: option.label,
        extra:
          option.value === sortKey ? (
            <Icon name="CheckRadioSolid" size="$5" color="$icon" />
          ) : undefined,
        onPress: () => handleSelect(option.value),
      })),
    });
  }, [handleSelect, intl, options, sortKey]);

  if (!options.length || !selectedOption) {
    return null;
  }

  return (
    <XStack px="$pagePadding">
      <XStack
        ai="center"
        gap="$2"
        py="$1"
        userSelect="none"
        hoverStyle={{ opacity: 0.7 }}
        pressStyle={{ opacity: 0.5 }}
        onPress={handlePress}
      >
        <Icon name="FilterSortOutline" size="$4.5" color="$iconSubdued" />
        <SizableText size="$bodyMd" color="$textSubdued">
          {selectedOption.label}
        </SizableText>
        <Icon name="ChevronDownSmallOutline" size="$4.5" color="$iconSubdued" />
      </XStack>
    </XStack>
  );
}
