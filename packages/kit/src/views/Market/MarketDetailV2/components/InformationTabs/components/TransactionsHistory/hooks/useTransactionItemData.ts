import { useMemo } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  useTokenAddressAtom,
  useTokenDetailSymbolAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IMarketTokenTransaction,
  IMarketTokenTransactionToken,
} from '@onekeyhq/shared/types/marketV2';

interface IUseTransactionItemDataProps {
  item: IMarketTokenTransaction;
}

// Helper function to fill in missing token symbol from token detail
function fillTokenSymbolIfMissing(
  token: IMarketTokenTransactionToken,
  tokenAddress: string | undefined,
  tokenSymbol: string | undefined,
): IMarketTokenTransactionToken {
  // If symbol is missing and token address matches current token address, use tokenDetail symbol
  if (
    (!token.symbol || token.symbol === '') &&
    tokenAddress &&
    tokenSymbol &&
    token.address?.toLowerCase() === tokenAddress.toLowerCase()
  ) {
    return {
      ...token,
      symbol: tokenSymbol,
    };
  }
  return token;
}

export function useTransactionItemData({ item }: IUseTransactionItemDataProps) {
  const intl = useIntl();
  const [tokenAddress] = useTokenAddressAtom();
  const [tokenSymbol] = useTokenDetailSymbolAtom();

  const isBuy = item.type === 'buy';

  // Get base and quote tokens, and fill in missing symbols from tokenDetail
  const baseToken = useMemo(() => {
    const token = isBuy ? item.to : item.from;
    return fillTokenSymbolIfMissing(token, tokenAddress, tokenSymbol);
  }, [isBuy, item.to, item.from, tokenAddress, tokenSymbol]);

  const quoteToken = useMemo(() => {
    const token = isBuy ? item.from : item.to;
    return fillTokenSymbolIfMissing(token, tokenAddress, tokenSymbol);
  }, [isBuy, item.from, item.to, tokenAddress, tokenSymbol]);

  const baseSign = isBuy ? '+' : '-';
  const quoteSign = isBuy ? '-' : '+';
  const typeColor = isBuy ? '$textSuccess' : '$textCritical';

  const typeText = useMemo(
    () =>
      isBuy
        ? intl.formatMessage({
            id: ETranslations.dexmarket_details_transactions_buy,
          })
        : intl.formatMessage({
            id: ETranslations.dexmarket_details_transactions_sell,
          }),
    [isBuy, intl],
  );

  const basePrice = baseToken.price;
  const value =
    item.volumeUSD ??
    BigNumber(baseToken.amount).times(BigNumber(basePrice)).toNumber();

  return {
    isBuy,
    baseToken,
    quoteToken,
    baseSign,
    quoteSign,
    typeColor,
    typeText,
    price: basePrice,
    value,
  };
}
