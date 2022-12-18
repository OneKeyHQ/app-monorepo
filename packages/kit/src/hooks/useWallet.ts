import { useEffect, useState } from 'react';

import type { IWallet } from '@onekeyhq/engine/src/types';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useAppSelector } from './useAppSelector';

export const useWalletSimple = (walletId: string | null) => {
  const wallet = useAppSelector((s) =>
    s.runtime.wallets?.find((n) => n.id === walletId),
  );
  return wallet ?? null;
};

export function useWallet({
  walletId,
  walletFallback,
}: {
  walletId: string | null;
  walletFallback?: IWallet;
}) {
  const walletInRedux = useWalletSimple(walletId);
  const [walletInDb, setWalletInDb] = useState<IWallet | null>(
    walletInRedux ?? null,
  );
  useEffect(() => {
    (async () => {
      if (!walletId || walletInRedux) {
        return;
      }
      const result = await backgroundApiProxy.engine.getWallet(walletId);
      setWalletInDb(result);
    })();
  }, [walletId, walletInRedux]);

  return {
    wallet: walletInRedux ?? walletInDb ?? walletFallback,
  };
}
