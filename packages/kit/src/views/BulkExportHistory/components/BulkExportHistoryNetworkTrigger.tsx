import { memo, useMemo } from 'react';

import {
  Icon,
  SizableText,
  Spinner,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { useNetworkOptions } from '@onekeyhq/kit/src/views/ChainSelector/hooks/useNetworkOptions';

const MAX_VISIBLE_NETWORKS = 3;

function BulkExportHistoryNetworkTrigger({
  selectedNetworkIds,
  disabled,
  onPress,
}: {
  selectedNetworkIds: string[];
  disabled?: boolean;
  onPress?: () => void;
}) {
  const { networks: selectedNetworks, isLoading } =
    useNetworkOptions(selectedNetworkIds);

  const selectedNetworkNames = useMemo(
    () => selectedNetworks.map((network) => network.name).join(', '),
    [selectedNetworks],
  );

  const visibleNetworks = useMemo(
    () => selectedNetworks.slice(0, MAX_VISIBLE_NETWORKS),
    [selectedNetworks],
  );

  const remainingCount = Math.max(
    selectedNetworkIds.length - visibleNetworks.length,
    0,
  );

  return (
    <Stack
      userSelect="none"
      onPress={disabled ? undefined : onPress}
      flexDirection="row"
      alignItems="center"
      borderRadius="$3"
      borderWidth={1}
      borderCurve="continuous"
      borderColor="$borderStrong"
      px="$3"
      py="$2.5"
      minHeight="$12"
      testID="bulk-export-history-network-trigger"
      {...(!disabled && {
        hoverStyle: {
          bg: '$bgHover',
        },
        pressStyle: {
          bg: '$bgActive',
        },
      })}
      {...(disabled && {
        opacity: 0.5,
      })}
    >
      <XStack flex={1} alignItems="center" gap="$3">
        <XStack alignItems="center" minWidth={44}>
          {isLoading && !selectedNetworks.length ? (
            <Spinner size="small" />
          ) : (
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
                    size="$6"
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
          )}
        </XStack>
        <SizableText
          flex={1}
          size="$bodyLg"
          numberOfLines={1}
          testID="bulk-export-history-network-trigger-text"
        >
          {selectedNetworkNames}
        </SizableText>
      </XStack>
      <Icon name="ChevronDownSmallOutline" mr="$-0.5" color="$iconSubdued" />
    </Stack>
  );
}

export default memo(BulkExportHistoryNetworkTrigger);
