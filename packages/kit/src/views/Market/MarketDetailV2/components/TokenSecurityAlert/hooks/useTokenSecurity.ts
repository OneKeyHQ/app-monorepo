import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import { analyzeSecurityData, formatSecurityData } from '../utils';

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
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenSecurity({
          contractAddress: tokenAddress,
          chainId: networkId,
        });

      const tokenSecurityData =
        batchData[tokenAddress] || batchData[tokenAddress.toLowerCase()];

      return tokenSecurityData || null;
    },
    [tokenAddress, networkId],
    {
      initResult: null,
    },
  );

  // Note: Removed trusted_token special handling since we now use dynamic structure
  // and rely on API's riskType directly. Backend should handle data filtering.

  const { securityStatus, riskCount, cautionCount, formattedData } =
    useMemo(() => {
      const {
        status,
        riskCount: risks,
        cautionCount: cautions,
      } = analyzeSecurityData(securityData);
      const formatted = formatSecurityData(securityData);

      return {
        securityStatus: status,
        riskCount: risks,
        cautionCount: cautions,
        formattedData: formatted,
      };
    }, [securityData]);

  return {
    securityData,
    securityStatus,
    riskCount,
    cautionCount,
    formattedData,
  };
};
