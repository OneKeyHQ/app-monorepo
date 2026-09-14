/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { act, render, screen } from '@testing-library/react';

import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { PerpetualTradingBanner } from './PerpetualTradingBanner';

let mockTicker: string | undefined;
let mockDismissed = false;
let mockPerpDisabled = false;
let mockPerpTabShowWeb = false;
let mockPress: (() => void) | undefined;
const mockSwitchTab = jest.fn();
const mockPendingInstrument = jest
  .fn<Promise<void>, unknown[]>()
  .mockResolvedValue(undefined);
const mockChangeAsset = jest
  .fn<Promise<void>, unknown[]>()
  .mockResolvedValue(undefined);
const mockEmit = jest.fn<void, unknown[]>();
jest.mock('@onekeyhq/kit/src/hooks/usePerpTabConfig', () => ({
  usePerpTabConfig: () => ({
    perpDisabled: mockPerpDisabled,
    perpTabShowWeb: mockPerpTabShowWeb,
  }),
}));
jest.mock('../../hooks/useTokenDetail', () => ({
  useTokenDetail: () => ({
    tokenDetail: { symbol: 'AAPL' },
    perpsInfo: mockTicker ? { hlTicker: mockTicker } : undefined,
  }),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => 'Trade perpetuals' }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ switchTab: mockSwitchTab }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: {
      setPendingInitialTradeInstrument: (...args: unknown[]) =>
        mockPendingInstrument(...args),
      changeActiveAsset: (...args: unknown[]) => mockChangeAsset(...args),
    },
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useBannerClosePersistAtom: () => [
    { ids: mockDismissed ? ['perps-trading-banner'] : [] },
    jest.fn(),
  ],
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { market: { token: { perpsBannerClick: jest.fn() } } },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  appEventBus: { emit: (...args: unknown[]) => mockEmit(...args) },
  EAppEventBusNames: {},
}));
jest.mock('@onekeyhq/shared/src/logger/scopes/perp/perpPageSource', () => ({
  setPerpPageEnterSource: jest.fn(),
  EPerpPageEnterSource: {},
}));
jest.mock('@onekeyhq/components', () => ({
  Icon: () => null,
  IconButton: () => null,
  SizableText: ({ children }: PropsWithChildren) => <span>{children}</span>,
  XStack: ({
    children,
    opacity,
    onPress,
  }: PropsWithChildren<{ opacity?: number; onPress?: () => void }>) => {
    if (onPress) mockPress = onPress;
    return <div aria-hidden={opacity === 0 ? true : undefined}>{children}</div>;
  },
  Stack: () => <div data-testid="banner-space" />,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockTicker = undefined;
  mockDismissed = false;
  mockPerpDisabled = false;
  mockPerpTabShowWeb = false;
  mockPress = undefined;
});

it('does not insert a banner on retry after initial detail failed or had no mapping', () => {
  const { rerender } = render(<PerpetualTradingBanner stableLayout />);
  mockTicker = 'xyz:AAPL';
  rerender(<PerpetualTradingBanner stableLayout />);
  expect(screen.queryByText(/Trade perpetuals/)).toBeNull();
});
it('preserves the slot if a refresh loses an existing mapping', () => {
  mockTicker = 'xyz:AAPL';
  const { rerender } = render(<PerpetualTradingBanner stableLayout />);
  expect(screen.getByText(/Trade perpetuals/)).toBeTruthy();
  mockTicker = undefined;
  rerender(<PerpetualTradingBanner stableLayout />);
  expect(
    screen.getByText(/Trade perpetuals/).closest('[aria-hidden=true]'),
  ).toBeTruthy();
  mockTicker = 'xyz:AAPL';
  rerender(<PerpetualTradingBanner stableLayout />);
  expect(screen.getByText(/Trade perpetuals/)).toBeTruthy();
});
it('does not reserve space for a dismissed banner', () => {
  mockDismissed = true;
  mockTicker = 'xyz:AAPL';
  const { container } = render(<PerpetualTradingBanner stableLayout />);
  expect(container.childElementCount).toBe(0);
});
it('preserves the existing dynamic behavior outside stable native layout', () => {
  const { rerender } = render(<PerpetualTradingBanner />);
  mockTicker = 'xyz:AAPL';
  rerender(<PerpetualTradingBanner />);
  expect(screen.getByText(/Trade perpetuals/)).toBeTruthy();
});

it('does not reserve a stale perpetual slot in a request-skipping detail', () => {
  mockTicker = 'xyz:AAPL';
  const { container, rerender } = render(
    <PerpetualTradingBanner stableLayout disabled />,
  );
  expect(container.childElementCount).toBe(0);
  mockTicker = undefined;
  rerender(<PerpetualTradingBanner stableLayout disabled />);
  expect(container.childElementCount).toBe(0);
});

afterEach(() => jest.useRealTimers());

it.each([false, true])(
  'opens the configured Perps tab (web: %s)',
  async (showWeb) => {
    jest.useFakeTimers();
    mockTicker = 'BTC';
    mockPerpTabShowWeb = showWeb;
    render(<PerpetualTradingBanner />);
    expect(mockPress).toBeDefined();
    await act(async () => {
      mockPress?.();
      await jest.advanceTimersByTimeAsync(80);
    });
    expect(mockSwitchTab).toHaveBeenCalledWith(
      showWeb ? ETabRoutes.WebviewPerpTrade : ETabRoutes.Perp,
    );
    if (showWeb) {
      expect(mockPendingInstrument).not.toHaveBeenCalled();
      expect(mockChangeAsset).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    } else {
      expect(mockPendingInstrument).toHaveBeenCalledWith({
        coin: 'BTC',
        mode: 'perp',
      });
      expect(mockChangeAsset).toHaveBeenCalledWith({ coin: 'BTC' });
      expect(mockEmit).toHaveBeenCalled();
      expect(mockPendingInstrument.mock.invocationCallOrder[0]).toBeLessThan(
        mockSwitchTab.mock.invocationCallOrder[0],
      );
    }
  },
);

it('hides the entry when Perps is disabled', () => {
  mockTicker = 'BTC';
  mockPerpDisabled = true;
  render(<PerpetualTradingBanner />);
  expect(screen.queryByText(/Trade perpetuals/)).toBeNull();
  expect(mockSwitchTab).not.toHaveBeenCalled();
});
