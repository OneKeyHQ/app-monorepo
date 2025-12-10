import { forwardRef, memo, useImperativeHandle } from 'react';

import type { IPopoverProps } from '@onekeyhq/components';
import { GradientMask, ScrollView, XStack } from '@onekeyhq/components';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { useNetworkFilterScroll } from '../../hooks/useNetworkFilterScroll';

import { MarketNetworkStartFilterItem } from './MarketNetworkStartFilterItem';
import { MoreButton } from './MoreButton';
import { NetworksFilterItem } from './NetworksFilterItem';

interface ISwapNetworkToggleGroupProps {
  networks: IServerNetwork[];
  onSelectNetwork: (network: IServerNetwork) => void;
  selectedNetwork?: IServerNetwork;
  onMoreNetworkSelect: (network: IServerNetwork) => void;
  placement?: IPopoverProps['placement'];
  onStartListSelect?: () => void;
  startListSelect?: boolean;
}

// Layout constants for desktop network filter scrolling
const DESKTOP_LAYOUT_CONSTANTS = {
  SCROLL_OFFSET_ADJUSTMENT: 20, // Additional offset for scroll positioning
  LEFT_GRADIENT_THRESHOLD: 2, // Minimum scroll distance to show left gradient
} as const;

const EXTRA_MORE_BUTTON_WIDTH = 64;

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
      onStartListSelect,
      startListSelect,
    },
    ref,
  ) => {
    const {
      scrollViewRef,
      shouldShowLeftGradient,
      shouldShowRightGradient,
      allowMoreButton,
      handleLayout,
      handleContentSizeChange,
      handleItemLayout,
      handleScroll,
      scrollToNetwork,
    } = useNetworkFilterScroll({
      layoutConstants: DESKTOP_LAYOUT_CONSTANTS,
      enableMoreButton: true,
      moreButtonWidth: EXTRA_MORE_BUTTON_WIDTH,
    });

    useImperativeHandle(
      ref,
      () => ({
        scrollToNetwork,
      }),
      [scrollToNetwork],
    );

    return (
      <XStack
        position="relative"
        p="$1"
        gap="$1"
        mt="$3"
        mb="$2"
        maxWidth="100%"
        overflow="hidden"
        borderWidth={1}
        borderColor="$neutral4"
        borderRadius="$3"
      >
        <XStack flex={1} position="relative">
          <ScrollView
            ref={scrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onLayout={handleLayout}
            onContentSizeChange={handleContentSizeChange}
          >
            <XStack gap="$0.5" pr={allowMoreButton ? '$4' : undefined}>
              {onStartListSelect ? (
                <MarketNetworkStartFilterItem
                  isSelected={startListSelect}
                  onPress={onStartListSelect}
                />
              ) : null}
              {networks.map((network) => (
                <NetworksFilterItem
                  key={network.id}
                  networkName={network.name}
                  networkImageUri={network.logoURI}
                  isSelected={network?.id === selectedNetwork?.id}
                  onPress={() => onSelectNetwork(network)}
                  onTouchStart={() => onSelectNetwork(network)}
                  onMouseDown={() => onSelectNetwork(network)}
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

        {allowMoreButton ? (
          <MoreButton
            networks={networks}
            selectedNetworkId={selectedNetwork?.id}
            onNetworkSelect={onMoreNetworkSelect}
            placement={placement}
          />
        ) : null}
      </XStack>
    );
  },
);

MarketNetworkFilter.displayName = 'MarketNetworkFilter';

const MarketNetworkFilterComponent = memo(MarketNetworkFilter);

export { MarketNetworkFilterComponent as MarketNetworkFilter };
