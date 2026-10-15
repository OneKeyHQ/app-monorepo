import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalAddressRiskCheckRoutes } from '@onekeyhq/shared/src/routes/addressRiskCheck';
import { EModalBulkCopyAddressesRoutes } from '@onekeyhq/shared/src/routes/bulkCopyAddresses';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import type { IPrimeFreeTrialPendingAction } from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';
import { EPrimeFreeTrialPendingActionType } from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import { usePrimeFeatureAccess } from './usePrimeFeatureAccess';

async function isPendingActionContextValid(
  action: IPrimeFreeTrialPendingAction,
) {
  if (action.walletId) {
    const wallet = await backgroundApiProxy.serviceAccount.getWalletSafe({
      walletId: action.walletId,
    });
    if (!wallet) {
      return false;
    }
  }
  if (action.networkId) {
    const network = await backgroundApiProxy.serviceNetwork.getNetworkSafe({
      networkId: action.networkId,
    });
    if (!network) {
      return false;
    }
  }
  return true;
}

// Expand tab only: continues the action the extension popup saved before it
// handed the OneKey ID login off. Called after the relayed login succeeds;
// the slot (not URL params) is the source of truth, so the latest action wins
// even when a relay arrives while an earlier login is still running.
export function usePrimeFreeTrialPendingActionRunner() {
  const navigation = useAppNavigation();
  const { ensureFeatureAccess } = usePrimeFeatureAccess();

  return useCallback(async () => {
    const action =
      await backgroundApiProxy.servicePrimeFreeTrial.consumePendingAction();
    if (!action) {
      return;
    }
    if (
      !(await backgroundApiProxy.servicePrime.isLoggedIn()) ||
      !(await isPendingActionContextValid(action))
    ) {
      defaultLogger.prime.subscription.primeFreeTrialTrace({
        stage: 'runPendingAction',
        reason: `dropped ${action.type}: login or context changed`,
      });
      return;
    }
    if (action.type === EPrimeFreeTrialPendingActionType.BulkCopyAddresses) {
      if (!action.networkId) {
        return;
      }
      const access = await ensureFeatureAccess({
        featureId: EPrimeFeatures.BulkCopyAddresses,
        networkId: action.networkId,
      });
      if (!access.granted) {
        return;
      }
      navigation.pushModal(EModalRoutes.BulkCopyAddressesModal, {
        screen: EModalBulkCopyAddressesRoutes.BulkCopyAddressesModal,
        params: {
          walletId: action.walletId ?? '',
          networkId: action.networkId,
        },
      });
      return;
    }
    if (action.type === EPrimeFreeTrialPendingActionType.AddressRiskCheck) {
      const access = await ensureFeatureAccess({
        featureId: EPrimeFeatures.AddressRiskCheck,
        networkId: action.networkId,
        allowExhausted: true,
      });
      if (!access.granted) {
        return;
      }
      navigation.pushModal(EModalRoutes.AddressRiskCheckModal, {
        screen: EModalAddressRiskCheckRoutes.AddressRiskCheckInput,
        params: { networkId: action.networkId },
      });
    }
  }, [ensureFeatureAccess, navigation]);
}
