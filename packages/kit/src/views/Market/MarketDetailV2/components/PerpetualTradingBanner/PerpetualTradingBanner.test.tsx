/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { act, render, screen } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { PerpetualTradingBanner } from './PerpetualTradingBanner';

let mockProxyUnavailable = false;
const mockToastError = jest.fn<void, unknown[]>();

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
const mockLogError = jest.fn<void, unknown[]>();
const mockWebTarget = jest
  .fn<Promise<void>, unknown[]>()
  .mockResolvedValue(undefined);
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
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) =>
      id === ETranslations.global_unknown_error_retry_message
        ? id
        : 'Trade perpetuals',
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ switchTab: mockSwitchTab }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  get default() {
    if (mockProxyUnavailable) throw new OneKeyLocalError('Chunk unavailable');
    return {
      serviceWebviewPerp: {
        setTradeTarget: (...args: unknown[]) => mockWebTarget(...args),
      },
      serviceHyperliquid: {
        setPendingInitialTradeInstrument: (...args: unknown[]) =>
          mockPendingInstrument(...args),
        changeActiveAsset: (...args: unknown[]) => mockChangeAsset(...args),
      },
    };
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useBannerClosePersistAtom: () => [
    { ids: mockDismissed ? ['perps-trading-banner'] : [] },
    jest.fn(),
  ],
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    market: { token: { perpsBannerClick: jest.fn() } },
    app: { error: { log: (...args: unknown[]) => mockLogError(...args) } },
  },
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
  Toast: { error: (...args: unknown[]) => mockToastError(...args) },
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
  mockProxyUnavailable = false;
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

it('reserves a desktop layout slot while ticker availability changes', () => {
  const { rerender } = render(<PerpetualTradingBanner reserveSpace />);
  expect(
    screen.getByText(/Trade perpetuals/).closest('[aria-hidden=true]'),
  ).toBeTruthy();

  mockTicker = 'xyz:AAPL';
  rerender(<PerpetualTradingBanner reserveSpace />);
  expect(
    screen.getByText(/Trade perpetuals/).closest('[aria-hidden=true]'),
  ).toBeNull();

  mockTicker = undefined;
  rerender(<PerpetualTradingBanner reserveSpace />);
  expect(
    screen.getByText(/Trade perpetuals/).closest('[aria-hidden=true]'),
  ).toBeTruthy();
});

it('does not reserve a desktop layout slot when Perps is disabled', () => {
  mockPerpDisabled = true;
  const { container } = render(<PerpetualTradingBanner reserveSpace />);
  expect(container.childElementCount).toBe(0);
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
      expect(mockWebTarget).toHaveBeenCalledWith({ coin: 'BTC' });
      expect(mockWebTarget.mock.invocationCallOrder[0]).toBeLessThan(
        mockSwitchTab.mock.invocationCallOrder[0],
      );
      expect(mockPendingInstrument).not.toHaveBeenCalled();
      expect(mockChangeAsset).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    } else {
      expect(mockWebTarget).not.toHaveBeenCalled();
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

it.each(['chunk', 'target'])(
  'shows a retry message when Web Perps %s preparation fails',
  async (failure) => {
    jest.useFakeTimers();
    mockTicker = 'xyz:AAPL';
    mockPerpTabShowWeb = true;
    if (failure === 'chunk') {
      mockProxyUnavailable = true;
    } else {
      mockWebTarget.mockRejectedValueOnce(new Error('Background unavailable'));
    }
    render(<PerpetualTradingBanner />);
    await act(async () => {
      mockPress?.();
      await jest.advanceTimersByTimeAsync(80);
    });
    expect(mockSwitchTab).not.toHaveBeenCalled();
    expect(mockChangeAsset).not.toHaveBeenCalled();
    expect(mockLogError).toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith({
      title: ETranslations.global_unknown_error_retry_message,
    });
    if (failure === 'chunk') expect(mockWebTarget).not.toHaveBeenCalled();
    mockProxyUnavailable = false;
    await act(async () => {
      mockPress?.();
      await jest.advanceTimersByTimeAsync(80);
    });
    expect(mockWebTarget).toHaveBeenLastCalledWith({ coin: 'xyz:AAPL' });
    expect(mockSwitchTab).toHaveBeenCalledWith(ETabRoutes.WebviewPerpTrade);
    expect(mockToastError).toHaveBeenCalledTimes(1);
  },
);

it('preserves native asset selection if initial target preparation fails', async () => {
  jest.useFakeTimers();
  mockTicker = 'xyz:AAPL';
  mockPendingInstrument.mockRejectedValueOnce(new Error('Preparation failed'));
  render(<PerpetualTradingBanner />);
  await act(async () => {
    mockPress?.();
    await jest.advanceTimersByTimeAsync(80);
  });
  expect(mockSwitchTab).toHaveBeenCalledWith(ETabRoutes.Perp);
  expect(mockChangeAsset).toHaveBeenCalledWith({ coin: 'xyz:AAPL' });
  expect(mockEmit).toHaveBeenCalled();
});
