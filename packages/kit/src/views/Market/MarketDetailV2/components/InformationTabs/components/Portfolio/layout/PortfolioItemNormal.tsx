import { memo } from 'react';

import { NumberSizeableText, XStack } from '@onekeyhq/components';
import type { IMarketAccountPortfolioItem } from '@onekeyhq/shared/types/marketV2';

interface IPortfolioItemNormalProps {
  item: IMarketAccountPortfolioItem;
  index: number;
}

function PortfolioItemNormalBase({ item, index }: IPortfolioItemNormalProps) {
  return (
    <XStack
      h={40}
      pl="$5"
      pr="$3"
      alignItems="center"
      cursor="default"
      {...(index % 2 === 1 && { backgroundColor: '$bgSubdued' })}
      hoverStyle={{ backgroundColor: '$bgHover' }}
    >
      {/* Amount */}
      <NumberSizeableText
        size="$bodyMd"
        color="$text"
        autoFormatter="price-marketCap"
        autoFormatterThreshold={1000}
        width="50%"
      >
        {item.amount}
      </NumberSizeableText>

      {/* Total Value */}
      <NumberSizeableText
        size="$bodyMd"
        color="$text"
        autoFormatter="price-marketCap"
        autoFormatterThreshold={1000}
        formatterOptions={{
          currency: '$',
        }}
      >
        {item.totalPrice}
      </NumberSizeableText>
    </XStack>
  );
}

const PortfolioItemNormal = memo(PortfolioItemNormalBase);

export { PortfolioItemNormal };
