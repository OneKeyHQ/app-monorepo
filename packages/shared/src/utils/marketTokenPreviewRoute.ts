import type { IMarketTokenDetailPreview } from '../../types/marketV2';

export function parseTokenDetailPreviewParam(
  value: unknown,
): IMarketTokenDetailPreview | undefined {
  try {
    const preview: unknown =
      typeof value === 'string' ? JSON.parse(value) : value;
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

export const marketTokenPreviewRouteConfig = {
  parse: { legacyTokenPreview: parseTokenDetailPreviewParam },
  stringify: {
    legacyTokenPreview: (value: unknown): string => {
      const preview = parseTokenDetailPreviewParam(value);
      return preview ? JSON.stringify(preview) : '';
    },
  },
};
