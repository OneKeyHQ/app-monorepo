import { XStack, useMedia } from '@onekeyhq/components';
import { BaseMarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketAccountPortfolioDisplayItem } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { StockTokenInfoPopover } from '../../components/StockTokenInfo/StockTokenInfoPopover';
import { StockTokenVariantSelector } from '../../components/TokenSelector/StockTokenVariantSelector';

export function MarketStockTradeTarget({
  token,
  portfolioData,
  resolvedVariantKeys,
}: {
  token: ISwapToken;
  portfolioData?: IMarketAccountPortfolioDisplayItem[];
  resolvedVariantKeys?: string[];
}) {
  const { gtLg } = useMedia();
  const showPrice = platformEnv.isNative || !gtLg;
  const priceLabel = (
    <BaseMarketTokenPrice
      price={token.price || '--'}
      tokenName={token.name || ''}
      tokenSymbol={token.symbol || ''}
      currency="$"
      size="$bodyLgMedium"
    />
  );
  return (
    <XStack
      testID="stock-trade-target"
      height={44}
      pl="$1"
      alignItems="center"
      justifyContent="space-between"
      gap="$2"
    >
      <StockTokenVariantSelector
        portfolioData={portfolioData}
        resolvedVariantKeys={resolvedVariantKeys}
      />
      {showPrice &&
        (gtLg ? priceLabel : <StockTokenInfoPopover label={priceLabel} />)}
    </XStack>
  );
}
