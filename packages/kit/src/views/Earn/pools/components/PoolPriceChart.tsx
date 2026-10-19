import { useMemo, useState } from 'react';

import { useTheme } from '@tamagui/core';
import Svg, { Path } from 'react-native-svg';

import { Stack } from '@onekeyhq/components';

import type { LayoutChangeEvent } from 'react-native';

const PADDING_Y = 6;

/** 30-day price line; green when the period ended higher, red when lower */
export function PoolPriceChart({
  prices,
  height = 96,
}: {
  /** Display prices, oldest first */
  prices: number[];
  height?: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const path = useMemo(() => {
    if (!width || prices.length < 2) {
      return '';
    }
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const span = max - min || 1;
    const usable = height - PADDING_Y * 2;
    return prices
      .map((price, index) => {
        const x = (index / (prices.length - 1)) * width;
        const y = PADDING_Y + usable - ((price - min) / span) * usable;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [height, prices, width]);

  const rising = prices.length < 2 || prices[prices.length - 1] >= prices[0];
  const color = rising ? theme.iconSuccess?.val : theme.iconCritical?.val;

  return (
    <Stack
      h={height}
      onLayout={(event: LayoutChangeEvent) =>
        setWidth(event.nativeEvent.layout.width)
      }
    >
      {path ? (
        <Svg width={width} height={height}>
          <Path
            d={path}
            stroke={String(color ?? '#22c55e')}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      ) : null}
    </Stack>
  );
}
