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
 * Solana chains accepted by WalletConnect Pay, keyed by CAIP-2 reference
 * (first 32 base58 chars of the genesis hash, per the same coverage doc)
 * mapped to the OneKey networkId. Pay uses only this CAIP-30 form; the
 * deprecated `4sGjMW…` mainnet id is deliberately not accepted.
 */
export const WALLET_CONNECT_PAY_SOLANA_CHAINS: Record<string, string> = {
  '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 'sol--101',
};

/**
 * Maps a CAIP-2 chain id to a OneKey networkId, restricted to the vetted
 * chain whitelists so that server-returned actions on any other chain are
 * rejected before signing.
 */
export function wcPayChainIdToNetworkId(caip2ChainId: string): string | null {
  // Exactly two non-empty segments: CAIP-2 is `namespace:reference` and
  // nothing else. Destructuring only the first two fields would silently
  // accept trailing segments (`eip155:1:extra` as `evm--1`); such an id can
  // still only ever map onto the whitelisted chain it names, but a malformed
  // id from the server must not pass as a valid one.
  const parts = caip2ChainId.split(':');
  if (parts.length !== 2) {
    return null;
  }
  const [namespace, reference] = parts;
  if (!namespace || !reference) {
    return null;
  }
  if (
    namespace === 'eip155' &&
    WALLET_CONNECT_PAY_EIP155_CHAIN_REFS.includes(reference)
  ) {
    return `evm--${reference}`;
  }
  if (
    namespace === 'solana' &&
    Object.prototype.hasOwnProperty.call(
      WALLET_CONNECT_PAY_SOLANA_CHAINS,
      reference,
    )
  ) {
    return WALLET_CONNECT_PAY_SOLANA_CHAINS[reference];
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
