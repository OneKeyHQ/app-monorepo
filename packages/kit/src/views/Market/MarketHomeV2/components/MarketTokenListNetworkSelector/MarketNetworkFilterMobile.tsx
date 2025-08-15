import { forwardRef, memo, useImperativeHandle, useRef, useState } from 'react';

import { ScrollView, XStack } from '@onekeyhq/components';
import type { IListViewProps, IPopoverProps } from '@onekeyhq/components';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { GradientMask } from './GradientMask';
import { NetworksFilterItem } from './NetworksFilterItem';

import type { ScrollView as ScrollViewType } from 'react-native';

interface IMarketNetworkFilterMobileProps {
  networks: IServerNetwork[];
  onSelectNetwork: (network: IServerNetwork) => void;
  selectedNetwork?: IServerNetwork;
  onMoreNetworkSelect: (network: IServerNetwork) => void;
  placement?: IPopoverProps['placement'];
  showMoreButton?: boolean;
  containerStyle?: IListViewProps<any>['contentContainerStyle'];
}

// Layout constants for mobile network filter scrolling calculations
const MOBILE_LAYOUT_CONSTANTS = {
  ITEM_GAP: 8, // gap between items
  CONTAINER_PADDING: 12, // mobile padding
  SCROLL_OFFSET_ADJUSTMENT: 20,
  ITEM_WIDTH: 100, // estimated mobile item width
  LEFT_GRADIENT_THRESHOLD: 2, // Minimum scroll distance to show left gradient
} as const;

export interface IMarketNetworkFilterMobileRef {
  scrollToNetwork: (networkId: string) => void;
}

const MarketNetworkFilterMobile = forwardRef<
  IMarketNetworkFilterMobileRef,
  IMarketNetworkFilterMobileProps
>(({ networks, selectedNetwork, onSelectNetwork, containerStyle }, ref) => {
  const [scrollX, setScrollX] = useState(0);
  const [scrollViewWidth, setScrollViewWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const scrollViewRef = useRef<ScrollViewType>(null);

  const shouldShowLeftGradient =
    scrollX > MOBILE_LAYOUT_CONSTANTS.LEFT_GRADIENT_THRESHOLD;
  const shouldShowRightGradient =
    contentWidth > scrollViewWidth &&
    scrollX <
      contentWidth -
        scrollViewWidth -
        MOBILE_LAYOUT_CONSTANTS.LEFT_GRADIENT_THRESHOLD;

  useImperativeHandle(
    ref,
    () => ({
      scrollToNetwork: (networkId: string) => {
        const networkIndex = networks.findIndex(
          (network) => network.id === networkId,
        );
        if (networkIndex !== -1 && scrollViewRef.current) {
          const itemWidth = MOBILE_LAYOUT_CONSTANTS.ITEM_WIDTH;
          const gap = MOBILE_LAYOUT_CONSTANTS.ITEM_GAP;
          const containerPadding = MOBILE_LAYOUT_CONSTANTS.CONTAINER_PADDING;

          const scrollToX = Math.max(
            0,
            networkIndex * (itemWidth + gap) -
              containerPadding -
              MOBILE_LAYOUT_CONSTANTS.SCROLL_OFFSET_ADJUSTMENT,
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
    <XStack position="relative" maxWidth="100%" overflow="hidden">
      <XStack flex={1} position="relative">
        <ScrollView
          ref={scrollViewRef}
          horizontal
          contentContainerStyle={containerStyle}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(event) => {
            const currentScrollX = event.nativeEvent.contentOffset.x;
            setScrollX(currentScrollX);
          }}
          onLayout={(event) => {
            const width = event.nativeEvent.layout.width;
            setScrollViewWidth(width);
          }}
          onContentSizeChange={(width) => {
            setContentWidth(width);
          }}
        >
          <XStack gap="$2" pr="$3">
            {networks.map((network) => (
              <NetworksFilterItem
                key={network.id}
                networkName={network.name}
                networkImageUri={network.logoURI}
                isSelected={network?.id === selectedNetwork?.id}
                onPress={() => onSelectNetwork(network)}
              />
            ))}
          </XStack>
        </ScrollView>

        <GradientMask
          opacity={shouldShowLeftGradient ? 1 : 0}
          position="left"
        />
        <GradientMask
          opacity={shouldShowRightGradient ? 1 : 0}
          position="right"
        />
      </XStack>
    </XStack>
  );
});

MarketNetworkFilterMobile.displayName = 'MarketNetworkFilterMobile';

const MarketNetworkFilterMobileComponent = memo(MarketNetworkFilterMobile);

export { MarketNetworkFilterMobileComponent as MarketNetworkFilterMobile };
