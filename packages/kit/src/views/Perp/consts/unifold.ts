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

// Dev-only alternative destination: Arbitrum USDC (server allowlists it).
// A plain-chain destination settles straight back into the user's own wallet,
// so the whole pipeline (address → vendor scan → execution ledger → polling →
// webhook) can be exercised for the price of source-chain gas, with no
// HyperCore activation fee and no Hyperliquid withdrawal fee. Values verified
// against the vendor catalog — do not rewrite from memory.
// Production always uses the HyperCore destination above.
export const UNIFOLD_ARBITRUM_CHAIN_TYPE = 'ethereum';
export const UNIFOLD_ARBITRUM_CHAIN_ID = '42161';
export const UNIFOLD_ARBITRUM_USDC_ADDRESS =
  '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
export const UNIFOLD_ARBITRUM_USDC_SYMBOL = 'USDC';
