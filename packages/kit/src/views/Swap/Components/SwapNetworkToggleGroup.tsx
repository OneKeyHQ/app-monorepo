import { memo } from 'react';

import { Button, Image, SizableText, XStack } from '@onekeyhq/components';

import type { ISwapNetwork } from '../types';

interface ISwapNetworkToggleGroupProps {
  networks: ISwapNetwork[];
  type: 'from' | 'to';
  onlySupportSingleNetWork?: string;
  isOnlySupportSingleNetWork?: () => boolean;
  onSelectNetwork: (network: ISwapNetwork) => void;
  selectedNetwork?: ISwapNetwork;
  onMoreNetwork: () => void;
}

const SwapNetworkToggleGroup = ({
  networks,
  selectedNetwork,
  onlySupportSingleNetWork,
  type,
  onSelectNetwork,
  onMoreNetwork,
}: ISwapNetworkToggleGroupProps) => (
  // <ScrollView horizontal showsHorizontalScrollIndicator={false}>
  <XStack space="$4">
    {networks.map((network) => (
      <Button
        ml="$2"
        key={network.networkId}
        backgroundColor={
          network?.networkId === selectedNetwork?.networkId ||
          (!selectedNetwork && network.networkId === 'all')
            ? '$bgCriticalStrongDark'
            : '$background'
        }
        disabled={
          !!(
            type === 'to' &&
            onlySupportSingleNetWork &&
            network.networkId !== onlySupportSingleNetWork
          )
        }
        onPress={() => {
          onSelectNetwork(network);
        }}
      >
        <XStack space="$2" justifyContent="center" alignItems="center">
          <Image
            w="$4"
            h="$4"
            borderRadius="$2"
            source={{ uri: network.logoURI }}
            // resizeMode="center"
          />
          <SizableText>
            {network.name ?? network.symbol ?? network.shortcode ?? 'Unknown'}
          </SizableText>
        </XStack>
      </Button>
    ))}
    <Button
      ml="$2"
      onPress={onMoreNetwork}
      disabled={!!(type === 'to' && onlySupportSingleNetWork)}
    >
      更多网络
    </Button>
  </XStack>
  // </ScrollView>
);

export default memo(SwapNetworkToggleGroup);
