// cspell: words hypercore unifold Unifold
// HyperCore Perp (USDC) deposit destination. Verified byte-for-byte against
// Unifold's live supported_destination_tokens: chain_id 1337, chain_type
// ethereum, zero token address (34-char sentinel value, do not "fix" it).
// All Unifold traffic goes through the OneKey wallet service; no vendor key
// lives in the client anymore.
export const UNIFOLD_HYPERCORE_CHAIN_TYPE = 'ethereum';
export const UNIFOLD_HYPERCORE_CHAIN_ID = '1337';
export const UNIFOLD_HYPERCORE_USDC_PERP_ADDRESS =
  '0x00000000000000000000000000000000';
export const UNIFOLD_HYPERCORE_USDC_PERP_SYMBOL = 'USDC (Perp)';
