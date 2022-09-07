import { useCallback, useEffect, useState } from 'react';

import {
  AccountDynamicItem,
  PriceAlertItem,
} from '@onekeyhq/engine/src/managers/notification';
import { Account } from '@onekeyhq/engine/src/types/account';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

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
    setWallets(data);
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
  const { serviceNotification } = backgroundApiProxy;
  const { wallets, getWalletsAndAccounts } = useWalletsAndAccounts();
  const [enabledAccounts, setEnabledAccounts] = useState<AccountDynamicItem[]>(
    [],
  );

  const fetchEnabledAccounts = useCallback(async () => {
    const accounts = await serviceNotification.queryAccountDynamic();
    setEnabledAccounts(accounts);
  }, [serviceNotification]);

  const refresh = useCallback(() => {
    fetchEnabledAccounts();
    getWalletsAndAccounts();
  }, [fetchEnabledAccounts, getWalletsAndAccounts]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    wallets,
    enabledAccounts,
    refresh,
  };
};

export const usePriceAlertlist = () => {
  const { serviceNotification } = backgroundApiProxy;
  const [alerts, setAlerts] = useState<PriceAlertItem[]>();

  const fetchPriceAlerts = useCallback(async () => {
    const res = await serviceNotification.queryPriceAlertList();
    setAlerts(res);
  }, [serviceNotification]);

  useEffect(() => {
    fetchPriceAlerts();
  }, [fetchPriceAlerts]);

  return {
    alerts,
    fetchPriceAlerts,
  };
};
