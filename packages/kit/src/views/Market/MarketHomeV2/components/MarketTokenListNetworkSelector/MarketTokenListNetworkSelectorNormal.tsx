import { forwardRef, memo, useImperativeHandle, useRef } from 'react';

import type { IPopoverProps } from '@onekeyhq/components';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { MarketNetworkFilter } from './MarketNetworkFilter';
import { MarketTokenListNetworkSelectorNormalSkeleton } from './MarketTokenListNetworkSelectorNormalSkeleton';

import type { IMarketNetworkFilterRef } from './MarketNetworkFilter';

interface IMarketTokenListNetworkSelectorNormalProps {
  marketNetworks: IServerNetwork[];
  currentSelectNetwork?: IServerNetwork;
  onSelectCurrentNetwork: (network: IServerNetwork) => void;
  handleMoreNetworkSelect: (network: IServerNetwork) => void;
  isLoading?: boolean;
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

    if (isLoading || marketNetworks.length === 0) {
      return <MarketTokenListNetworkSelectorNormalSkeleton />;
    }

    return (
      <MarketNetworkFilter
        ref={marketNetworkFilterRef}
        networks={marketNetworks}
        selectedNetwork={currentSelectNetwork}
        onSelectNetwork={onSelectCurrentNetwork}
        onMoreNetworkSelect={handleMoreNetworkSelect}
        placement={placement}
      />
    );
  },
);

MarketTokenListNetworkSelectorNormal.displayName =
  'MarketTokenListNetworkSelectorNormal';

const MarketTokenListNetworkSelectorNormalComponent = memo(
  MarketTokenListNetworkSelectorNormal,
);

export { MarketTokenListNetworkSelectorNormalComponent as MarketTokenListNetworkSelectorNormal };
