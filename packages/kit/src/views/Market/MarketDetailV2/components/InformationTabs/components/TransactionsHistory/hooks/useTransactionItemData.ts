import { useMemo } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import { useTokenDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatRelativeTimeAbbr } from '@onekeyhq/shared/src/utils/dateUtils';
import type {
  IMarketTokenDetail,
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
  tokenDetail: IMarketTokenDetail | undefined,
): IMarketTokenTransactionToken {
  // If symbol is missing and token address matches current token address, use tokenDetail symbol
  if (
    (!token.symbol || token.symbol === '') &&
    tokenAddress &&
    tokenDetail?.symbol &&
    token.address?.toLowerCase() === tokenAddress.toLowerCase()
  ) {
    return {
      ...token,
      symbol: tokenDetail.symbol,
    };
  }
  return token;
}

export function useTransactionItemData({ item }: IUseTransactionItemDataProps) {
  const intl = useIntl();
  const { tokenDetail, tokenAddress } = useTokenDetail();

  const formattedTime = formatRelativeTimeAbbr(item.timestamp);

  const isBuy = item.type === 'buy';

  // Get base and quote tokens, and fill in missing symbols from tokenDetail
  const baseToken = useMemo(() => {
    const token = isBuy ? item.to : item.from;
    return fillTokenSymbolIfMissing(token, tokenAddress, tokenDetail);
  }, [isBuy, item.to, item.from, tokenAddress, tokenDetail]);

  const quoteToken = useMemo(() => {
    const token = isBuy ? item.from : item.to;
    return fillTokenSymbolIfMissing(token, tokenAddress, tokenDetail);
  }, [isBuy, item.from, item.to, tokenAddress, tokenDetail]);

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

  const price = isBuy ? item.to.price : item.from.price;
  const value = BigNumber(item.from.amount)
    .times(BigNumber(item.from.price))
    .toNumber();

  return {
    isBuy,
    baseToken,
    quoteToken,
    baseSign,
    quoteSign,
    typeColor,
    typeText,
    price,
    value,
    formattedTime,
  };
}
