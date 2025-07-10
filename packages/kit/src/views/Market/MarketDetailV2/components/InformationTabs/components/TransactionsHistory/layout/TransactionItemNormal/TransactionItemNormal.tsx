import { memo } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import { TransactionAddress } from '../../components/TransactionAddress';
import { TransactionAmount } from '../../components/TransactionAmount';
import { TransactionPrice } from '../../components/TransactionPrice';
import { TransactionTime } from '../../components/TransactionTime';
import { TransactionType } from '../../components/TransactionType';
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
      <TransactionTime
        timestamp={item.timestamp}
        formatRelativeTime={formatRelativeTime}
        style={styles.time}
      />

      <TransactionType
        typeText={typeText}
        typeColor={typeColor}
        style={styles.type}
      />

      <TransactionAmount
        baseToken={baseToken}
        quoteToken={quoteToken}
        baseSign={baseSign}
        quoteSign={quoteSign}
        typeColor={typeColor}
        style={styles.amount}
      />

      <TransactionPrice price={price} style={styles.price} />

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
