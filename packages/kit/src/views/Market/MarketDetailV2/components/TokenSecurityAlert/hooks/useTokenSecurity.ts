import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';

import { analyzeSecurityData, formatSecurityData } from '../utils';

import type {
  IUseTokenSecurityParams,
  IUseTokenSecurityResult,
} from '../types';

export const useTokenSecurity = ({
  tokenAddress,
  networkId,
}: IUseTokenSecurityParams): IUseTokenSecurityResult => {
  // Every instance for the same token shares this key, so a component that
  // mounts after the first request settled starts from that result.
  const securitySwrKey =
    tokenAddress && networkId
      ? swrKeys.marketTokenSecurity({
          networkId,
          tokenAddress:
            normalizeTokenContractAddress({
              networkId,
              contractAddress: tokenAddress,
            }) ?? tokenAddress,
        })
      : undefined;
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
      // A key change already swaps in that token's cached result or null.
      undefinedResultIfReRun: !securitySwrKey,
      swrKey: securitySwrKey,
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
