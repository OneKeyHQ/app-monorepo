import { useCallback } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import {
  Icon,
  IconButton,
  Image,
  SizableText,
  Stack,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { NetworkAvatar } from '../../../components/NetworkAvatar';

export function MarketTokenAddress({
  tokenName,
  address,
  uri,
  networkId,
  tokenNameColor,
  tokenNameSize = '$bodyMdMedium',
  addressSize = '$bodyMd',
}: {
  networkId?: string;
  tokenName: string;
  address: string;
  uri?: string;
  tokenNameColor?: ISizableTextProps['color'];
  tokenNameSize?: ISizableTextProps['size'];
  addressSize?: ISizableTextProps['size'];
}) {
  const { copyText } = useClipboard();
  const handleOpenUrl = useCallback(async () => {
    const network = await backgroundApiProxy.serviceNetwork.getNetwork({
      networkId,
    });
    if (network.explorers[0].address) {
      openUrlExternal(
        network.explorers[0].address.replace('{address}', address),
      );
    }
  }, [address, networkId]);
  const renderIcon = useCallback(() => {
    if (uri) {
      return (
        <Image size="$5" src={decodeURIComponent(uri)} borderRadius="$full" />
      );
    }
    if (networkId) {
      return <NetworkAvatar size="$5" networkId={networkId} />;
    }

    return (
      <Stack
        width="$5"
        height="$5"
        ai="center"
        jc="center"
        bg="$bgStrong"
        borderRadius="$full"
      >
        <Icon size="$2.5" name="PlaceholderSolid" />
      </Stack>
    );
  }, [networkId, uri]);
  return (
    <XStack space="$1.5" ai="center">
      {renderIcon()}
      <XStack space="$2">
        <SizableText
          color={tokenNameColor}
          size={tokenNameSize}
        >{`${tokenName}:`}</SizableText>
        <SizableText size={addressSize}>{`${address.slice(
          0,
          6,
        )}...${address.slice(
          address.length - 4,
          address.length,
        )}`}</SizableText>
      </XStack>
      <IconButton
        variant="tertiary"
        color="$iconSubdued"
        icon="Copy1Outline"
        size="small"
        iconSize="$4"
        onPress={() => copyText(address)}
      />
      <IconButton
        variant="tertiary"
        color="$iconSubdued"
        icon="OpenOutline"
        size="small"
        iconSize="$4"
        onPress={handleOpenUrl}
      />
    </XStack>
  );
}
