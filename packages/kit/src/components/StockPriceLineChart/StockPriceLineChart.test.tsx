/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { StockPriceLineChart } from './StockPriceLineChart';

let mockOnLayout:
  | ((event: { nativeEvent: { layout: { width: number } } }) => void)
  | undefined;
let mockChartData: IMarketTokenChart;

jest.mock('@onekeyhq/components', () => ({
  Stack: ({
    children,
    onLayout,
    testID,
  }: {
    children?: ReactNode;
    onLayout?: typeof mockOnLayout;
    testID?: string;
  }) => {
    if (testID === 'simple-chart') mockOnLayout = onLayout;
    return <div>{children}</div>;
  },
}));

jest.mock('@tamagui/core', () => ({
  useTheme: () => ({
    textCritical: { val: '#ff0000' },
    textSuccess: { val: '#00aa00' },
    textSubdued: { val: '#666666' },
    bgApp: { val: '#ffffff' },
    borderStrong: { val: '#aaaaaa' },
    primary10: { val: '#000000' },
    textInverse: { val: '#ffffff' },
    bgCriticalStrong: { val: '#ff0000' },
    bgSuccessStrong: { val: '#00aa00' },
    bg: { val: '#ffffff' },
    borderSubdued: { val: '#dddddd' },
    text: { val: '#000000' },
    textDisabled: { val: '#999999' },
  }),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useFormatDate', () => ({
  __esModule: true,
  default: () => ({ formatDate: () => '' }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('../LightweightChart', () => ({
  LightweightChart: ({ data }: { data: IMarketTokenChart }) => {
    mockChartData = data;
    return null;
  },
}));

const data: IMarketTokenChart = Array.from({ length: 288 }, (_, index) => [
  index * 300,
  100 + index,
]);

function measure(width: number) {
  act(() => mockOnLayout?.({ nativeEvent: { layout: { width } } }));
}

it('preserves the sampled series while a tab is hidden and shown at the same width', () => {
  render(
    <StockPriceLineChart data={data} height={240} testID="simple-chart" />,
  );
  measure(480);
  const sampled = mockChartData;
  expect(sampled.length).toBeLessThan(data.length);

  measure(0);
  expect(mockChartData).toBe(sampled);
  measure(480);
  expect(mockChartData).toBe(sampled);
});

it('keeps live updates and real width changes working after a hidden measurement', () => {
  const { rerender } = render(
    <StockPriceLineChart data={data} height={240} testID="simple-chart" />,
  );
  measure(480);
  const sampledCount = mockChartData.length;
  measure(0);

  const updated: IMarketTokenChart = [...data, [288 * 300, 500]];
  rerender(
    <StockPriceLineChart data={updated} height={240} testID="simple-chart" />,
  );
  expect(mockChartData.length).toBeLessThan(updated.length);
  expect(mockChartData.at(-1)).toEqual(updated.at(-1));

  measure(960);
  expect(mockChartData.length).toBeGreaterThan(sampledCount);
  expect(mockChartData.at(-1)).toEqual(updated.at(-1));
});
