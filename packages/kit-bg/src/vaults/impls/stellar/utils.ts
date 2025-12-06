import { Buffer } from 'buffer';

import BigNumber from 'bignumber.js';

import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

import { Memo } from './sdkStellar';

// Stellar reserves
export const BASE_RESERVE = '1'; // 1 XLM base reserve
export const ENTRY_RESERVE = '0.5'; // 0.5 XLM per trustline/offer/signer

// Minimum account creation balance
export const MIN_ACCOUNT_BALANCE = '1'; // 1 XLM minimum

// Base fee per operation
export const BASE_FEE = '100'; // 100 stroops = 0.00001 XLM

export const SAC_TOKEN_DECIMALS = 7;

export const SAC_TOKEN_ASSET_TYPES = ['credit_alphanum4', 'credit_alphanum12'];

const MEMO_TEXT_MAX_BYTES = 28;

const MEMO_ID_MAX = new BigNumber('18446744073709551615');

/**
 * Calculate available balance considering reserves
 * Formula: available = balance - (baseReserve + numEntries * entryReserve)
 */
export function calculateAvailableBalance(params: {
  balance: string;
  numSubEntries: number;
}): string {
  const { balance, numSubEntries } = params;

  const reserved = new BigNumber(BASE_RESERVE).plus(
    new BigNumber(ENTRY_RESERVE).multipliedBy(numSubEntries),
  );

  const available = new BigNumber(balance).minus(reserved);

  return BigNumber.max(available, 0).toFixed(7);
}

/**
 * Calculate minimum balance requirement
 */
export function isValidAccountCreationAmount(amount: string): boolean {
  return new BigNumber(amount).gte(MIN_ACCOUNT_BALANCE);
}

export function buildMemoFromString(memo?: string) {
  if (!memo) {
    return undefined;
  }
  const trimmed = memo.trim();
  if (!trimmed) {
    return undefined;
  }
  if (isUint64Memo(trimmed)) {
    return Memo.id(trimmed);
  }
  const memoBytes = Buffer.from(trimmed, 'utf8');
  if (memoBytes.length > MEMO_TEXT_MAX_BYTES) {
    throw new OneKeyInternalError('Memo text exceeds 28 bytes limit');
  }
  return Memo.text(trimmed);
}

function isUint64Memo(value: string) {
  if (!/^\d+$/.test(value)) {
    return false;
  }
  const bn = new BigNumber(value);
  if (!bn.isFinite() || bn.isNegative()) {
    return false;
  }
  return bn.lte(MEMO_ID_MAX);
}
