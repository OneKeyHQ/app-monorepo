import { useCallback, useEffect, useRef } from 'react';

import { popToTabRootScreen } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import {
  isPrimeFreeTrialTravelMode,
  usePrimeFeatureAccess,
} from '../../Prime/hooks/usePrimeFeatureAccess';

// Page-level gate of BulkSendAddressesInput. The extension expand tab and
// direct routes reach this page without the entry gate, so it re-checks on
// mount:
// 1. E2E and Prime pass.
// 2. Logged-in free user: never asked to log in again; leaves only when the
//    cached quota is known to be 0 (or the feature is not open), otherwise
//    the start on the Review page decides.
// 3. Logged out: log in in place; a cancel leaves the page.
export function useBulkSendPageAccess({
  networkId,
  isInModal,
}: {
  networkId: string | undefined;
  isInModal: boolean | undefined;
}) {
  const navigation = useAppNavigation();
  const { isPrimeSubscriptionActive, isLoggedIn } = useOneKeyAuth();
  const { getCachedAccess, ensureFeatureAccess, showActiveRejectedFeedback } =
    usePrimeFeatureAccess();
  const checkedRef = useRef(false);

  // Leave the whole bulk send stack: the Home tab route on wide screens (and
  // the extension expand tab), the BulkSendModal on narrow screens.
  const exitPage = useCallback(async () => {
    if (isInModal) {
      navigation.popStack();
      return;
    }
    await popToTabRootScreen();
  }, [isInModal, navigation]);

  useEffect(() => {
    if (checkedRef.current) {
      return;
    }
    checkedRef.current = true;
    if (platformEnv.isE2E || isPrimeSubscriptionActive) {
      return;
    }
    void (async () => {
      if (isPrimeFreeTrialTravelMode()) {
        // Legacy behavior: Prime only.
        await exitPage();
        showActiveRejectedFeedback({
          featureId: EPrimeFeatures.BulkSend,
          reason: 'notOpen',
          networkId,
          afterPageExit: true,
        });
        return;
      }
      const loggedIn =
        isLoggedIn && (await backgroundApiProxy.servicePrime.isLoggedIn());
      if (loggedIn) {
        const access = getCachedAccess(EPrimeFeatures.BulkSend);
        if (access.status === 'exhausted' || access.status === 'notOpen') {
          await exitPage();
          showActiveRejectedFeedback({
            featureId: EPrimeFeatures.BulkSend,
            reason: access.status,
            resetAt: access.status === 'exhausted' ? access.resetAt : undefined,
            networkId,
            afterPageExit: true,
          });
        }
        return;
      }
      await ensureFeatureAccess({
        featureId: EPrimeFeatures.BulkSend,
        networkId,
        onDenied: async () => {
          await exitPage();
        },
      });
    })();
    // Runs once on mount; later state changes are handled by start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
