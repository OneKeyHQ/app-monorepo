import { XStack } from '@onekeyhq/components';
import { BaseMarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
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
      <StockTokenInfoPopover
        label={
          <BaseMarketTokenPrice
            price={token.price || '--'}
            tokenName={token.name || ''}
            tokenSymbol={token.symbol || ''}
            currency="$"
            size="$bodyLgMedium"
          />
        }
      />
    </XStack>
  );
}
