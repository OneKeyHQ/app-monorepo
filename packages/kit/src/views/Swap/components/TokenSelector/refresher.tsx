import { useCallback, useContext, useEffect } from 'react';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../../../hooks';

import { TokenSelectorContext } from './context';

export const DataUpdaters = () => {
  const { networkId } = useContext(TokenSelectorContext);
  const { accountId } = useActiveWalletAccount();

  const onRefresh = useCallback(
    (activeNetworkId?: string) => {
      if (activeNetworkId) {
        backgroundApiProxy.serviceToken.fetchTokensIfEmpty({
          activeAccountId: accountId,
          activeNetworkId,
        });
        backgroundApiProxy.serviceToken.fetchAccountTokensIfEmpty({
          activeAccountId: accountId,
          activeNetworkId,
        });
      }
    },
    [accountId],
  );

  useEffect(() => {
    onRefresh(networkId);
  }, [onRefresh, networkId]);

  return null;
};
