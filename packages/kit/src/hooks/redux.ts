import { useMemo } from 'react';

import { useToast } from '@onekeyhq/components';
import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import { IAccount, INetwork, IWallet } from '@onekeyhq/engine/src/types';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HW,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/engine/src/types/wallet';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { appSelector } from '../store';
import { useTransactionSendContext } from '../views/Send/utils/TransactionSendContext';

import { useAppSelector } from './useAppSelector';

export { useAppSelector };
export type ISelectorBuilder = (
  selector: typeof useAppSelector,
  helpers: {
    useMemo: typeof useMemo;
  },
) => unknown;

function mockUseMemo<T>(
  factory: () => T,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  deps: React.DependencyList | undefined,
) {
  return factory();
}

export function makeSelector<T>(builder: ISelectorBuilder) {
  return {
    // hooks for UI
    use: (): T => builder(useAppSelector, { useMemo }) as T,
    // getter for Background
    get: (): T =>
      builder(appSelector, {
        useMemo: mockUseMemo,
      }) as T,
  };
}

export const useSettings = () => {
  const settings = useAppSelector((s) => s.settings);
  return settings;
};

export const useDiscover = () => {
  const discover = useAppSelector((s) => s.discover);
  return discover;
};

export const useStatus = () => {
  const status = useAppSelector((s) => s.status);
  return status;
};

export const useData = () => {
  const data = useAppSelector((s) => s.data);
  return data;
};

export const useGeneral = () => {
  const general = useAppSelector((s) => s.general);
  return general;
};

export const useRuntime = () => useAppSelector((s) => s.runtime);

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

export type IActiveWalletAccount = {
  wallet: IWallet | null;
  account: IAccount | null;
  network: INetwork | null;
  externalWallet: IWallet | null;
  watchingWallet: IWallet | null;
  networkId: string;
  walletId: string;
  accountId: string;
  networkImpl: string;
  accountAddress: string;
  isCompatibleNetwork: boolean;
};

export const {
  use: useActiveWalletAccountOrigin,
  get: getActiveWalletAccount,
} = makeSelector<IActiveWalletAccount>((selector) => {
  const { activeAccountId, activeWalletId, activeNetworkId } = selector(
    (s) => s.general,
  );

  // TODO init runtime data from background
  const { wallets, networks, accounts } = selector((s) => s.runtime);

  const externalWallet =
    wallets.find((wallet) => wallet.id === WALLET_TYPE_EXTERNAL) ?? null;
  const watchingWallet =
    wallets.find((wallet) => wallet.id === WALLET_TYPE_WATCHING) ?? null;

  const activeWallet =
    wallets.find((wallet) => wallet.id === activeWalletId) ?? null;
  const activeAccountInfo = activeWallet
    ? accounts.find((account) => account.id === activeAccountId) ?? null
    : null;
  const activeNetwork =
    networks.find((network) => network.id === activeNetworkId) ?? null;

  const networkImpl = activeNetwork?.impl || '';
  const networkId = activeNetworkId || '';
  const accountAddress = activeAccountInfo?.address || '';
  const accountId = activeAccountId || '';
  const walletId = activeWalletId || '';

  let isCompatibleNetwork = true;
  if (accountId && networkId) {
    try {
      isCompatibleNetwork = isAccountCompatibleWithNetwork(
        accountId,
        networkId,
      );
    } catch (error) {
      debugLogger.common.error(error);
    }
  }

  return {
    wallet: activeWallet,
    account: activeAccountInfo,
    network: activeNetwork,
    externalWallet,
    watchingWallet,
    accountId,
    networkId,
    networkImpl,
    accountAddress,
    walletId,
    isCompatibleNetwork,
  };
});

export function useActiveWalletAccount() {
  const result = useActiveWalletAccountOrigin();
  const context = useTransactionSendContext();
  const toast = useToast();
  if (context && context.isTransactionSendFlow) {
    const msg =
      'useActiveWalletAccount() is NOT allowed in Send flow. please replace to useActiveSideAccount()';
    toast.show(
      {
        title: msg,
      },
      {
        type: 'error',
      },
    );
    if (process.env.NODE_ENV !== 'production') {
      // console.error(msg);
      throw new Error(msg);
    }
  }
  return result;
}

export const useGetWalletDetail = (walletId: string | null) => {
  const wallet =
    useAppSelector((s) =>
      s.runtime.wallets?.find?.((w) => w.id === walletId),
    ) ?? null;
  return wallet;
};

export const useFiatPay = (networkId: string) => {
  const currencies = useAppSelector((s) => s.data.onekeySupportList);
  return currencies.filter((item) => item.networkId === networkId);
};

export const useMoonpayPayCurrency = (code?: string) =>
  useAppSelector((s) => s.data.currencyList).find((item) => item.code === code);
