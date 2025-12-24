import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { IListViewProps, IPopoverProps } from '@onekeyhq/components';
import { useMedia } from '@onekeyhq/components';
import { useMarketNetworks } from '@onekeyhq/kit/src/views/Market/hooks';
import { type IServerNetwork } from '@onekeyhq/shared/types';

import { MarketTokenListNetworkSelectorMobile } from './MarketTokenListNetworkSelectorMobile';
import { MarketTokenListNetworkSelectorNormal } from './MarketTokenListNetworkSelectorNormal';

import type { IMarketTokenListNetworkSelectorMobileRef } from './MarketTokenListNetworkSelectorMobile';
import type { IMarketTokenListNetworkSelectorNormalRef } from './MarketTokenListNetworkSelectorNormal';

interface IMarketTokenListNetworkSelectorProps {
  selectedNetworkId?: string;
  onSelectNetworkId?: (networkId: string) => void;
  placement?: IPopoverProps['placement'];
  containerStyle?: IListViewProps<any>['contentContainerStyle'];
  onStartListSelect?: () => void;
  startListSelect?: boolean;
}

function MarketTokenListNetworkSelector({
  selectedNetworkId,
  onSelectNetworkId,
  placement,
  containerStyle,
  onStartListSelect,
  startListSelect,
}: IMarketTokenListNetworkSelectorProps) {
  const { md } = useMedia();
  const normalComponentRef =
    useRef<IMarketTokenListNetworkSelectorNormalRef>(null);
  const mobileComponentRef =
    useRef<IMarketTokenListNetworkSelectorMobileRef>(null);

  const { marketNetworks, isLoading } = useMarketNetworks();

  // Derive currently selected network purely from props to keep component stateless.
  const currentSelectNetwork = useMemo(() => {
    if (!selectedNetworkId) return undefined;
    return marketNetworks.find((n) => n.id === selectedNetworkId);
  }, [marketNetworks, selectedNetworkId]);

  // When the list of networks changes, ensure the parent gets an initial networkId if none provided.
  useEffect(() => {
    if (marketNetworks.length === 0) return;
    if (!currentSelectNetwork && !startListSelect) {
      onSelectNetworkId?.(marketNetworks[0].id);
    }
  }, [
    marketNetworks,
    selectedNetworkId,
    onSelectNetworkId,
    startListSelect,
    currentSelectNetwork,
  ]);
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
        onStartListSelect={onStartListSelect}
        startListSelect={startListSelect}
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
      onStartListSelect={onStartListSelect}
      startListSelect={startListSelect}
    />
  );
}

export { MarketTokenListNetworkSelector };
