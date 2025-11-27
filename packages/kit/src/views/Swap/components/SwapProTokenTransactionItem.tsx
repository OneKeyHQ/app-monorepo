import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { SizableText, XStack } from '@onekeyhq/components';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import { useCurrency } from '../../../components/Currency';

interface ISwapProTokenTransactionItemProps {
  item: IMarketTokenTransaction;
}

const SwapProTokenTransactionItem = ({
  item,
}: ISwapProTokenTransactionItemProps) => {
  const currencyInfo = useCurrency();
  const { formatPrice, formatTokenValue, textColor } = useMemo(() => {
    const tokenPrice = item.type === 'buy' ? item.to.price : item.from.price;
    const formatPriceValue = numberFormat(tokenPrice, {
      formatter: 'price',
      formatterOptions: {
        currency: currencyInfo.symbol,
      },
    });
    const tokenAmount = item.type === 'buy' ? item.to.amount : item.from.amount;
    const tokenValue = new BigNumber(tokenAmount)
      .multipliedBy(tokenPrice)
      .toFixed();
    const formatTokenValueValue = numberFormat(tokenValue, {
      formatter: 'value',
      formatterOptions: {
        currency: currencyInfo.symbol,
      },
    });
    const textColorValue =
      item.type === 'buy' ? '$textSuccess' : '$textCritical';
    return {
      formatPrice: formatPriceValue,
      formatTokenValue: formatTokenValueValue,
      textColor: textColorValue,
    };
  }, [
    currencyInfo.symbol,
    item.from.amount,
    item.from.price,
    item.to.amount,
    item.to.price,
    item.type,
  ]);
  return (
    <XStack alignItems="center" justifyContent="space-between">
      <SizableText size="$bodySm" color={textColor}>
        {formatPrice}
      </SizableText>
      <SizableText size="$bodySm" color={textColor}>
        {formatTokenValue}
      </SizableText>
    </XStack>
  );
};

export default SwapProTokenTransactionItem;
