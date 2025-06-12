import { memo } from 'react';

import { Icon, SizableText, XStack, useClipboard } from '@onekeyhq/components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketTokenHolder } from '@onekeyhq/shared/types/marketV2';

interface IHolderItemProps {
  item: IMarketTokenHolder;
  index: number;
}

function HolderItem({ item, index }: IHolderItemProps) {
  const { copyText } = useClipboard();

  const handleCopyAddress = () => {
    copyText(item.accountAddress);
  };

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    if (num < 0.001) {
      return num.toExponential(2);
    }
    return numberFormat(amount, { formatter: 'balance' });
  };

  const formatFiatValue = (fiatValue: string) => {
    const num = parseFloat(fiatValue);
    return numberFormat(num.toString(), { formatter: 'marketCap' });
  };

  const formatPercent = (percent?: string) => {
    if (!percent) return '--';
    const num = parseFloat(percent);
    if (Number.isNaN(num)) return '--';
    // If the value appears to be in the 0-1 range convert it to percentage.
    const value = num < 1 ? num * 100 : num;
    return `${value.toFixed(2)}%`;
  };

  return (
    <XStack
      py="$3"
      px="$4"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      alignItems="center"
      gap="$3"
    >
      {/* Rank */}
      <SizableText size="$bodyMd" color="$textSubdued" minWidth="$6">
        #{index + 1}
      </SizableText>

      {/* Address with copy icon */}
      <XStack
        onPress={handleCopyAddress}
        cursor="pointer"
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        borderRadius="$2"
        px="$2"
        py="$1"
        alignItems="center"
        gap="$1"
        flex={1}
        minWidth={0}
      >
        <SizableText
          fontFamily="$monoRegular"
          size="$bodyMd"
          color="$text"
          numberOfLines={1}
          flexShrink={1}
        >
          {accountUtils.shortenAddress({
            address: item.accountAddress,
            leadingLength: 6,
            trailingLength: 4,
          })}
        </SizableText>
        <Icon name="Copy2Outline" size="$4" color="$iconSubdued" />
      </XStack>

      {/* Percentage */}
      <SizableText
        size="$bodyMd"
        color="$text"
        minWidth="$16"
        textAlign="right"
      >
        {formatPercent(item.percentage)}
      </SizableText>

      {/* Amount */}
      <SizableText
        size="$bodyMd"
        color="$text"
        minWidth="$20"
        textAlign="right"
      >
        {formatAmount(item.amount)}
      </SizableText>

      {/* Fiat Value */}
      <SizableText
        size="$bodyMd"
        color="$text"
        minWidth="$20"
        textAlign="right"
      >
        ${formatFiatValue(item.fiatValue)}
      </SizableText>
    </XStack>
  );
}

export default memo(HolderItem);
