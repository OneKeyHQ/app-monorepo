import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Select, SizableText, XStack } from '@onekeyhq/components';

import {
  formatPriceMarketCapOptionLabel,
  isPriceMarketCapMode,
} from '../utils/NativeChartControlsShared';

import type { ITradingViewNativeChartControlsConfigData } from '../../types';

type IPriceMarketCapConfig = NonNullable<
  ITradingViewNativeChartControlsConfigData['priceMarketCap']
>;

export function PriceMarketCapSelect({
  priceMarketCap,
  onPriceMarketCapModeChange,
}: {
  priceMarketCap: IPriceMarketCapConfig;
  onPriceMarketCapModeChange: (
    mode: IPriceMarketCapConfig['activeMode'],
  ) => void;
}) {
  const intl = useIntl();
  const items = useMemo(
    () =>
      priceMarketCap.options.map((option) => ({
        label: formatPriceMarketCapOptionLabel(intl, option),
        value: option.value,
      })),
    [intl, priceMarketCap.options],
  );
  const value = priceMarketCap.activeMode ?? priceMarketCap.options[0]?.value;
  const selectedLabel =
    items.find((item) => item.value === value)?.label ?? priceMarketCap.label;

  return (
    <Select
      testID="trading-view-native-price-market-cap-select"
      title={priceMarketCap.label}
      items={items}
      value={value}
      onChange={(mode) => {
        if (isPriceMarketCapMode(mode, priceMarketCap.options)) {
          onPriceMarketCapModeChange(mode);
        }
      }}
      placement="bottom-end"
      floatingPanelProps={{
        width: 220,
      }}
      renderTrigger={({ onPress, disabled }) => (
        <XStack
          testID="trading-view-native-price-market-cap-select-trigger"
          h={30}
          px="$3"
          gap="$1.5"
          alignItems="center"
          borderRadius="$full"
          borderCurve="continuous"
          bg="$transparent"
          opacity={disabled ? 0.5 : 1}
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          cursor={disabled ? 'not-allowed' : 'pointer'}
          userSelect="none"
          onPress={onPress}
        >
          <SizableText
            size="$bodyMdMedium"
            color="$textSubdued"
            numberOfLines={1}
          >
            {selectedLabel}
          </SizableText>
          <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
        </XStack>
      )}
    />
  );
}
