import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { IListViewProps, IPopoverProps } from '@onekeyhq/components';
import { useMedia } from '@onekeyhq/components';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { MarketTokenListNetworkSelectorMobile } from './MarketTokenListNetworkSelectorMobile';
import { MarketTokenListNetworkSelectorNormal } from './MarketTokenListNetworkSelectorNormal';

import type { IMarketTokenListNetworkSelectorMobileRef } from './MarketTokenListNetworkSelectorMobile';
import type { IMarketTokenListNetworkSelectorNormalRef } from './MarketTokenListNetworkSelectorNormal';

interface IMarketTokenListNetworkSelectorProps {
  selectedNetworkId?: string;
  onSelectNetworkId?: (networkId: string) => void;
  placement?: IPopoverProps['placement'];
  containerStyle?: IListViewProps<any>['contentContainerStyle'];
}

function MarketTokenListNetworkSelector({
  selectedNetworkId,
  onSelectNetworkId,
  placement,
  containerStyle,
}: IMarketTokenListNetworkSelectorProps) {
  const { md } = useMedia();
  const normalComponentRef =
    useRef<IMarketTokenListNetworkSelectorNormalRef>(null);
  const mobileComponentRef =
    useRef<IMarketTokenListNetworkSelectorMobileRef>(null);

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
      if (md) {
        mobileComponentRef.current?.scrollToNetwork(selectedNetworkId);
      } else {
        normalComponentRef.current?.scrollToNetwork(selectedNetworkId);
      }
    }
  }, [selectedNetworkId, md]);

  if (md) {
    return (
      <MarketTokenListNetworkSelectorMobile
        ref={mobileComponentRef}
        marketNetworks={marketNetworks}
        currentSelectNetwork={currentSelectNetwork}
        onSelectCurrentNetwork={onSelectCurrentNetwork}
        handleMoreNetworkSelect={handleMoreNetworkSelect}
        isLoading={isLoading}
        placement={placement}
        containerStyle={containerStyle}
      />
    );
  }

  return (
    <MarketTokenListNetworkSelectorNormal
      ref={normalComponentRef}
      marketNetworks={marketNetworks}
      currentSelectNetwork={currentSelectNetwork}
      onSelectCurrentNetwork={onSelectCurrentNetwork}
      handleMoreNetworkSelect={handleMoreNetworkSelect}
      isLoading={isLoading}
      placement={placement}
    />
  );
}

export { MarketTokenListNetworkSelector };
