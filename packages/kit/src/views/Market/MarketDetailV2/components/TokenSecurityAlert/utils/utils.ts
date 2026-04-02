import type { ColorTokens } from '@onekeyhq/components/src/primitives';
import type {
  IMarketTokenSecurityData,
  IMarketTokenSecurityItem,
} from '@onekeyhq/shared/types/marketV2';

import type { ISecurityKeyValue, ISecurityStatus } from '../types';

// Simplified function to format security data - directly use API structure
export const formatSecurityData = (
  data: IMarketTokenSecurityData | null,
): ISecurityKeyValue[] => {
  if (!data) return [];

  const items: ISecurityKeyValue[] = [];

  // Iterate through all security items and format them
  Object.entries(data).forEach(
    ([key, item]: [string, IMarketTokenSecurityItem]) => {
      const { value, content, riskType } = item;

      items.push({
        key,
        label: content,
        value,
        riskType, // Pass through the risk type for color handling
      });
    },
  );

  return items;
};

// Simplified function to analyze security data - directly use riskType with separated counts
export const analyzeSecurityData = (
  data: IMarketTokenSecurityData | null,
): {
  status: ISecurityStatus | null;
  riskCount: number;
  cautionCount: number;
} => {
  if (!data) return { status: null, riskCount: 0, cautionCount: 0 };

  let riskCount = 0;
  let cautionCount = 0;

  // Count risks and cautions separately based on riskType
  Object.values(data).forEach((item: IMarketTokenSecurityItem) => {
    if (item.riskType === 'risk') {
      riskCount += 1;
    } else if (item.riskType === 'caution') {
      cautionCount += 1;
    }
  });

  // Determine status based on priority: risk > caution > safe
  let status: ISecurityStatus;
  if (riskCount > 0) {
    status = 'risk'; // Highest priority: show red if any risk items
  } else if (cautionCount > 0) {
    status = 'caution'; // Medium priority: show yellow if any caution items
  } else {
    status = 'safe'; // Lowest priority: show green if no issues
  }

  return {
    status,
    riskCount,
    cautionCount,
  };
};

// Shared function for getting security display information (count and color)
export const getSecurityDisplayInfo = (
  securityStatus: ISecurityStatus | null,
  riskCount: number,
  cautionCount: number,
): {
  count: number;
  color: ColorTokens;
} => {
  if (securityStatus === 'risk') {
    return {
      count: riskCount,
      color: '$iconCritical',
    };
  }
  if (securityStatus === 'caution') {
    return {
      count: cautionCount,
      color: '$iconCaution',
    };
  }
  return {
    count: 0,
    color: '$iconSuccess',
  };
};

// Function for getting total security display information (total count with priority color)
export const getTotalSecurityDisplayInfo = (
  securityStatus: ISecurityStatus | null,
  riskCount: number,
  cautionCount: number,
): {
  count: number;
  color: ColorTokens;
} => {
  const totalCount = riskCount + cautionCount;

  if (securityStatus === 'risk') {
    return {
      count: totalCount,
      color: '$iconCritical',
    };
  }
  if (securityStatus === 'caution') {
    return {
      count: totalCount,
      color: '$iconCaution',
    };
  }
  return {
    count: 0,
    color: '$iconSuccess',
  };
};
