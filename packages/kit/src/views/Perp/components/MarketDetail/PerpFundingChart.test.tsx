/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen, within } from '@testing-library/react';

import type { ILightweightChartProps } from '@onekeyhq/kit/src/components/LightweightChart';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { PerpFundingChart } from './PerpFundingChart';

import type { BaselineSeriesPartialOptions } from 'lightweight-charts';

const FUNDING_HISTORY_EMPTY_DESCRIPTION =
  ETranslations.perp_funding_rate_history_empty__desc;

type IMockLightweightChartProps = {
  baselineOptions?: BaselineSeriesPartialOptions;
  histogramOptions?: ILightweightChartProps['histogramOptions'];
  seriesType?: ILightweightChartProps['seriesType'];
  onHover?: ILightweightChartProps['onHover'];
  data: IMarketTokenChart;
  fontSize?: number;
  height?: number;
  hideCrosshairPriceLabel?: boolean;
  lineWidth?: number;
  priceFormatterPrecision?: number;
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
  setStopPolling: jest.Mock<boolean, [boolean]>;
};

const mockLightweightChart = jest.fn((_props: IMockLightweightChartProps) => (
  <div data-testid="funding-chart" />
));
const mockUsePerpFundingHistory = jest.fn<
  IMockFundingHistory,
  [string | undefined, string]
>();
const mockSetStopPolling = jest.fn<boolean, [boolean]>(() => false);
let mockIsNative = false;

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockIsNative;
    },
  },
}));

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'svg',
  Path: 'path',
}));

jest.mock('@onekeyhq/components', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  const { createPortal } =
    jest.requireActual<typeof import('react-dom')>('react-dom');
  function MockStack({
    children,
    onPress,
    testID,
    onLayout,
    left,
    bottom,
    width,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
    onLayout?: (event: { nativeEvent: { layout: { width: number } } }) => void;
    left?: number;
    bottom?: number;
    width?: number | string;
  }) {
    useEffect(() => {
      onLayout?.({ nativeEvent: { layout: { width: 360 } } });
    }, [onLayout]);
    return onPress ? (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ) : (
      <div
        data-testid={testID}
        data-left={left}
        data-bottom={bottom}
        data-width={width}
      >
        {children}
      </div>
    );
  }

  return {
    Tooltip: ({ renderContent }: { renderContent: ReactNode }) =>
      createPortal(
        <div data-testid="chart-tooltip-overlay">{renderContent}</div>,
        document.body,
      ),
    Button: MockStack,
    Theme: MockStack,
    ScrollView: MockStack,
    SizableText: MockStack,
    Spinner: () => <div data-testid="funding-chart-loading" />,
    XStack: MockStack,
    YStack: MockStack,
    useThemeName: () => 'light',
    getTokenValue: () => 4,
    useTheme: () => ({
      green9: { val: '#30A46C' },
      red9: { val: '#E5484D' },
      orange9: { val: '#F76808' },
      neutral3: { val: '#EEEEEE' },
      bgInverse: { val: '#000000' },
    }),
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

jest.mock('@onekeyhq/kit/src/hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => 'en-US',
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    locale: 'en-US',
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('../../hooks/usePerpMarketDetail', () => ({
  usePerpFundingHistory: (coin: string | undefined, range: string) =>
    mockUsePerpFundingHistory(coin, range),
}));

jest.mock('./PerpOiChart', () => ({
  PerpOiChart: () => <div data-testid="perp-open-interest-chart" />,
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
    jest.clearAllMocks();
    mockIsNative = false;
    mockUsePerpFundingHistory.mockReturnValue({
      result: FUNDING_HISTORY,
      isLoading: false,
      setStopPolling: mockSetStopPolling,
    });
  });

  it('renders all three cards before funding history arrives', () => {
    mockUsePerpFundingHistory.mockReturnValue({
      result: [],
      isLoading: undefined,
      setStopPolling: mockSetStopPolling,
    });

    const { rerender } = render(
      <PerpFundingChart coin="BTC" variant="mobile" />,
    );

    const funding = screen.getByTestId('perp-funding-rate-chart');
    const cumulative = screen.getByTestId('perp-cumulative-funding-rate-chart');
    expect(screen.getByTestId('perp-open-interest-chart')).toBeTruthy();
    expect(within(funding).getByTestId('funding-chart-loading')).toBeTruthy();
    expect(
      within(cumulative).getByTestId('funding-chart-loading'),
    ).toBeTruthy();
    expect(screen.queryByText(FUNDING_HISTORY_EMPTY_DESCRIPTION)).toBeNull();
    expect(mockLightweightChart).not.toHaveBeenCalled();

    mockUsePerpFundingHistory.mockReturnValue({
      result: FUNDING_HISTORY,
      isLoading: false,
      setStopPolling: mockSetStopPolling,
    });
    rerender(<PerpFundingChart coin="BTC" variant="mobile" />);

    expect(screen.getByTestId('perp-funding-rate-chart')).toBe(funding);
    expect(screen.getByTestId('perp-cumulative-funding-rate-chart')).toBe(
      cumulative,
    );
    expect(within(funding).getByTestId('funding-chart')).toBeTruthy();
    expect(within(cumulative).getByTestId('funding-chart')).toBeTruthy();
    expect(screen.queryByTestId('funding-chart-loading')).toBeNull();
  });

  it('shows a funding-specific empty state in each card after an empty response', () => {
    mockUsePerpFundingHistory.mockReturnValue({
      result: [],
      isLoading: false,
      setStopPolling: mockSetStopPolling,
    });

    render(<PerpFundingChart coin="BTC" variant="mobile" />);

    expect(screen.getAllByText(FUNDING_HISTORY_EMPTY_DESCRIPTION)).toHaveLength(
      2,
    );
    expect(
      screen.queryByText(ETranslations.perp_market_info_data_unavailable__desc),
    ).toBeNull();
  });

  it('renders funding as signed bars and cumulative funding as an unfilled line', () => {
    render(<PerpFundingChart coin="BTC" />);

    expect(screen.getByTestId('perp-funding-chart-scroll-view')).toBeTruthy();
    const chartCalls = mockLightweightChart.mock.calls.slice(-2);
    expect(chartCalls[0][0]).toEqual(
      expect.objectContaining({
        data: [
          [0, 0.003],
          [28_800, 0.003],
        ],
        hideCrosshairPriceLabel: true,
        height: 214,
        lineWidth: 2,
        priceFormatterPrecision: 4,
        priceScalePosition: 'right',
        seriesType: 'histogram',
        showLastValue: false,
        showTimeScale: true,
        timeZone: 'Asia/Shanghai',
        locale: 'en-US',
      }),
    );
    expect(chartCalls[1][0]).toEqual(
      expect.objectContaining({
        data: [
          [0, 0.003],
          [28_800, 0.006],
        ],
        hideCrosshairPriceLabel: true,
        height: 214,
        lineWidth: 2,
        priceFormatterPrecision: 4,
        priceScalePosition: 'right',
        seriesType: 'baseline',
        showLastValue: false,
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
    expect(chartCalls[0][0].histogramOptions).toEqual(
      expect.objectContaining({
        base: 0,
        positiveColor: '#30A46C',
        negativeColor: '#E5484D',
      }),
    );
    expect(chartCalls[1][0].baselineOptions).toEqual(
      expect.objectContaining({
        topLineColor: '#F76808',
        bottomLineColor: '#F76808',
        topFillColor1: 'transparent',
        topFillColor2: 'transparent',
        bottomFillColor1: 'transparent',
        bottomFillColor2: 'transparent',
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
    ['1h', '8h', 'D'].forEach((label) => {
      expect(screen.getAllByText(label)).toHaveLength(2);
    });
    expect(mockUsePerpFundingHistory).toHaveBeenLastCalledWith('BTC', '90d');
    expect(
      within(screen.getByTestId('perp-funding-rate-chart-legend')).getByText(
        ETranslations.perp_positive_funding_rate__label,
      ),
    ).toBeTruthy();
    expect(
      within(
        screen.getByTestId('perp-cumulative-funding-rate-chart-legend'),
      ).getByText(ETranslations.perp_cumulative_funding_rate_short__title),
    ).toBeTruthy();
  });

  it('changes each chart interval locally after preloading 90 days', () => {
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
    expect(mockUsePerpFundingHistory).toHaveBeenLastCalledWith('BTC', '90d');

    fireEvent.click(screen.getAllByText('1h')[1]);
    expect(mockUsePerpFundingHistory).toHaveBeenLastCalledWith('BTC', '90d');

    fireEvent.click(screen.getAllByText('D')[0]);
    expect(mockUsePerpFundingHistory).toHaveBeenLastCalledWith('BTC', '90d');
    expect(
      within(screen.getByTestId('perp-funding-rate-chart')).getByText(
        FUNDING_HISTORY_EMPTY_DESCRIPTION,
      ),
    ).toBeTruthy();
    expect(
      within(
        screen.getByTestId('perp-cumulative-funding-rate-chart'),
      ).getByTestId('funding-chart'),
    ).toBeTruthy();
    expect(
      new Set(mockUsePerpFundingHistory.mock.calls.map(([, range]) => range)),
    ).toEqual(new Set(['90d']));
  });

  it('uses the same chart types and readable axes in the mobile layout', () => {
    render(<PerpFundingChart coin="BTC" variant="mobile" />);

    expect(screen.queryByTestId('perp-funding-chart-scroll-view')).toBeNull();
    expect(
      mockLightweightChart.mock.calls
        .slice(-2)
        .map(([props]) => props.seriesType),
    ).toEqual(['histogram', 'baseline']);
    expect(
      within(screen.getByTestId('perp-funding-rate-chart-legend')).getByText(
        ETranslations.perp_positive_funding_rate__label,
      ),
    ).toBeTruthy();
    expect(
      within(
        screen.getByTestId('perp-cumulative-funding-rate-chart-legend'),
      ).getByText(ETranslations.perp_cumulative_funding_rate_short__title),
    ).toBeTruthy();
    mockLightweightChart.mock.calls.forEach(([props]) => {
      expect(props).toEqual(
        expect.objectContaining({
          fontSize: 11,
          height: 214,
          lineWidth: 2,
          priceScalePosition: 'right',
          priceScaleMinimumWidth: 60,
          priceScaleLabelAlign: 'right',
          horzLineStyle: 0,
          showLastValue: false,
        }),
      );
    });
  });

  it.each(['mobile', 'workspace'] as const)(
    'keeps a compact tooltip outside desktop clipping and above the native plot in %s',
    (variant) => {
      mockIsNative = variant === 'mobile';
      render(<PerpFundingChart coin="BTC" variant={variant} />);
      const hover = mockLightweightChart.mock.calls.at(-1)?.[0].onHover;
      act(() => hover?.({ time: 28_800, price: 0.006, x: 290, y: 240 }));
      const tooltip = screen.getByTestId(
        'perp-cumulative-funding-rate-chart-tooltip',
      );
      expect(tooltip.getAttribute('data-width')).toBe('200');
      if (mockIsNative) {
        expect(tooltip.parentElement?.getAttribute('data-bottom')).toBe('226');
        expect(tooltip.parentElement?.getAttribute('data-left')).toBe('152');
      } else {
        expect(
          screen.getByTestId('chart-tooltip-overlay').contains(tooltip),
        ).toBe(true);
        expect(
          screen
            .getByTestId('perp-funding-chart-scroll-view')
            .contains(tooltip),
        ).toBe(false);
      }
      expect(within(tooltip).getByText('0.0030%')).toBeTruthy();
      expect(within(tooltip).getByText('0.0060%')).toBeTruthy();

      act(() => hover?.({ time: 28_800, price: 0.006, x: 0, y: 0 }));
      if (mockIsNative) {
        expect(tooltip.parentElement?.getAttribute('data-bottom')).toBe('226');
        expect(tooltip.parentElement?.getAttribute('data-left')).toBe('8');
      }

      fireEvent.click(screen.getAllByText('1h')[1]);
      expect(
        screen.queryByTestId('perp-cumulative-funding-rate-chart-tooltip'),
      ).toBeNull();
    },
  );

  it('pauses polling while hidden and resumes when active', () => {
    const { rerender } = render(
      <PerpFundingChart coin="BTC" isActive={false} />,
    );

    expect(mockSetStopPolling).toHaveBeenLastCalledWith(true);

    rerender(<PerpFundingChart coin="BTC" isActive />);

    expect(mockSetStopPolling).toHaveBeenLastCalledWith(false);
  });

  it('only updates chart data references when polling history changes', () => {
    const { rerender } = render(<PerpFundingChart coin="BTC" />);
    const initialFundingData = mockLightweightChart.mock.calls[0][0].data;
    const initialCumulativeData = mockLightweightChart.mock.calls[1][0].data;

    mockUsePerpFundingHistory.mockReturnValue({
      result: FUNDING_HISTORY.map((record) => ({ ...record })),
      isLoading: false,
      setStopPolling: mockSetStopPolling,
    });
    rerender(<PerpFundingChart coin="BTC" />);

    const latestCalls = mockLightweightChart.mock.calls.slice(-2);
    expect(latestCalls[0][0].data).toBe(initialFundingData);
    expect(latestCalls[1][0].data).toBe(initialCumulativeData);

    mockUsePerpFundingHistory.mockReturnValue({
      result: FUNDING_HISTORY.map((record, index) =>
        index === 0 ? { ...record, fundingRate: '0.00004' } : { ...record },
      ),
      isLoading: false,
      setStopPolling: mockSetStopPolling,
    });
    rerender(<PerpFundingChart coin="BTC" />);

    const changedCalls = mockLightweightChart.mock.calls.slice(-2);
    expect(changedCalls[0][0].data).not.toBe(initialFundingData);
    expect(changedCalls[1][0].data).not.toBe(initialCumulativeData);
  });
});
