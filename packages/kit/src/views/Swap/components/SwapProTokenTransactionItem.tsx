import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { NumberSizeableText, SizableText, XStack } from '@onekeyhq/components';
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
  const { formatPrice, formatTokenValue } = useMemo(() => {
    const rawTokenPrice = item.type === 'buy' ? item.to.price : item.from.price;
    const rawTokenAmount =
      item.type === 'buy' ? item.to.amount : item.from.amount;

    const isPriceValid = isValidNumericValue(rawTokenPrice);
    const isAmountValid = isValidNumericValue(rawTokenAmount);
    const textColorValue =
      item.type === 'buy' ? '$textSuccess' : '$textCritical';
    let formatPriceValue = (
      <SizableText
        size="$bodySm"
        color={textColorValue}
        fontFamily="$monoRegular"
      >
        {FALLBACK_DISPLAY};
      </SizableText>
    );
    if (isPriceValid) {
      const isAboveThreshold = new BigNumber(rawTokenPrice).gte(10);
      formatPriceValue = (
        <NumberSizeableText
          size="$bodySm"
          color={textColorValue}
          fontFamily="$monoRegular"
          formatter={isAboveThreshold ? 'marketCap' : 'price'}
          formatterOptions={{
            currency: currencyInfo.symbol,
          }}
        >
          {rawTokenPrice}
        </NumberSizeableText>
      );
    }

    let formatTokenValueValue = (
      <SizableText
        size="$bodySm"
        color={textColorValue}
        fontFamily="$monoRegular"
      >
        {FALLBACK_DISPLAY};
      </SizableText>
    );
    if (isPriceValid && isAmountValid) {
      const tokenValue = new BigNumber(rawTokenAmount)
        .multipliedBy(rawTokenPrice)
        .toFixed();
      const isAboveThreshold = new BigNumber(tokenValue).gte(10);
      formatTokenValueValue = (
        <NumberSizeableText
          size="$bodySm"
          color={textColorValue}
          fontFamily="$monoRegular"
          formatter={isAboveThreshold ? 'marketCap' : 'value'}
          formatterOptions={{
            currency: currencyInfo.symbol,
          }}
        >
          {tokenValue}
        </NumberSizeableText>
      );
    }
    return {
      formatPrice: formatPriceValue,
      formatTokenValue: formatTokenValueValue,
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
      {formatPrice}
      {formatTokenValue}
    </XStack>
  );
};

export default SwapProTokenTransactionItem;
