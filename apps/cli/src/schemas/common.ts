import { z } from 'zod';

import { BTC_ADDRESS_TYPES } from '../core/btc/address-types';

/** 0x-prefixed, 40 hex character Ethereum-compatible address */
export const ethAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

/** Chain-specific account address for read-only account/history commands */
export const chainAddress = z
  .string()
  .min(1)
  .describe(
    'Chain-specific account address, for example 0x..., bc1..., or tb1...',
  );

/** Blockchain identifier — alias (eth, bsc) or networkId (evm--1) */
export const chainId = z
  .string()
  .min(1)
  .describe('Chain alias (eth, bsc, polygon) or networkId (evm--1, evm--56)');

/** Canonical user-facing BTC address type */
export const btcAddressType = z.enum(BTC_ADDRESS_TYPES);

/**
 * Human-readable token amount (e.g. "1.5", "0.001").
 * NEVER smallest unit (wei, sat). CLI handles conversion internally.
 */
export const humanAmount = z
  .string()
  .regex(/^\d+\.?\d*$/, 'Amount must be a positive number')
  .describe(
    'Human-readable amount (e.g. "1.5"). NEVER smallest unit (wei/sat). CLI converts internally.',
  );

/** Token identifier — contract address or symbol (resolved by CLI) */
export const tokenId = z
  .string()
  .min(1)
  .describe('Token contract address (0x...) or symbol (ETH, USDC)');

/** Positive integer as string */
export const positiveIntString = z
  .string()
  .regex(/^\d+$/, 'Must be a positive integer');

/** BTC fee rate tier (slow/standard/fast) */
export const btcFeeTier = z
  .enum(['slow', 'standard', 'fast'])
  .describe('BTC fee tier — slow, standard (default), or fast');

/** BTC fee rate in sats/vByte (positive number, takes priority over --fee-tier) */
export const btcFeeRate = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'Must be a positive number (sats/vByte)')
  .describe('Explicit BTC fee rate in sats/vByte; overrides --fee-tier');
