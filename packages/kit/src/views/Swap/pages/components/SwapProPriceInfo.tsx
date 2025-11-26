import { useMemo } from 'react';

import { SizableText, YStack } from '@onekeyhq/components';
import { useSwapProTokenMarketDetailInfoAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

const SwapProPriceInfo = () => {
  const [tokenMarketDetailInfo] = useSwapProTokenMarketDetailInfoAtom();
  const [settings] = useSettingsPersistAtom();
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
    const priceChange = Number(
      tokenMarketDetailInfo?.priceChange24hPercent ?? '0',
    );
    // todo 切换 24 小时
    const formattedPriceChangeValue = numberFormat(priceChange.toString(), {
      formatter: 'priceChange',
      formatterOptions: {
        showPlusMinusSigns: true,
      },
    });
    const textColorValue = priceChange > 0 ? '$textSuccess' : '$textCritical';
    return {
      formattedPrice: formattedPriceValue,
      formattedPriceChange: formattedPriceChangeValue,
      textColor: textColorValue,
    };
  }, [
    settings?.currencyInfo.symbol,
    tokenMarketDetailInfo?.price,
    tokenMarketDetailInfo?.priceChange24hPercent,
  ]);
  return (
    <YStack gap="$1">
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
