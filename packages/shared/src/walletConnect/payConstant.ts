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

/**
 * Maps a CAIP-2 chain id to a OneKey networkId, restricted to the vetted
 * WALLET_CONNECT_PAY_EIP155_CHAIN_REFS list so that server-returned actions
 * on any other chain are rejected before signing.
 */
export function wcPayChainIdToNetworkId(caip2ChainId: string): string | null {
  const [namespace, reference] = caip2ChainId.split(':');
  if (
    namespace === 'eip155' &&
    reference &&
    WALLET_CONNECT_PAY_EIP155_CHAIN_REFS.includes(reference)
  ) {
    return `evm--${reference}`;
  }
  return null;
}

export const WALLET_CONNECT_PAY_TRUSTED_HOST = 'pay.walletconnect.com';

export function isWcPayTrustedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === WALLET_CONNECT_PAY_TRUSTED_HOST ||
    host.endsWith(`.${WALLET_CONNECT_PAY_TRUSTED_HOST}`)
  );
}

/**
 * Strict check for URLs that will actually be LOADED (webview/iframe):
 * https only, trusted host only. Unlike validateWcPayLinkDomain there is no
 * pass-through for non-URL strings, so schemes like javascript: are rejected.
 */
export function isWcPayTrustedUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && isWcPayTrustedHost(hostname);
  } catch {
    return false;
  }
}

/**
 * Domain guard on top of the SDK's `isPaymentLink`, which only does substring
 * matching (`pay.` / `pay=` / `pay_`) so e.g. `pay.walletconnect.com.evil.com`,
 * `evil.com/?pid=pay_x` and arbitrary text like `ORDER_PAY_2024` all pass it.
 * URL forms must be https on pay.walletconnect.com (or a subdomain); non-URL
 * forms carry no host, so only the known shapes are accepted: `wc:` URIs
 * (the SDK already required a pay marker) and bare `pay_...` ids.
 */
export function validateWcPayLinkDomain(uri: string): boolean {
  if (!/^https?:\/\//i.test(uri)) {
    return uri.startsWith('wc:') || /^pay_[\w-]+$/i.test(uri);
  }
  return isWcPayTrustedUrl(uri);
}
