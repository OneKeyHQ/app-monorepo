import { useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IMarketTokenSecurityBatchResponse,
  IMarketTokenSecurityItem,
} from '@onekeyhq/shared/types/marketV2';

type IUseTokenSecurityParams = {
  tokenAddress?: string;
  networkId: string;
};

type ISecurityStatus = 'safe' | 'warning';

type IUseTokenSecurityResult = {
  securityData: {
    [key: string]: IMarketTokenSecurityItem;
  } | null;
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

// Helper function to format new security data structure into key-value pairs
export const formatSecurityData = (
  data: { [key: string]: IMarketTokenSecurityItem } | null,
): ISecurityKeyValue[] => {
  if (!data) return [];

  const items: ISecurityKeyValue[] = [];

  // Iterate through all security items and format them
  Object.entries(data).forEach(([key, item]) => {
    const { value, content } = item;

    // Determine if this is a warning based on the key and value
    let isWarning = false;

    if (typeof value === 'boolean') {
      // For boolean values, most are warnings when true, except for trusted items
      if (
        key.includes('trusted') ||
        key.includes('open_source') ||
        key.includes('trust_list')
      ) {
        isWarning = !value; // Warning if NOT trusted/open source
      } else {
        isWarning = value; // Warning if true for most security flags
      }
    } else if (typeof value === 'number') {
      // For numeric values like taxes, warn if > 10%
      if (key.includes('tax') || key.includes('fee')) {
        isWarning = value > 10;
      }
    } else if (typeof value === 'string') {
      // For string percentages, parse and check
      const numValue = parseFloat(value);
      if (!Number.isNaN(numValue)) {
        if (key.includes('percent') || key.includes('percentage')) {
          isWarning = numValue > 50; // Warning if ownership > 50%
        } else if (key.includes('tax') || key.includes('fee')) {
          isWarning = numValue > 10; // Warning if tax > 10%
        }
      }
    }

    let displayValue: string;
    if (typeof value === 'boolean') {
      displayValue = ''; // Don't show yes/no text for boolean values
    } else {
      displayValue = String(value);
    }

    items.push({
      key,
      label: content,
      value: displayValue,
      isWarning,
    });
  });

  return items;
};

// Helper function to determine security status from new data structure
const analyzeSecurityData = (
  data: { [key: string]: IMarketTokenSecurityItem } | null,
): { status: ISecurityStatus | null; count: number } => {
  if (!data) return { status: null, count: 0 };

  let warningCount = 0;

  // Define warning keys for different chains
  const commonWarningKeys = [
    'is_honeypot',
    'is_proxy',
    'cannot_sell_all',
    'is_anti_whale',
    'is_blacklisted',
    'external_call',
    'hidden_owner',
    'is_mintable',
    'can_take_back_ownership',
    'owner_change_balance',
    'cannot_buy',
  ];

  const solanaWarningKeys = [
    'is_balance_mutable_authority',
    'closable',
    'is_metadata_upgrade_authority',
    'freezable',
    'mintable',
    'non_transferable',
    'transfer_fee_upgradable',
    'transfer_hook_upgradable',
  ];

  const suiWarningKeys = [
    'is_blacklisted',
    'is_contract_upgradeable',
    'is_metadata_modifiable',
    'is_mintable',
  ];

  const allWarningKeys = [
    ...commonWarningKeys,
    ...solanaWarningKeys,
    ...suiWarningKeys,
  ];

  // Check each warning key
  allWarningKeys.forEach((key) => {
    const item = data[key];
    if (item) {
      if (typeof item.value === 'boolean' && item.value) {
        warningCount += 1;
      } else if (typeof item.value === 'string' && item.value === 'true') {
        warningCount += 1;
      }
    }
  });

  // Check for trusted/open source items (warning if false)
  const trustKeys = [
    'trusted_token',
    'is_trusted_token',
    'trust_list',
    'is_open_source',
  ];
  trustKeys.forEach((key) => {
    const item = data[key];
    if (item) {
      if (typeof item.value === 'boolean' && !item.value) {
        warningCount += 1;
      } else if (typeof item.value === 'string' && item.value === 'false') {
        warningCount += 1;
      }
    }
  });

  // Check tax values
  const taxKeys = ['buy_tax', 'sell_tax', 'transfer_tax'];
  taxKeys.forEach((key) => {
    const item = data[key];
    if (item && typeof item.value === 'number' && item.value > 0) {
      warningCount += 1;
    }
  });

  const status = warningCount > 0 ? 'warning' : 'safe';
  return { status, count: warningCount };
};

export const useTokenSecurity = ({
  tokenAddress,
  networkId,
}: IUseTokenSecurityParams): IUseTokenSecurityResult => {
  const [securityData, setSecurityData] = useState<{
    [key: string]: IMarketTokenSecurityItem;
  } | null>(null);
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
        const batchData =
          await backgroundApiProxy.serviceMarketV2.fetchMarketTokenSecurity([
            {
              contractAddress: tokenAddress,
              chainId: networkId,
            },
          ]);

        const tokenSecurityData =
          batchData[tokenAddress] || batchData[tokenAddress.toLowerCase()];

        console.log(
          'tokenSecurityData',
          tokenSecurityData,
          batchData,
          tokenAddress,
        );

        if (!tokenSecurityData) {
          setError('No security data found for token');
          setSecurityStatus(null);
          setWarningCount(0);
          return;
        }

        const { status, count } = analyzeSecurityData(tokenSecurityData);

        setSecurityData(tokenSecurityData);
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
