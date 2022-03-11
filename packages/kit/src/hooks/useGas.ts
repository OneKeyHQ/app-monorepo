import useSWR from 'swr';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useAppSelector } from './redux';

export const useGas = (assert = true, networkId?: string) => {
  const defaultNetworkId = useAppSelector(
    (s) => s.general.activeNetwork?.network?.id,
  );
  const activeNetworkId = networkId ?? defaultNetworkId;
  const key = assert && activeNetworkId ? 'gas' : null;
  const result = useSWR(
    key,
    () => backgroundApiProxy.engine.getGasPrice(activeNetworkId ?? ''),
    {
      refreshInterval: 20 * 1000,
    },
  );
  return result;
};
