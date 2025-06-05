import { memo, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import { ScrollView, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import { GradientMask } from './GradientMask';
import { MoreButton } from './MoreButton';
import { NetworksFilterItem } from './NetworksFilterItem';

interface ISwapNetworkToggleGroupProps {
  networks: ISwapNetwork[];
  disableNetworks?: string[];
  moreNetworksCount?: number;
  moreNetworks?: ISwapNetwork[];
  onSelectNetwork: (network: ISwapNetwork) => void;
  selectedNetwork?: ISwapNetwork;
  onMoreNetwork: () => void;
  onMoreNetworkSelect: (network: ISwapNetwork) => void;
}

const MarketNetworkFilter = ({
  networks,
  selectedNetwork,
  onSelectNetwork,
  disableNetworks,
  moreNetworksCount,
  moreNetworks,
  onMoreNetworkSelect,
  onMoreNetwork,
}: ISwapNetworkToggleGroupProps) => {
  const { width } = useWindowDimensions();
  const intl = useIntl();
  const [scrollX, setScrollX] = useState(0);
  const isWiderScreen = width > 680;
  const filteredNetworks = useMemo(
    () => (isWiderScreen ? networks : networks.slice(0, 20)),
    [networks, isWiderScreen],
  );

  // 控制左侧渐变遮罩的显示，滚动超过10px后显示
  const shouldShowLeftGradient = scrollX > 2;
  return (
    <XStack
      position="relative"
      p="$1"
      maxWidth="100%"
      overflow="hidden"
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$2"
    >
      <XStack flex={1} position="relative">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={(event) => {
            const currentScrollX = event.nativeEvent.contentOffset.x;
            setScrollX(currentScrollX);
          }}
          scrollEventThrottle={16}
        >
          <XStack gap="$2" pr="$4">
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

        <GradientMask
          opacity={shouldShowLeftGradient ? 1 : 0}
          position="left"
        />
        <GradientMask position="right" />
      </XStack>

      {moreNetworksCount && moreNetworksCount > 0 ? (
        <MoreButton
          networks={moreNetworks}
          selectedNetworkId={selectedNetwork?.networkId}
          onNetworkSelect={onMoreNetworkSelect}
          onPress={onMoreNetwork}
        />
      ) : null}
    </XStack>
  );
};

export default memo(MarketNetworkFilter);
