import { useEffect, useId } from 'react';

import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

/**
 * Keeps the Lightning Spark SDK connected while the calling screen shows a
 * Spark account. The background connects only when the password is cached,
 * and disconnects 60 s after the last such screen closes.
 */
export function useLightningSparkSession({
  accountId,
  networkId,
}: {
  accountId?: string;
  networkId?: string;
}) {
  const holderId = useId();
  const isSpark = networkUtils.isLightningSparkNetworkByNetworkId(networkId);
  useEffect(() => {
    if (!isSpark || !accountId || !networkId) {
      return undefined;
    }
    void backgroundApiProxy.serviceLightningSpark.holdSession({
      holderId,
      accountId,
      networkId,
    });
    return () => {
      void backgroundApiProxy.serviceLightningSpark.releaseSession({
        holderId,
      });
    };
  }, [accountId, holderId, isSpark, networkId]);
}
