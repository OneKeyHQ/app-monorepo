import { memo, useCallback } from 'react';

import { Icon, SizableText, XStack, useClipboard } from '@onekeyhq/components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketTokenHolder } from '@onekeyhq/shared/types/marketV2';

import { useHoldersLayout } from './useHoldersLayout';

interface IHolderItemProps {
  item: IMarketTokenHolder;
  index: number;
}

function HolderItemBase({ item, index }: IHolderItemProps) {
  const { copyText } = useClipboard();
  const { layoutConfig } = useHoldersLayout();

  const handleCopyAddress = useCallback(() => {
    copyText(item.accountAddress);
  }, [copyText, item.accountAddress]);

  return (
    <XStack py="$3" px="$4" alignItems="center" gap="$3">
      {/* Rank */}
      <SizableText size="$bodyMd" color="$textSubdued" {...layoutConfig.rank}>
        #{index + 1}
      </SizableText>

      {/* Address with copy icon */}
      <XStack
        onPress={handleCopyAddress}
        cursor="pointer"
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        borderRadius="$2"
        px="$1"
        py="$1"
        alignItems="center"
        gap="$1"
        {...layoutConfig.address}
        mx="$-1"
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

      {/* Amount */}
      <SizableText size="$bodyMd" color="$text" {...layoutConfig.amount}>
        {numberFormat(item.amount, { formatter: 'balance' })}
      </SizableText>

      {/* Fiat Value */}
      <SizableText size="$bodyMd" color="$text" {...layoutConfig.value}>
        ${numberFormat(item.fiatValue, { formatter: 'marketCap' })}
      </SizableText>
    </XStack>
  );
}

const HolderItem = memo(HolderItemBase);

export { HolderItem };
