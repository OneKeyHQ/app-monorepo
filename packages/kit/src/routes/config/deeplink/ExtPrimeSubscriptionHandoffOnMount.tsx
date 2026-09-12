import { memo, useEffect } from 'react';

import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import { consumePrimeSubscriptionHandoffFromUrl } from './primeSubscriptionExtHandoff';

function ExtPrimeSubscriptionHandoffOnMountCmp() {
  useEffect(() => {
    if (!platformEnv.isExtensionUiExpandTab) {
      return;
    }

    const runPendingHandoff = () => {
      if (!consumePrimeSubscriptionHandoffFromUrl()) {
        return;
      }
      void (async () => {
        await timerUtils.wait(600);
        const { handleDeepLinkUrl } = await import('.');
        handleDeepLinkUrl({
          url: uriUtils.buildDeepLinkUrl({
            path: EOneKeyDeepLinkPath.prime_subscription,
          }),
        });
      })();
    };

    runPendingHandoff();
    globalThis.addEventListener('hashchange', runPendingHandoff);
    return () => {
      globalThis.removeEventListener('hashchange', runPendingHandoff);
    };
  }, []);

  return null;
}

export const ExtPrimeSubscriptionHandoffOnMount = memo(
  ExtPrimeSubscriptionHandoffOnMountCmp,
);
