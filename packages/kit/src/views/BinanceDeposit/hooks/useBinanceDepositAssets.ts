import { useCallback, useMemo, useState } from 'react';

import type {
  IBinanceDepositAssetNetwork,
  IBinanceDepositAssetSymbol,
} from '@onekeyhq/shared/types/exchange';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

type IDepositAssetsResult = {
  networks: IBinanceDepositAssetNetwork[];
  networkNames: Record<string, string>;
  loadFailed: boolean;
};

const EMPTY_ASSETS: IDepositAssetsResult = {
  networks: [],
  networkNames: {},
  loadFailed: false,
};

// Deposit-enabled networks and symbols, plus the current selection. The
// symbol key is kept verbatim: the server compares it case-sensitively.
export function useBinanceDepositAssets({
  preferredNetworkId,
}: {
  preferredNetworkId?: string;
}) {
  const {
    result,
    isLoading,
    run: reloadAssets,
  } = usePromiseResult(
    async (): Promise<IDepositAssetsResult> => {
      let networks: IBinanceDepositAssetNetwork[];
      try {
        networks =
          await backgroundApiProxy.serviceBinanceDeposit.getDepositAssets();
      } catch {
        // The supported-assets request already raised its own toast.
        return { ...EMPTY_ASSETS, loadFailed: true };
      }
      const networkNames: Record<string, string> = {};
      try {
        const { networks: serverNetworks } =
          await backgroundApiProxy.serviceNetwork.getNetworksByIds({
            networkIds: networks.map((item) => item.networkId),
          });
        serverNetworks.forEach((item) => {
          networkNames[item.id] = item.name;
        });
      } catch {
        // Names are cosmetic; the network id is shown instead.
      }
      return { networks, networkNames, loadFailed: false };
    },
    [],
    { watchLoading: true, initResult: EMPTY_ASSETS },
  );

  const [selectedNetworkId, setSelectedNetworkId] = useState<
    string | undefined
  >();
  const [selectedSymbol, setSelectedSymbol] = useState<string | undefined>();

  const { networks, networkNames, loadFailed } = result;

  const network = useMemo<IBinanceDepositAssetNetwork | undefined>(
    () =>
      networks.find((item) => item.networkId === selectedNetworkId) ??
      networks.find((item) => item.networkId === preferredNetworkId) ??
      networks[0],
    [networks, preferredNetworkId, selectedNetworkId],
  );

  const symbol = useMemo<IBinanceDepositAssetSymbol | undefined>(
    () =>
      network?.symbols.find((item) => item.symbol === selectedSymbol) ??
      network?.symbols[0],
    [network, selectedSymbol],
  );

  const selectNetwork = useCallback((networkId: string) => {
    setSelectedNetworkId(networkId);
    setSelectedSymbol(undefined);
  }, []);

  const findSymbol = useCallback(
    (params: {
      networkId: string;
      symbol: string;
    }): IBinanceDepositAssetSymbol | undefined =>
      networks
        .find((item) => item.networkId === params.networkId)
        ?.symbols.find((item) => item.symbol === params.symbol),
    [networks],
  );

  return {
    networks,
    networkNames,
    isLoading: Boolean(isLoading),
    loadFailed,
    reloadAssets,
    network,
    symbol,
    selectNetwork,
    selectSymbol: setSelectedSymbol,
    findSymbol,
  };
}
