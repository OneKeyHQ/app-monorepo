import { useCallback, useContext, useEffect } from 'react';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  useAccountTokens,
  useActiveWalletAccount,
  useNetworkTokens,
} from '../../../../hooks';
import { setSelectedNetworkId } from '../../../../store/reducers/swap';

import { NetworkSelectorContext } from './context';

export const TokenSelectorListeners = () => {
  const { accountId: activeAccountId, networkId: currentNetworkId } =
    useActiveWalletAccount();
  const { networkId: activeNetworkId } = useContext(NetworkSelectorContext);
  useEffect(() => {
    backgroundApiProxy.serviceToken.fetchAccountTokens({
      activeAccountId,
      activeNetworkId,
      withBalance: true,
    });
    backgroundApiProxy.serviceToken.fetchTokens({
      activeAccountId,
      activeNetworkId,
      withBalance: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeNetworkId && currentNetworkId) {
      backgroundApiProxy.dispatch(setSelectedNetworkId(currentNetworkId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const networkTokens = useNetworkTokens(activeNetworkId);
  const accountTokens = useAccountTokens(activeNetworkId, activeAccountId);

  const onPullNetworkTokens = useCallback(() => {
    if (activeNetworkId) {
      if (!networkTokens.length) {
        backgroundApiProxy.serviceToken.fetchTokens({
          activeAccountId,
          activeNetworkId,
        });
      }
      if (!accountTokens.length) {
        backgroundApiProxy.serviceToken.fetchAccountTokens({
          activeAccountId,
          activeNetworkId,
        });
      }
    }
  }, [networkTokens, accountTokens, activeNetworkId, activeAccountId]);

  useEffect(() => {
    onPullNetworkTokens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNetworkId]);

  return null;
};
