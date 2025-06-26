import { forwardRef, memo, useImperativeHandle, useRef } from 'react';

import { Stack } from '@onekeyhq/components';
import type { IPopoverProps } from '@onekeyhq/components';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import { MarketNetworkFilter } from './MarketNetworkFilter';
import { MarketTokenListNetworkSelectorNormalSkeleton } from './MarketTokenListNetworkSelectorNormalSkeleton';

import type { IMarketNetworkFilterRef } from './MarketNetworkFilter';

interface IMarketTokenListNetworkSelectorNormalProps {
  marketNetworks: ISwapNetwork[];
  currentSelectNetwork?: ISwapNetwork;
  onSelectCurrentNetwork: (network: ISwapNetwork) => void;
  handleMoreNetworkSelect: (network: ISwapNetwork) => void;
  isLoading?: boolean;
  forceLoading?: boolean;
  placement?: IPopoverProps['placement'];
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
      placement,
    },
    ref,
  ) => {
    const marketNetworkFilterRef = useRef<IMarketNetworkFilterRef>(null);

    useImperativeHandle(
      ref,
      () => ({
        scrollToNetwork: (networkId: string) => {
          setTimeout(() => {
            marketNetworkFilterRef.current?.scrollToNetwork(networkId);
          }, 100);
        },
      }),
      [],
    );

    return (
      <Stack pt="$3" pl="$5" pr="$5" pb="$2">
        {isLoading || forceLoading ? (
          <MarketTokenListNetworkSelectorNormalSkeleton />
        ) : (
          <MarketNetworkFilter
            ref={marketNetworkFilterRef}
            networks={marketNetworks}
            selectedNetwork={currentSelectNetwork}
            onSelectNetwork={onSelectCurrentNetwork}
            onMoreNetworkSelect={handleMoreNetworkSelect}
            placement={placement}
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

export { MarketTokenListNetworkSelectorNormalComponent as MarketTokenListNetworkSelectorNormal };
