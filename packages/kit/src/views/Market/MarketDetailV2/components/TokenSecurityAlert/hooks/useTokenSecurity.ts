import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import { analyzeSecurityData } from '../utils';

import type {
  IUseTokenSecurityParams,
  IUseTokenSecurityResult,
} from '../types';

export const useTokenSecurity = ({
  tokenAddress,
  networkId,
}: IUseTokenSecurityParams): IUseTokenSecurityResult => {
  const { result: securityData } = usePromiseResult(
    async () => {
      if (!tokenAddress) {
        return null;
      }

      const batchData =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenSecurity([
          {
            contractAddress: tokenAddress,
            chainId: networkId,
          },
        ]);

      const tokenSecurityData =
        batchData[tokenAddress] || batchData[tokenAddress.toLowerCase()];

      return tokenSecurityData || null;
    },
    [tokenAddress, networkId],
    {
      initResult: null,
    },
  );

  const { securityStatus, warningCount } = useMemo(() => {
    const { status, count } = analyzeSecurityData(securityData);
    return { securityStatus: status, warningCount: count };
  }, [securityData]);

  return {
    securityData,
    securityStatus,
    warningCount,
  };
};
