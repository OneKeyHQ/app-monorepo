import { useMemo } from 'react';

import {
  allNetworksAccountRegex,
  generateFakeAllnetworksAccount,
} from '@onekeyhq/engine/src/managers/account';

import { useAppSelector } from './useAppSelector';

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
  accountId,
}: {
  accountId?: string | null;
}) => {
  const map = useAppSelector((s) => s.overview.allNetworksAccountsMap);

  const data = useMemo(() => map?.[accountId || ''] ?? {}, [map, accountId]);

  return {
    data,
  };
};
