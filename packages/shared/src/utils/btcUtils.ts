/**
 * BTC address and path utility functions.
 *
 * These are simple prefix-based checks that do NOT depend on heavy crypto deps,
 * so they can safely live in shared.
 *
 * Migrated from @onekeyhq/core/src/chains/btc/sdkBtc to avoid core
 * dependency in kit/shared.
 */

export const isTaprootPath = (pathPrefix: string) =>
  pathPrefix.startsWith(`m/86'/`);

export const isNativeSegwitPath = (pathPrefix: string) =>
  pathPrefix.startsWith(`m/84'/`);

// oxlint-disable-next-line @cspell/spellchecker
// Taproot addresses start with 'bc1p' on mainnet

// oxlint-disable-next-line @cspell/spellchecker
// Taproot addresses start with 'tb1p' on testnet
export const isTaprootAddress = (address: string): boolean =>
  address.startsWith('bc1p') || address.startsWith('tb1p');

export const isNativeSegwitAddress = (address: string): boolean =>
  address.startsWith('bc1q') || address.startsWith('tb1q');

export default {
  isTaprootPath,
  isNativeSegwitPath,
  isTaprootAddress,
  isNativeSegwitAddress,
};
