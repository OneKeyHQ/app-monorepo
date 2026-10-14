import { useCallback } from 'react';

import { rootNavigationRef } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import type { IPrimeFreeTrialFeatureId } from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

// Opening the Prime dashboard from the free-trial feedback. Needs no auth
// provider, so the remaining-uses hint can use it inside dialogs.
export function usePrimeFreeTrialUpgrade() {
  const navigation = useAppNavigation();

  const openPrimeDashboard = useCallback(
    ({
      featureId,
      networkId,
      freeTrialReason,
      afterPageExit,
    }: {
      featureId: IPrimeFreeTrialFeatureId;
      networkId?: string;
      freeTrialReason?: 'exhausted' | 'notOpen';
      // The calling page was just closed: its navigation object may no
      // longer resolve the root stack, so navigate from the root ref.
      afterPageExit?: boolean;
    }) => {
      const params = {
        fromFeature: featureId,
        networkId,
        freeTrialReason,
      };
      if (afterPageExit) {
        rootNavigationRef.current?.navigate(ERootRoutes.iOSFullScreen, {
          screen: EModalRoutes.PrimeModal,
          params: { screen: EPrimePages.PrimeDashboard, params },
        });
        return;
      }
      navigation.pushFullModal(EModalRoutes.PrimeModal, {
        screen: EPrimePages.PrimeDashboard,
        params,
      });
    },
    [navigation],
  );

  // "Get Prime" of the exhausted toast and of the remaining hint (used up, or
  // no free trial for the feature).
  const getPrime = useCallback(
    ({
      featureId,
      networkId,
      afterPageExit,
      freeTrialReason = 'exhausted',
    }: {
      featureId: IPrimeFreeTrialFeatureId;
      networkId?: string;
      afterPageExit?: boolean;
      freeTrialReason?: 'exhausted' | 'notOpen';
    }) => {
      defaultLogger.prime.subscription.primeFreeTrialUpgradeClick({
        featureName: featureId,
        featureId,
      });
      openPrimeDashboard({
        featureId,
        networkId,
        freeTrialReason,
        afterPageExit,
      });
    },
    [openPrimeDashboard],
  );

  return { openPrimeDashboard, getPrime };
}
