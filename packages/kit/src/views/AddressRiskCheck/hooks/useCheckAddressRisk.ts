import { useCallback, useEffect, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/core';

import { rootNavigationRef } from '@onekeyhq/components';
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
import { createPrimeFreeTrialAttempt } from '@onekeyhq/shared/src/utils/primeFreeTrialAnalytics';
import { getPrimeFreeTrialError } from '@onekeyhq/shared/src/utils/primeFreeTrialUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IAddressRiskCheckResult } from '@onekeyhq/shared/types/addressRiskCheck';
import { PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE } from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

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

  const attempt =
    entitlementSource === 'freeTrial'
      ? createPrimeFreeTrialAttempt({
          featureId: EPrimeFeatures.AddressRiskCheck,
          stage: 'execution',
        })
      : undefined;
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
    attempt?.finish('success');
    return result;
  })().catch((error: unknown) => {
    const trialError = getPrimeFreeTrialError(error);
    if (trialError) {
      attempt?.finish(
        trialError.code === PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE
          ? 'exhausted'
          : 'notOpen',
        'server',
      );
    } else {
      attempt?.finish('failed');
    }
    throw error;
  });

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
// the result page right away, which shows the loading and runs the check. A
// manually entered address of a free user whose local snapshot is used up or
// not open gets the feedback on the press instead, unless it has a history
// result to show. Addresses picked from the history or recent list always
// have one.
export function useCheckAddressRisk() {
  const navigation = useAppNavigation();
  // The input or history page the press came from.
  const reactNavigation = useNavigation();
  const { getCachedAccess, showActiveRejectedFeedback } =
    usePrimeFeatureAccess();
  const lastOpenedAtRef = useRef(0);

  const checkRisk = useCallback(
    async ({
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
      const access = getCachedAccess(EPrimeFeatures.AddressRiskCheck);
      const attempt =
        access.status !== 'prime'
          ? createPrimeFreeTrialAttempt({
              featureId: EPrimeFeatures.AddressRiskCheck,
              stage: 'access',
            })
          : undefined;
      if (
        entryPoint === 'inputManual' &&
        (access.status === 'exhausted' || access.status === 'notOpen')
      ) {
        const historyResult = await getHistoryResult({ networkId, address });
        // The user may have left the page during the lookup.
        if (!reactNavigation.isFocused()) {
          attempt?.finish('contextChanged');
          return;
        }
        if (!historyResult) {
          attempt?.finish(access.status, 'client');
          showActiveRejectedFeedback({
            featureId: EPrimeFeatures.AddressRiskCheck,
            reason: access.status,
            resetAt: access.status === 'exhausted' ? access.resetAt : undefined,
            networkId,
          });
          return;
        }
      }
      attempt?.finish('granted');
      navigation.push(EModalAddressRiskCheckRoutes.AddressRiskCheckResult, {
        checkRequest: { networkId, address, entryPoint },
        showMoreAnalysis: true,
      });
    },
    [getCachedAccess, navigation, reactNavigation, showActiveRejectedFeedback],
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
        // Only a page still on top handles a free-trial rejection; one the
        // user already left keeps the failed state.
        if (!getPrimeFreeTrialError(error) || !reactNavigation.isFocused()) {
          setIsFailed(true);
          return;
        }
        // Leave this page first so Prime does not close back onto a dead
        // end: the Send page check closes its whole modal, a check inside
        // the feature goes back to the input / history page. The dashboard
        // waits for the close animation, and opens only if the user is still
        // on the page this landed on.
        if (entryPoint === 'sendAddressInput') {
          navigation.popStack();
        } else {
          navigation.pop();
        }
        const landedRouteKey =
          rootNavigationRef.current?.getCurrentRoute()?.key;
        await timerUtils.wait(300);
        if (
          rootNavigationRef.current?.getCurrentRoute()?.key !== landedRouteKey
        ) {
          return;
        }
        handleFreeTrialError({ error, networkId, afterPageExit: true });
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
