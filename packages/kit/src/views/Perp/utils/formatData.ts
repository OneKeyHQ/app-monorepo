import type { IWsActiveAssetCtx } from '@onekeyhq/shared/types/hyperliquid/sdk';

export function formatAssetCtx(assetCtx: IWsActiveAssetCtx['ctx'] | null) {
  const prevPrice = parseFloat(assetCtx?.prevDayPx || '0');
  const markPrice = parseFloat(assetCtx?.markPx || '0');
  const change24hPercent =
    prevPrice > 0 ? ((markPrice - prevPrice) / prevPrice) * 100 : 0;
  return {
    markPrice: assetCtx?.markPx || '0',
    oraclePrice: assetCtx?.oraclePx || '0',
    prevDayPrice: assetCtx?.prevDayPx || '0',
    fundingRate: assetCtx?.funding || '0',
    openInterest: assetCtx?.openInterest || '0',
    volume24h: assetCtx?.dayNtlVlm || '0',
    change24hPercent,
  };
}

export function formatLargeNumber(
  value: string | number | undefined | null,
  decimals = 2,
): string {
  if (value == null || value === undefined) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(num) || num == null) return '0';

  if (num >= 1e12) {
    return `${(num / 1e12).toFixed(decimals)}T`;
  }
  if (num >= 1e9) {
    return `${(num / 1e9).toFixed(decimals)}B`;
  }
  if (num >= 1e6) {
    return `${(num / 1e6).toFixed(decimals)}M`;
  }
  if (num >= 1e3) {
    return `${(num / 1e3).toFixed(decimals)}K`;
  }

  // For smaller numbers, show more precision
  if (num >= 1) {
    return num.toFixed(decimals);
  }
  if (num >= 0.01) {
    return num.toFixed(decimals);
  }
  // For very small numbers, use more decimal places
  return num.toFixed(6);
}
