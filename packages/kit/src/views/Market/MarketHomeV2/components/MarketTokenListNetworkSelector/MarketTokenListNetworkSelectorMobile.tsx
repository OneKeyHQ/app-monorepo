import { forwardRef, memo, useImperativeHandle, useRef } from 'react';

import { Stack } from '@onekeyhq/components';
import type { IListViewProps, IPopoverProps } from '@onekeyhq/components';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { MarketNetworkFilterMobile } from './MarketNetworkFilterMobile';
import { MarketTokenListNetworkSelectorNormalSkeleton } from './MarketTokenListNetworkSelectorNormalSkeleton';

import type { IMarketNetworkFilterMobileRef } from './MarketNetworkFilterMobile';

interface IMarketTokenListNetworkSelectorMobileProps {
  marketNetworks: IServerNetwork[];
  currentSelectNetwork?: IServerNetwork;
  onSelectCurrentNetwork: (network: IServerNetwork) => void;
  handleMoreNetworkSelect: (network: IServerNetwork) => void;
  isLoading?: boolean;
  forceLoading?: boolean;
  placement?: IPopoverProps['placement'];
  containerStyle?: IListViewProps<any>['contentContainerStyle'];
}

export interface IMarketTokenListNetworkSelectorMobileRef {
  scrollToNetwork: (networkId: string) => void;
}

const MarketTokenListNetworkSelectorMobile = forwardRef<
  IMarketTokenListNetworkSelectorMobileRef,
  IMarketTokenListNetworkSelectorMobileProps
>(
  (
    {
      marketNetworks,
      currentSelectNetwork,
      onSelectCurrentNetwork,
      handleMoreNetworkSelect,
      isLoading,
      placement,
      containerStyle,
    },
    ref,
  ) => {
    const marketNetworkFilterRef = useRef<IMarketNetworkFilterMobileRef>(null);

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
      <Stack>
        {isLoading || marketNetworks.length === 0 ? (
          <MarketTokenListNetworkSelectorNormalSkeleton />
        ) : (
          <MarketNetworkFilterMobile
            ref={marketNetworkFilterRef}
            networks={marketNetworks}
            selectedNetwork={currentSelectNetwork}
            onSelectNetwork={onSelectCurrentNetwork}
            onMoreNetworkSelect={handleMoreNetworkSelect}
            placement={placement}
            containerStyle={containerStyle}
          />
        )}
      </Stack>
    );
  },
);

MarketTokenListNetworkSelectorMobile.displayName =
  'MarketTokenListNetworkSelectorMobile';

const MarketTokenListNetworkSelectorMobileComponent = memo(
  MarketTokenListNetworkSelectorMobile,
);

export { MarketTokenListNetworkSelectorMobileComponent as MarketTokenListNetworkSelectorMobile };
