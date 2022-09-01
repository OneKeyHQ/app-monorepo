import { useCallback, useEffect, useState } from 'react';

import {
  AccountDynamicItem,
  PriceAlertItem,
} from '@onekeyhq/engine/src/managers/notification';
import { Account } from '@onekeyhq/engine/src/types/account';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/engine/src/types/token';

export type WalletData = Omit<Wallet, 'accounts'> & {
  accounts: Account[];
};

export const useEnabledAccountDynamicAccounts = () => {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [enabledAccounts, setEnabledAccounts] = useState<AccountDynamicItem[]>(
    [],
  );

  const getWalletsAndAccounts = useCallback(async () => {
    const walletList = await backgroundApiProxy.engine.getWallets();
    const walletsWithAccounts = await Promise.all(
      walletList.map(async (w) => ({
        ...w,
        accounts: await backgroundApiProxy.engine.getAccounts(w.accounts),
      })),
    );
    setWallets(walletsWithAccounts.filter((w) => !!w.accounts?.length));
  }, []);

  const fetchEnabledAccounts = useCallback(async () => {
    const accounts = await backgroundApiProxy.engine.queryAccountDynamic();
    setEnabledAccounts(accounts);
  }, []);

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
  const [alerts, setAlerts] = useState<PriceAlertItem[]>();

  const fetchPriceAlerts = useCallback(async () => {
    const res = await backgroundApiProxy.engine.queryPriceAlertList();
    setAlerts(res);
  }, []);

  useEffect(() => {
    fetchPriceAlerts();
  }, [fetchPriceAlerts]);

  return {
    alerts,
    fetchPriceAlerts,
  };
};

export const useSingleToken = (networkId: string, address: string) => {
  const [token, setToken] = useState<Token>();

  useEffect(() => {
    backgroundApiProxy.engine.findToken({
      networkId,
      tokenIdOnNetwork: address,
    }).then(t => {
        if(t){
          setToken(t);
        }
      });
  }, []);

  return token;
}
