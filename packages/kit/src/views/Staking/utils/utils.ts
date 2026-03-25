import BigNumber from 'bignumber.js';

export const buildLocalTxStatusSyncId = ({
  providerName = '',
  tokenSymbol = '',
}: {
  providerName?: string;
  tokenSymbol?: string;
}) => `${providerName?.toLowerCase()}-${tokenSymbol?.toLowerCase()}`;

// Borrow tag format: borrow:{provider}:{action}[:claimIds]
export type IBorrowAction =
  | 'supply'
  | 'borrow'
  | 'withdraw'
  | 'repay'
  | 'claim';

export const buildBorrowTag = ({
  provider,
  action,
  claimIds,
}: {
  provider: string;
  action: IBorrowAction;
  claimIds?: string[];
}): string => {
  const base = `borrow:${provider.toLowerCase()}:${action}`;
  if (action === 'claim' && claimIds?.length) {
    return `${base}:${[...claimIds].toSorted().join(',')}`;
  }
  return base;
};

export const parseBorrowTag = (
  tag: string,
): {
  provider: string;
  action: IBorrowAction;
  claimIds?: string[];
} | null => {
  if (!tag.startsWith('borrow:')) return null;
  const parts = tag.split(':');
  if (parts.length < 3) return null;
  return {
    provider: parts[1],
    action: parts[2] as IBorrowAction,
    claimIds: parts[3]?.split(','),
  };
};

export const isBorrowTag = (tag: string): boolean => tag.startsWith('borrow:');

// Check if any tag in the list is a borrow tag for the given provider
export const hasBorrowTagForProvider = (
  tags: string[],
  provider: string,
): boolean =>
  tags.some((tag) => {
    const parsed = parseBorrowTag(tag);
    return parsed?.provider === provider.toLowerCase();
  });

export function capitalizeString(str: string): string {
  if (!str) return str; // Return if the string is empty or undefined
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function normalizeStakeTokenAddress(params?: {
  address?: string;
  isNative?: boolean;
}) {
  if (!params || params.isNative) {
    return '';
  }
  return (params.address || '').toLowerCase();
}

export function resolveStakeTokenAddress(params?: {
  address?: string;
  isNative?: boolean;
}) {
  if (!params || params.isNative) {
    return '';
  }
  return params.address || '';
}

export function buildStakeTokenUniqueKey(params?: {
  uniqueKey?: string;
  address?: string;
  symbol?: string;
  isNative?: boolean;
}) {
  if (!params) {
    return '';
  }
  if (params.uniqueKey) {
    return params.uniqueKey;
  }
  return `${params.isNative ? 'native' : params.address}-${params.symbol || ''}`;
}

export function isInvalidAmount(num: string): boolean {
  return BigNumber(num).isNaN() || num.endsWith('.');
}

export function countDecimalPlaces(input: string | number): number {
  // Convert the input to a string if it's a number
  const inputNum = typeof input === 'string' ? Number(input) : input;

  if (Number.isNaN(inputNum)) {
    return 0;
  }

  const inputStr =
    typeof input === 'string' ? input : BigNumber(input).toFixed();

  // Find the decimal point
  const decimalIndex = inputStr.indexOf('.');

  // If there's no decimal point, return 0
  if (decimalIndex === -1) {
    return 0;
  }

  // Return the number of characters after the decimal point
  return inputStr.length - decimalIndex - 1;
}

export function shouldShowStakingSummaryCard({
  isDisabled,
  isPendleProvider,
  amountValue,
  hasSummarySection,
  showPendleTransactionSection,
}: {
  isDisabled?: boolean;
  isPendleProvider: boolean;
  amountValue: string;
  hasSummarySection: boolean;
  showPendleTransactionSection: boolean;
}): boolean {
  if (isDisabled) {
    return false;
  }

  if (isPendleProvider && Number(amountValue) <= 0) {
    return false;
  }

  return hasSummarySection || showPendleTransactionSection;
}
