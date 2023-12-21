import { memo } from 'react';

import { Avatar, Button, Image, Text, XStack } from '@onekeyhq/components';

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
          <Avatar size="$4">
            <Image
              flex={1}
              width="100%"
              source={{ uri: network.logoURI }}
              resizeMode="center"
            />
          </Avatar>
          <Text>
            {network.name ?? network.symbol ?? network.shortcode ?? 'Unknown'}
          </Text>
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
