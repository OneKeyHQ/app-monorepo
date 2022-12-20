import { useCallback, useEffect, useState } from 'react';

import { useAsync } from 'react-async-hook';

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
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';

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

const isBurnAddress = (address: string) =>
  [ADDRESS_ZERO, DUMMY_ADDRESS, DUMMY_ADDRESS_2, DUMMY_ADDRESS_3].includes(
    address,
  );

export const checkAccountCanSubscribe = async (account: Account | null) => {
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
  const isContractArray = await makeTimeoutPromise({
    asyncFunc: async () =>
      Promise.all(
        [
          OnekeyNetwork.eth,
          OnekeyNetwork.polygon,
          OnekeyNetwork.arbitrum,
          OnekeyNetwork.optimism,
        ].map((networkId) =>
          backgroundApiProxy.validator.isContractAddress(networkId, address),
        ),
      ),
    timeout: 6000,
    timeoutResult: [],
  });
  return isContractArray.every((n) => n !== true);
};

export const useAddressCanSubscribe = (account: Account | null) => {
  const { result } = useAsync(
    async () => checkAccountCanSubscribe(account),
    [account],
  );
  return result ?? false;
};
