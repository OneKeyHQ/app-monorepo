import { useMemo } from 'react';

import { SizableText, YStack } from '@onekeyhq/components';
import {
  useSwapProTimeRangeAtom,
  useSwapProTokenMarketDetailInfoAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { ESwapProTimeRange } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

const SwapProPriceInfo = () => {
  const [tokenMarketDetailInfo] = useSwapProTokenMarketDetailInfoAtom();
  const [swapProTimeRange] = useSwapProTimeRangeAtom();
  const [settings] = useSettingsPersistAtom();
  const priceChange = useMemo(() => {
    switch (swapProTimeRange.value) {
      case ESwapProTimeRange.ONE_HOUR:
        return tokenMarketDetailInfo?.priceChange1hPercent ?? '0';
      case ESwapProTimeRange.FOUR_HOURS:
        return tokenMarketDetailInfo?.priceChange4hPercent ?? '0';
      case ESwapProTimeRange.EIGHT_HOURS:
        return tokenMarketDetailInfo?.priceChange8hPercent ?? '0';
      case ESwapProTimeRange.TWENTY_FOUR_HOURS:
        return tokenMarketDetailInfo?.priceChange24hPercent ?? '0';
      default:
        return '0';
    }
  }, [swapProTimeRange.value, tokenMarketDetailInfo]);
  const { formattedPrice, formattedPriceChange, textColor } = useMemo(() => {
    const formattedPriceValue = numberFormat(
      tokenMarketDetailInfo?.price ?? '0',
      {
        formatter: 'price',
        formatterOptions: {
          currency: settings?.currencyInfo.symbol,
        },
      },
    );
    const priceChangeValue = Number(priceChange);
    const formattedPriceChangeValue = numberFormat(priceChange, {
      formatter: 'priceChange',
      formatterOptions: {
        showPlusMinusSigns: true,
      },
    });
    let textColorValue = '$text';
    if (priceChangeValue > 0) {
      textColorValue = '$textSuccess';
    } else if (priceChangeValue < 0) {
      textColorValue = '$textCritical';
    }
    return {
      formattedPrice: formattedPriceValue,
      formattedPriceChange: formattedPriceChangeValue,
      textColor: textColorValue,
    };
  }, [
    priceChange,
    settings?.currencyInfo.symbol,
    tokenMarketDetailInfo?.price,
  ]);
  return (
    <YStack gap="$1.5" mt="$1.5" mb="$1">
      <SizableText size="$headingLg" color={textColor}>
        {formattedPrice}
      </SizableText>
      <SizableText size="$bodySmMedium" color={textColor}>
        {formattedPriceChange}
      </SizableText>
    </YStack>
  );
};
export default SwapProPriceInfo;
