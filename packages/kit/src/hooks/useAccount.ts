import { useEffect, useMemo, useState } from 'react';

import { getWalletIdFromAccountId } from '@onekeyhq/engine/src/managers/account';
import type { IAccount } from '@onekeyhq/engine/src/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { selectRuntimeAccounts } from '../store/selectors';

import { useAppSelector } from './useAppSelector';

export const useAccountSimple = (accountId: string | null) => {
  const account = useAppSelector(selectRuntimeAccounts)?.find(
    (n) => n.id === accountId,
  );
  return account ?? null;
};

export function useAccount({
  accountId,
  networkId,
  accountFallback,
}: {
  accountId: string | null;
  networkId: string;
  accountFallback?: IAccount;
}) {
  const accountInRedux = useAccountSimple(accountId);
  const [accountInDb, setAccountInDb] = useState<IAccount | null>(
    accountInRedux ?? null,
  );
  useEffect(() => {
    (async () => {
      if (!accountId || !networkId || accountInRedux) {
        return;
      }
      const result = await backgroundApiProxy.engine.getAccount(
        accountId,
        networkId,
      );
      setAccountInDb(result);
    })();
  }, [accountId, accountInRedux, networkId]);

  return {
    account: accountInRedux ?? accountInDb ?? accountFallback,
  };
}

export const useWalletIdFromAccountIdWithFallback = (
  accountId?: string | null,
  fallback = '',
): string =>
  useMemo(() => {
    if (!accountId) {
      return fallback;
    }
    try {
      return getWalletIdFromAccountId(accountId);
    } catch (error) {
      debugLogger.common.error('useWalletIdFromAccountId', error);
      return fallback;
    }
  }, [accountId, fallback]);
