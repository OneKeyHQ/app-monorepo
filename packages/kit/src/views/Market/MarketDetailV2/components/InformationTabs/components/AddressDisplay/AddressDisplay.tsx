import { memo, useCallback, useMemo } from 'react';

import {
  InteractiveIcon,
  SizableText,
  Stack,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
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

  const copyIcon = useMemo(
    () =>
      enableCopy ? (
        <InteractiveIcon
          icon="Copy3Outline"
          onPress={handleCopyAddress}
          size="$4"
        />
      ) : null,
    [enableCopy, handleCopyAddress],
  );

  const openInBrowserButton = useMemo(
    () =>
      enableOpenInBrowser ? (
        <InteractiveIcon
          icon="OpenOutline"
          onPress={handleOpenInBrowser}
          size="$4"
        />
      ) : null,
    [enableOpenInBrowser, handleOpenInBrowser],
  );

  return (
    <Stack alignItems="center" flexDirection="row" gap="$1.5" {...style}>
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

      <XStack gap="$1.5">
        {copyIcon}
        {openInBrowserButton}
      </XStack>
    </Stack>
  );
}

export const AddressDisplay = memo(AddressDisplayBase);
