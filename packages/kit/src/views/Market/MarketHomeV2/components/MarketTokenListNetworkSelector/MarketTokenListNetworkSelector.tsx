import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { IPopoverProps } from '@onekeyhq/components';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { MarketTokenListNetworkSelectorNormal } from './MarketTokenListNetworkSelectorNormal';

import type { IMarketTokenListNetworkSelectorNormalRef } from './MarketTokenListNetworkSelectorNormal';

interface IMarketTokenListNetworkSelectorProps {
  selectedNetworkId?: string;
  onSelectNetworkId?: (networkId: string) => void;
  forceLoading?: boolean;
  placement?: IPopoverProps['placement'];
}

function MarketTokenListNetworkSelector({
  selectedNetworkId,
  onSelectNetworkId,
  forceLoading,
  placement,
}: IMarketTokenListNetworkSelectorProps) {
  const normalComponentRef =
    useRef<IMarketTokenListNetworkSelectorNormalRef>(null);

  const { networkList, isLoading } = useMarketBasicConfig();

  const marketNetworks: IServerNetwork[] = useMemo(() => {
    if (!networkList || networkList.length === 0) return [];

    // Sort by index (smaller numbers first) then map to local network info
    return networkList
      .sort((a, b) => a.index - b.index)
      .map((configNetwork) => {
        const networkInfo = networkUtils.getLocalNetworkInfo(
          configNetwork.networkId,
        );
        if (!networkInfo) return null;
        return networkInfo;
      })
      .filter(Boolean);
  }, [networkList]);

  // Derive currently selected network purely from props to keep component stateless.
  const currentSelectNetwork = useMemo(() => {
    if (!selectedNetworkId) return undefined;
    return marketNetworks.find((n) => n.id === selectedNetworkId);
  }, [marketNetworks, selectedNetworkId]);

  // When the list of networks changes, ensure the parent gets an initial networkId if none provided.
  useEffect(() => {
    if (marketNetworks.length === 0) return;
    if (!selectedNetworkId) {
      onSelectNetworkId?.(marketNetworks[0].id);
    }
  }, [marketNetworks, selectedNetworkId, onSelectNetworkId]);

  const onSelectCurrentNetwork = useCallback(
    (network: IServerNetwork) => {
      onSelectNetworkId?.(network.id);
    },
    [onSelectNetworkId],
  );

  const handleMoreNetworkSelect = useCallback(
    (network: IServerNetwork) => {
      onSelectCurrentNetwork(network);
    },
    [onSelectCurrentNetwork],
  );

  useEffect(() => {
    if (selectedNetworkId) {
      normalComponentRef.current?.scrollToNetwork(selectedNetworkId);
    }
  }, [selectedNetworkId]);

  return (
    <MarketTokenListNetworkSelectorNormal
      ref={normalComponentRef}
      marketNetworks={marketNetworks}
      currentSelectNetwork={currentSelectNetwork}
      onSelectCurrentNetwork={onSelectCurrentNetwork}
      handleMoreNetworkSelect={handleMoreNetworkSelect}
      isLoading={isLoading}
      forceLoading={forceLoading}
      placement={placement}
    />
  );
}

export { MarketTokenListNetworkSelector };
