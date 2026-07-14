import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import { Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import { NetworksFilterItem } from '../../../components/NetworksFilterItem';

interface ISwapNetworkToggleGroupProps {
  networks: ISwapNetwork[];
  sameChainNetwork?: ISwapNetwork;
  sameChainBadgeText: string;
  maxVisibleNetworks: number;
  disableNetworks?: string[];
  onSelectNetwork: (network: ISwapNetwork) => void;
  selectedNetwork?: ISwapNetwork;
  onMoreNetwork: () => void;
  onDisableNetworksClick: () => void;
}

const SwapNetworkToggleGroup = ({
  networks,
  sameChainNetwork,
  sameChainBadgeText,
  maxVisibleNetworks,
  selectedNetwork,
  onSelectNetwork,
  disableNetworks,
  onMoreNetwork,
  onDisableNetworksClick,
}: ISwapNetworkToggleGroupProps) => {
  const { width } = useWindowDimensions();
  const intl = useIntl();
  const isWiderScreen = width > 380;
  const visibleNetworkCount = isWiderScreen
    ? maxVisibleNetworks
    : Math.max(maxVisibleNetworks - 1, 1);
  const filteredNetworks = useMemo(
    () => networks.slice(0, visibleNetworkCount),
    [networks, visibleNetworkCount],
  );
  const moreNetworks = useMemo(
    () => networks.slice(visibleNetworkCount),
    [networks, visibleNetworkCount],
  );
  const disableMoreNetworks =
    moreNetworks.length > 0 &&
    moreNetworks.every((network) =>
      disableNetworks?.includes(network.networkId),
    );

  const getNetworkOnPress = (network: ISwapNetwork) =>
    disableNetworks?.includes(network.networkId)
      ? () => {
          onDisableNetworksClick();
        }
      : () => {
          onSelectNetwork(network);
        };

  return (
    <XStack
      px="$5"
      pt="$1"
      pb="$3"
      gap={3}
      alignItems="center"
      $gtMd={{ gap: '$1.5' }}
    >
      {sameChainNetwork ? (
        <>
          <NetworksFilterItem
            disabled={Boolean(
              disableNetworks?.includes(sameChainNetwork.networkId),
            )}
            networkImageUri={sameChainNetwork.logoURI}
            badgeText={sameChainBadgeText}
            keepNetworkImageSize
            tooltipContent={sameChainNetwork.name}
            isSelected={
              sameChainNetwork.networkId === selectedNetwork?.networkId
            }
            px="$2"
            py="$1.5"
            h="$9"
            alignItems="center"
            gap="$1.5"
            borderWidth={1}
            flexShrink={0}
            $gtMd={{ gap: 5 }}
            onPress={getNetworkOnPress(sameChainNetwork)}
          />
          <Stack w={1} h="$6" bg="$border" flexShrink={0} />
        </>
      ) : null}
      {filteredNetworks.map((network) => (
        <NetworksFilterItem
          key={network.networkId}
          disabled={Boolean(disableNetworks?.includes(network.networkId))}
          networkImageUri={network.logoURI}
          isAllNetworks={network.isAllNetworks}
          tooltipContent={
            network.isAllNetworks
              ? intl.formatMessage({ id: ETranslations.global_all_networks })
              : network.name
          }
          isSelected={network?.networkId === selectedNetwork?.networkId}
          keepNetworkImageSize
          px="$2"
          py="$1.5"
          h="$9"
          alignItems="center"
          borderWidth={1}
          flexShrink={0}
          onPress={getNetworkOnPress(network)}
        />
      ))}
      {moreNetworks.length > 0 ? (
        <NetworksFilterItem
          disabled={disableMoreNetworks}
          networkName={`${moreNetworks.length}+`}
          networkNameProps={{
            color: '$text',
            $gtMd: {
              color: '$textSubdued',
              size: '$bodyMdMedium',
            },
          }}
          px="$2"
          py="$1.5"
          h="$9"
          alignItems="center"
          borderWidth={1}
          minWidth={0}
          flex={1}
          onPress={disableMoreNetworks ? undefined : onMoreNetwork}
        />
      ) : null}
    </XStack>
  );
};

export default memo(SwapNetworkToggleGroup);
