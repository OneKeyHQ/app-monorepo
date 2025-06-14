import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

import { Stack } from '@onekeyhq/components';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import MarketNetworkFilter from './MarketNetworkFilter';
import MarketTokenListNetworkSelectorNormalSkeleton from './MarketTokenListNetworkSelectorNormalSkeleton';

import type { IMarketNetworkFilterRef } from './MarketNetworkFilter';

interface IMarketTokenListNetworkSelectorNormalProps {
  marketNetworks: ISwapNetwork[];
  currentSelectNetwork?: ISwapNetwork;
  onSelectCurrentNetwork: (network: ISwapNetwork) => void;
  handleMoreNetworkSelect: (network: ISwapNetwork) => void;
  isLoading?: boolean;
  forceLoading?: boolean;
}

export interface IMarketTokenListNetworkSelectorNormalRef {
  scrollToNetwork: (networkId: string) => void;
}

const MarketTokenListNetworkSelectorNormal = forwardRef<
  IMarketTokenListNetworkSelectorNormalRef,
  IMarketTokenListNetworkSelectorNormalProps
>(
  (
    {
      marketNetworks,
      currentSelectNetwork,
      onSelectCurrentNetwork,
      handleMoreNetworkSelect,
      isLoading,
      forceLoading,
    },
    ref,
  ) => {
    const marketNetworkFilterRef = useRef<IMarketNetworkFilterRef>(null);

    useImperativeHandle(
      ref,
      () => ({
        scrollToNetwork: (networkId: string) => {
          // 使用 setTimeout 确保状态更新后再滚动
          setTimeout(() => {
            marketNetworkFilterRef.current?.scrollToNetwork(networkId);
          }, 100);
        },
      }),
      [],
    );

    return (
      <Stack paddingVertical="$3" paddingHorizontal="$5">
        {isLoading || forceLoading ? (
          <MarketTokenListNetworkSelectorNormalSkeleton />
        ) : (
          <MarketNetworkFilter
            ref={marketNetworkFilterRef}
            networks={marketNetworks}
            selectedNetwork={currentSelectNetwork}
            onSelectNetwork={onSelectCurrentNetwork}
            onMoreNetworkSelect={handleMoreNetworkSelect}
          />
        )}
      </Stack>
    );
  },
);

MarketTokenListNetworkSelectorNormal.displayName =
  'MarketTokenListNetworkSelectorNormal';

const MarketTokenListNetworkSelectorNormalComponent = memo(
  MarketTokenListNetworkSelectorNormal,
);

export default MarketTokenListNetworkSelectorNormalComponent;
