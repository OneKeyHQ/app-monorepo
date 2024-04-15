import { memo, useCallback } from 'react';

import { XStack, useMedia } from '@onekeyhq/components';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import { NetworksFilterItem } from '../../../components/NetworksFilterItem';

interface ISwapNetworkToggleGroupProps {
  networks: ISwapNetwork[];
  moreNetworksCount?: number;
  isOnlySupportSingleNetWork?: () => boolean;
  onSelectNetwork: (network: ISwapNetwork) => void;
  selectedNetwork?: ISwapNetwork;
  onMoreNetwork: () => void;
}

const SwapNetworkToggleGroup = ({
  networks,
  selectedNetwork,
  onSelectNetwork,
  moreNetworksCount,
  onMoreNetwork,
}: ISwapNetworkToggleGroupProps) => {
  const { md } = useMedia();
  const getNetworkName = useCallback(
    (networkId: string) => {
      if (networkId === 'all') {
        return md ? 'All' : 'All Networks';
      }
      return undefined;
    },
    [md],
  );
  return (
    <XStack px="$5" pt="$1" pb="$3" space="$2">
      {networks.map((network) => (
        <NetworksFilterItem
          key={network.networkId}
          networkName={getNetworkName(network.networkId)}
          networkImageUri={network.logoURI}
          tooltipContent={
            network.name ?? network.symbol ?? network.shortcode ?? 'Unknown'
          }
          isSelected={
            network?.networkId === selectedNetwork?.networkId ||
            (!selectedNetwork && network.networkId === 'all')
          }
          onPress={() => {
            onSelectNetwork(network);
          }}
        />
      ))}
      {moreNetworksCount && moreNetworksCount > 0 ? (
        <NetworksFilterItem
          networkName={`${moreNetworksCount}+`}
          flex={1}
          onPress={onMoreNetwork}
        />
      ) : null}
    </XStack>
  );
};

export default memo(SwapNetworkToggleGroup);
