import { memo } from 'react';

import {
  Image,
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
}

function TransactionItemSmallBase({ item }: ITransactionItemSmallProps) {
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
    formattedTime,
  } = useTransactionItemData({ item });

  return (
    <XStack py="$2.5" px="$5" alignItems="center">
      <XStack {...styles.time} gap="$2" alignItems="center">
        {item.poolLogoUrl ? (
          <Image
            width="$5"
            height="$5"
            borderRadius="$full"
            source={{ uri: item.poolLogoUrl }}
          />
        ) : null}
        <YStack>
          <SizableText size="$bodyMdMedium" color={typeColor}>
            {typeText}
          </SizableText>

          <SizableText size="$bodySm" color="$textSubdued">
            {formattedTime}
          </SizableText>
        </YStack>
      </XStack>

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
