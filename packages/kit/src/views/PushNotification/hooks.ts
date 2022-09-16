import { useCallback, useEffect, useState } from 'react';

import {
  AccountDynamicItem,
  PriceAlertItem,
} from '@onekeyhq/engine/src/managers/notification';
import { Account } from '@onekeyhq/engine/src/types/account';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useRuntime } from '../../hooks/redux';

export type WalletData = Omit<Wallet, 'accounts'> & {
  accounts: Account[];
};

export const useWalletsAndAccounts = () => {
  const { engine } = backgroundApiProxy;
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const { wallets: walletsWithoutAccount } = useRuntime();

  const getWalletsAndAccounts = useCallback(async () => {
    const data = await Promise.all(
      walletsWithoutAccount.map(async (w) => ({
        ...w,
        accounts: await engine.getAccounts(w.accounts),
      })),
    );
    setWallets(data);
    return data;
  }, [engine, walletsWithoutAccount]);

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
