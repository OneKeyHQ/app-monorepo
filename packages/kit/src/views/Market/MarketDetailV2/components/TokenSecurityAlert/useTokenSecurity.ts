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

export type ISecurityKeyValue = {
  key: string;
  label: string;
  value: string;
  isWarning: boolean;
};

// Helper function to format security data into key-value pairs
export const formatSecurityData = (
  data: IMarketTokenSecurity | null,
): ISecurityKeyValue[] => {
  if (!data) return [];

  const formatPercentage = (value: string | undefined): string => {
    if (!value || value === '0') return '0%';
    return `${value}%`;
  };

  const isWarningValue = (value: string | undefined): boolean => {
    return value === '1' || value === 'true';
  };

  const items: ISecurityKeyValue[] = [];

  // Always show tax information
  items.push({
    key: 'buyTax',
    label: 'Buy Tax',
    value: formatPercentage(data.buyTax),
    isWarning: parseFloat(data.buyTax || '0') > 10,
  });

  items.push({
    key: 'sellTax',
    label: 'Sell Tax',
    value: formatPercentage(data.sellTax),
    isWarning: parseFloat(data.sellTax || '0') > 10,
  });

  // Always show holder count
  items.push({
    key: 'holderCount',
    label: 'Holder Count',
    value: data.holderCount || '0',
    isWarning: parseInt(data.holderCount || '0', 10) < 100,
  });

  // Always show ownership percentages
  items.push({
    key: 'ownerPercentage',
    label: 'Owner Percentage',
    value: formatPercentage(data.ownerPercentage),
    isWarning: parseFloat(data.ownerPercentage || '0') > 50,
  });

  items.push({
    key: 'creatorPercentage',
    label: 'Creator Percentage',
    value: formatPercentage(data.creatorPercentage),
    isWarning: parseFloat(data.creatorPercentage || '0') > 50,
  });

  // Show all boolean security flags
  const securityFlags = [
    { key: 'isHoneypot', label: 'Honeypot', value: data.isHoneypot },
    { key: 'isProxy', label: 'Proxy Contract', value: data.isProxy },
    {
      key: 'cannotSellAll',
      label: 'Cannot Sell All',
      value: data.cannotSellAll,
    },
    { key: 'isAntiWhale', label: 'Anti-Whale', value: data.isAntiWhale },
    { key: 'isBlacklisted', label: 'Blacklisted', value: data.isBlacklisted },
    { key: 'externalCall', label: 'External Call', value: data.externalCall },
    { key: 'hiddenOwner', label: 'Hidden Owner', value: data.hiddenOwner },
    { key: 'isMintable', label: 'Mintable', value: data.isMintable },
    {
      key: 'canTakeBackOwnership',
      label: 'Can Take Back Ownership',
      value: data.canTakeBackOwnership,
    },
    {
      key: 'ownerChangeBalance',
      label: 'Owner Change Balance',
      value: data.ownerChangeBalance,
    },
    { key: 'cannotBuy', label: 'Cannot Buy', value: data.cannotBuy },
    { key: 'isOpenSource', label: 'Open Source', value: data.isOpenSource },
  ];

  securityFlags.forEach((flag) => {
    const isWarning =
      flag.key === 'isOpenSource'
        ? !isWarningValue(flag.value) // Warning if NOT open source
        : isWarningValue(flag.value); // Warning if true for other flags

    items.push({
      key: flag.key,
      label: flag.label,
      value: '', // No text value, just icon
      isWarning,
    });
  });

  return items;
};

// Helper function to determine security status and count warnings from security data
const analyzeSecurityData = (
  data: IMarketTokenSecurity | null,
): { status: ISecurityStatus | null; count: number } => {
  if (!data) return { status: null, count: 0 };

  // List of warning indicators to check
  const warningChecks = [
    data.isHoneypot,
    data.isProxy,
    data.cannotSellAll,
    data.isAntiWhale,
    data.isBlacklisted,
    data.externalCall,
    data.hiddenOwner,
    data.isMintable,
    data.canTakeBackOwnership,
    data.ownerChangeBalance,
    data.cannotBuy,
  ];

  // Count the number of true warning flags
  const count = warningChecks.filter(Boolean).length;
  const status = count > 0 ? 'warning' : 'safe';

  return { status, count };
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
