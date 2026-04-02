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

function useRiskDetection({
  origin,
  unsignedMessage,
}: {
  origin: string;
  unsignedMessage?: IUnsignedMessage;
}) {
  const [continueOperate, setContinueOperate] = useState(false);

  const { result: urlSecurityInfo } = usePromiseResult(async () => {
    if (!origin) return {} as IHostSecurity;
    return backgroundApiProxy.serviceDiscovery.checkUrlSecurity({
      url: origin,
      from: 'app',
    });
  }, [origin]);

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
