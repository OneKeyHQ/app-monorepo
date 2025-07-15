import { memo } from 'react';

import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import { TransactionAmount } from '../../components/TransactionAmount';
import { useTransactionItemData } from '../../hooks/useTransactionItemData';

import { useTransactionsLayoutSmall } from './useTransactionsLayoutSmall';

interface ITransactionItemSmallProps {
  item: IMarketTokenTransaction;
  networkId: string;
}

function TransactionItemSmallBase({
  item,
  networkId,
}: ITransactionItemSmallProps) {
  const { styles } = useTransactionsLayoutSmall();
  const [settingsPersistAtom] = useSettingsPersistAtom();
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
  } = useTransactionItemData({ item, networkId });

  return (
    <XStack py="$1" px="$4" alignItems="center">
      <YStack {...styles.time}>
        <SizableText size="$bodySmMedium" color={typeColor}>
          {typeText}
        </SizableText>

        <SizableText size="$bodySm" color="$textSubdued">
          {formatRelativeTime(item.timestamp)}
        </SizableText>
      </YStack>

      <TransactionAmount
        baseToken={baseToken}
        quoteToken={quoteToken}
        baseSign={baseSign}
        quoteSign={quoteSign}
        typeColor={typeColor}
        style={styles.amount}
      />

      <YStack {...styles.price} justifyContent="flex-end">
        <NumberSizeableText
          textAlign="right"
          size="$bodySmMedium"
          color="$text"
          autoFormatter="price-marketCap"
          formatterOptions={{
            capAtMaxT: true,
            currency: settingsPersistAtom.currencyInfo.symbol,
          }}
        >
          {value}
        </NumberSizeableText>

        <NumberSizeableText
          textAlign="right"
          size="$bodySm"
          color="$textSubdued"
          autoFormatter="price-marketCap"
          formatterOptions={{
            capAtMaxT: true,
            currency: settingsPersistAtom.currencyInfo.symbol,
          }}
        >
          {price}
        </NumberSizeableText>
      </YStack>
    </XStack>
  );
}

const TransactionItemSmall = memo(TransactionItemSmallBase);

export { TransactionItemSmall };
