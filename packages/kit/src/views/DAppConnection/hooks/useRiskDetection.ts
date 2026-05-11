import { useEffect, useMemo, useState } from 'react';

import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  isEthSignType,
  isPrimaryTypeOrderSign,
  isPrimaryTypePermitSign,
} from '@onekeyhq/shared/src/signMessage';
import {
  EHostSecurityLevel,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';

import type { Verify } from '@walletconnect/types';

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
      return {
        ...(backendSecurityInfo ?? ({} as IHostSecurity)),
        level: EHostSecurityLevel.High,
      };
    }
    if (validation === 'UNKNOWN') {
      return {
        ...(backendSecurityInfo ?? ({} as IHostSecurity)),
        level: EHostSecurityLevel.Unknown,
      };
    }
    return backendSecurityInfo;
  }, [backendSecurityInfo, walletConnectVerifyContext]);

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
