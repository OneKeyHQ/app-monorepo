import { useCallback, useEffect, useState } from 'react';

import {
  AccountDynamicItem,
  PriceAlertItem,
} from '@onekeyhq/engine/src/managers/notification';
import { Account } from '@onekeyhq/engine/src/types/account';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
  Wallet,
} from '@onekeyhq/engine/src/types/wallet';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

const sorts = {
  [WALLET_TYPE_HD]: 0,
  [WALLET_TYPE_HW]: 1,
  [WALLET_TYPE_IMPORTED]: 2,
  [WALLET_TYPE_WATCHING]: 3,
  [WALLET_TYPE_EXTERNAL]: 4,
};

export type WalletData = Omit<Wallet, 'accounts'> & {
  accounts: Account[];
};

export const useWalletsAndAccounts = () => {
  const { engine } = backgroundApiProxy;
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const getWalletsAndAccounts = useCallback(async () => {
    const walletList = await engine.getWallets();
    const walletsWithAccounts = await Promise.all(
      walletList.map(async (w) => ({
        ...w,
        accounts: await engine.getAccounts(w.accounts),
      })),
    );
    const data = walletsWithAccounts.filter((w) => !!w.accounts?.length);
    setWallets(data.sort((a, b) => sorts[a.type] - sorts[b.type]));
    return data;
  }, [engine]);

  useEffect(() => {
    getWalletsAndAccounts();
  }, [getWalletsAndAccounts]);

  return {
    wallets,
    getWalletsAndAccounts,
  };
};

export const useEnabledAccountDynamicAccounts = () => {
  const [loading, setLoading] = useState(false);
  const { serviceNotification } = backgroundApiProxy;
  const { wallets, getWalletsAndAccounts } = useWalletsAndAccounts();
  const [enabledAccounts, setEnabledAccounts] = useState<AccountDynamicItem[]>(
    [],
  );

  const fetchEnabledAccounts = useCallback(async () => {
    const accounts = await serviceNotification.queryAccountDynamic();
    setEnabledAccounts(accounts);
  }, [serviceNotification]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await fetchEnabledAccounts();
      await getWalletsAndAccounts();
    } finally {
      setLoading(false);
    }
  }, [fetchEnabledAccounts, getWalletsAndAccounts]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    loading,
    wallets,
    enabledAccounts,
    refresh,
  };
};

export const usePriceAlertlist = () => {
  const { serviceNotification } = backgroundApiProxy;
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<PriceAlertItem[]>([]);

  const fetchPriceAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await serviceNotification.queryPriceAlertList();
      setAlerts(res || []);
    } catch (e) {
      // pass
    }
    setLoading(false);
  }, [serviceNotification]);

  useEffect(() => {
    fetchPriceAlerts();
  }, [fetchPriceAlerts]);

  return {
    alerts,
    loading,
    fetchPriceAlerts,
  };
};
