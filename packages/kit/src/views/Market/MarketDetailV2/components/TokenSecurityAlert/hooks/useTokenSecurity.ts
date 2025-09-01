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

  if (
    securityData &&
    'trusted_token' in securityData &&
    securityData.trusted_token?.value === false
  ) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    Reflect.deleteProperty(securityData, 'trusted_token');
  }

  const { securityStatus, warningCount, formattedData } = useMemo(() => {
    const { status, count } = analyzeSecurityData(securityData);
    const formatted = formatSecurityData(securityData);

    return {
      securityStatus: status,
      warningCount: count,
      formattedData: formatted,
    };
  }, [securityData]);

  return {
    securityData,
    securityStatus,
    warningCount,
    formattedData,
  };
};
