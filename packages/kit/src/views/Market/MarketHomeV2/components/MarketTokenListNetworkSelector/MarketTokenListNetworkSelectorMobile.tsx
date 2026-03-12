import { memo } from 'react';

import { Stack } from '@onekeyhq/components';
import type { IListViewProps, IPopoverProps } from '@onekeyhq/components';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { MarketNetworkFilterMobile } from './MarketNetworkFilterMobile';
import { MarketTokenListNetworkSelectorNormalSkeleton } from './MarketTokenListNetworkSelectorNormalSkeleton';

interface IMarketTokenListNetworkSelectorMobileProps {
  marketNetworks: IServerNetwork[];
  currentSelectNetwork?: IServerNetwork;
  onSelectCurrentNetwork: (network: IServerNetwork) => void;
  handleMoreNetworkSelect: (network: IServerNetwork) => void;
  isLoading?: boolean;
  forceLoading?: boolean;
  placement?: IPopoverProps['placement'];
  containerStyle?: IListViewProps<any>['contentContainerStyle'];
  onStartListSelect?: () => void;
  startListSelect?: boolean;
}

function MarketTokenListNetworkSelectorMobileImpl({
  marketNetworks,
  currentSelectNetwork,
  onSelectCurrentNetwork,
  handleMoreNetworkSelect,
  isLoading: _isLoading,
  placement,
  containerStyle,
  onStartListSelect,
  startListSelect,
}: IMarketTokenListNetworkSelectorMobileProps) {
  return (
    <Stack>
      {marketNetworks.length === 0 ? (
        <MarketTokenListNetworkSelectorNormalSkeleton />
      ) : (
        <MarketNetworkFilterMobile
          networks={marketNetworks}
          selectedNetwork={currentSelectNetwork}
          onSelectNetwork={onSelectCurrentNetwork}
          onMoreNetworkSelect={handleMoreNetworkSelect}
          placement={placement}
          containerStyle={containerStyle}
          onStartListSelect={onStartListSelect}
          startListSelect={startListSelect}
        />
      )}
    </Stack>
  );
}

const MarketTokenListNetworkSelectorMobile = memo(
  MarketTokenListNetworkSelectorMobileImpl,
);

export { MarketTokenListNetworkSelectorMobile };
