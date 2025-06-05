import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import { ScrollView, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import { GradientMask } from './GradientMask';
import { MoreButton } from './MoreButton';
import { NetworksFilterItem } from './NetworksFilterItem';

interface ISwapNetworkToggleGroupProps {
  networks: ISwapNetwork[];
  disableNetworks?: string[];
  moreNetworksCount?: number;
  onSelectNetwork: (network: ISwapNetwork) => void;
  selectedNetwork?: ISwapNetwork;
  onMoreNetwork: () => void;
}

const MarketNetworkFilter = ({
  networks,
  selectedNetwork,
  onSelectNetwork,
  disableNetworks,
  moreNetworksCount,
  onMoreNetwork,
}: ISwapNetworkToggleGroupProps) => {
  const { width } = useWindowDimensions();
  const intl = useIntl();
  const isWiderScreen = width > 680;
  const filteredNetworks = useMemo(
    () => (isWiderScreen ? networks : networks.slice(0, 20)),
    [networks, isWiderScreen],
  );
  return (
    <YStack
      position="relative"
      px="$5"
      pt="$1"
      pb="$3"
      maxWidth="100%"
      overflow="hidden"
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$2"
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        pr={moreNetworksCount && moreNetworksCount > 0 ? '$12' : '$0'}
      >
        <XStack gap="$2">
          {filteredNetworks.map((network) => (
            <NetworksFilterItem
              key={network.networkId}
              networkName={network.name}
              disabled={Boolean(disableNetworks?.includes(network.networkId))}
              networkImageUri={network.logoURI}
              tooltipContent={
                network.isAllNetworks
                  ? intl.formatMessage({
                      id: ETranslations.global_all_networks,
                    })
                  : network.name
              }
              isSelected={network?.networkId === selectedNetwork?.networkId}
              onPress={
                disableNetworks?.includes(network.networkId)
                  ? undefined
                  : () => {
                      onSelectNetwork(network);
                    }
              }
            />
          ))}
        </XStack>
      </ScrollView>

      {/* 添加左右渐变遮罩 */}
      <GradientMask position="left" />
      <GradientMask position="right" />

      {moreNetworksCount && moreNetworksCount > 0 ? (
        <MoreButton
          position="absolute"
          right="$5"
          top="$1"
          onPress={onMoreNetwork}
        />
      ) : null}
    </YStack>
  );
};

export default memo(MarketNetworkFilter);
