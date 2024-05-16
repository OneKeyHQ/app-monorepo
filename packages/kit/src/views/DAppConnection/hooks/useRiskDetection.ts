import { useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EHostSecurityLevel,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';

function useRiskDetection({ origin }: { origin: string }) {
  const [continueOperate, setContinueOperate] = useState(false);

  const { result: urlSecurityInfo } = usePromiseResult(async () => {
    if (!origin) return {} as IHostSecurity;
    return backgroundApiProxy.serviceDiscovery.checkUrlSecurity(origin);
  }, [origin]);

  const riskLevel = urlSecurityInfo?.level ?? EHostSecurityLevel.Unknown;
  const showContinueOperate = useMemo(
    () =>
      !(
        riskLevel === EHostSecurityLevel.Security ||
        riskLevel === EHostSecurityLevel.Unknown
      ),
    [riskLevel],
  );

  const canContinueOperate = useMemo(() => {
    if (!showContinueOperate) {
      return true;
    }
    return continueOperate;
  }, [continueOperate, showContinueOperate]);

  return {
    showContinueOperate,
    continueOperate,
    setContinueOperate,
    canContinueOperate,
    urlSecurityInfo,
    riskLevel,
  };
}

export { useRiskDetection };
