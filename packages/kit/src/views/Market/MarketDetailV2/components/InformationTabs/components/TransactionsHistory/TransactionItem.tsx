import { memo } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { openTransactionDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatDistanceToNowStrict } from '@onekeyhq/shared/src/utils/dateUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import { useTransactionsLayout } from './useTransactionsLayout';

interface ITransactionItemProps {
  item: IMarketTokenTransaction;
  networkId: string;
}

function TransactionItemBase({ item, networkId }: ITransactionItemProps) {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const { layoutConfig } = useTransactionsLayout();

  const handleCopyAddress = () => {
    copyText(item.owner);
  };

  const handleViewInBrowser = () => {
    void openTransactionDetailsUrl({
      networkId,
      txid: item.hash,
      openInExternal: true,
    });
  };

  // Display relative time like "3 minutes" / "2 hours" without suffix.
  const formatRelativeTime = (timestamp: number) =>
    formatDistanceToNowStrict(timestamp * 1000, {
      addSuffix: false,
      roundingMethod: 'floor',
    });

  const isBuy = item.type === 'buy';
  const baseToken = isBuy ? item.to : item.from;
  const quoteToken = isBuy ? item.from : item.to;

  const baseSign = isBuy ? '+' : '-';
  const quoteSign = isBuy ? '-' : '+';
  const typeColor = isBuy ? '$textSuccess' : '$textCritical';

  return (
    <XStack py="$1" px="$4" alignItems="center">
      {/* Time */}
      <SizableText size="$bodyMd" color="$textSubdued" {...layoutConfig.time}>
        {formatRelativeTime(item.timestamp)}
      </SizableText>

      {/* Type */}
      <SizableText
        size="$bodyMdMedium"
        color={typeColor}
        {...layoutConfig.type}
      >
        {isBuy
          ? intl.formatMessage({
              id: ETranslations.dexmarket_details_transactions_buy,
            })
          : intl.formatMessage({
              id: ETranslations.dexmarket_details_transactions_sell,
            })}
      </SizableText>

      {/* Amount - 2 columns (YStack) x 2 rows layout */}
      <XStack
        {...layoutConfig.amount}
        alignItems="center"
        justifyContent="flex-start"
        gap="$1"
      >
        {/* Column 1: amounts */}
        <YStack width="49%" alignItems="flex-end">
          <SizableText size="$bodySm" color={typeColor} numberOfLines={1}>
            {`${baseSign}${
              numberFormat(baseToken.amount, {
                formatter: 'balance',
              }) as string
            }`}
          </SizableText>

          <SizableText size="$bodySm" color="$text" numberOfLines={1}>
            {`${quoteSign}${
              numberFormat(quoteToken.amount, {
                formatter: 'balance',
              }) as string
            }`}
          </SizableText>
        </YStack>

        {/* Column 2: symbols */}
        <YStack width="49%" alignItems="flex-start">
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {baseToken.symbol}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {quoteToken.symbol}
          </SizableText>
        </YStack>
      </XStack>

      {/* Price */}
      <NumberSizeableText
        size="$bodyMd"
        color="$text"
        formatter="price"
        formatterOptions={{ currency: '$' }}
        {...layoutConfig.price}
      >
        {isBuy ? item.to.price : item.from.price}
      </NumberSizeableText>

      {/* Value */}
      <SizableText size="$bodyMd" color="$text" {...layoutConfig.value}>
        $
        {(parseFloat(item.from.amount) * parseFloat(item.from.price)).toFixed(
          2,
        )}
      </SizableText>

      {/* Address */}
      <XStack alignItems="center" gap="$1" {...layoutConfig.address} mx="$-1">
        <XStack
          onPress={handleCopyAddress}
          cursor="pointer"
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          borderRadius="$2"
          p="$1"
          alignItems="center"
          gap="$1"
          flexShrink={1}
        >
          <SizableText
            fontFamily="$monoRegular"
            size="$bodyMd"
            color="$text"
            numberOfLines={1}
            flexShrink={1}
          >
            {accountUtils.shortenAddress({
              address: item.owner,
              leadingLength: 6,
              trailingLength: 4,
            })}
          </SizableText>
          <Icon name="Copy2Outline" size="$4" color="$iconSubdued" />
        </XStack>
        <XStack
          onPress={handleViewInBrowser}
          cursor="pointer"
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          borderRadius="$2"
          p="$1.5"
          alignItems="center"
          justifyContent="center"
        >
          <Icon name="OpenOutline" size="$4" color="$iconSubdued" />
        </XStack>
      </XStack>
    </XStack>
  );
}

const TransactionItem = memo(TransactionItemBase);

export { TransactionItem };
