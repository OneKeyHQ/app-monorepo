import type { IPortfolioSlice } from './DeFiPortfolioStats';

export type IStackedBarSegment = {
  key: string;
  /** 0..100. Used as `flexBasis: ${flexBasis}%` by the renderer; also
   * the source of truth for the tooltip's one-decimal percent string. */
  flexBasis: number;
  colorToken: string;
  /** Integer-percent label for legend use, e.g. "13%". Tooltip uses
   * one-decimal precision via formatPortfolioPercent instead. */
  label: string;
  /** Source slice label, exposed for tooltips. */
  sliceLabel: string;
  /** Source net worth, exposed for tooltips. */
  netWorth: number;
  /** Network IDs the protocol spans. Tooltip surfaces multi-chain
   * logos when length > 1; transparent in single-chain contexts. */
  networkIds: string[];
};

function formatLegendPercentLabel(p: number): string {
  // Integer percent for legend density. The tooltip carries the
  // one-decimal precision.
  return `${Math.round(p)}%`;
}

export function buildStackedBarSegments(
  slices: IPortfolioSlice[],
): IStackedBarSegment[] {
  return slices.map((s) => ({
    key: s.key,
    flexBasis: s.percent,
    colorToken: s.colorToken,
    label: formatLegendPercentLabel(s.percent),
    sliceLabel: s.label,
    netWorth: s.netWorth,
    networkIds: s.networkIds,
  }));
}
