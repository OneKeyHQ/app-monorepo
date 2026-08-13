/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { PerpFundingChart } from './PerpFundingChart';

type IMockLightweightChartProps = {
  data: IMarketTokenChart;
  lineType?: 'simple' | 'steps';
  lineWidth?: number;
  priceScalePosition?: 'left' | 'right';
  secondaryLineData?: IMarketTokenChart;
  showLastValue?: boolean;
  showTimeScale?: boolean;
};

const mockLightweightChart = jest.fn((_props: IMockLightweightChartProps) => (
  <div data-testid="funding-chart" />
));

jest.mock('@onekeyhq/components', () => {
  function MockStack({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void;
  }) {
    return onPress ? (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    ) : (
      <div>{children}</div>
    );
  }

  return {
    Icon: MockStack,
    SizableText: MockStack,
    Spinner: MockStack,
    Tooltip: ({
      renderTrigger,
      renderContent,
    }: {
      renderTrigger: ReactNode;
      renderContent: ReactNode;
    }) => (
      <div>
        {renderTrigger}
        {renderContent}
      </div>
    ),
    XStack: MockStack,
    YStack: MockStack,
    useTheme: () => ({
      bgAccent: { val: '#31E72F' },
      bgCriticalStrong: { val: '#EF4444' },
    }),
  };
});

jest.mock('@onekeyhq/kit/src/components/LightweightChart', () => ({
  LightweightChart: (props: IMockLightweightChartProps) =>
    mockLightweightChart(props),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    locale: 'en-US',
    formatMessage: () => '',
  }),
}));

jest.mock('../../hooks/usePerpMarketDetail', () => ({
  usePerpFundingHistory: () => ({
    result: [
      {
        coin: 'BTC',
        fundingRate: '0.00001',
        premium: '0',
        time: 0,
      },
      {
        coin: 'BTC',
        fundingRate: '0.00002',
        premium: '0',
        time: 60 * 60 * 1000,
      },
      {
        coin: 'BTC',
        fundingRate: '0.00003',
        premium: '0',
        time: 8 * 60 * 60 * 1000,
      },
    ],
    isLoading: false,
  }),
}));

describe('PerpFundingChart', () => {
  beforeEach(() => {
    mockLightweightChart.mockClear();
  });

  it('renders current and cumulative funding as separate charts', () => {
    render(<PerpFundingChart coin="BTC" />);

    expect(mockLightweightChart).toHaveBeenCalledTimes(2);
    expect(mockLightweightChart.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        data: [
          [0, 0.003],
          [28_800, 0.003],
        ],
        lineWidth: 1,
        lineType: undefined,
        priceScalePosition: 'left',
        showLastValue: false,
        showTimeScale: true,
      }),
    );
    expect(mockLightweightChart.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        data: [
          [0, 0.003],
          [28_800, 0.006],
        ],
        lineWidth: 1,
        lineType: 'steps',
        priceScalePosition: 'left',
        showLastValue: true,
        showTimeScale: true,
      }),
    );
    expect(mockLightweightChart.mock.calls[0][0]).not.toHaveProperty(
      'secondaryLineData',
    );
    expect(mockLightweightChart.mock.calls[1][0]).not.toHaveProperty(
      'secondaryLineData',
    );
    expect(
      screen.getByText(
        'The funding rate for each selected interval. Positive rates mean long positions pay short positions; negative rates mean short positions pay long positions.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'The running sum of funding rates over the displayed period. It shows how funding has accumulated over time, not the funding paid by an individual account.',
      ),
    ).toBeTruthy();
    ['1h', '4h', '8h', '12h', 'D'].forEach((label) => {
      expect(screen.getAllByText(label)).toHaveLength(2);
    });
  });

  it('lets each chart select its interval independently', () => {
    render(<PerpFundingChart coin="BTC" />);

    fireEvent.click(screen.getAllByText('1h')[0]);

    const latestCalls = mockLightweightChart.mock.calls.slice(-2);
    expect(latestCalls[0][0].data).toEqual([
      [0, 0.001],
      [3600, 0.002],
      [28_800, 0.003],
    ]);
    expect(latestCalls[1][0].data).toEqual([
      [0, 0.003],
      [28_800, 0.006],
    ]);
  });
});
