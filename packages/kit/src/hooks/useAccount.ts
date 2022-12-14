import { useEffect, useState } from 'react';

import type { IAccount } from '@onekeyhq/engine/src/types';

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

  return {
    account: accountInRedux ?? accountInDb ?? accountFallback,
  };
}
