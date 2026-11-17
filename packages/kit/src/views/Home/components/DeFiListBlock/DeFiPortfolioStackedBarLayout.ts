import { formatPortfolioPercent } from './formatPortfolioPercent';

import type { IPortfolioSlice } from './DeFiPortfolioStats';

export type IStackedBarSegment = {
  key: string;
  /** 0..100. Used as `flexBasis: ${flexBasis}%` by the renderer; also
   * the source of truth for the tooltip's one-decimal percent string. */
  flexBasis: number;
  colorToken: string;
  /** Display label shared with the tooltip, e.g. "12.7%". */
  label: string;
  /** Source slice label, exposed for tooltips. */
  sliceLabel: string;
  /** Source net worth, exposed for tooltips. */
  netWorth: number;
  /** Network IDs the protocol spans. Tooltip surfaces multi-chain
   * logos when length > 1; transparent in single-chain contexts. */
  networkIds: string[];
};

export function buildStackedBarSegments(
  slices: IPortfolioSlice[],
): IStackedBarSegment[] {
  return slices.map((s) => ({
    key: s.key,
    flexBasis: s.percent,
    colorToken: s.colorToken,
    label: formatPortfolioPercent(s.percent, s.netWorth),
    sliceLabel: s.label,
    netWorth: s.netWorth,
    networkIds: s.networkIds,
  }));
}
