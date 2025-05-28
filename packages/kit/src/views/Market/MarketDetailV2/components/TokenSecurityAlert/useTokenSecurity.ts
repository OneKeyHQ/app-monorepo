import { useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketTokenSecurity } from '@onekeyhq/shared/types/marketV2';

type IUseTokenSecurityParams = {
  tokenAddress?: string;
  networkId: string;
};

type IUseTokenSecurityResult = {
  securityData: IMarketTokenSecurity | null;
  error: string | null;
  loading: boolean;
};

export const useTokenSecurity = ({
  tokenAddress,
  networkId,
}: IUseTokenSecurityParams): IUseTokenSecurityResult => {
  const [securityData, setSecurityData] = useState<IMarketTokenSecurity | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTokenSecurity = async () => {
      if (!tokenAddress) {
        console.log('No token address provided');
        setError('No token address provided');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data =
          await backgroundApiProxy.serviceMarketV2.fetchMarketTokenSecurity(
            tokenAddress,
            networkId,
          );
        console.log('Token security data:', data);
        setSecurityData(data);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch token security';
        console.error('Failed to fetch token security:', err);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    void fetchTokenSecurity();
  }, [tokenAddress, networkId]);

  return {
    securityData,
    error,
    loading,
  };
};
