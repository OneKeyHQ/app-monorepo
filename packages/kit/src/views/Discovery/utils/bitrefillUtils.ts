export const BITREFILL_EMBED_ORIGIN = 'https://embed.bitrefill.com';
export const BITREFILL_REF_CODE = 'bronekey01';

// EVM-only payment method identifiers accepted by Bitrefill's embed widget.
// These identifiers are Bitrefill's own naming (not OneKey's) — see the
// paymentMethods enum in Bitrefill's embed docs. Non-EVM methods (bitcoin,
// lightning, usdc_solana, usdt_trc20, etc.) are intentionally excluded
// because OneKey currently only has a native parser for ethereum: URIs.
// Not every EVM pair is listed (e.g. usdt_base, usdc_bsc) because Bitrefill
// does not support them as of 2026-04-15; add as they become available.
const EVM_PAYMENT_METHODS = [
  'ethereum',
  'eth_base',
  'usdc_erc20',
  'usdc_polygon',
  'usdc_arbitrum',
  'usdc_base',
  'usdt_erc20',
  'usdt_polygon',
  'usdt_arbitrum',
  'usdt_bsc',
];

export function getBitrefillEmbedUrl(): string {
  const params = new URLSearchParams({
    ref: BITREFILL_REF_CODE,
    utm_source: 'onekey',
    paymentMethods: EVM_PAYMENT_METHODS.join(','),
  });
  return `${BITREFILL_EMBED_ORIGIN}/?${params.toString()}`;
}
