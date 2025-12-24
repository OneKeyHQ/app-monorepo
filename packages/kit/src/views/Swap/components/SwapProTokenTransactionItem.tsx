import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { SizableText, XStack } from '@onekeyhq/components';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import { useCurrency } from '../../../components/Currency';

interface ISwapProTokenTransactionItemProps {
  item: IMarketTokenTransaction;
}

const FALLBACK_DISPLAY = '-';

const isValidNumericValue = (value: unknown): boolean => {
  if (value === null || value === undefined || value === '') {
    return false;
  }
  const num = Number(value);
  return Number.isFinite(num);
};

const SwapProTokenTransactionItem = ({
  item,
}: ISwapProTokenTransactionItemProps) => {
  const currencyInfo = useCurrency();
  const { formatPrice, formatTokenValue, textColor } = useMemo(() => {
    const rawTokenPrice = item.type === 'buy' ? item.to.price : item.from.price;
    const rawTokenAmount =
      item.type === 'buy' ? item.to.amount : item.from.amount;

    const isPriceValid = isValidNumericValue(rawTokenPrice);
    const isAmountValid = isValidNumericValue(rawTokenAmount);

    let formatPriceValue = FALLBACK_DISPLAY;
    if (isPriceValid) {
      formatPriceValue = numberFormat(rawTokenPrice, {
        formatter: 'marketCap',
        formatterOptions: {
          currency: currencyInfo.symbol,
        },
      });
    }

    let formatTokenValueValue = FALLBACK_DISPLAY;
    if (isPriceValid && isAmountValid) {
      const tokenValue = new BigNumber(rawTokenAmount)
        .multipliedBy(rawTokenPrice)
        .toFixed();
      formatTokenValueValue = numberFormat(tokenValue, {
        formatter: 'marketCap',
        formatterOptions: {
          currency: currencyInfo.symbol,
        },
      });
    }

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
    <XStack alignItems="center" justifyContent="space-between" py="$1">
      <SizableText size="$bodySm" color={textColor} fontFamily="$monoRegular">
        {formatPrice}
      </SizableText>
      <SizableText size="$bodySm" color={textColor} fontFamily="$monoRegular">
        {formatTokenValue}
      </SizableText>
    </XStack>
  );
};

export default SwapProTokenTransactionItem;
