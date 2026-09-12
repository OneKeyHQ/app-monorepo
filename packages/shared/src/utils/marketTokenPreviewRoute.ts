import type { IMarketTokenDetailPreview } from '../../types/marketV2';

export function parseTokenDetailPreviewParam(
  value: unknown,
): IMarketTokenDetailPreview | undefined {
  try {
    // Only in-memory route objects may seed the preview. URL strings are not
    // trusted token metadata, even when they contain well-formed JSON.
    const preview = value;
    if (!preview || typeof preview !== 'object' || Array.isArray(preview))
      return undefined;
    const candidate = preview as Partial<IMarketTokenDetailPreview>;
    if (
      typeof candidate.address !== 'string' ||
      typeof candidate.networkId !== 'string' ||
      typeof candidate.name !== 'string' ||
      typeof candidate.symbol !== 'string' ||
      typeof candidate.decimals !== 'number' ||
      !Number.isFinite(candidate.decimals) ||
      typeof candidate.selectedAt !== 'number' ||
      !Number.isFinite(candidate.selectedAt)
    )
      return undefined;
    return candidate as IMarketTokenDetailPreview;
  } catch {
    return undefined;
  }
}

// URL/hash navigation must fetch authoritative metadata instead of restoring
// display identity from caller-controlled query parameters.
export const marketTokenPreviewRouteConfig = {
  parse: { legacyTokenPreview: (_value: string): undefined => undefined },
  stringify: {
    legacyTokenPreview: (_value: unknown): string => '',
  },
};
