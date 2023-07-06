import { useEffect, useMemo, useState } from 'react';

import {
  allNetworksAccountRegex,
  generateFakeAllnetworksAccount,
} from '@onekeyhq/engine/src/managers/account';
import type { Account } from '@onekeyhq/engine/src/types/account';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

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
  const [networkAccountsMap, setNetworkAccountMap] = useState<
    Record<string, Account[]>
  >({});

  useEffect(() => {
    backgroundApiProxy.serviceAllNetwork
      .getAllNetworksWalletAccounts({
        walletId,
        accountId,
      })
      .then((map) => {
        setNetworkAccountMap(map);
      });
  }, [walletId, accountId]);

  return networkAccountsMap;
};
