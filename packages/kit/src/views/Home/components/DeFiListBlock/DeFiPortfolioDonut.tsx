import { useMemo } from 'react';

import Svg, { Path } from 'react-native-svg';

import { getTokenValue } from '@onekeyhq/components';

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

function resolveSliceFill(token: string): string {
  // getTokenValue returns `any`; the 'color' category guarantees a string.
  const resolved: unknown = getTokenValue(token as `$${string}`, 'color');
  return typeof resolved === 'string' ? resolved : token;
}

export function DeFiPortfolioDonut({
  slices,
  size = 120,
  thickness = 18,
}: IDeFiPortfolioDonutProps) {
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
          fill: resolveSliceFill(PORTFOLIO_EMPTY_RING_TOKEN),
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
          fill: resolveSliceFill(slice.colorToken),
        });
      }
    }
    return result;
  }, [slices, outerRadius, innerRadius]);

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
