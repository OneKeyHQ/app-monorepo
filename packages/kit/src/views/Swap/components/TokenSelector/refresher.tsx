import { useCallback, useContext, useEffect } from 'react';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';

import { TokenSelectorContext } from './context';

export const DataUpdaters = () => {
  const { networkId } = useContext(TokenSelectorContext);

  const onRefresh = useCallback((activeNetworkId?: string) => {
    if (activeNetworkId) {
      backgroundApiProxy.serviceToken.fetchTokensIfEmpty({
        activeNetworkId,
      });
    } else {
      backgroundApiProxy.serviceToken.getEnabledNativeTokens();
    }
  }, []);

  useEffect(() => {
    onRefresh(networkId);
  }, [onRefresh, networkId]);

  return null;
};
