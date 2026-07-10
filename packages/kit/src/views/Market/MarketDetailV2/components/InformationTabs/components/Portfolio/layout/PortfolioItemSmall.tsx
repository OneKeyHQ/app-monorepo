import { memo } from 'react';

import { NumberSizeableText, XStack, YStack } from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import type { IMarketAccountPortfolioItem } from '@onekeyhq/shared/types/marketV2';

import { PnlCell } from '../components/PnlCell';

interface IPortfolioItemSmallProps {
  item: IMarketAccountPortfolioItem;
}

function PortfolioItemSmallBase({ item }: IPortfolioItemSmallProps) {
  const pnl = item.pnl;
  const isPnlSupported = pnl?.isPnlSupported ?? false;

  return (
    <XStack mx="$2" px="$3" py="$2.5" borderRadius="$3" alignItems="center">
      <YStack w={100} minWidth={0} alignItems="flex-start">
        <Currency
          size="$bodySm"
          color="$text"
          autoFormatter="price-marketCap"
          autoFormatterThreshold={1000}
          sourceCurrency={USD_CURRENCY_ID}
        >
          {item.totalPrice}
        </Currency>
        <NumberSizeableText
          size="$bodySm"
          color="$textSubdued"
          autoFormatter="price-marketCap"
          autoFormatterThreshold={1000}
        >
          {item.amount}
        </NumberSizeableText>
      </YStack>

      <PnlCell
        usdValue={pnl?.unrealizedPnlUsd ?? '0'}
        percent={pnl?.unrealizedPnlPercent ?? '0'}
        isSupported={isPnlSupported}
        flex={1}
      />

      <PnlCell
        usdValue={pnl?.totalPnlUsd ?? '0'}
        percent={pnl?.totalPnlPercent ?? '0'}
        isSupported={isPnlSupported}
        columnWidth={110}
      />
    </XStack>
  );
}

const PortfolioItemSmall = memo(PortfolioItemSmallBase);

export { PortfolioItemSmall };
