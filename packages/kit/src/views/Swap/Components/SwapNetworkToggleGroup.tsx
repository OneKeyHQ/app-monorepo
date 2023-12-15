import { memo } from 'react';

import { Button, Image, ScrollView, XStack } from '@onekeyhq/components';

import type { ISwapNetwork } from '../types';

interface ISwapNetworkToggleGroupProps {
  networks: ISwapNetwork[];
  onSelectNetwork: (network: ISwapNetwork) => void;
  selectedNetwork?: ISwapNetwork;
}

const SwapNetworkToggleGroup = ({
  networks,
  selectedNetwork,
  onSelectNetwork,
}: ISwapNetworkToggleGroupProps) => (
  <ScrollView horizontal>
    <XStack space="$4">
      {networks.map((network) => (
        <Button
          key={network.networkId}
          style={
            network?.networkId === selectedNetwork?.networkId
              ? { border: '1px solid #000' }
              : {}
          }
          onPress={() => {
            onSelectNetwork(network);
          }}
        >
          <Image source={{ uri: network.logoURI }} />
          {network.networkId}
        </Button>
      ))}
    </XStack>
  </ScrollView>
);

export default memo(SwapNetworkToggleGroup);
