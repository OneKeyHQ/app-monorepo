import { useEffect, useState } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export function useExistNostrAccount({
  walletId,
  currentAccountId,
  currentNetworkId,
}: {
  walletId: string;
  currentAccountId: string;
  currentNetworkId: string;
}) {
  const [isFetchNostrAccount, setIsFetchNostrAccount] = useState(true);
  const [existNostrAccount, setExistNostrAccount] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const account = await backgroundApiProxy.serviceNostr.getNostrAccount({
          walletId,
          currentNetworkId,
          currentAccountId,
        });
        setExistNostrAccount(!!(account?.address && account?.pubKey));
      } catch (e) {
        setExistNostrAccount(false);
      } finally {
        setIsFetchNostrAccount(false);
      }
    })();
  }, [walletId, currentAccountId, currentNetworkId]);

  return {
    isFetchNostrAccount,
    existNostrAccount,
  };
}
