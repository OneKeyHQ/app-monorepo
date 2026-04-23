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
};

type IResolvedPath = {
  key: string;
  d: string;
  fill: string;
};

// Tamagui palette tokens are stored `$`-prefixed (see DeFiPortfolioPalette);
// `useTheme()` indexes by the unprefixed name. Fall back to the raw token so
// mis-resolution is visible instead of silently rendering black.
function resolveColor(
  theme: ReturnType<typeof useTheme>,
  token: string,
): string {
  const key = token.startsWith('$') ? token.slice(1) : token;
  const entry = (
    theme as unknown as Record<string, { val?: string } | undefined>
  )[key];
  return entry?.val ?? token;
}

export function DeFiPortfolioDonut({
  slices,
  size = 120,
  thickness = 18,
}: IDeFiPortfolioDonutProps) {
  const theme = useTheme();
  const outerRadius = size / 2;
  const innerRadius = Math.max(0, outerRadius - thickness);

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
          fill: resolveColor(theme, PORTFOLIO_EMPTY_RING_TOKEN),
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
      });
      cursor += slice.percent;
      if (d) {
        result.push({
          key: slice.key,
          d,
          fill: resolveColor(theme, slice.colorToken),
        });
      }
    }
    return result;
  }, [slices, outerRadius, innerRadius, theme]);

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
    >
      {paths.map((p) => (
        <Path key={p.key} d={p.d} fill={p.fill} />
      ))}
    </Svg>
  );
}

DeFiPortfolioDonut.displayName = 'DeFiPortfolioDonut';
