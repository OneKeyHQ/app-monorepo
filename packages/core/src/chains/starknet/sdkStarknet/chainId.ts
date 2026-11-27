import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export const STARKNET_MAINNET_CHAIN_ID = '0x534e5f4d41494e' as const;
export const STARKNET_SEPOLIA_CHAIN_ID = '0x534e5f5345504f4c4941' as const;

export type IStarknetCanonicalChainId =
  | typeof STARKNET_MAINNET_CHAIN_ID
  | typeof STARKNET_SEPOLIA_CHAIN_ID;

const CHAIN_ID_ALIASES: Record<string, IStarknetCanonicalChainId> = {
  [STARKNET_MAINNET_CHAIN_ID]: STARKNET_MAINNET_CHAIN_ID,
  sn_main: STARKNET_MAINNET_CHAIN_ID,
  mainnet: STARKNET_MAINNET_CHAIN_ID,
  [STARKNET_SEPOLIA_CHAIN_ID]: STARKNET_SEPOLIA_CHAIN_ID,
  sn_sepolia: STARKNET_SEPOLIA_CHAIN_ID,
  sepolia: STARKNET_SEPOLIA_CHAIN_ID,
};

/**
 * Normalizes Starknet chain IDs from either RPC/starknet.js felt form
 * (`0x534e5f4d41494e`) or OneKey server network config aliases (`mainnet`,
 * `sepolia`) to the canonical hex felt expected by tx hashing and firmware.
 */
export function tryNormalizeStarknetChainId(
  chainId: string,
): IStarknetCanonicalChainId | undefined {
  return CHAIN_ID_ALIASES[chainId.trim().toLowerCase()];
}

export function normalizeStarknetChainId(
  chainId: string,
): IStarknetCanonicalChainId {
  const matched = tryNormalizeStarknetChainId(chainId);
  if (!matched) {
    throw new OneKeyLocalError(`Unsupported Starknet chainId: ${chainId}`);
  }
  return matched;
}
