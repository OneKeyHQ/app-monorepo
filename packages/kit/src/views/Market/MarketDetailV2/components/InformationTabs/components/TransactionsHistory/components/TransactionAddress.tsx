import { type ComponentProps, memo } from 'react';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

interface ITransactionAddressProps {
  address: string;
  handleCopyAddress: () => void;
  handleViewInBrowser: () => void;
  style?: ComponentProps<typeof XStack>;
}

function TransactionAddressBase({
  address,
  handleCopyAddress,
  handleViewInBrowser,
  style,
}: ITransactionAddressProps) {
  return (
    <XStack alignItems="center" gap="$1" {...style} mx="$-1">
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
            address,
            leadingLength: 6,
            trailingLength: 4,
          })}
        </SizableText>
        <Icon name="Copy3Outline" size="$4" color="$iconSubdued" />
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
  );
}

const TransactionAddress = memo(TransactionAddressBase);

export { TransactionAddress };
