import { useEffect } from 'react';

import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
import { supportedNetworks } from '../config';

export function useNetworkPrices(networkId?: string) {
  const networkPrices = useAppSelector((s) => s.discover.networkPrices);
  const activeNetwokId =
    networkId && supportedNetworks.includes(networkId)
      ? networkId
      : OnekeyNetwork.eth;
  const price = networkPrices?.[activeNetwokId];
  useEffect(() => {
    backgroundApiProxy.serviceGas.refreshGasPrice({
      networkId: activeNetwokId,
    });
    const t = setInterval(
      () =>
        backgroundApiProxy.serviceGas.refreshGasPrice({
          networkId: activeNetwokId,
        }),
      60 * 1000,
    );
    return () => clearInterval(t);
  }, [activeNetwokId]);
  return price;
}
