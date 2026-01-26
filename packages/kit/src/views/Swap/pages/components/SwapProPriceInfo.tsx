import { useMemo } from 'react';

import { NumberSizeableText, SizableText, YStack } from '@onekeyhq/components';
import {
  useSwapProSelectTokenAtom,
  useSwapProTimeRangeAtom,
  useSwapProTokenMarketDetailInfoAtom,
  useSwapProTokenTransactionPriceAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { ESwapProTimeRange } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

interface ISwapProPriceInfoProps {
  onPricePress: (price: string) => void;
}

const SwapProPriceInfo = ({ onPricePress }: ISwapProPriceInfoProps) => {
  const [tokenMarketDetailInfo] = useSwapProTokenMarketDetailInfoAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProTokenTransactionPrice] = useSwapProTokenTransactionPriceAtom();
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
  const unFormattedPrice = useMemo(() => {
    if (swapProSelectToken?.isNative) {
      return tokenMarketDetailInfo?.price || '--';
    }
    if (swapProTokenTransactionPrice) {
      return swapProTokenTransactionPrice;
    }
    if (tokenMarketDetailInfo?.price) {
      return tokenMarketDetailInfo?.price;
    }
    return '--';
  }, [
    swapProSelectToken?.isNative,
    swapProTokenTransactionPrice,
    tokenMarketDetailInfo?.price,
  ]);

  const { formattedPriceChange, textColor } = useMemo(() => {
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
      formattedPriceChange: formattedPriceChangeValue,
      textColor: textColorValue,
    };
  }, [priceChange]);
  return (
    <YStack
      role="button"
      userSelect="none"
      cursor="pointer"
      onPress={() => {
        onPricePress(unFormattedPrice);
      }}
    >
      <NumberSizeableText
        size="$headingLg"
        color={textColor}
        fontFamily="$monoMedium"
        formatter="price"
        formatterOptions={{
          currency: settings?.currencyInfo.symbol,
        }}
      >
        {unFormattedPrice}
      </NumberSizeableText>
      <SizableText
        size="$bodySmMedium"
        color={textColor}
        fontFamily="$monoMedium"
      >
        {formattedPriceChange}
      </SizableText>
    </YStack>
  );
};
export default SwapProPriceInfo;
