import { memo } from 'react';

import {
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
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

  return (
    <XStack
      py="$3"
      px="$4"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      alignItems="center"
      justifyContent="space-between"
    >
      <XStack alignItems="center" gap="$3" flex={1}>
        <SizableText size="$bodyMd" color="$textSubdued" minWidth="$6">
          #{index + 1}
        </SizableText>

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
        >
          <SizableText size="$bodyMd" color="$text">
            {accountUtils.shortenAddress({
              address: item.accountAddress,
              leadingLength: 6,
              trailingLength: 4,
            })}
          </SizableText>
        </XStack>
      </XStack>

      <YStack alignItems="flex-end" gap="$1">
        <SizableText size="$bodyMd" color="$text">
          {formatAmount(item.amount)}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          ${formatFiatValue(item.fiatValue)}
        </SizableText>
      </YStack>
    </XStack>
  );
}

export default memo(HolderItem);
