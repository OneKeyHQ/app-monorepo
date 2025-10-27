import { forwardRef, memo, useImperativeHandle } from 'react';

import type { IListViewProps, IPopoverProps } from '@onekeyhq/components';
import { GradientMask, ScrollView, XStack } from '@onekeyhq/components';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { useNetworkFilterScroll } from '../../hooks/useNetworkFilterScroll';

import { NetworksFilterItem } from './NetworksFilterItem';

interface IMarketNetworkFilterMobileProps {
  networks: IServerNetwork[];
  onSelectNetwork: (network: IServerNetwork) => void;
  selectedNetwork?: IServerNetwork;
  onMoreNetworkSelect: (network: IServerNetwork) => void;
  placement?: IPopoverProps['placement'];
  showMoreButton?: boolean;
  containerStyle?: IListViewProps<any>['contentContainerStyle'];
}

// Layout constants for mobile network filter scrolling
const MOBILE_LAYOUT_CONSTANTS = {
  SCROLL_OFFSET_ADJUSTMENT: 4,
  LEFT_GRADIENT_THRESHOLD: 2, // Minimum scroll distance to show left gradient
} as const;

export interface IMarketNetworkFilterMobileRef {
  scrollToNetwork: (networkId: string) => void;
}

const MarketNetworkFilterMobile = forwardRef<
  IMarketNetworkFilterMobileRef,
  IMarketNetworkFilterMobileProps
>(({ networks, selectedNetwork, onSelectNetwork, containerStyle }, ref) => {
  const {
    scrollViewRef,
    shouldShowLeftGradient,
    shouldShowRightGradient,
    handleLayout,
    handleContentSizeChange,
    handleItemLayout,
    handleScroll,
    scrollToNetwork,
  } = useNetworkFilterScroll({
    layoutConstants: MOBILE_LAYOUT_CONSTANTS,
    enableMoreButton: false,
    moreButtonWidth: 0,
  });

  useImperativeHandle(
    ref,
    () => ({
      scrollToNetwork,
    }),
    [scrollToNetwork],
  );

  return (
    <XStack position="relative" maxWidth="100%" overflow="hidden">
      <XStack flex={1} position="relative">
        <ScrollView
          ref={scrollViewRef}
          horizontal
          contentContainerStyle={containerStyle}
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onLayout={handleLayout}
          onContentSizeChange={handleContentSizeChange}
        >
          <XStack gap="$2" pr="$3">
            {networks.map((network) => (
              <NetworksFilterItem
                key={network.id}
                networkName={network.name}
                networkImageUri={network.logoURI}
                isSelected={network?.id === selectedNetwork?.id}
                onPress={() => onSelectNetwork(network)}
                onLayout={(event) => handleItemLayout(network.id, event)}
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
