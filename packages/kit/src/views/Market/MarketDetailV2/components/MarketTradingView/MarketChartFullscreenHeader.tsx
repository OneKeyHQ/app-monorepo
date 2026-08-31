import { XStack, YStack } from '@onekeyhq/components';
import { BaseMarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import { PriceChangePercentage } from '@onekeyhq/kit/src/views/Market/components/PriceChangePercentage';

import { MarketTestIDs } from '../../../testIDs';
import { useMarketDetailHeaderDisplayData } from '../../hooks/useMarketDetailDisplayData';
import { MarketTokenSelector } from '../TokenSelector/MarketTokenSelector';

export function MarketChartFullscreenHeader({
  chartMode,
}: {
  chartMode: 'native' | 'tradingView';
}) {
  const { tokenDetail } = useMarketDetailHeaderDisplayData();

  if (!tokenDetail) {
    return null;
  }

  const {
    name = '',
    symbol = '',
    price = '--',
    priceChange24hPercent = '--',
  } = tokenDetail;

  return (
    <XStack
      testID={MarketTestIDs.detailChartFullscreenInfo}
      flexShrink={0}
      alignItems="center"
      gap="$2"
    >
      <MarketTokenSelector chartMode={chartMode} showAddress />

      <YStack flexShrink={0} pointerEvents="none">
        <BaseMarketTokenPrice
          size="$bodyLgMedium"
          price={price}
          tokenName={name}
          tokenSymbol={symbol}
        />
        <PriceChangePercentage size="$headingXs">
          {priceChange24hPercent}
        </PriceChangePercentage>
      </YStack>
    </XStack>
  );
}
