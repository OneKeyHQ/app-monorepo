import { isBoolean } from 'lodash';

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

      let displayValue: string;
      if (isBoolean(value)) {
        displayValue = ''; // Don't show yes/no text for boolean values
      } else {
        displayValue = String(value);
      }

      items.push({
        key,
        label: content,
        value: displayValue,
        isWarning: riskType === 'caution' || riskType === 'risk', // Both caution and risk are warnings
        riskType, // Pass through the risk type for color handling
      });
    },
  );

  return items;
};

// Simplified function to analyze security data - directly use riskType
export const analyzeSecurityData = (
  data: IMarketTokenSecurityData | null,
): { status: ISecurityStatus | null; count: number } => {
  if (!data) return { status: null, count: 0 };

  let warningCount = 0;

  // Count warnings based on riskType
  Object.values(data).forEach((item: IMarketTokenSecurityItem) => {
    if (item.riskType === 'caution' || item.riskType === 'risk') {
      warningCount += 1;
    }
  });

  const status = warningCount > 0 ? 'warning' : 'safe';
  return { status, count: warningCount };
};
