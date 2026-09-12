import { useEffect, useMemo } from 'react';

import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useScopedAcknowledgement } from '@onekeyhq/kit/src/hooks/useScopedAcknowledgement';
import { buildPrimeAnalyticsProfileSnapshot } from '@onekeyhq/kit-bg/src/services/ServicePrime/primeAnalyticsProfile';
import { primePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { makeTimeoutPromise } from '@onekeyhq/shared/src/background/backgroundUtils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import {
  isEthSignType,
  isPrimaryTypeOrderSign,
  isPrimaryTypePermitSign,
} from '@onekeyhq/shared/src/signMessage';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import {
  EHostSecurityLevel,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';

import {
  shouldReportSiteScanRiskWarnedForUser,
  shouldStartSiteScanRiskWarningAttempt,
} from './siteScanRiskWarning';

import type { Verify } from '@walletconnect/types';

let siteScanRiskWarnedInFlight = false;

function overrideSecurityLevel(
  base: IHostSecurity | undefined,
  level: EHostSecurityLevel,
  host: string,
): IHostSecurity {
  if (base) return { ...base, level };
  return {
    host,
    level,
    attackTypes: [],
    phishingSite: false,
    checkSources: [],
    alert: '',
    projectName: '',
    createdAt: '',
  };
}

function useRiskDetection({
  origin,
  unsignedMessage,
  walletConnectVerifyContext,
}: {
  origin: string;
  unsignedMessage?: IUnsignedMessage;
  // WalletConnect identity attestation from the SDK (proposal/request).
  // When present, its validation/isScam fields override OneKey's reputation
  // score in the negative direction — a peer that can't prove its origin
  // must not be rendered as "Security" regardless of how the claimed URL
  // scores against our backend.
  walletConnectVerifyContext?: Verify.Context;
}) {
  const { result: backendSecurityResult } = usePromiseResult(
    async () => ({
      origin,
      info: origin
        ? await makeTimeoutPromise({
            asyncFunc: async () =>
              backgroundApiProxy.serviceDiscovery.checkUrlSecurity({
                url: origin,
                from: 'app',
              }),
            timeout: 10_000,
            timeoutRejectError: new OneKeyLocalError(
              'Site security check timed out',
            ),
          })(undefined).catch(() =>
            overrideSecurityLevel(
              undefined,
              EHostSecurityLevel.Unknown,
              origin,
            ),
          )
        : ({} as IHostSecurity),
    }),
    [origin],
    { undefinedResultIfReRun: true },
  );
  const isBackendSecurityResultCurrent =
    backendSecurityResult?.origin === origin;
  let backendSecurityInfo: IHostSecurity | undefined;
  if (isBackendSecurityResultCurrent) {
    backendSecurityInfo = backendSecurityResult.info?.level
      ? backendSecurityResult.info
      : overrideSecurityLevel(undefined, EHostSecurityLevel.Unknown, origin);
  }
  const hasConclusiveWalletConnectRisk = Boolean(
    walletConnectVerifyContext &&
    (walletConnectVerifyContext.verified.isScam ||
      walletConnectVerifyContext.verified.validation === 'INVALID'),
  );
  const isRiskCheckPending = Boolean(
    origin &&
    !isBackendSecurityResultCurrent &&
    !hasConclusiveWalletConnectRisk,
  );

  const urlSecurityInfo = useMemo<IHostSecurity | undefined>(() => {
    if (!walletConnectVerifyContext) return backendSecurityInfo;
    const { validation, isScam } = walletConnectVerifyContext.verified;
    // isScam takes precedence per Reown's Verify API UX guidance.
    if (isScam || validation === 'INVALID') {
      return overrideSecurityLevel(
        backendSecurityInfo,
        EHostSecurityLevel.High,
        origin,
      );
    }
    if (validation === 'UNKNOWN') {
      if (!backendSecurityInfo) {
        return undefined;
      }
      // Only strip the verified-site affordance when the backend has nothing
      // worse to say. A backend-flagged High/Medium origin must keep its
      // severity — UNKNOWN means "can't attest identity", not "safe".
      const backendLevel = backendSecurityInfo?.level;
      if (
        backendLevel === EHostSecurityLevel.High ||
        backendLevel === EHostSecurityLevel.Medium
      ) {
        return backendSecurityInfo;
      }
      return overrideSecurityLevel(
        backendSecurityInfo,
        EHostSecurityLevel.Unknown,
        origin,
      );
    }
    return backendSecurityInfo;
  }, [backendSecurityInfo, walletConnectVerifyContext, origin]);

  const riskLevel = useMemo(
    () => urlSecurityInfo?.level ?? EHostSecurityLevel.Unknown,
    [urlSecurityInfo],
  );

  const isRiskSignMethod = useMemo(() => {
    if (!unsignedMessage) return false;
    if (isEthSignType({ unsignedMessage })) {
      return true;
    }
    if (!urlSecurityInfo) {
      return false;
    }
    if (
      (isPrimaryTypePermitSign({ unsignedMessage }) ||
        isPrimaryTypeOrderSign({ unsignedMessage })) &&
      riskLevel !== EHostSecurityLevel.Security
    ) {
      return true;
    }
    return false;
  }, [unsignedMessage, riskLevel, urlSecurityInfo]);

  const showContinueOperate = useMemo(() => {
    if (isRiskSignMethod) {
      return true;
    }

    return !(
      riskLevel === EHostSecurityLevel.Security ||
      riskLevel === EHostSecurityLevel.Unknown
    );
  }, [riskLevel, isRiskSignMethod]);

  const riskAcknowledgementKey = useMemo(
    () =>
      stableStringify({
        origin,
        isRiskCheckPending,
        riskLevel,
        isRiskSignMethod,
        messageType: unsignedMessage?.type,
        message: unsignedMessage?.message,
      }),
    [
      origin,
      isRiskCheckPending,
      riskLevel,
      isRiskSignMethod,
      unsignedMessage?.type,
      unsignedMessage?.message,
    ],
  );
  const { isAccepted: isRiskAcknowledged, setAccepted: setContinueOperate } =
    useScopedAcknowledgement(riskAcknowledgementKey);
  const currentContinueOperate = Boolean(
    !isRiskCheckPending && (!showContinueOperate || isRiskAcknowledged),
  );

  // Log risk detection info
  useEffect(() => {
    defaultLogger.discovery.dapp.dappRiskDetect({
      riskLevel,
      showContinueOperateCheckBox: showContinueOperate,
      currentContinueOperate,
    });
  }, [riskLevel, showContinueOperate, currentContinueOperate]);

  // Prime benefit usage: a Prime user was shown an enhanced dapp-security
  // risk warning. Read the persist atom once (no subscription, no token
  // refresh) so this shared connection/sign hook gains no new re-render
  // source and non-Prime users skip the event without a bg auth hop.
  // Session-level emit flag is keyed by OneKey user so an account switch in
  // the same JS runtime can still report; no URL/domain is reported.
  useEffect(() => {
    if (
      !shouldStartSiteScanRiskWarningAttempt({
        riskLevel,
        inFlight: siteScanRiskWarnedInFlight,
      })
    ) {
      return;
    }
    siteScanRiskWarnedInFlight = true;
    void (async () => {
      try {
        const persist = await primePersistAtom.get();
        const { isPrimeActive } = buildPrimeAnalyticsProfileSnapshot({
          isLoggedIn: persist.isLoggedIn,
          isLoggedInOnServer: persist.isLoggedInOnServer,
          isPrimeSubscriptionActive: persist.primeSubscription?.isActive,
        });
        const currentUserId = persist.onekeyUserId;
        if (
          !isPrimeActive ||
          !shouldReportSiteScanRiskWarnedForUser(currentUserId)
        ) {
          return;
        }
        defaultLogger.prime.usage.siteScanRiskWarned({
          featureName: EPrimeFeatures.BlockaidSiteScan,
          riskLevel,
          isPrimeActive: true,
        });
      } catch {
        // Analytics must never affect the risk detection flow.
      } finally {
        siteScanRiskWarnedInFlight = false;
      }
    })();
  }, [riskLevel]);

  return {
    showContinueOperate,
    continueOperate: currentContinueOperate,
    setContinueOperate,
    urlSecurityInfo,
    riskLevel,
    isRiskSignMethod,
  };
}

export { useRiskDetection };
