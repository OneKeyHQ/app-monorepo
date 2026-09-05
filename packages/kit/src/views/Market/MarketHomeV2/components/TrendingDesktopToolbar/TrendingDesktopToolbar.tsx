import { memo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { MARKET_LIST_TOOLBAR_ITEM_HEIGHT } from '../../../marketDesktopLayoutConstants';
import { TIME_RANGE_OPTIONS } from '../TimeRangeSelector';

import type { IMarketTimeRangeValue } from '../../types';

function TrendingDesktopToolbarImpl({
  timeRange,
  onTimeRangeChange,
}: {
  timeRange: IMarketTimeRangeValue;
  onTimeRangeChange: (value: IMarketTimeRangeValue) => void;
}) {
  const intl = useIntl();
  const filterChips = [
    {
      icon: 'ChartColumnarOutline' as const,
      label: intl.formatMessage({
        id: ETranslations.market_filter_chip_top_turnover,
      }),
    },
    {
      icon: 'CoinsOutline' as const,
      label: intl.formatMessage({
        id: ETranslations.market_filter_chip_mid_cap,
      }),
    },
    {
      icon: 'RadarOutline' as const,
      label: intl.formatMessage({
        id: ETranslations.market_filter_chip_large_cap,
      }),
    },
  ];

  return (
    <XStack
      width="100%"
      height={MARKET_LIST_TOOLBAR_ITEM_HEIGHT}
      alignItems="center"
      justifyContent="space-between"
      testID="market-trending-desktop-toolbar"
    >
      <XStack alignItems="center" gap="$1">
        {TIME_RANGE_OPTIONS.map((option) => {
          const selected = option.value === timeRange;
          return (
            <Stack
              key={option.value}
              minWidth={44}
              px="$2.5"
              py="$1.5"
              borderRadius="$3"
              bg={selected ? '$bgStrong' : '$transparent'}
              hoverStyle={selected ? undefined : { bg: '$bgHover' }}
              pressStyle={{ bg: '$bgActive' }}
              cursor="pointer"
              alignItems="center"
              onPress={() => onTimeRangeChange(option.value)}
              testID={`market-trending-time-${option.value}`}
            >
              <SizableText
                size="$bodyMdMedium"
                color={selected ? '$text' : '$textSubdued'}
              >
                {option.label}
              </SizableText>
            </Stack>
          );
        })}

        <Stack width={1} height={20} bg="$borderSubdued" mx="$2" />

        {filterChips.map((chip) => (
          <XStack key={chip.label} alignItems="center" gap="$2" px="$2.5">
            <Icon name={chip.icon} size="$5" color="$iconSubdued" />
            <SizableText size="$bodyMd" color="$textSubdued">
              {chip.label}
            </SizableText>
          </XStack>
        ))}
      </XStack>

      <XStack alignItems="center" gap="$2" px="$2.5">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.market_filters })}
        </SizableText>
        <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
      </XStack>
    </XStack>
  );
}

export const TrendingDesktopToolbar = memo(TrendingDesktopToolbarImpl);
