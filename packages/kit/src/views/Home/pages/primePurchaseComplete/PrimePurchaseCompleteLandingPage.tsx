import { useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { DESKTOP_BROWSER_COMPLETION_URL } from '@onekeyhq/shared/src/consts/authConsts';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabHomeRoutes } from '@onekeyhq/shared/src/routes';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import { DeepLinkLanding } from '../../components/DeepLinkLanding';
import { HomeTestIDs } from '../../testIDs';
import {
  openAppViaDeepLink,
  scheduleDeepLinkFallbackHint,
} from '../../utils/deepLinkLaunchUtils';

import { notifyPrimeWebCheckoutReturnInExtension } from './notifyPrimeWebCheckoutReturnInExtension';

const AUTO_OPEN_DELAY_MS = 300;
const PRIME_PURCHASE_COMPLETE_DEEP_LINK_FALLBACK_DELAY_MS = 3000;
const PRIME_PURCHASE_COMPLETE_DEEP_LINK = uriUtils.buildDeepLinkUrl({
  path: EOneKeyDeepLinkPath.prime_purchase_complete,
});

function isFramedPage() {
  try {
    return globalThis.top !== globalThis.self;
  } catch {
    // Cross-origin parents throw on access.
    return true;
  }
}

// RevenueCat appends ?app_user_id=<OneKey ID> to the redirect. Drop it from
// the address bar and history right away; nothing here trusts it.
function stripCheckoutReturnQuery() {
  try {
    const { location, history } = globalThis;
    if (!location?.search) {
      return;
    }
    history?.replaceState?.(
      history.state ?? null,
      '',
      `${location.pathname}${location.hash}`,
    );
  } catch {
    // URL cleanup is best-effort only.
  }
}

// Redirect target of the RevenueCat hosted card checkout. The return is only
// a hint for the app to re-check RevenueCat; it never confirms a purchase.
function PrimePurchaseCompleteLandingPage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [isFallbackVisible, setIsFallbackVisible] = useState(false);
  const didClearQueryParamRef = useRef(false);
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;

  useEffect(() => {
    if (!platformEnv.isWeb || didClearQueryParamRef.current) {
      return;
    }
    didClearQueryParamRef.current = true;
    // React Navigation rewrites the URL from the original route path (query
    // included) for as long as the route params still match it.
    navigation.setParams({ app_user_id: undefined });
  }, [navigation]);

  useEffect(() => {
    if (!platformEnv.isWeb) {
      return undefined;
    }
    stripCheckoutReturnQuery();
    // The extension bridge is injected into every frame, so a third-party
    // page could frame this route to trigger the extension return.
    if (isFramedPage()) {
      return undefined;
    }

    let cancelled = false;
    let fallbackCleanup: (() => void) | undefined;
    const resumeWebCheckout = async () => {
      try {
        const { resumePrimeWebCheckoutAfterReturn } =
          await import('../../../Prime/hooks/primeHostedCardCheckout');
        if (cancelled || !(await resumePrimeWebCheckoutAfterReturn())) {
          return false;
        }
        navigationRef.current.replace(ETabHomeRoutes.TabHome);
        return true;
      } catch {
        return false;
      }
    };
    const autoOpenTimerId = setTimeout(async () => {
      // A checkout started by this web app replaced the page; keep waiting
      // for RevenueCat here instead of handing off.
      if (await resumeWebCheckout()) {
        return;
      }
      if (cancelled) {
        return;
      }
      if ((await notifyPrimeWebCheckoutReturnInExtension()) || cancelled) {
        // The extension focuses the checkout initiator and closes this tab.
        return;
      }
      if (!platformEnv.isWebMobile) {
        // The same completion page as desktop OAuth already launches the app.
        // Do not forward RevenueCat's app_user_id or other return parameters.
        globalThis.location.replace(
          `${DESKTOP_BROWSER_COMPLETION_URL}?scene=success&locale=${encodeURIComponent(intl.locale)}`,
        );
        return;
      }
      fallbackCleanup = scheduleDeepLinkFallbackHint({
        delay: PRIME_PURCHASE_COMPLETE_DEEP_LINK_FALLBACK_DELAY_MS,
        onFallback: () => setIsFallbackVisible(true),
      });
      openAppViaDeepLink(PRIME_PURCHASE_COMPLETE_DEEP_LINK);
    }, AUTO_OPEN_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(autoOpenTimerId);
      fallbackCleanup?.();
    };
  }, [intl.locale]);

  return (
    <DeepLinkLanding
      loadingTitle={intl.formatMessage({
        id: ETranslations.prime_payment_confirming__title,
      })}
      fallbackDescription={intl.formatMessage({
        id: ETranslations.prime_description,
      })}
      isFallbackVisible={isFallbackVisible}
      onOpenApp={() => {
        openAppViaDeepLink(PRIME_PURCHASE_COMPLETE_DEEP_LINK);
      }}
      openAppTestID={HomeTestIDs.primePurchaseCompleteOpenAppFallbackBtn}
      downloadTestID={HomeTestIDs.primePurchaseCompleteDownloadFallbackBtn}
    />
  );
}

export { PrimePurchaseCompleteLandingPage };
