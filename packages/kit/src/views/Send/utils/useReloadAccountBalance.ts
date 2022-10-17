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
    backgroundApiProxy.serviceToken.fetchAccountTokens({
      activeAccountId: accountId,
      activeNetworkId: networkId,
      withBalance: true,
      withPrice: true,
    });
  }, [accountId, networkId]);
}
