import { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import { DeepLinkLanding } from '../../components/DeepLinkLanding';
import { HomeTestIDs } from '../../testIDs';
import {
  openAppViaDeepLink,
  scheduleDeepLinkFallbackHint,
} from '../../utils/deepLinkLaunchUtils';

import { openPrimeSubscriptionFromWebLanding } from './openPrimeSubscriptionFromWebLanding';

const AUTO_OPEN_DELAY_MS = 300;
const PRIME_SUBSCRIPTION_DEEP_LINK_FALLBACK_DELAY_MS = 3000;
const PRIME_SUBSCRIPTION_DEEP_LINK = uriUtils.buildDeepLinkUrl({
  path: EOneKeyDeepLinkPath.prime_subscription,
});

function PrimeSubscriptionLandingPage() {
  const intl = useIntl();
  const [isFallbackVisible, setIsFallbackVisible] = useState(false);

  useEffect(() => {
    if (!platformEnv.isWeb) {
      return undefined;
    }

    let cancelled = false;
    let fallbackCleanup: (() => void) | undefined;
    const autoOpenTimerId = setTimeout(() => {
      void openPrimeSubscriptionFromWebLanding({
        openViaDeepLink: () => {
          if (cancelled) {
            return;
          }
          // Native fallback is only for a missing/failed extension RPC.
          // Scheduling it while wallet_openPrimeSubscription is pending lets
          // the user open desktop and still leave a later successful
          // chrome.tabs navigation committed.
          fallbackCleanup = scheduleDeepLinkFallbackHint({
            delay: PRIME_SUBSCRIPTION_DEEP_LINK_FALLBACK_DELAY_MS,
            onFallback: () => setIsFallbackVisible(true),
          });
          openAppViaDeepLink(PRIME_SUBSCRIPTION_DEEP_LINK);
        },
      });
    }, AUTO_OPEN_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(autoOpenTimerId);
      fallbackCleanup?.();
    };
  }, []);

  return (
    <DeepLinkLanding
      loadingTitle={intl.formatMessage({
        id: ETranslations.prime_manage_subscription,
      })}
      fallbackDescription={intl.formatMessage({
        id: ETranslations.prime_description,
      })}
      isFallbackVisible={isFallbackVisible}
      onOpenApp={() => {
        openAppViaDeepLink(PRIME_SUBSCRIPTION_DEEP_LINK);
      }}
      openAppTestID={HomeTestIDs.primeSubscriptionOpenAppFallbackBtn}
      downloadTestID={HomeTestIDs.primeSubscriptionDownloadFallbackBtn}
    />
  );
}

export { PrimeSubscriptionLandingPage };
