import { isBoolean, isNumber, isString } from 'lodash';

import type {
  IMarketTokenSecurityData,
  IMarketTokenSecurityItem,
} from '@onekeyhq/shared/types/marketV2';

import { getSecurityConfig } from '../config/securityConfig';

import type { ISecurityKeyValue, ISecurityStatus } from '../types';

// Helper function to check if a key is a warning
const isWarningKey = (key: string, value: any): boolean => {
  const config = getSecurityConfig();
  const allWarningKeys = [
    ...config.warningKeys.common,
    ...config.warningKeys.solana,
    ...config.warningKeys.sui,
  ];

  // Check each warning key
  if (allWarningKeys.includes(key)) {
    if (isBoolean(value) && value) return true;
    if (isString(value) && value === 'true') return true;
  }

  // Check for trusted/open source items (warning if false)
  if (config.trustKeys.includes(key)) {
    if (isBoolean(value) && !value) return true;
    if (isString(value) && value === 'false') return true;
  }

  // Check tax values
  if (config.taxKeys.includes(key) && isNumber(value) && value > 0) {
    return true;
  }

  return false;
};

// Helper function to format new security data structure into key-value pairs
export const formatSecurityData = (
  data: IMarketTokenSecurityData | null,
): ISecurityKeyValue[] => {
  if (!data) return [];

  const items: ISecurityKeyValue[] = [];

  // Iterate through all security items and format them
  Object.entries(data).forEach(
    ([key, item]: [string, IMarketTokenSecurityItem]) => {
      const { value, content } = item;

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
        isWarning: isWarningKey(key, value),
      });
    },
  );

  return items;
};

// Helper function to determine security status from new data structure
export const analyzeSecurityData = (
  data: IMarketTokenSecurityData | null,
): { status: ISecurityStatus | null; count: number } => {
  if (!data) return { status: null, count: 0 };

  let warningCount = 0;

  // Count warnings for all keys
  Object.entries(data).forEach(
    ([key, item]: [string, IMarketTokenSecurityItem]) => {
      if (isWarningKey(key, item.value)) {
        warningCount += 1;
      }
    },
  );

  const status = warningCount > 0 ? 'warning' : 'safe';
  return { status, count: warningCount };
};
