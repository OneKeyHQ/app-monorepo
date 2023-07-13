import { useEffect, useMemo, useState } from 'react';

import {
  allNetworksAccountRegex,
  generateFakeAllnetworksAccount,
} from '@onekeyhq/engine/src/managers/account';
import type { Account } from '@onekeyhq/engine/src/types/account';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useManageNetworks } from './useManageNetworks';

export const useAllNetworkAccountInfo = ({
  accountId,
}: {
  accountId: string;
}) =>
  useMemo(() => {
    if (!allNetworksAccountRegex.test(accountId)) {
      return;
    }
    return generateFakeAllnetworksAccount({ accountId });
  }, [accountId]);

export const useAllNetworksWalletAccounts = ({
  walletId,
  accountId,
}: {
  walletId: string;
  accountId: string;
}) => {
  const [loading, setLoading] = useState(false);
  const { enabledNetworks } = useManageNetworks();
  const [networkAccountsMap, setNetworkAccountMap] = useState<
    Record<string, Account[]>
  >({});

  useEffect(() => {
    setLoading(true);
    backgroundApiProxy.serviceAllNetwork
      .getAllNetworksWalletAccounts({
        walletId,
        accountId,
      })
      .then((map) => {
        setNetworkAccountMap(map);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [walletId, accountId, enabledNetworks]);

  return {
    loading,
    data: networkAccountsMap,
  };
};
