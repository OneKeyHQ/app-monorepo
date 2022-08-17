import { TypedUseSelectorHook, useSelector } from 'react-redux';

import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { WALLET_TYPE_EXTERNAL } from '@onekeyhq/engine/src/types/wallet';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { appDispatch, appSelector } from '../store';

import type { IAppState } from '../store';
import type { INetwork } from '../store/reducers/runtime';

export const useAppDispatch = () => {
  console.error(
    '`useAppDispatch()` is deprecated. use `const { dispatch } = backgroundApiProxy;` instead.',
  );
  return appDispatch;
};
export const useAppSelector: TypedUseSelectorHook<IAppState> = useSelector;

export type ISelectorBuilder = (selector: typeof useAppSelector) => unknown;

export function makeSelector<T>(builder: ISelectorBuilder) {
  return {
    // hooks for UI
    use: (): T => builder(useAppSelector) as T,
    // getter for Background
    get: (): T => builder(appSelector) as T,
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

export const useAutoUpdate = () => useAppSelector((s) => s.autoUpdate);

export type IActiveWalletAccount = {
  wallet: Wallet | null;
  account: Account | null;
  network: INetwork | null;
  externalWallet: Wallet | null;
  networkId: string;
  walletId: string;
  accountId: string;
  networkImpl: string;
  accountAddress: string;
  isCompatibleNetwork: boolean;
};

export const { use: useActiveWalletAccount, get: getActiveWalletAccount } =
  makeSelector<IActiveWalletAccount>((selector) => {
    const { activeAccountId, activeWalletId, activeNetworkId } = selector(
      (s) => s.general,
    );

    // TODO init runtime data from background
    const { wallets, networks, accounts } = selector((s) => s.runtime);

    const externalWallet =
      wallets.find((wallet) => wallet.id === WALLET_TYPE_EXTERNAL) ?? null;

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
      accountId,
      networkId,
      networkImpl,
      accountAddress,
      walletId,
      isCompatibleNetwork,
    };
  });

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

export const useNetwork = (networkId?: string | null) => {
  const network = useAppSelector((s) =>
    s.runtime.networks?.find((n) => n.id === networkId),
  );
  return network ?? null;
};

export const useAccount = (accountId: string | null) => {
  const account = useAppSelector((s) =>
    s.runtime.accounts?.find((n) => n.id === accountId),
  );
  return account ?? null;
};
