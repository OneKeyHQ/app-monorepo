import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

import {
  getBtcForkNetwork,
  validateBtcAddress,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import {
  IMPL_BTC,
  IMPL_EVM,
  IMPL_SOL,
  IMPL_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { AppError, ERROR_CODES } from '../errors';

import type { IChainConfig } from './chain-resolver';

export interface IAddressValidationResult {
  isValid: boolean;
  normalizedAddress: string;
}

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

// SOL signatures are base58, 64 bytes — typical encoded length 86–88.
export const SOL_TXID_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{43,128}$/;

export function validateAddressForChain(
  chainConfig: IChainConfig,
  address: string,
): IAddressValidationResult {
  if (chainConfig.impl === IMPL_EVM) {
    const isValid = EVM_ADDRESS_RE.test(address);
    return {
      isValid,
      normalizedAddress: isValid ? address : '',
    };
  }

  if (chainConfig.impl === IMPL_BTC || chainConfig.impl === IMPL_TBTC) {
    try {
      const validation = validateBtcAddress({
        address,
        network: getBtcForkNetwork(chainConfig.impl),
      });
      return {
        isValid: validation.isValid,
        normalizedAddress: validation.normalizedAddress || address,
      };
    } catch {
      return {
        isValid: false,
        normalizedAddress: '',
      };
    }
  }

  if (chainConfig.impl === IMPL_SOL) {
    return validateSolAddress(address);
  }

  return {
    isValid: false,
    normalizedAddress: '',
  };
}

// Mirrors kit-bg sol/Vault.validateAddress (1:1) — accept the address if
// it is on-curve OR decodes to 32 bytes. PDAs are intentionally allowed:
// they cannot receive lamports but can hold SPL tokens, so the App treats
// them as valid recipients and the CLI must too.
function validateSolAddress(address: string): IAddressValidationResult {
  try {
    const publicKey = new PublicKey(address);
    if (
      PublicKey.isOnCurve(address) ||
      PublicKey.isOnCurve(publicKey.encode()) ||
      bs58.decode(address).length === 32
    ) {
      return { isValid: true, normalizedAddress: address };
    }
    return { isValid: false, normalizedAddress: '' };
  } catch {
    return { isValid: false, normalizedAddress: '' };
  }
}

export function assertAddressForChain(
  chainConfig: IChainConfig,
  address: string,
): string {
  const validation = validateAddressForChain(chainConfig, address);
  if (validation.isValid) {
    return validation.normalizedAddress || address;
  }

  throw new AppError(
    ERROR_CODES.PARAM_INVALID_ADDRESS.code,
    `Invalid address for ${chainConfig.networkId}: ${address}`,
    `Provide a valid ${chainConfig.nativeSymbol} address for ${chainConfig.networkId}.`,
  );
}

// Token identifier format check by chain.
// EVM: 0x + 40 hex (ERC-20 contract address).
// SOL: 32-byte base58 PublicKey (SPL mint).
// BTC/TBTC: no tokens.
// Validates pre-API call so we fail fast with a chain-specific error.
export function assertTokenAddressForChain(
  chainConfig: IChainConfig,
  token: string,
): string {
  if (chainConfig.impl === IMPL_EVM) {
    if (!EVM_ADDRESS_RE.test(token)) {
      throw new AppError(
        ERROR_CODES.PARAM_INVALID_TOKEN.code,
        `Invalid ERC-20 contract address for ${chainConfig.networkId}: ${token}`,
        'Provide a 0x-prefixed, 40 hex character contract address.',
      );
    }
    return token;
  }
  if (chainConfig.impl === IMPL_SOL) {
    const validation = validateSolAddress(token);
    if (!validation.isValid) {
      throw new AppError(
        ERROR_CODES.PARAM_INVALID_TOKEN.code,
        `Invalid SPL mint address for ${chainConfig.networkId}: ${token}`,
        'Provide a base58 SPL mint pubkey (32 bytes).',
      );
    }
    return validation.normalizedAddress || token;
  }
  throw new AppError(
    ERROR_CODES.PARAM_INVALID_TOKEN.code,
    `Token transfers not supported on ${chainConfig.networkId}.`,
    'Send the chain native asset instead.',
  );
}

export function sameAddress(
  chainConfig: IChainConfig,
  left: string,
  right: string,
): boolean {
  if (chainConfig.impl === IMPL_EVM) {
    return left.toLowerCase() === right.toLowerCase();
  }
  // SOL/BTC are case-sensitive (base58 / bech32) — stay strict.
  return left === right;
}
