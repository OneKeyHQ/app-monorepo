import { useEffect, useMemo, useRef, useState } from 'react';

import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { primePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import {
  isEthSignType,
  isPrimaryTypeOrderSign,
  isPrimaryTypePermitSign,
} from '@onekeyhq/shared/src/signMessage';
import {
  EHostSecurityLevel,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';

import {
  isPrimeActiveFromPersist,
  shouldStartSiteScanRiskWarningAttempt,
} from './siteScanRiskWarning';

import type { Verify } from '@walletconnect/types';

let siteScanRiskWarnedReportedThisSession = false;

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
  const [continueOperate, setContinueOperate] = useState(false);

  const { result: backendSecurityInfo } = usePromiseResult(async () => {
    if (!origin) return {} as IHostSecurity;
    return backgroundApiProxy.serviceDiscovery.checkUrlSecurity({
      url: origin,
      from: 'app',
    });
  }, [origin]);

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

  // Handle state changes when showContinueOperate changes
  useEffect(() => {
    // Auto-enable continue operate when checkbox is not shown
    setContinueOperate(!showContinueOperate);
  }, [showContinueOperate]);

  // Log risk detection info
  useEffect(() => {
    defaultLogger.discovery.dapp.dappRiskDetect({
      riskLevel,
      showContinueOperateCheckBox: showContinueOperate,
      currentContinueOperate: continueOperate,
    });
  }, [riskLevel, showContinueOperate, continueOperate]);

  // Prime benefit usage: a Prime user was shown an enhanced dapp-security
  // risk warning. Read the persist atom once (no subscription, no token
  // refresh) so this shared connection/sign hook gains no new re-render
  // source and non-Prime users skip the event without a bg auth hop.
  // Session-level emit flag bounds volume across stacked DApp modals; no
  // URL/domain is reported.
  const siteScanRiskWarnedTrackedRef = useRef(false);
  const siteScanRiskWarnedInFlightRef = useRef(false);
  useEffect(() => {
    if (
      !shouldStartSiteScanRiskWarningAttempt({
        riskLevel,
        sessionReported: siteScanRiskWarnedReportedThisSession,
        instanceTracked: siteScanRiskWarnedTrackedRef.current,
        inFlight: siteScanRiskWarnedInFlightRef.current,
      })
    ) {
      return;
    }
    siteScanRiskWarnedInFlightRef.current = true;
    void (async () => {
      try {
        const persist = await primePersistAtom.get();
        if (
          !isPrimeActiveFromPersist(persist) ||
          siteScanRiskWarnedReportedThisSession
        ) {
          return;
        }
        siteScanRiskWarnedTrackedRef.current = true;
        siteScanRiskWarnedReportedThisSession = true;
        defaultLogger.prime.usage.siteScanRiskWarned({
          featureName: EPrimeFeatures.BlockaidSiteScan,
          riskLevel,
          isPrimeActive: true,
        });
      } catch {
        // Analytics must never affect the risk detection flow.
      } finally {
        siteScanRiskWarnedInFlightRef.current = false;
      }
    })();
  }, [riskLevel]);

  return {
    showContinueOperate,
    continueOperate,
    setContinueOperate,
    urlSecurityInfo,
    riskLevel,
    isRiskSignMethod,
  };
}

export { useRiskDetection };
