import { useMemo } from 'react';

import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@onekeyhq/components';

import { PORTFOLIO_EMPTY_RING_TOKEN } from './DeFiPortfolioPalette';
import { buildDonutArcPath } from './donutGeometry';

import type { IPortfolioSlice } from './DeFiPortfolioStats';

type IDeFiPortfolioDonutProps = {
  slices: IPortfolioSlice[];
  size?: number;
  thickness?: number;
  gapDeg?: number;
};

// A small angular gap reads as an intentional slice boundary without
// fragmenting the ring; zero looks like one continuous blob.
const DEFAULT_SLICE_GAP_DEG = 2;

type IResolvedPath = {
  key: string;
  d: string;
  fill: string;
};

type ITamaguiThemeShape = Record<string, { val?: string } | undefined>;

// Palette tokens come from the theme layer (`semantic.ts` spreading alpha
// color scales), not the `color` category of `createTokens`. `getTokenValue`
// only covers the latter, so theme-token lookup via `useTheme()` is required.
function resolveSliceFill(
  theme: ReturnType<typeof useTheme>,
  token: string,
): string {
  const key = token.startsWith('$') ? token.slice(1) : token;
  return (theme as unknown as ITamaguiThemeShape)[key]?.val ?? token;
}

export function DeFiPortfolioDonut({
  slices,
  size = 120,
  thickness = 18,
  gapDeg = DEFAULT_SLICE_GAP_DEG,
}: IDeFiPortfolioDonutProps) {
  const theme = useTheme();
  const outerRadius = size / 2;
  const innerRadius = Math.max(0, outerRadius - thickness);
  // Single-slice (100% one protocol) looks wrong with a gap — the one arc
  // would be a C-shape. Suppress the gap then.
  const effectiveGap = slices.length > 1 ? gapDeg : 0;

  const paths = useMemo<IResolvedPath[]>(() => {
    if (slices.length === 0) {
      const d = buildDonutArcPath({
        startPercent: 0,
        sweepPercent: 100,
        outerRadius,
        innerRadius,
      });
      if (!d) return [];
      return [
        {
          key: 'empty-ring',
          d,
          fill: resolveSliceFill(theme, PORTFOLIO_EMPTY_RING_TOKEN),
        },
      ];
    }

    const result: IResolvedPath[] = [];
    let cursor = 0;
    for (const slice of slices) {
      const d = buildDonutArcPath({
        startPercent: cursor,
        sweepPercent: slice.percent,
        outerRadius,
        innerRadius,
        gapDeg: effectiveGap,
      });
      cursor += slice.percent;
      if (d) {
        result.push({
          key: slice.key,
          d,
          fill: resolveSliceFill(theme, slice.colorToken),
        });
      }
    }
    return result;
  }, [slices, outerRadius, innerRadius, theme, effectiveGap]);

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {paths.map((p) => (
        <Path key={p.key} d={p.d} fill={p.fill} />
      ))}
    </Svg>
  );
}

DeFiPortfolioDonut.displayName = 'DeFiPortfolioDonut';
