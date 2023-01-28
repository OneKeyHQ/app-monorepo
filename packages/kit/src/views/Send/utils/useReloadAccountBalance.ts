import { useEffect } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export function useReloadAccountBalance({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  useEffect(() => {
    if (!accountId || !networkId) {
      return;
    }
    backgroundApiProxy.serviceToken.fetchAccountTokens({
      activeAccountId: accountId,
      activeNetworkId: networkId,
    });
  }, [accountId, networkId]);
}
