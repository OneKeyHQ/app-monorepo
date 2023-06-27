import { useEffect } from 'react';

import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export default function RefreshLightningNetworkToken({
  networkId,
  accountId,
  password,
}: {
  networkId: string;
  accountId: string;
  password: string;
}) {
  useEffect(() => {
    if (networkId !== OnekeyNetwork.lightning) {
      return;
    }
    backgroundApiProxy.serviceLightningNetwork
      .refreshToken({
        networkId,
        accountId,
        password,
      })
      .then(() => {
        debugLogger.common.info('refresh lightning network token success');
      })
      .catch(() => {
        debugLogger.common.info('refresh lightning network token failed');
      });
    debugLogger.common.info('should refresh lightning network token');
  }, [password, networkId, accountId]);
  return null;
}
