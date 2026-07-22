import { WALLET_CONNECT_V2_PROJECT_ID } from './constant';

/**
 * WalletConnect Pay app id.
 *
 * Verified on dashboard.walletconnect.com (project OneKeyApp): the
 * "WalletConnect Pay ID" equals the Cloud project id. WalletKit would default
 * `payConfig.appId` to `core.projectId` anyway; we pass it explicitly to keep
 * the dependency visible.
 */
export const WALLET_CONNECT_PAY_APP_ID = WALLET_CONNECT_V2_PROJECT_ID;

export function getWalletConnectPayConfig(): { appId: string } {
  return {
    appId: WALLET_CONNECT_PAY_APP_ID,
  };
}

/**
 * EVM chains accepted by WalletConnect Pay (see
 * https://docs.walletconnect.com/payments/token-and-chain-coverage).
 * Entries are eip155 chain references; each maps to OneKey networkId
 * `evm--{ref}`. Networks not present in the wallet are filtered at runtime.
 * Solana is planned for a later phase.
 */
export const WALLET_CONNECT_PAY_EIP155_CHAIN_REFS: string[] = [
  '1', // Ethereum
  '10', // Optimism
  '56', // BNB Smart Chain
  '137', // Polygon
  '143', // Monad
  '8453', // Base
  '42161', // Arbitrum One
  '42220', // Celo
];

export function wcPayChainIdToNetworkId(caip2ChainId: string): string | null {
  const [namespace, reference] = caip2ChainId.split(':');
  if (namespace === 'eip155' && reference) {
    return `evm--${reference}`;
  }
  return null;
}
