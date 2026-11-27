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

const AUTO_OPEN_DELAY_MS = 300;
const PRIME_DASHBOARD_DEEP_LINK_FALLBACK_DELAY_MS = 3000;
const PRIME_DASHBOARD_DEEP_LINK = uriUtils.buildDeepLinkUrl({
  path: EOneKeyDeepLinkPath.prime_dashboard,
});

// Email landing (e.g. gift-ended email): opens the plain Prime dashboard in
// the native app, unlike /prime/subscription which opens crypto checkout.
function PrimeDashboardLandingPage() {
  const intl = useIntl();
  const [isFallbackVisible, setIsFallbackVisible] = useState(false);

  useEffect(() => {
    if (!platformEnv.isWeb) {
      return undefined;
    }

    let fallbackCleanup: (() => void) | undefined;
    const autoOpenTimerId = setTimeout(() => {
      fallbackCleanup = scheduleDeepLinkFallbackHint({
        delay: PRIME_DASHBOARD_DEEP_LINK_FALLBACK_DELAY_MS,
        onFallback: () => setIsFallbackVisible(true),
      });
      openAppViaDeepLink(PRIME_DASHBOARD_DEEP_LINK);
    }, AUTO_OPEN_DELAY_MS);

    return () => {
      clearTimeout(autoOpenTimerId);
      fallbackCleanup?.();
    };
  }, []);

  return (
    <DeepLinkLanding
      loadingTitle={intl.formatMessage({ id: ETranslations.global_prime })}
      fallbackDescription={intl.formatMessage({
        id: ETranslations.prime_description,
      })}
      isFallbackVisible={isFallbackVisible}
      onOpenApp={() => {
        openAppViaDeepLink(PRIME_DASHBOARD_DEEP_LINK);
      }}
      openAppTestID={HomeTestIDs.primeDashboardOpenAppFallbackBtn}
      downloadTestID={HomeTestIDs.primeDashboardDownloadFallbackBtn}
    />
  );
}

export { PrimeDashboardLandingPage };
