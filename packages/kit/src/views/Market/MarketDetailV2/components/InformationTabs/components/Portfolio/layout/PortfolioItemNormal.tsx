import { memo } from 'react';

import { NumberSizeableText, SizableText, XStack } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IMarketAccountPortfolioItem } from '@onekeyhq/shared/types/marketV2';

interface IPortfolioItemNormalProps {
  item: IMarketAccountPortfolioItem;
  index: number;
}

function PortfolioItemNormalBase({ item }: IPortfolioItemNormalProps) {
  const [settingsPersistAtom] = useSettingsPersistAtom();

  return (
    <XStack h={40} px="$4" alignItems="center" justifyContent="space-between">
      {/* Amount */}
      <NumberSizeableText
        size="$bodyMd"
        color="$text"
        flex={1}
        formatter="balance"
      >
        {item.amount}
      </NumberSizeableText>

      {/* Total Value */}
      <NumberSizeableText
        size="$bodyMd"
        color="$text"
        flex={1}
        textAlign="right"
        formatter="value"
        formatterOptions={{
          currency: settingsPersistAtom.currencyInfo.symbol,
        }}
      >
        {item.totalPrice}
      </NumberSizeableText>
    </XStack>
  );
}

const PortfolioItemNormal = memo(PortfolioItemNormalBase);

export { PortfolioItemNormal };
