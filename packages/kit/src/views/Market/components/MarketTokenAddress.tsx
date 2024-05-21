import {
  IconButton,
  SizableText,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { NetworkAvatar } from '../../../components/NetworkAvatar';

export function MarketTokenAddress({
  tokenName,
  address,
  url,
  networkId,
}: {
  networkId?: string;
  tokenName: string;
  address: string;
  url: string;
}) {
  const { copyText } = useClipboard();
  return (
    <XStack space="$1.5" ai="center">
      {networkId ? <NetworkAvatar networkId={networkId} size="$5" /> : null}
      <XStack space="$2">
        <SizableText size="$bodyMdMedium">{`${tokenName}:`}</SizableText>
        <SizableText size="$bodyMd">{`${address.slice(0, 6)}...${address.slice(
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
        onPress={() => openUrlExternal(url)}
      />
    </XStack>
  );
}
