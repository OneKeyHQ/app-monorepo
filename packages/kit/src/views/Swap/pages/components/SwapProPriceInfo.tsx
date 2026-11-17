import { useMemo } from 'react';

import { NumberSizeableText, SizableText, YStack } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import {
  useSwapProTimeRangeAtom,
  useSwapProTokenMarketDetailInfoAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { ESwapProTimeRange } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import { SwapTestIDs } from '../../testIDs';

import type { ISwapProMarketData } from '../../utils/swapProMarketDataUtils';

interface ISwapProPriceInfoProps {
  marketData: ISwapProMarketData;
  onPricePress: (price: string) => void;
}

const SwapProPriceInfo = ({
  marketData,
  onPricePress,
}: ISwapProPriceInfoProps) => {
  const [tokenMarketDetailInfo] = useSwapProTokenMarketDetailInfoAtom();
  const [swapProTimeRange] = useSwapProTimeRangeAtom();
  const currencyInfo = useCurrency();
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
  const unFormattedPrice = marketData.price || '--';
  const isMarketSource = marketData.source === 'market';

  const { formattedPriceChange, textColor } = useMemo(() => {
    if (!isMarketSource) {
      return {
        formattedPriceChange: '',
        textColor: '$text',
      };
    }
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
  }, [isMarketSource, priceChange]);
  return (
    <YStack
      role="button"
      userSelect="none"
      cursor="pointer"
      onPress={() => {
        if (marketData.price) {
          onPricePress(marketData.price);
        }
      }}
    >
      <NumberSizeableText
        testID={SwapTestIDs.proPrice}
        size="$headingLg"
        color={textColor}
        fontWeight="500"
        formatter="price"
        formatterOptions={{
          currency: '$',
        }}
      >
        {unFormattedPrice}
      </NumberSizeableText>
      {isMarketSource && tokenMarketDetailInfo?.priceConverted ? (
        <NumberSizeableText
          size="$bodySm"
          color="$textSubdued"
          formatter="price"
          formatterOptions={{ currency: currencyInfo.symbol }}
        >
          {tokenMarketDetailInfo.priceConverted}
        </NumberSizeableText>
      ) : null}
      {isMarketSource ? (
        <SizableText size="$bodySmMedium" color={textColor}>
          {formattedPriceChange}
        </SizableText>
      ) : null}
    </YStack>
  );
};
export default SwapProPriceInfo;
