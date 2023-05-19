import { useCallback, useEffect, useState } from 'react';

import { isCoinTypeCompatibleWithImpl } from '@onekeyhq/engine/src/managers/impl';
import type {
  AccountDynamicItem,
  PriceAlertItem,
} from '@onekeyhq/engine/src/managers/notification';
import {
  ADDRESS_ZERO,
  DUMMY_ADDRESS,
  DUMMY_ADDRESS_2,
  DUMMY_ADDRESS_3,
} from '@onekeyhq/engine/src/managers/revoke';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { makeTimeoutPromise } from '@onekeyhq/shared/src/background/backgroundUtils';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useRuntime } from '../../hooks/redux';

export type WalletData = Omit<Wallet, 'accounts'> & {
  accounts: Account[];
};

const isBurnAddress = (address: string) =>
  [ADDRESS_ZERO, DUMMY_ADDRESS, DUMMY_ADDRESS_2, DUMMY_ADDRESS_3].includes(
    address,
  );

export const useEvmWalletsAndAccounts = () => {
  const { engine } = backgroundApiProxy;
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const { wallets: walletsWithoutAccount } = useRuntime();

  const getWalletsAndAccounts = useCallback(async () => {
    const data = await Promise.all(
      walletsWithoutAccount.map(async (w) => {
        const accounts = await engine.getAccounts(w.accounts);
        return {
          ...w,
          accounts:
            accounts?.filter((account) => {
              if (!account) {
                return false;
              }
              const { address, coinType } = account || {};
              if (isBurnAddress(address)) {
                return false;
              }
              if (!isCoinTypeCompatibleWithImpl(coinType, IMPL_EVM)) {
                return false;
              }
              return true;
            }) ?? [],
        };
      }),
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

export const useEnabledAccountDynamicAccounts = (queryOnMount = true) => {
  const [loading, setLoading] = useState(false);
  const { serviceNotification } = backgroundApiProxy;
  const { wallets, getWalletsAndAccounts } = useEvmWalletsAndAccounts();
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
    if (queryOnMount) {
      refresh();
    }
  }, [refresh, queryOnMount]);

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

export const checkAccountCanSubscribe = async (
  account: Account | null,
  networkId: string,
) => {
  if (!account) {
    return false;
  }
  const { address, coinType } = account || {};
  if (isBurnAddress(address)) {
    return false;
  }
  if (!isCoinTypeCompatibleWithImpl(coinType, IMPL_EVM)) {
    return false;
  }
  const isContract = await makeTimeoutPromise({
    asyncFunc: async () =>
      backgroundApiProxy.validator.isContractAddress(networkId, address),
    timeout: 6000,
    timeoutResult: false,
  });
  return !isContract;
};
