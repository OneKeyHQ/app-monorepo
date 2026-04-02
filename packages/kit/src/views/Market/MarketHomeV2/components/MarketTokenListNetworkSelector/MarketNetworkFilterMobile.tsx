import { memo } from 'react';

import type { IListViewProps, IPopoverProps } from '@onekeyhq/components';
import {
  ScrollableFilterBar,
  useScrollableFilterBar,
} from '@onekeyhq/kit/src/components/ScrollableFilterBar';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { MarketNetworkStartFilterItem } from './MarketNetworkStartFilterItem';
import { NetworksFilterItem } from './NetworksFilterItem';

interface IMarketNetworkFilterMobileProps {
  networks: IServerNetwork[];
  onSelectNetwork: (network: IServerNetwork) => void;
  selectedNetwork?: IServerNetwork;
  onMoreNetworkSelect: (network: IServerNetwork) => void;
  placement?: IPopoverProps['placement'];
  showMoreButton?: boolean;
  containerStyle?: IListViewProps<any>['contentContainerStyle'];
  onStartListSelect?: () => void;
  startListSelect?: boolean;
}

function NetworksFilterItemWithLayout({
  network,
  isSelected,
  onPress,
}: {
  network: IServerNetwork;
  isSelected: boolean;
  onPress: () => void;
}) {
  const { handleItemLayout } = useScrollableFilterBar();
  return (
    <NetworksFilterItem
      networkName={network.name}
      networkImageUri={network.logoURI}
      isSelected={isSelected}
      isAllNetworks={network.isAllNetworks}
      onPress={onPress}
      onLayout={(event) => handleItemLayout(network.id, event)}
    />
  );
}

function MarketNetworkFilterMobileImpl({
  networks,
  selectedNetwork,
  onSelectNetwork,
  containerStyle,
  onStartListSelect,
  startListSelect,
}: IMarketNetworkFilterMobileProps) {
  return (
    <ScrollableFilterBar
      selectedItemId={selectedNetwork?.id}
      itemGap="$2"
      itemPr="$3"
      contentContainerStyle={containerStyle}
    >
      {onStartListSelect ? (
        <MarketNetworkStartFilterItem
          isSelected={startListSelect}
          onPress={onStartListSelect}
        />
      ) : null}
      {networks.map((network) => (
        <NetworksFilterItemWithLayout
          key={network.id}
          network={network}
          isSelected={network?.id === selectedNetwork?.id}
          onPress={() => onSelectNetwork(network)}
        />
      ))}
    </ScrollableFilterBar>
  );
}

const MarketNetworkFilterMobile = memo(MarketNetworkFilterMobileImpl);

export { MarketNetworkFilterMobile };
