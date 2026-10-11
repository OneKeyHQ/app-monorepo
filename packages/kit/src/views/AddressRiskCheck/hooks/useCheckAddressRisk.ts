import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  IPrimeAddressRiskCheckEntryPoint,
  IPrimeEntitlementSource,
} from '@onekeyhq/shared/src/logger/scopes/prime/types';
import { EModalAddressRiskCheckRoutes } from '@onekeyhq/shared/src/routes/addressRiskCheck';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import type { IAddressRiskCheckResult } from '@onekeyhq/shared/types/addressRiskCheck';

import { usePrimeFeatureAccess } from '../../Prime/hooks/usePrimeFeatureAccess';
import { getPrimeEntitlementSource } from '../../Prime/utils/primeFreeTrialAccess';

type IAddressRiskCheckRequest = {
  networkId: string;
  address: string;
  entryPoint: IPrimeAddressRiskCheckEntryPoint;
  // Analytics only
  entitlementSource?: IPrimeEntitlementSource;
};

const addressRiskCheckRequests = new Map<
  string,
  Promise<IAddressRiskCheckResult>
>();

export function executeAddressRiskCheck({
  networkId,
  address,
  entryPoint,
  entitlementSource,
}: IAddressRiskCheckRequest): Promise<IAddressRiskCheckResult> {
  const requestKey = `${entryPoint}\n${networkId}\n${address}`;
  const pendingRequest = addressRiskCheckRequests.get(requestKey);
  if (pendingRequest) {
    return pendingRequest;
  }

  const request = (async () => {
    const result =
      await backgroundApiProxy.serviceAddressRiskCheck.checkAddressRisk({
        networkId,
        address,
      });
    defaultLogger.prime.usage.addressRiskCheckSuccess({
      entryPoint,
      network: result.networkId,
      riskLevel: result.level,
      riskFactorsCount: result.reasons.length,
      cached: result.cached,
      featureName: EPrimeFeatures.AddressRiskCheck,
      entitlementSource,
    });
    // Best-effort local history write must never hide or delay a successful
    // risk result.
    void backgroundApiProxy.simpleDb.addressRiskCheck
      .addCheck({
        networkId: result.networkId,
        address: result.address,
        level: result.level,
        checkedAt: result.checkedAt,
      })
      .catch(() => {
        // ignore local persistence failures
      });
    return result;
  })();

  addressRiskCheckRequests.set(requestKey, request);
  const clearRequest = () => {
    if (addressRiskCheckRequests.get(requestKey) === request) {
      addressRiskCheckRequests.delete(requestKey);
    }
  };
  void request.then(clearRequest, clearRequest);
  return request;
}

// Shared entry for running a check: calls the server, records the success into
// local "Recent checks" (failures are never recorded), and navigates to the
// result page. Used by the standalone input and history entry points.
export function useCheckAddressRisk() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const isRouteFocused = useRouteIsFocused();
  const isRouteFocusedRef = useRef(isRouteFocused);
  const isMountedRef = useRef(true);
  const isCheckingRef = useRef(false);
  const [isChecking, setIsChecking] = useState(false);
  isRouteFocusedRef.current = isRouteFocused;
  const { handleFreeTrialError } = usePrimeFeatureAccess();
  const [primeUser] = usePrimePersistAtom();
  const entitlementSource = getPrimeEntitlementSource(primeUser);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const checkRisk = useCallback(
    async ({
      networkId,
      address,
      entryPoint,
    }: {
      networkId: string;
      address: string;
      entryPoint: Exclude<IPrimeAddressRiskCheckEntryPoint, 'sendAddressInput'>;
    }): Promise<IAddressRiskCheckResult | undefined> => {
      if (isCheckingRef.current) {
        return undefined;
      }
      isCheckingRef.current = true;
      setIsChecking(true);
      const shouldPresentFeedback = () =>
        isMountedRef.current && isRouteFocusedRef.current;
      try {
        const result = await executeAddressRiskCheck({
          networkId,
          address,
          entryPoint,
          entitlementSource,
        });
        if (!shouldPresentFeedback()) {
          return result;
        }
        navigation.push(EModalAddressRiskCheckRoutes.AddressRiskCheckResult, {
          result,
          showMoreAnalysis: true,
        });
        return result;
      } catch (error) {
        // Free trial exhausted / not open: unified feedback (dashboard and,
        // when exhausted, the reset time) instead of a generic failure.
        if (
          shouldPresentFeedback() &&
          handleFreeTrialError({ error, networkId })
        ) {
          return undefined;
        }
        // Network / rate-limit / server errors. Invalid-address is handled
        // inline on the input form before this call.
        if (shouldPresentFeedback()) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.address_risk_check_level_failed__title,
            }),
            message: intl.formatMessage({
              id: ETranslations.address_risk_check_level_failed__desc,
            }),
          });
        }
        return undefined;
      } finally {
        if (isMountedRef.current) {
          setIsChecking(false);
        }
        isCheckingRef.current = false;
      }
    },
    [entitlementSource, handleFreeTrialError, intl, navigation],
  );

  return { isChecking, checkRisk };
}
