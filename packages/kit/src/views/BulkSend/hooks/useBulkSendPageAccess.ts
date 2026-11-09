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
// 2. Logged-in free user: stays whatever the quota; "Next" checks it and the
//    start on the Review page is the final judge.
// 3. Logged out: log in in place, then stay (the quota is not known yet);
//    a cancel leaves the page.
export function useBulkSendPageAccess({
  networkId,
  isInModal,
}: {
  networkId: string | undefined;
  isInModal: boolean | undefined;
}) {
  const navigation = useAppNavigation();
  const { isPrimeSubscriptionActive, isLoggedIn } = useOneKeyAuth();
  const { ensureFeatureAccess, openPrimeDashboard } = usePrimeFeatureAccess();
  const checkedRef = useRef(false);
  // The user may leave while the check waits: a late answer must not pop
  // the page they went to or open the dashboard over it.
  const isUnmountedRef = useRef(false);
  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

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
        openPrimeDashboard({
          featureId: EPrimeFeatures.BulkSend,
          networkId,
          afterPageExit: true,
        });
        return;
      }
      const loggedIn =
        isLoggedIn && (await backgroundApiProxy.servicePrime.isLoggedIn());
      if (loggedIn || isUnmountedRef.current) {
        return;
      }
      await ensureFeatureAccess({
        trackAttempt: false,
        featureId: EPrimeFeatures.BulkSend,
        networkId,
        isContextValid: () => !isUnmountedRef.current,
        onDenied: async () => {
          if (isUnmountedRef.current) {
            return;
          }
          await exitPage();
        },
      });
    })();
    // Runs once on mount; later state changes are handled by start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
