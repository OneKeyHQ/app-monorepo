import type {
  IMarketTokenSecurityData,
  IMarketTokenSecurityItem,
} from '@onekeyhq/shared/types/marketV2';

import type { ISecurityKeyValue, ISecurityStatus } from '../types';

// Define warning keys for different chains
const COMMON_WARNING_KEYS = [
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
  'transfer_pausable',
];

const SOLANA_WARNING_KEYS = [
  'is_balance_mutable_authority',
  'closable',
  'is_metadata_upgrade_authority',
  'freezable',
  'mintable',
  'non_transferable',
  'transfer_fee_upgradable',
  'transfer_hook_upgradable',
];

const SUI_WARNING_KEYS = [
  'is_blacklisted',
  'is_contract_upgradeable',
  'is_metadata_modifiable',
  'is_mintable',
];

const ALL_WARNING_KEYS = [
  ...COMMON_WARNING_KEYS,
  ...SOLANA_WARNING_KEYS,
  ...SUI_WARNING_KEYS,
];

const TRUST_KEYS = [
  'trusted_token',
  'is_trusted_token',
  'trust_list',
  'is_open_source',
];

const TAX_KEYS = ['buy_tax', 'sell_tax', 'transfer_tax'];

// Helper function to check if a key is a warning
const isWarningKey = (key: string, value: any): boolean => {
  // Check each warning key
  if (ALL_WARNING_KEYS.includes(key)) {
    if (typeof value === 'boolean' && value) return true;
    if (typeof value === 'string' && value === 'true') return true;
  }

  // Check for trusted/open source items (warning if false)
  if (TRUST_KEYS.includes(key)) {
    if (typeof value === 'boolean' && !value) return true;
    if (typeof value === 'string' && value === 'false') return true;
  }

  // Check tax values
  if (TAX_KEYS.includes(key) && typeof value === 'number' && value > 0) {
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
      if (typeof value === 'boolean') {
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
