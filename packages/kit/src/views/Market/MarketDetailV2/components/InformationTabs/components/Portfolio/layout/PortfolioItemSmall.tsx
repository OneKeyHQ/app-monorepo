import { memo } from 'react';

import { NumberSizeableText, XStack } from '@onekeyhq/components';
import type { IMarketAccountPortfolioItem } from '@onekeyhq/shared/types/marketV2';

interface IPortfolioItemSmallProps {
  item: IMarketAccountPortfolioItem;
  index: number;
}

function PortfolioItemSmallBase({ item }: IPortfolioItemSmallProps) {
  return (
    <XStack
      px="$5"
      py="$3"
      borderBottomWidth={1}
      borderColor="$borderSubdued"
      alignItems="center"
    >
      {/* Amount */}
      <NumberSizeableText
        size="$bodyMd"
        color="$text"
        autoFormatter="price-marketCap"
        width="50%"
      >
        {item.amount}
      </NumberSizeableText>

      {/* Total Value */}
      <NumberSizeableText
        size="$bodyMd"
        color="$text"
        autoFormatter="price-marketCap"
        formatterOptions={{
          currency: '$',
        }}
      >
        {item.totalPrice}
      </NumberSizeableText>
    </XStack>
  );
}

const PortfolioItemSmall = memo(PortfolioItemSmallBase);

export { PortfolioItemSmall };
