import { useCallback, useMemo } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import { useClipboard } from '@onekeyhq/components';
import { openTransactionDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatRelativeTimeAbbr } from '@onekeyhq/shared/src/utils/dateUtils';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

interface IUseTransactionItemDataProps {
  item: IMarketTokenTransaction;
  networkId: string;
}

export function useTransactionItemData({
  item,
  networkId,
}: IUseTransactionItemDataProps) {
  const intl = useIntl();
  const { copyText } = useClipboard();

  const handleCopyAddress = useCallback(() => {
    copyText(item.owner);
  }, [copyText, item.owner]);

  const handleViewInBrowser = useCallback(() => {
    void openTransactionDetailsUrl({
      networkId,
      txid: item.hash,
      openInExternal: true,
    });
  }, [networkId, item.hash]);

  const formatRelativeTime = formatRelativeTimeAbbr;

  const isBuy = item.type === 'buy';
  const baseToken = isBuy ? item.to : item.from;
  const quoteToken = isBuy ? item.from : item.to;

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
  const value = BigNumber(item.from.amount).times(item.from.price).toNumber();

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
    formatRelativeTime,
    handleCopyAddress,
    handleViewInBrowser,
  };
}
