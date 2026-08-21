/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { PerpFundingChart } from './PerpFundingChart';

import type { BaselineSeriesPartialOptions } from 'lightweight-charts';

const FUNDING_HISTORY_EMPTY_DESCRIPTION =
  ETranslations.perp_funding_rate_history_empty__desc;

type IMockLightweightChartProps = {
  baselineOptions?: BaselineSeriesPartialOptions;
  data: IMarketTokenChart;
  fontSize?: number;
  hideCrosshairPriceLabel?: boolean;
  lineWidth?: number;
  priceScaleMinimumWidth?: number;
  priceScalePosition?: 'left' | 'right';
  secondaryLineData?: IMarketTokenChart;
  showLastValue?: boolean;
  showTimeScale?: boolean;
  timeZone?: string;
  locale?: string;
};

type IMockFundingHistory = {
  result: Array<{
    coin: string;
    fundingRate: string;
    premium: string;
    time: number;
  }>;
  isLoading: boolean | undefined;
};

const mockLightweightChart = jest.fn((_props: IMockLightweightChartProps) => (
  <div data-testid="funding-chart" />
));
const mockUsePerpFundingHistory = jest.fn<IMockFundingHistory, []>();

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
    SizableText: MockStack,
    Spinner: () => <div data-testid="funding-chart-loading" />,
    XStack: MockStack,
    YStack: MockStack,
    useTheme: () => ({
      bgAccent: { val: '#31E72F' },
      bgCriticalStrong: { val: '#EF4444' },
    }),
    useThemeName: () => 'dark',
  };
});

jest.mock('@onekeyhq/kit/src/components/LightweightChart', () => ({
  LightweightChart: (props: IMockLightweightChartProps) =>
    mockLightweightChart(props),
}));

jest.mock('@onekeyhq/kit/src/components/InfoIcon', () => ({
  InfoIcon: ({ tooltip }: { tooltip: { title: string; content: string } }) => (
    <button
      type="button"
      data-testid="funding-chart-info"
      data-tooltip-title={tooltip.title}
    >
      {tooltip.content}
    </button>
  ),
}));

jest.mock('@onekeyhq/kit/src/hooks/useDeviceTimeZone', () => ({
  useDeviceTimeZone: () => 'Asia/Shanghai',
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    locale: 'en-US',
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('../../hooks/usePerpMarketDetail', () => ({
  usePerpFundingHistory: () => mockUsePerpFundingHistory(),
}));

const FUNDING_HISTORY = [
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
];

describe('PerpFundingChart', () => {
  beforeEach(() => {
    mockLightweightChart.mockClear();
    mockUsePerpFundingHistory.mockReturnValue({
      result: FUNDING_HISTORY,
      isLoading: false,
    });
  });

  it('shows loading instead of the empty state before the first request starts', () => {
    mockUsePerpFundingHistory.mockReturnValue({
      result: [],
      isLoading: undefined,
    });

    render(<PerpFundingChart coin="BTC" variant="mobile" />);

    expect(screen.getByTestId('funding-chart-loading')).toBeTruthy();
    expect(screen.queryByText(FUNDING_HISTORY_EMPTY_DESCRIPTION)).toBeNull();
  });

  it('uses a funding-specific empty message after an empty response', () => {
    mockUsePerpFundingHistory.mockReturnValue({
      result: [],
      isLoading: false,
    });

    render(<PerpFundingChart coin="BTC" variant="mobile" />);

    expect(screen.getByText(FUNDING_HISTORY_EMPTY_DESCRIPTION)).toBeTruthy();
    expect(
      screen.queryByText(ETranslations.perp_market_info_data_unavailable__desc),
    ).toBeNull();
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
        hideCrosshairPriceLabel: true,
        lineWidth: 2,
        priceScalePosition: 'left',
        showLastValue: false,
        showTimeScale: true,
        timeZone: 'Asia/Shanghai',
        locale: 'en-US',
      }),
    );
    expect(mockLightweightChart.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        data: [
          [0, 0.003],
          [28_800, 0.006],
        ],
        hideCrosshairPriceLabel: true,
        lineWidth: 2,
        priceScalePosition: 'left',
        showLastValue: true,
        showTimeScale: true,
        timeZone: 'Asia/Shanghai',
        locale: 'en-US',
      }),
    );
    expect(mockLightweightChart.mock.calls[0][0]).not.toHaveProperty(
      'secondaryLineData',
    );
    expect(mockLightweightChart.mock.calls[1][0]).not.toHaveProperty(
      'secondaryLineData',
    );
    expect(mockLightweightChart.mock.calls[0][0].baselineOptions).toEqual(
      mockLightweightChart.mock.calls[1][0].baselineOptions,
    );
    expect(mockLightweightChart.mock.calls[0][0].baselineOptions).toEqual(
      expect.objectContaining({
        topFillColor1: 'rgba(15, 41, 30, 0.18)',
        topFillColor2: 'rgba(15, 41, 30, 0.18)',
        bottomFillColor1: 'rgba(60, 24, 26, 0.18)',
        bottomFillColor2: 'rgba(60, 24, 26, 0.18)',
      }),
    );
    expect(
      screen.getByText(ETranslations.perp_funding_rate_chart__desc),
    ).toBeTruthy();
    expect(
      screen.getByText(ETranslations.perp_funding_rate_history__title),
    ).toBeTruthy();
    expect(
      screen.getByText(ETranslations.perp_cumulative_funding_rate_chart__desc),
    ).toBeTruthy();
    expect(
      screen
        .getAllByTestId('funding-chart-info')
        .map((element) => element.getAttribute('data-tooltip-title')),
    ).toEqual([
      ETranslations.perp_funding_rate_history__title,
      ETranslations.perp_cumulative_funding_rate__title,
    ]);
    ['1h', '4h', '8h', '12h', 'D'].forEach((label) => {
      expect(screen.getAllByText(label)).toHaveLength(2);
    });
    expect(
      screen.getAllByText(ETranslations.perp_positive_funding_rate__label),
    ).toHaveLength(2);
    expect(
      screen.getAllByText(ETranslations.perp_negative_funding_rate__label),
    ).toHaveLength(2);
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

  it('uses compact axes for the mobile chart layout', () => {
    render(<PerpFundingChart coin="BTC" variant="mobile" />);

    expect(mockLightweightChart).toHaveBeenCalledTimes(2);
    expect(
      screen.getAllByText(ETranslations.perp_positive_funding_rate__label),
    ).toHaveLength(2);
    expect(
      screen.getAllByText(ETranslations.perp_negative_funding_rate__label),
    ).toHaveLength(2);
    mockLightweightChart.mock.calls.forEach(([props]) => {
      expect(props).toEqual(
        expect.objectContaining({
          fontSize: 9,
          lineWidth: 1,
          priceScaleMinimumWidth: 48,
        }),
      );
    });
  });
});
