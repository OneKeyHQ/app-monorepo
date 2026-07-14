import { memo, useMemo } from 'react';
import type { ComponentProps } from 'react';

import { SizableText, Spinner, Stack, XStack } from '@onekeyhq/components';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { useNetworkOptions } from '@onekeyhq/kit/src/views/ChainSelector/hooks/useNetworkOptions';

const DEFAULT_MAX_VISIBLE_NETWORKS = 3;

function BulkExportHistoryNetworkAvatars({
  networkIds,
  size = '$6',
  maxVisible = DEFAULT_MAX_VISIBLE_NETWORKS,
}: {
  networkIds: string[];
  size?: ComponentProps<typeof NetworkAvatarBase>['size'];
  maxVisible?: number;
}) {
  const { networks, isLoading } = useNetworkOptions(networkIds);

  const visibleNetworks = useMemo(
    () => networks.slice(0, maxVisible),
    [networks, maxVisible],
  );

  const remainingCount = Math.max(
    networkIds.length - visibleNetworks.length,
    0,
  );

  if (isLoading && !networks.length) {
    return <Spinner size="small" />;
  }

  return (
    <XStack alignItems="center">
      {visibleNetworks.map((network, index) => (
        <Stack
          key={network.id}
          borderWidth={2}
          borderColor="$bgApp"
          borderRadius="$full"
          zIndex={visibleNetworks.length - index}
          {...(index !== 0 && {
            ml: '$-2',
          })}
        >
          <NetworkAvatarBase
            logoURI={network.logoURI}
            size={size}
            networkName={network.name}
            isCustomNetwork={network.isCustomNetwork}
            isAllNetworks={network.isAllNetworks}
            allNetworksIconProps={{
              color: '$iconActive',
            }}
          />
        </Stack>
      ))}
      {remainingCount > 0 ? (
        <XStack
          px="$1"
          minWidth={28}
          bg="$gray5"
          borderRadius="$full"
          ml="$-2"
          borderWidth={2}
          borderColor="$bgApp"
          alignItems="center"
          justifyContent="center"
          h={28}
          zIndex={999}
        >
          <SizableText size="$bodySm">+{remainingCount}</SizableText>
        </XStack>
      ) : null}
    </XStack>
  );
}

export default memo(BulkExportHistoryNetworkAvatars);
