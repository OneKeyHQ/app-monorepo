// Maps OneKey networkIds to Onramper's network slugs for the headless
// checkout request (Onramper expects e.g. 'ethereum', not 'evm--1').
// TEMPORARY seed for the staging demo: the canonical mapping should come from
// the backend fiat-pay token list once it ships headless metadata per token.
const ONRAMPER_NETWORK_BY_ONEKEY_NETWORK: Record<string, string> = {
  'evm--1': 'ethereum',
  // Staging allowlist candidates: 'solana' confirmed by the official example
  // app (demos usd→sol); 'bitcoin' per the Onramper network-slug examples.
  'btc--0': 'bitcoin',
  'sol--101': 'solana',
};

export function toOnramperNetworkCode(networkId: string): string | undefined {
  return ONRAMPER_NETWORK_BY_ONEKEY_NETWORK[networkId];
}
