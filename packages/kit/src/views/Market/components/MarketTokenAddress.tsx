import { useCallback } from 'react';

import { useIntl } from 'react-intl';

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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { NetworkAvatar } from '../../../components/NetworkAvatar';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

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
  tokenName?: string;
  address: string;
  uri?: string;
  tokenNameColor?: ISizableTextProps['color'];
  tokenNameSize?: ISizableTextProps['size'];
  addressSize?: ISizableTextProps['size'];
}) {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const { result: network } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getNetwork({
        networkId,
      }),
    [networkId],
    {
      checkIsFocused: false,
      overrideIsFocused: () => false,
    },
  );
  const handleOpenUrl = useCallback(async () => {
    if (network?.explorers[0].address) {
      openUrlExternal(
        network.explorers[0].address.replace('{address}', address),
      );
    }
  }, [address, network?.explorers]);
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
    <XStack gap="$1.5" ai="center">
      {renderIcon()}
      <XStack gap="$2">
        <SizableText color={tokenNameColor} size={tokenNameSize}>{`${
          tokenName || network?.name || ''
        }:`}</SizableText>
        <SizableText size={addressSize}>{`${address.slice(
          0,
          6,
        )}...${address.slice(
          address.length - 4,
          address.length,
        )}`}</SizableText>
      </XStack>
      <IconButton
        title={intl.formatMessage({ id: ETranslations.global_copy })}
        variant="tertiary"
        color="$iconSubdued"
        icon="Copy1Outline"
        size="small"
        iconSize="$4"
        onPress={() => copyText(address)}
      />
      <IconButton
        title={intl.formatMessage({
          id: ETranslations.global_view_in_blockchain_explorer,
        })}
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
