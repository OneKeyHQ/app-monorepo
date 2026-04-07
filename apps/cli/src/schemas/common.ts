import { z } from 'zod';

/** 0x-prefixed, 40 hex character Ethereum address */
export const ethAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

/** Blockchain identifier — alias (eth, bsc) or networkId (evm--1) */
export const chainId = z
  .string()
  .min(1)
  .describe('Chain alias (eth, bsc, polygon) or networkId (evm--1, evm--56)');

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
