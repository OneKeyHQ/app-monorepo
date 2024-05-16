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

  const riskLevel = useMemo(
    () => urlSecurityInfo?.level ?? EHostSecurityLevel.Unknown,
    [urlSecurityInfo],
  );
  const showContinueOperate = useMemo(() => {
    if (!urlSecurityInfo) {
      return false;
    }
    const show = !(
      riskLevel === EHostSecurityLevel.Security ||
      riskLevel === EHostSecurityLevel.Unknown
    );
    if (!show && !continueOperate) {
      setContinueOperate(true);
    }
    return show;
  }, [riskLevel, urlSecurityInfo, continueOperate]);

  return {
    showContinueOperate,
    continueOperate,
    setContinueOperate,
    urlSecurityInfo,
    riskLevel,
  };
}

export { useRiskDetection };
