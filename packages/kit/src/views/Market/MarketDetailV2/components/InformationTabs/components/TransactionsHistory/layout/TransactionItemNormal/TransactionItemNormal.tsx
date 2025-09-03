import { memo } from 'react';

import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import { AddressDisplay } from '../../../AddressDisplay';
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
  const { styles, isSmallScreen } = useTransactionsLayoutNormal();
  const {
    baseToken,
    quoteToken,
    baseSign,
    quoteSign,
    typeColor,
    typeText,
    price,
    value,
    formattedTime,
  } = useTransactionItemData({ item });
  const [settingsPersistAtom] = useSettingsPersistAtom();

  return (
    <XStack py="$1" px="$4" alignItems="center">
      <SizableText size="$bodyMd" color="$textSubdued" {...styles.time}>
        {formattedTime}
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

      {isSmallScreen ? (
        <YStack {...styles.priceValue} justifyContent="center">
          <NumberSizeableText
            size="$bodyMdMedium"
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
            color="$textSubdued"
            size="$bodySm"
            autoFormatter="price-marketCap"
            formatterOptions={{
              capAtMaxT: true,
              currency: settingsPersistAtom.currencyInfo.symbol,
            }}
          >
            {price}
          </NumberSizeableText>
        </YStack>
      ) : (
        <>
          <NumberSizeableText
            size="$bodyMd"
            color="$text"
            autoFormatter="price-marketCap"
            formatterOptions={{
              capAtMaxT: true,
              currency: settingsPersistAtom.currencyInfo.symbol,
            }}
            {...styles.price}
          >
            {price}
          </NumberSizeableText>

          <NumberSizeableText
            size="$bodyMd"
            color="$text"
            autoFormatter="price-marketCap"
            formatterOptions={{
              capAtMaxT: true,
              currency: settingsPersistAtom.currencyInfo.symbol,
            }}
            {...styles.value}
          >
            {value}
          </NumberSizeableText>
        </>
      )}

      <AddressDisplay
        address={item.owner}
        enableCopy
        enableOpenInBrowser
        networkId={networkId}
        txId={item.hash}
        style={styles.address}
      />
    </XStack>
  );
}

const TransactionItemNormal = memo(TransactionItemNormalBase);

export { TransactionItemNormal };
