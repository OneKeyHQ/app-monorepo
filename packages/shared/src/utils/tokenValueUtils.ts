export const UNAVAILABLE_DISPLAY = '--';

// During the OK-46226 backend compatibility window, fields typed as `string`
// or `number` on ITokenFiat may be null/undefined at runtime when an upstream
// provider (indexer/onchain/wallet) fails to return data. Accept the loose
// runtime type so callers don't need to cast at every site.
export function isValidNumberValue(
  v: string | number | null | undefined,
): v is string | number {
  return v !== null && v !== undefined && v !== '';
}

// Renderers feed this directly into NumberSizeableText, which already
// short-circuits the '--' string without running it through a formatter
// (packages/components/src/content/NumberSizeableText/index.tsx:87-98).
export function displayOrUnavailable(
  v: string | number | null | undefined,
): string | number {
  return isValidNumberValue(v) ? v : UNAVAILABLE_DISPLAY;
}
