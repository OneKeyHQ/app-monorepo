import { memo } from 'react';

import BigNumber from 'bignumber.js';

import { NumberSizeableText, SizableText, XStack } from '@onekeyhq/components';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import { TransactionAddress } from '../../components/TransactionAddress';
import { TransactionAmount } from '../../components/TransactionAmount';
import { useTransactionItemData } from '../../hooks/useTransactionItemData';

import { useTransactionsLayoutNormal } from './useTransactionsLayoutNormal';

interface ITransactionItemNormalProps {
  item: IMarketTokenTransaction;
  networkId: string;
}

function TransactionItemNormalBase({
  item,
  networkId,
}: ITransactionItemNormalProps) {
  const { styles } = useTransactionsLayoutNormal();
  const {
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
  } = useTransactionItemData({ item, networkId });

  return (
    <XStack py="$1" px="$4" alignItems="center">
      <SizableText size="$bodyMd" color="$textSubdued" {...styles.time}>
        {formatRelativeTime(item.timestamp)}
      </SizableText>

      <SizableText size="$bodyMdMedium" color={typeColor} {...styles.type}>
        {typeText}
      </SizableText>

      <TransactionAmount
        baseToken={baseToken}
        quoteToken={quoteToken}
        baseSign={baseSign}
        quoteSign={quoteSign}
        typeColor={typeColor}
        style={styles.amount}
      />

      <NumberSizeableText
        size="$bodyMd"
        color="$text"
        formatter={BigNumber(price).gt(1_000_000) ? 'marketCap' : 'price'}
        formatterOptions={{ currency: '$', capAtMaxT: true }}
        {...styles.price}
      >
        {price}
      </NumberSizeableText>

      <SizableText size="$bodyMd" color="$text" {...styles.value}>
        ${value}
      </SizableText>

      <TransactionAddress
        address={item.owner}
        handleCopyAddress={handleCopyAddress}
        handleViewInBrowser={handleViewInBrowser}
        style={styles.address}
      />
    </XStack>
  );
}

const TransactionItemNormal = memo(TransactionItemNormalBase);

export { TransactionItemNormal };
