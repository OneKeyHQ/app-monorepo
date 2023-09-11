import { useEffect, useMemo, useState } from 'react';

import { getWalletIdFromAccountId } from '@onekeyhq/engine/src/managers/account';
import type { IAccount } from '@onekeyhq/engine/src/types';
import flowLogger from '@onekeyhq/shared/src/logger/flowLogger/flowLogger';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useAppSelector } from './useAppSelector';

export const useAccountSimple = (accountId: string | null) => {
  const account = useAppSelector((s) =>
    s.runtime.accounts?.find((n) => n.id === accountId),
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

  const finalAccount = accountInRedux ?? accountInDb ?? accountFallback;
  return useMemo(
    () => ({
      account: finalAccount,
    }),
    [finalAccount],
  );
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
      flowLogger.error.log('useWalletIdFromAccountId', error);
      return fallback;
    }
  }, [accountId, fallback]);
