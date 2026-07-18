import type { ComponentProps } from 'react';
import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Spinner, Stack, XStack } from '@onekeyhq/components';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { useNetworkOptions } from '@onekeyhq/kit/src/views/ChainSelector/hooks/useNetworkOptions';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IServerNetwork } from '@onekeyhq/shared/types';

const DEFAULT_MAX_VISIBLE_NETWORKS = 3;

export type IBulkExportHistoryNetworkOptions = {
  networks: IServerNetwork[];
  isLoading: boolean;
};

function BulkExportHistoryNetworkAvatars({
  networkIds,
  networkOptions,
  size = '$6',
  maxVisible = DEFAULT_MAX_VISIBLE_NETWORKS,
  remainingCountMode = 'inline',
  showNames = false,
  showAllNames = false,
  nameTextProps,
}: {
  networkIds: string[];
  networkOptions?: IBulkExportHistoryNetworkOptions;
  size?: ComponentProps<typeof NetworkAvatarBase>['size'];
  maxVisible?: number;
  remainingCountMode?: 'inline' | 'overlay';
  showNames?: boolean;
  showAllNames?: boolean;
  nameTextProps?: ComponentProps<typeof SizableText>;
}) {
  const intl = useIntl();
  const fetchedNetworkOptions = useNetworkOptions(
    networkOptions ? undefined : networkIds,
  );
  const { networks, isLoading } = networkOptions ?? fetchedNetworkOptions;

  const visibleNetworks = useMemo(
    () => networks.slice(0, maxVisible),
    [networks, maxVisible],
  );

  const remainingCount = Math.max(
    networkIds.length - visibleNetworks.length,
    0,
  );

  const networkNamesText = useMemo(() => {
    if (!visibleNetworks.length) {
      return intl.formatMessage(
        { id: ETranslations.global_count_networks },
        { count: networkIds.length },
      );
    }

    const namedNetworks = showAllNames ? networks : visibleNetworks;
    const visibleNames = namedNetworks
      .map((network) => network.name)
      .join(', ');
    if (remainingCount > 0 && !showAllNames) {
      return `${visibleNetworks[0].name} +${networkIds.length - 1}`;
    }
    return visibleNames;
  }, [
    intl,
    networkIds.length,
    networks,
    remainingCount,
    showAllNames,
    visibleNetworks,
  ]);

  if (isLoading && !networks.length) {
    return <Spinner size="small" />;
  }

  return (
    <XStack
      flex={showNames ? 1 : undefined}
      minWidth={0}
      alignItems="center"
      gap={showNames ? '$2' : undefined}
    >
      <XStack flexShrink={0} alignItems="center">
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
        {remainingCount > 0 && remainingCountMode === 'overlay' ? (
          <XStack
            position="absolute"
            right="$-2"
            bottom="$-1"
            px="$0.5"
            minWidth={20}
            h={20}
            bg="$bgSubdued"
            borderRadius="$full"
            borderWidth={2}
            borderColor="$bgApp"
            alignItems="center"
            justifyContent="center"
            zIndex={999}
          >
            <SizableText size="$bodySm">+{remainingCount}</SizableText>
          </XStack>
        ) : null}
        {remainingCount > 0 && remainingCountMode === 'inline' ? (
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
      {showNames ? (
        <SizableText
          flex={1}
          minWidth={0}
          size="$bodyMdMedium"
          numberOfLines={showAllNames ? undefined : 1}
          {...nameTextProps}
        >
          {networkNamesText}
        </SizableText>
      ) : null}
    </XStack>
  );
}

export default memo(BulkExportHistoryNetworkAvatars);
