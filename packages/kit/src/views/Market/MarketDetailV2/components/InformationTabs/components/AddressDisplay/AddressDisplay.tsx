import { memo, useCallback } from 'react';

import { Icon, SizableText, XStack, useClipboard } from '@onekeyhq/components';
import {
  openExplorerAddressUrl,
  openTransactionDetailsUrl,
} from '@onekeyhq/kit/src/utils/explorerUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { IAddressDisplayProps } from './types';

function AddressDisplayBase({
  address,
  enableCopy = true,
  enableOpenInBrowser = false,
  addressFormatOptions = { leadingLength: 6, trailingLength: 4 },
  onCopyAddress,
  onOpenInBrowser,
  style,
  networkId,
  txId,
}: IAddressDisplayProps) {
  const { copyText } = useClipboard();

  const handleCopyAddress = useCallback(() => {
    if (onCopyAddress) {
      onCopyAddress();
    } else {
      copyText(address);
    }
  }, [onCopyAddress, copyText, address]);

  const handleOpenInBrowser = useCallback(() => {
    if (onOpenInBrowser) {
      onOpenInBrowser();
    } else if (networkId && txId) {
      void openTransactionDetailsUrl({
        networkId,
        txid: txId,
        openInExternal: true,
      });
    } else if (networkId) {
      void openExplorerAddressUrl({
        networkId,
        address,
        openInExternal: true,
      });
    }
  }, [onOpenInBrowser, networkId, txId, address]);

  return (
    <XStack alignItems="center" gap="$1" {...style} mx="$-1">
      {enableCopy ? (
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
              ...addressFormatOptions,
            })}
          </SizableText>
          <Icon name="Copy3Outline" size="$4" color="$iconSubdued" />
        </XStack>
      ) : null}

      {enableOpenInBrowser ? (
        <XStack
          onPress={handleOpenInBrowser}
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
      ) : null}
    </XStack>
  );
}

export const AddressDisplay = memo(AddressDisplayBase);
