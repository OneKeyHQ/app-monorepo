import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { IPopoverProps } from '@onekeyhq/components';
import { GradientMask, ScrollView, XStack } from '@onekeyhq/components';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { MoreButton } from './MoreButton';
import { NetworksFilterItem } from './NetworksFilterItem';

import type {
  LayoutChangeEvent,
  ScrollView as ScrollViewType,
} from 'react-native';

interface ISwapNetworkToggleGroupProps {
  networks: IServerNetwork[];
  onSelectNetwork: (network: IServerNetwork) => void;
  selectedNetwork?: IServerNetwork;
  onMoreNetworkSelect: (network: IServerNetwork) => void;
  placement?: IPopoverProps['placement'];
}

const LAYOUT_CONSTANTS = {
  CONTAINER_PADDING: 4, // p="$1" = 4px
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
    },
    ref,
  ) => {
    const [scrollX, setScrollX] = useState(0);
    const [scrollViewWidth, setScrollViewWidth] = useState(0);
    const [contentWidth, setContentWidth] = useState(0);
    const scrollViewRef = useRef<ScrollViewType>(null);
    const itemLayoutsRef = useRef<Record<string, { x: number; width: number }>>(
      {},
    );

    const shouldShowLeftGradient = useMemo(() => {
      return scrollX > LAYOUT_CONSTANTS.LEFT_GRADIENT_THRESHOLD;
    }, [scrollX]);

    const allowMoreButton = useMemo(() => {
      return contentWidth > scrollViewWidth;
    }, [contentWidth, scrollViewWidth]);

    const adjustedContentWidth = useMemo(() => {
      return allowMoreButton
        ? contentWidth + EXTRA_MORE_BUTTON_WIDTH
        : contentWidth;
    }, [allowMoreButton, contentWidth]);

    const shouldShowRightGradient = useMemo(() => {
      return (
        adjustedContentWidth > scrollViewWidth &&
        scrollX <
          adjustedContentWidth -
            scrollViewWidth -
            LAYOUT_CONSTANTS.LEFT_GRADIENT_THRESHOLD
      );
    }, [adjustedContentWidth, scrollViewWidth, scrollX]);

    const handleLayout = useCallback(
      (event: LayoutChangeEvent) => {
        const width = event.nativeEvent.layout.width;
        setScrollViewWidth((prevWidth) =>
          prevWidth === width ? prevWidth : width,
        );
      },
      [setScrollViewWidth],
    );

    const handleContentSizeChange = useCallback(
      (width: number) => {
        setContentWidth((prevWidth) =>
          prevWidth === width ? prevWidth : width,
        );
      },
      [setContentWidth],
    );

    const handleItemLayout = useCallback(
      (networkId: string, event: LayoutChangeEvent) => {
        const { x, width } = event.nativeEvent.layout;
        itemLayoutsRef.current[networkId] = { x, width };
      },
      [],
    );

    useImperativeHandle(
      ref,
      () => ({
        scrollToNetwork: (networkId: string) => {
          const layout = itemLayoutsRef.current[networkId];
          if (!layout || !scrollViewRef.current || scrollViewWidth === 0) {
            return;
          }

          const maxScrollX = Math.max(
            0,
            adjustedContentWidth - scrollViewWidth,
          );
          const itemStart = Math.max(
            0,
            layout.x - LAYOUT_CONSTANTS.SCROLL_OFFSET_ADJUSTMENT,
          );
          const targetX = Math.max(0, Math.min(itemStart, maxScrollX));

          scrollViewRef.current.scrollTo({
            x: targetX,
            animated: true,
          });
        },
      }),
      [adjustedContentWidth, scrollViewWidth],
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
            onScroll={(event) => {
              const currentScrollX = event.nativeEvent.contentOffset.x;
              setScrollX(currentScrollX);
            }}
            scrollEventThrottle={16}
            onLayout={handleLayout}
            onContentSizeChange={handleContentSizeChange}
          >
            <XStack gap="$0.5" pr={allowMoreButton ? '$4' : undefined}>
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
