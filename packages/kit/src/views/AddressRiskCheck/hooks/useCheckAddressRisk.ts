import { useCallback, useEffect, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/core';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  IPrimeAddressRiskCheckEntryPoint,
  IPrimeEntitlementSource,
} from '@onekeyhq/shared/src/logger/scopes/prime/types';
import {
  EModalAddressRiskCheckRoutes,
  type IModalAddressRiskCheckParamList,
} from '@onekeyhq/shared/src/routes/addressRiskCheck';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import { getPrimeFreeTrialError } from '@onekeyhq/shared/src/utils/primeFreeTrialUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
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
        result,
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

async function getHistoryResult({
  networkId,
  address,
}: {
  networkId: string;
  address: string;
}): Promise<IAddressRiskCheckResult | undefined> {
  try {
    const item = await backgroundApiProxy.simpleDb.addressRiskCheck.getCheck({
      networkId,
      address,
    });
    return item?.result;
  } catch {
    return undefined;
  }
}

// Runs a check; when the free trial rejects it (exhausted / not open), an
// address in the local history falls back to the result of its last check.
// The Send page check never does: its result gates a transfer.
export async function executeAddressRiskCheckWithHistory(
  request: IAddressRiskCheckRequest,
): Promise<{ result: IAddressRiskCheckResult; isHistoryResult: boolean }> {
  try {
    return {
      result: await executeAddressRiskCheck(request),
      isHistoryResult: false,
    };
  } catch (error) {
    if (
      request.entryPoint !== 'sendAddressInput' &&
      getPrimeFreeTrialError(error)
    ) {
      const historyResult = await getHistoryResult(request);
      if (historyResult) {
        return { result: historyResult, isHistoryResult: true };
      }
    }
    throw error;
  }
}

type IAddressRiskCheckResultRequest =
  IModalAddressRiskCheckParamList[EModalAddressRiskCheckRoutes.AddressRiskCheckResult]['checkRequest'];

// A double tap must not push the result page twice.
const OPEN_RESULT_GUARD_MS = 1000;

// Entry for running a check from the standalone input and history pages: opens
// the result page right away, which shows the loading and runs the check.
// When the local snapshot already says used up (or not open) and the address
// has no local history result to fall back to, the gate decides first on a
// fresh quota, so a stale 0 does not block and a real one gets the feedback
// without a loading page.
export function useCheckAddressRisk() {
  const navigation = useAppNavigation();
  const reactNavigation = useNavigation();
  const lastOpenedAtRef = useRef(0);
  // Bumped per check, on blur (e.g. History opened over the input, which
  // stays mounted) and on unmount: a pending check whose id moved on never
  // opens its result.
  const requestIdRef = useRef(0);
  useEffect(() => {
    const removeBlurListener = reactNavigation.addListener('blur', () => {
      requestIdRef.current += 1;
    });
    return () => {
      removeBlurListener();
      requestIdRef.current += 1;
    };
  }, [reactNavigation]);
  const { getCachedAccess, ensureFeatureAccess } = usePrimeFeatureAccess();

  const checkRisk = useCallback(
    ({
      networkId,
      address,
      entryPoint,
    }: {
      networkId: string;
      address: string;
      entryPoint: Exclude<IPrimeAddressRiskCheckEntryPoint, 'sendAddressInput'>;
    }) => {
      const now = Date.now();
      if (now - lastOpenedAtRef.current < OPEN_RESULT_GUARD_MS) {
        return;
      }
      lastOpenedAtRef.current = now;
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      const openResult = () => {
        navigation.push(EModalAddressRiskCheckRoutes.AddressRiskCheckResult, {
          checkRequest: { networkId, address, entryPoint },
          showMoreAnalysis: true,
        });
      };
      const access = getCachedAccess(EPrimeFeatures.AddressRiskCheck);
      if (access.status !== 'exhausted' && access.status !== 'notOpen') {
        openResult();
        return;
      }
      void (async () => {
        const isStale = () => requestIdRef.current !== requestId;
        if (!(await getHistoryResult({ networkId, address })) && !isStale()) {
          const gate = await ensureFeatureAccess({
            featureId: EPrimeFeatures.AddressRiskCheck,
            networkId,
            isContextValid: () => !isStale(),
          });
          if (!gate.granted) {
            return;
          }
        }
        if (!isStale()) {
          openResult();
        }
      })();
    },
    [ensureFeatureAccess, getCachedAccess, navigation],
  );

  return { checkRisk };
}

// Runs the check of the result page. A success is recorded into local "Recent
// checks" (failures are never recorded); a free-trial rejection without a
// history result leaves the page and shows the unified feedback; other
// failures show the failed state on the page.
export function useAddressRiskCheckRequest(
  checkRequest: IAddressRiskCheckResultRequest,
) {
  const [result, setResult] = useState<IAddressRiskCheckResult>();
  const [isHistoryResult, setIsHistoryResult] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const navigation = useAppNavigation();
  const reactNavigation = useNavigation();
  const { handleFreeTrialError } = usePrimeFeatureAccess();
  const [primeUser] = usePrimePersistAtom();
  const entitlementSource = getPrimeEntitlementSource(primeUser);
  const { networkId, address, entryPoint } = checkRequest;

  useEffect(() => {
    let isActive = true;
    setIsFailed(false);
    void executeAddressRiskCheckWithHistory({
      networkId,
      address,
      entryPoint,
      entitlementSource,
    }).then(
      (outcome) => {
        if (isActive) {
          setResult(outcome.result);
          setIsHistoryResult(outcome.isHistoryResult);
        }
      },
      async (error: unknown) => {
        if (!isActive) {
          return;
        }
        if (getPrimeFreeTrialError(error)) {
          // Only a page still on top handles the rejection. One the user
          // already left (mounted during its close animation) or covered gets
          // no feedback: popping would close another page, and the dashboard
          // would open over the screen the user went to. A covered page shows
          // the failed state when the user comes back.
          if (!reactNavigation.isFocused()) {
            setIsFailed(true);
            return;
          }
          // Leave this pending page first so the user is not left on it
          // behind the feedback: the Send page check closes the whole modal,
          // a check inside the feature goes back to the input / history page.
          if (entryPoint === 'sendAddressInput') {
            navigation.popStack();
          } else {
            navigation.pop();
          }
          await timerUtils.wait(300);
          handleFreeTrialError({ error, networkId, afterPageExit: true });
          return;
        }
        setIsFailed(true);
      },
    );
    return () => {
      isActive = false;
    };
    // Runs once per request; navigation / feedback helpers may change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, entryPoint, networkId]);

  return { result, isHistoryResult, isFailed };
}
