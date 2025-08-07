import { memo, useCallback, useMemo } from 'react';

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

  const addressContainerProps = useMemo(
    () => ({
      onPress: enableCopy ? handleCopyAddress : undefined,
      cursor: enableCopy ? 'pointer' : 'default',
      hoverStyle: enableCopy ? { bg: '$bgHover' } : undefined,
      pressStyle: enableCopy ? { bg: '$bgActive' } : undefined,
    }),
    [enableCopy, handleCopyAddress],
  );

  return (
    <XStack alignItems="center" gap="$1" ml="$-1" mr="$1" {...style}>
      <XStack
        {...addressContainerProps}
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

        {enableCopy ? (
          <Icon name="Copy3Outline" size="$4" color="$iconSubdued" />
        ) : null}
      </XStack>

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
