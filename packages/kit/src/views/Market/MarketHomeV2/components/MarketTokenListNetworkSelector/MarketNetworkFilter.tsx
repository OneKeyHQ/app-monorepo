import { forwardRef, memo, useImperativeHandle, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { ScrollView, XStack } from '@onekeyhq/components';
import type { IPopoverProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import { GradientMask } from './GradientMask';
import { MoreButton } from './MoreButton';
import { NetworksFilterItem } from './NetworksFilterItem';

import type { ScrollView as ScrollViewType } from 'react-native';

interface ISwapNetworkToggleGroupProps {
  networks: ISwapNetwork[];
  onSelectNetwork: (network: ISwapNetwork) => void;
  selectedNetwork?: ISwapNetwork;
  onMoreNetworkSelect: (network: ISwapNetwork) => void;
  placement?: IPopoverProps['placement'];
}

export interface IMarketNetworkFilterRef {
  scrollToNetwork: (networkId: string) => void;
}

const MarketNetworkFilter = forwardRef<
  IMarketNetworkFilterRef,
  ISwapNetworkToggleGroupProps
>(
  (
    {
      networks,
      selectedNetwork,
      onSelectNetwork,
      onMoreNetworkSelect,
      placement,
    },
    ref,
  ) => {
    const intl = useIntl();
    const [scrollX, setScrollX] = useState(0);
    const scrollViewRef = useRef<ScrollViewType>(null);

    const shouldShowLeftGradient = scrollX > 2;

    useImperativeHandle(
      ref,
      () => ({
        scrollToNetwork: (networkId: string) => {
          const networkIndex = networks.findIndex(
            (network) => network.networkId === networkId,
          );
          if (networkIndex !== -1 && scrollViewRef.current) {
            const itemWidth = 24 + 24 + 8 + 50;
            const gap = 8; // $2 gap between items
            const containerPadding = 4; // p="$1" = 4px

            const scrollToX = Math.max(
              0,
              networkIndex * (itemWidth + gap) - containerPadding - 20,
            );

            scrollViewRef.current.scrollTo({
              x: scrollToX,
              animated: true,
            });
          }
        },
      }),
      [networks],
    );

    return (
      <XStack
        position="relative"
        p="$1"
        gap="$1"
        maxWidth="100%"
        overflow="hidden"
        borderWidth={1}
        borderColor="$borderSubdued"
        borderRadius="$2"
      >
        <XStack flex={1} position="relative">
          <ScrollView
            ref={scrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={(event) => {
              const currentScrollX = event.nativeEvent.contentOffset.x;
              setScrollX(currentScrollX);
            }}
            scrollEventThrottle={16}
          >
            <XStack gap="$2" pr="$4">
              {networks.map((network) => (
                <NetworksFilterItem
                  key={network.networkId}
                  networkName={network.name}
                  networkImageUri={network.logoURI}
                  tooltipContent={
                    network.isAllNetworks
                      ? intl.formatMessage({
                          id: ETranslations.global_all_networks,
                        })
                      : network.name
                  }
                  isSelected={network?.networkId === selectedNetwork?.networkId}
                  onPress={() => onSelectNetwork(network)}
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

        <MoreButton
          networks={networks}
          selectedNetworkId={selectedNetwork?.networkId}
          onNetworkSelect={onMoreNetworkSelect}
          placement={placement}
        />
      </XStack>
    );
  },
);

MarketNetworkFilter.displayName = 'MarketNetworkFilter';

const MarketNetworkFilterComponent = memo(MarketNetworkFilter);

export { MarketNetworkFilterComponent as MarketNetworkFilter };
