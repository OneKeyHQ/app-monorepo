import { useMemo } from 'react';

import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import { WALLET_TYPE_HW } from '@onekeyhq/engine/src/types/wallet';

import { useAppSelector } from './useAppSelector';

export { useAppSelector };

export const useSettings = () => {
  const settings = useAppSelector((s) => s.settings);
  return settings;
};

export const useDiscover = () => {
  const discover = useAppSelector((s) => s.discover);
  return discover;
};

export const useData = () => {
  const data = useAppSelector((s) => s.data);
  return data;
};

export const useGeneral = () => {
  const general = useAppSelector((s) => s.general);
  return general;
};

/**
 * @deprecated use useAppSelector instead
 */
export const useRuntime = () => useAppSelector((s) => s.runtime);

export const useNetworks = () => useAppSelector((s) => s.runtime.networks);

// TODO rename like useManageNetworks
export const useRuntimeWallets = () => {
  const wallets = useAppSelector((s) => s.runtime.wallets);
  const hardwareWallets = useMemo(
    () => wallets.filter((w) => w.type === WALLET_TYPE_HW),
    [wallets],
  );
  return {
    wallets,
    hardwareWallets,
  };
};

export const useAutoUpdate = () => useAppSelector((s) => s.autoUpdate);

export const useGetWalletDetail = (walletId: string | null) => {
  const wallet =
    useAppSelector((s) =>
      s.runtime.wallets?.find?.((w) => w.id === walletId),
    ) ?? null;
  return wallet;
};

export const useTools = (networkId?: string) => {
  const tools = useAppSelector((s) => s.data.tools ?? []);
  return useMemo(() => {
    if (isAllNetworks(networkId)) {
      return tools;
    }
    return tools.filter((item) => item.networkId === networkId);
  }, [tools, networkId]);
};
