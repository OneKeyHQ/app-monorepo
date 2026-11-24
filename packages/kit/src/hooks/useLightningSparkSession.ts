import { useEffect, useId } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EXT_SPARK_SESSION_PORT_NAME_PREFIX } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

// Extension only. Every page (popup, side panel, expanded tab) runs its own
// React tree, whose ids repeat across pages, so a hold also names its page.
// The page keeps a port open that Chrome disconnects when the page closes,
// even when the screens' cleanup does not run; the background then releases
// that page's holds.
let extPageId: string | undefined;
let extPagePort: chrome.runtime.Port | undefined;

function openExtPageSessionPort(): string {
  extPageId ??= generateUUID();
  if (!extPagePort) {
    const port = chrome.runtime.connect({
      name: `${EXT_SPARK_SESSION_PORT_NAME_PREFIX}${extPageId}`,
    });
    // A background restart closes the port; the next hold opens another.
    port.onDisconnect.addListener(() => {
      if (extPagePort === port) {
        extPagePort = undefined;
      }
    });
    extPagePort = port;
  }
  return extPageId;
}

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
  const reactId = useId();
  const isSpark = networkUtils.isLightningSparkNetworkByNetworkId(networkId);
  useEffect(() => {
    if (!isSpark || !accountId || !networkId) {
      return undefined;
    }
    const pageId = platformEnv.isExtension
      ? openExtPageSessionPort()
      : undefined;
    const holderId = `${pageId ?? ''}${reactId}`;
    void backgroundApiProxy.serviceLightningSpark.holdSession({
      holderId,
      accountId,
      networkId,
      pageId,
    });
    return () => {
      void backgroundApiProxy.serviceLightningSpark.releaseSession({
        holderId,
      });
    };
  }, [accountId, isSpark, networkId, reactId]);
}
