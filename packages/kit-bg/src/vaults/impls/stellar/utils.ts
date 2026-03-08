import { Buffer } from 'buffer';

import BigNumber from 'bignumber.js';

import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

import { Asset, Memo, Networks, StrKey } from './sdkStellar';
import { EStellarAssetType } from './types';

// Stellar reserves
export const BASE_RESERVE = '1'; // 1 XLM base reserve
export const ENTRY_RESERVE = '0.5'; // 0.5 XLM per trustline/offer/signer

// Minimum account creation balance
export const MIN_ACCOUNT_BALANCE = BASE_RESERVE; // 1 XLM minimum

// Base fee per operation
export const BASE_FEE = '100'; // 100 stroops = 0.00001 XLM

export const SAC_TOKEN_DECIMALS = 7;

export const SAC_TOKEN_ASSET_TYPES = ['credit_alphanum4', 'credit_alphanum12'];

export const MEMO_TEXT_MAX_BYTES = 28;

const MEMO_ID_MAX = new BigNumber('18446744073709551615');

/**
 * Calculate the byte length of a UTF-8 string
 * @param text - The text to measure
 * @returns The byte length
 */
export function getUtf8ByteLength(text: string): number {
  return Buffer.from(text, 'utf8').length;
}

export function getNetworkPassphrase(networkId: string): string {
  return networkId.includes('testnet') ? Networks.TESTNET : Networks.PUBLIC;
}

/**
 * Calculate available balance considering reserves
 * Formula: available = balance - (baseReserve + numEntries * entryReserve)
 */
export function calculateFrozenBalance(params: {
  numSubEntries: number;
}): string {
  const { numSubEntries } = params;

  const reserved = new BigNumber(BASE_RESERVE)
    .plus(new BigNumber(ENTRY_RESERVE).multipliedBy(numSubEntries))
    .shiftedBy(SAC_TOKEN_DECIMALS);

  return reserved.toFixed(0);
}

/**
 * Calculate minimum balance requirement
 */
export function isValidAccountCreationAmount(amount: string): boolean {
  return new BigNumber(amount).gte(MIN_ACCOUNT_BALANCE);
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
  const byteLength = getUtf8ByteLength(trimmed);
  if (byteLength > MEMO_TEXT_MAX_BYTES) {
    throw new OneKeyInternalError(
      `Memo text exceeds ${MEMO_TEXT_MAX_BYTES} bytes limit (current: ${byteLength} bytes)`,
    );
  }
  return Memo.text(trimmed);
}

/**
 * Check if an address is a Stellar contract address
 * Contract addresses start with 'C' and are 56 characters long
 */
export function isContractAddress(address: string): boolean {
  if (!address || address.length !== 56) {
    return false;
  }
  try {
    return StrKey.isValidContract(address);
  } catch {
    return false;
  }
}

/**
 * Parse token address format
 * Supports both legacy (CODE:ISSUER) and contract (C...) formats
 */
export function parseTokenAddress(address: string): {
  type: EStellarAssetType;
  code?: string;
  issuer?: string;
  contractId?: string;
} {
  if (isContractAddress(address)) {
    return {
      type: EStellarAssetType.ContractToken,
      contractId: address,
    };
  }

  const parts = address.split(':');
  if (parts.length === 2) {
    const [code, issuer] = parts;
    return {
      type: EStellarAssetType.StellarAsset,
      code,
      issuer,
    };
  }

  throw new OneKeyInternalError(`Invalid token address format: ${address}`);
}

/**
 * Get SAC (Stellar Asset Contract) address for a classic asset
 * @param assetCode - Asset code (e.g., "USDC")
 * @param assetIssuer - Asset issuer public key
 * @param networkPassphrase - Network passphrase (defaults to PUBLIC)
 * @returns Contract address for the SAC
 */
export function getSACAddress(
  assetCode: string,
  assetIssuer: string,
  network?: (typeof Networks)[keyof typeof Networks],
): string {
  try {
    const asset = new Asset(assetCode, assetIssuer);
    // Use Asset.contractId to get the SAC address
    const contractAddress = asset.contractId(network || Networks.PUBLIC);
    return contractAddress;
  } catch (error) {
    throw new OneKeyInternalError(
      `Failed to get SAC address for ${assetCode}:${assetIssuer}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export function decimalToFraction(value: string | number | BigNumber): {
  n: number;
  d: number;
} {
  const bn = new BigNumber(value);

  const str = bn.toFixed();
  const [integerPart, decimalPart = ''] = str.split('.');

  const decimalPlaces = decimalPart.length;
  const denominator = new BigNumber(10).pow(decimalPlaces);

  const numerator = new BigNumber(integerPart)
    .multipliedBy(denominator)
    .plus(decimalPart || '0');

  const gcd = (a: BigNumber, b: BigNumber): BigNumber => {
    return b.isZero() ? a : gcd(b, a.mod(b));
  };

  const common = gcd(numerator, denominator);

  return {
    n: numerator.div(common).toNumber(),
    d: denominator.div(common).toNumber(),
  };
}

export function calculateAvailableBalance(params: {
  balance: string; // stroops
  numSubEntries: number;
}): { available: string; reserved: string } {
  const { balance, numSubEntries } = params;

  // convert XLM reserve to stroops (decimals = 7)
  const reserved = new BigNumber(BASE_RESERVE)
    .shiftedBy(SAC_TOKEN_DECIMALS)
    .plus(
      new BigNumber(ENTRY_RESERVE)
        .shiftedBy(SAC_TOKEN_DECIMALS)
        .multipliedBy(numSubEntries),
    )
    .toFixed(0);

  const available = BigNumber.max(
    new BigNumber(balance).minus(reserved),
    0,
  ).toFixed(0);

  return { available, reserved };
}
