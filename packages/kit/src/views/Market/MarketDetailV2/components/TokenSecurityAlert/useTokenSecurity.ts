import { useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketTokenSecurity } from '@onekeyhq/shared/types/marketV2';

type IUseTokenSecurityParams = {
  tokenAddress?: string;
  networkId: string;
};

type ISecurityStatus = 'safe' | 'warning';

type IUseTokenSecurityResult = {
  securityData: IMarketTokenSecurity | null;
  securityStatus: ISecurityStatus | null;
  warningCount: number;
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
  const [securityStatus, setSecurityStatus] = useState<ISecurityStatus | null>(
    null,
  );
  const [warningCount, setWarningCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Helper function to determine security status and count warnings from security data
  const analyzeSecurityData = (
    data: IMarketTokenSecurity | null,
  ): { status: ISecurityStatus | null; count: number } => {
    if (!data) return { status: null, count: 0 };

    // List of warning indicators to check
    const warningChecks = [
      data.isHoneypot,
      data.isProxy,
      data.hasHighTax,
      data.cannotSellAll,
      data.isAntiWhale,
      data.isBlacklisted,
      data.hasExternalCall,
      data.hasHiddenOwner,
      data.hasMintFunction,
      data.canTakeBackOwnership,
      data.ownerChangeBalance,
      data.hiddenOwner,
      data.cannotBuy,
    ];

    // Count the number of true warning flags
    const count = warningChecks.filter(Boolean).length;
    const status = count > 0 ? 'warning' : 'safe';

    return { status, count };
  };

  useEffect(() => {
    const fetchTokenSecurity = async () => {
      if (!tokenAddress) {
        console.log('No token address provided');
        setError('No token address provided');
        setSecurityStatus(null);
        setWarningCount(0);
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

        const { status, count } = analyzeSecurityData(data);
        setSecurityData(data);
        setSecurityStatus(status);
        setWarningCount(count);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch token security';
        console.error('Failed to fetch token security:', err);
        setError(errorMessage);
        setSecurityStatus(null);
        setWarningCount(0);
      } finally {
        setLoading(false);
      }
    };

    void fetchTokenSecurity();
  }, [tokenAddress, networkId]);

  return {
    securityData,
    securityStatus,
    warningCount,
    error,
    loading,
  };
};
