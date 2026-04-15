export const BITREFILL_EMBED_ORIGIN = 'https://embed.bitrefill.com';
export const BITREFILL_REF_CODE = 'bronekey01';

// Only EVM payment methods are supported — OneKey has a native ethereum: URI
// parser already, and handling non-EVM networks would require extra parsers.
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
