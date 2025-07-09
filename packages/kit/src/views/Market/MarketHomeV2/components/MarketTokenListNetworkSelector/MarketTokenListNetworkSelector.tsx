import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { IPopoverProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { MarketTokenListNetworkSelectorNormal } from './MarketTokenListNetworkSelectorNormal';
import { MarketTokenListNetworkSelectorSmall } from './MarketTokenListNetworkSelectorSmall';

import type { IMarketTokenListNetworkSelectorNormalRef } from './MarketTokenListNetworkSelectorNormal';

interface IMarketTokenListNetworkSelectorProps {
  selectedNetworkId?: string;
  onSelectNetworkId?: (networkId: string) => void;
  forceLoading?: boolean;
  size?: 'normal' | 'small';
  placement?: IPopoverProps['placement'];
}

function MarketTokenListNetworkSelector({
  selectedNetworkId,
  onSelectNetworkId,
  forceLoading,
  size = 'normal',
  placement,
}: IMarketTokenListNetworkSelectorProps) {
  const normalComponentRef =
    useRef<IMarketTokenListNetworkSelectorNormalRef>(null);

  const { result: marketChainsData, isLoading } = usePromiseResult(
    () => backgroundApiProxy.serviceMarketV2.fetchMarketChains(),
    [],
  );

  const marketNetworks: IServerNetwork[] = useMemo(() => {
    if (!marketChainsData?.list) return [];
    return marketChainsData.list
      .map((chain) => {
        const networkInfo = networkUtils.getLocalNetworkInfo(chain.networkId);
        if (!networkInfo) return null;
        return networkInfo;
      })
      .filter(Boolean);
  }, [marketChainsData]);

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

  if (size === 'small') {
    return (
      <MarketTokenListNetworkSelectorSmall
        marketNetworks={marketNetworks}
        currentSelectNetwork={currentSelectNetwork}
        onSelectCurrentNetwork={onSelectCurrentNetwork}
        isLoading={isLoading}
        forceLoading={forceLoading}
        placement={placement}
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
      forceLoading={forceLoading}
      placement={placement}
    />
  );
}

export { MarketTokenListNetworkSelector };
