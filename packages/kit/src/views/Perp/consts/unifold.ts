// cspell: words hypercore unifold Unifold
// Publishable key is safe to embed in the client bundle, same convention as
// WALLET_CONNECT_V2_PROJECT_ID.
export const UNIFOLD_PERPS_PUBLISHABLE_KEY =
  'pk_live_3FoqsO5i8l65qRYwEv5fYwvFjq4';

// HyperCore Perp (USDC) deposit destination. Verified byte-for-byte against
// Unifold's live supported_destination_tokens: chain_id 1337, chain_type
// ethereum, zero token address.
export const UNIFOLD_HYPERCORE_CHAIN_ID = '1337';
export const UNIFOLD_HYPERCORE_USDC_PERP_ADDRESS =
  '0x00000000000000000000000000000000';
export const UNIFOLD_HYPERCORE_USDC_PERP_SYMBOL = 'USDC (Perp)';
