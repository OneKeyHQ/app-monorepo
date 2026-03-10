import { memo } from 'react';

import {
  Image,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import { AddressDisplay } from '../../../AddressDisplay';
import { TransactionAmount } from '../../components/TransactionAmount';
import { useTransactionItemData } from '../../hooks/useTransactionItemData';

import { useTransactionsLayoutNormal } from './useTransactionsLayoutNormal';

interface ITransactionItemNormalProps {
  item: IMarketTokenTransaction;
  networkId: string;
  index: number;
}

function TransactionItemNormalBase({
  item,
  index,
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

  return (
    <XStack
      py="$1"
      pl="$5"
      pr="$3"
      alignItems="center"
      cursor="default"
      {...(index % 2 === 1 && { backgroundColor: '$bgSubdued' })}
      hoverStyle={{ backgroundColor: '$bgHover' }}
    >
      <SizableText size="$bodyMd" color="$textSubdued" {...styles.time}>
        {formattedTime}
      </SizableText>

      <XStack alignItems="center" gap="$2" {...styles.type}>
        {item.poolLogoUrl ? (
          <Image
            width="$5"
            height="$5"
            borderRadius="$full"
            source={{ uri: item.poolLogoUrl }}
          />
        ) : null}
        <SizableText size="$bodyMdMedium" color={typeColor}>
          {typeText}
        </SizableText>
      </XStack>

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
              currency: '$',
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
              currency: '$',
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
              currency: '$',
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
              currency: '$',
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
