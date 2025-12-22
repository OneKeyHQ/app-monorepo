import { Buffer } from 'buffer';

import BigNumber from 'bignumber.js';

import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

import { Asset, Memo, Networks, StrKey } from './sdkStellar';
import { EStellarAssetType } from './types';

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

export function getNetworkPassphrase(networkId: string): string {
  return networkId.includes('testnet') ? Networks.TESTNET : Networks.PUBLIC;
}

/**
 * Calculate available balance considering reserves
 * Formula: available = balance - (baseReserve + numEntries * entryReserve)
 */
export function calculateAvailableBalance(params: {
  balance: string;
  numSubEntries: number;
}): string {
  const { balance, numSubEntries } = params;

  const reserved = new BigNumber(BASE_RESERVE)
    .shiftedBy(-SAC_TOKEN_DECIMALS)
    .plus(
      new BigNumber(ENTRY_RESERVE)
        .shiftedBy(-SAC_TOKEN_DECIMALS)
        .multipliedBy(numSubEntries),
    );

  const available = new BigNumber(balance).minus(reserved);

  return BigNumber.max(available, 0).toFixed(0);
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
  const memoBytes = Buffer.from(trimmed, 'utf8');
  if (memoBytes.length > MEMO_TEXT_MAX_BYTES) {
    throw new OneKeyInternalError('Memo text exceeds 28 bytes limit');
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

/**
 * Check if a contract address is a SAC (Stellar Asset Contract)
 * and return the underlying classic asset if it is
 * @param contractId - Contract address
 * @returns Classic asset info if this is a SAC, null otherwise
 */
export async function getSACClassicAsset(
  contractId: string,
): Promise<{ code: string; issuer: string } | null> {
  // This is a placeholder - in practice, you would need to:
  // 1. Query the contract to check if it's a SAC
  // 2. If it is, extract the underlying asset info
  // For now, we'll return null to indicate we can't determine this
  // In a full implementation, this would require RPC calls to the network
  return null;
}
