import { ToastManager } from '@onekeyhq/components';
import { ToastManagerType } from '@onekeyhq/components/src/ToastManager';
import {
  allNetworksAccountRegex,
  generateFakeAllnetworksAccount,
  isAccountCompatibleWithNetwork,
} from '@onekeyhq/engine/src/managers/account';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import type { IAccount, INetwork, IWallet } from '@onekeyhq/engine/src/types';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/engine/src/types/wallet';
import flowLogger from '@onekeyhq/shared/src/logger/flowLogger/flowLogger';

import { useTransactionSendContext } from '../../views/Send/utils/TransactionSendContext';

import { buildCrossHooks } from './buildCrossHooks';

export type IActiveWalletAccount = {
  wallet: IWallet | null;
  account: IAccount | null | undefined;
  network: INetwork | null;
  externalWallet: IWallet | null;
  watchingWallet: IWallet | null;
  networkId: string;
  walletId: string;
  accountId: string;
  networkImpl: string;
  accountAddress: string;
  accountPubKey: string;
  isCompatibleNetwork: boolean;
};

// TODO remove this hook
const {
  use: useActiveWalletAccountOrigin,
  get: getActiveWalletAccount,
  // eslint-disable-next-line @typescript-eslint/no-shadow
} = buildCrossHooks<IActiveWalletAccount>((selector, { useMemo }) => {
  const activeAccountId = selector((s) => s.general.activeAccountId);
  const activeWalletId = selector((s) => s.general.activeWalletId);
  const activeNetworkId = selector((s) => s.general.activeNetworkId);

  const allNetworksAccountInfo = useMemo(() => {
    if (!isAllNetworks(activeNetworkId)) {
      return;
    }
    if (!allNetworksAccountRegex.test(activeAccountId ?? '')) {
      return;
    }
    return generateFakeAllnetworksAccount({ accountId: activeAccountId });
  }, [activeAccountId, activeNetworkId]);

  // TODO init runtime data from background
  const wallets = selector((s) => s.runtime.wallets);
  const networks = selector((s) => s.runtime.networks);
  const accounts = selector((s) => s.runtime.accounts);

  const externalWallet = useMemo(
    () => wallets.find((wallet) => wallet.id === WALLET_TYPE_EXTERNAL) ?? null,
    [wallets],
  );
  const watchingWallet = useMemo(
    () => wallets.find((wallet) => wallet.id === WALLET_TYPE_WATCHING) ?? null,
    [wallets],
  );
  const activeWallet = useMemo(
    () => wallets.find((wallet) => wallet.id === activeWalletId) ?? null,
    [activeWalletId, wallets],
  );
  const activeAccountInfo = useMemo(() => {
    if (isAllNetworks(activeNetworkId)) {
      return allNetworksAccountInfo;
    }
    return activeWallet
      ? accounts.find((account) => account.id === activeAccountId) ?? null
      : null;
  }, [
    activeAccountId,
    activeNetworkId,
    allNetworksAccountInfo,
    accounts,
    activeWallet,
  ]);
  const activeNetwork = useMemo(
    () => networks.find((network) => network.id === activeNetworkId) ?? null,
    [activeNetworkId, networks],
  );

  const networkImpl = activeNetwork?.impl || '';
  const networkId = activeNetworkId || '';
  const accountAddress = activeAccountInfo?.address || '';
  const accountPubKey = activeAccountInfo?.pubKey || '';
  const accountId = activeAccountId || '';
  const walletId = activeWalletId || '';

  const isCompatibleNetwork = useMemo(() => {
    let isCompatibleNetwork$ = true;
    if (accountId && networkId) {
      try {
        isCompatibleNetwork$ = isAccountCompatibleWithNetwork(
          accountId,
          networkId,
        );
      } catch (error) {
        flowLogger.error.log(error);
      }
    }
    return isCompatibleNetwork$;
  }, [accountId, networkId]);

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
    accountPubKey,
    walletId,
    isCompatibleNetwork,
  };
});

export function useActiveWalletAccount() {
  const result = useActiveWalletAccountOrigin();
  const context = useTransactionSendContext();

  if (context && context.isTransactionSendFlow) {
    const msg =
      'useActiveWalletAccount() is NOT allowed in Send flow. please replace to useActiveSideAccount()';
    ToastManager.show(
      {
        title: msg,
      },
      { type: ToastManagerType.error },
    );
    if (process.env.NODE_ENV !== 'production') {
      // console.error(msg);
      throw new Error(msg);
    }
  }
  return result;
}
export { getActiveWalletAccount };
