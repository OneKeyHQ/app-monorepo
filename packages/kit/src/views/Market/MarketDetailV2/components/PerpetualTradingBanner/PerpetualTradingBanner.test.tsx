/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { act, render, screen } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { EModalMarketRoutes } from '../../../router/types';

import { PerpetualTradingBanner } from './PerpetualTradingBanner';

import type { NavigationState, PartialState } from '@react-navigation/routers';

const expectedWebTradeParams = expect.objectContaining({
  screen: ETabRoutes.WebviewPerpTrade,
  params: {
    tradeRequest: {
      requestId: expect.any(String),
      expiresAt: expect.any(Number),
    },
  },
});

let mockProxyUnavailable = false;
const mockToastError = jest.fn<void, unknown[]>();

let mockTicker: string | undefined;
let mockDismissed = false;
let mockPerpDisabled = false;
let mockPerpTabShowWeb = false;
let mockPress: (() => void) | undefined;
const mockSwitchTab = jest.fn();
const mockDismissDiscoveryDetail = jest
  .fn<'ready' | 'cancelled', unknown[]>()
  .mockReturnValue('ready');
const mockGetRootState = jest.fn<
  PartialState<NavigationState> | undefined,
  []
>();
let mockRouteKey: string | undefined;
let mockRouteName: string | undefined;
const mockNavigationListeners = new Set<() => void>();
const mockEmitNavigationState = () => {
  for (const listener of mockNavigationListeners) listener();
};
const mockClearPendingInstrument = jest
  .fn<Promise<void>, [{ requestId: string }]>()
  .mockResolvedValue(undefined);
const mockClearWebTarget = jest
  .fn<Promise<void>, [{ requestId: string }]>()
  .mockResolvedValue(undefined);
const mockCommitWebTarget = jest
  .fn<Promise<boolean>, [{ requestId: string }]>()
  .mockResolvedValue(true);
const mockPageEnterSource = jest.fn<void, unknown[]>();
const mockPendingInstrument = jest
  .fn<Promise<void>, [{ coin: string; mode: 'perp'; requestId: string }]>()
  .mockResolvedValue(undefined);
const mockChangeAsset = jest
  .fn<Promise<void>, unknown[]>()
  .mockResolvedValue(undefined);
const mockEmit = jest.fn<void, unknown[]>();
const mockLogError = jest.fn<void, unknown[]>();
const mockWebTarget = jest
  .fn<Promise<void>, [{ coin: string; requestId: string }]>()
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
        setTradeTarget: (params: { coin: string; requestId: string }) =>
          mockWebTarget(params),
        clearTradeTarget: (params: { requestId: string }) =>
          mockClearWebTarget(params),
        commitTradeTarget: (params: { requestId: string }) =>
          mockCommitWebTarget(params),
      },
      serviceHyperliquid: {
        setPendingInitialTradeInstrument: (params: {
          coin: string;
          mode: 'perp';
          requestId: string;
        }) => mockPendingInstrument(params),
        clearPendingInitialTradeInstrument: (params: { requestId: string }) =>
          mockClearPendingInstrument(params),
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
  setPerpPageEnterSource: (...args: unknown[]) => mockPageEnterSource(...args),
  EPerpPageEnterSource: {},
}));
jest.mock('../../../utils/marketDetailNavigation', () => ({
  dismissDiscoveryMarketDetailForTrade: (...args: unknown[]) =>
    mockDismissDiscoveryDetail(...args),
}));
jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: {
    current: {
      getCurrentRoute: () =>
        mockRouteKey ? { key: mockRouteKey, name: mockRouteName } : undefined,
      getRootState: () => mockGetRootState(),
      addListener: (_type: string, listener: () => void) => {
        mockNavigationListeners.add(listener);
        return () => mockNavigationListeners.delete(listener);
      },
    },
  },
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
  mockRouteKey = undefined;
  mockRouteName = undefined;
  mockDismissDiscoveryDetail.mockReturnValue('ready');
  mockGetRootState.mockReturnValue(undefined);
  mockNavigationListeners.clear();
  mockPendingInstrument.mockResolvedValue(undefined);
  mockWebTarget.mockResolvedValue(undefined);
  mockClearPendingInstrument.mockResolvedValue(undefined);
  mockClearWebTarget.mockResolvedValue(undefined);
  mockCommitWebTarget.mockResolvedValue(true);
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
    mockRouteKey = 'market-detail';
    render(<PerpetualTradingBanner />);
    expect(mockPress).toBeDefined();
    await act(async () => {
      mockPress?.();
      await jest.advanceTimersByTimeAsync(80);
    });
    const tabArgs = showWeb
      ? [ETabRoutes.WebviewPerpTrade, expectedWebTradeParams]
      : [ETabRoutes.Perp];
    expect(mockSwitchTab).toHaveBeenCalledWith(...tabArgs);
    expect(mockDismissDiscoveryDetail).toHaveBeenCalledWith(
      'market-detail',
      ...tabArgs,
    );
    expect(mockDismissDiscoveryDetail.mock.invocationCallOrder[0]).toBeLessThan(
      mockSwitchTab.mock.invocationCallOrder[0],
    );
    if (showWeb) {
      expect(mockWebTarget).toHaveBeenCalledWith({
        coin: 'BTC',
        requestId: expect.any(String),
      });
      expect(mockWebTarget.mock.invocationCallOrder[0]).toBeLessThan(
        mockSwitchTab.mock.invocationCallOrder[0],
      );
      expect(mockCommitWebTarget).toHaveBeenCalledWith({
        requestId: mockWebTarget.mock.calls[0][0].requestId,
      });
      expect(mockSwitchTab.mock.invocationCallOrder[0]).toBeLessThan(
        mockCommitWebTarget.mock.invocationCallOrder[0],
      );
      expect(mockPendingInstrument).not.toHaveBeenCalled();
      expect(mockChangeAsset).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    } else {
      expect(mockWebTarget).not.toHaveBeenCalled();
      expect(mockPendingInstrument).toHaveBeenCalledWith({
        coin: 'BTC',
        mode: 'perp',
        requestId: expect.any(String),
      });
      expect(mockChangeAsset).toHaveBeenCalledWith({ coin: 'BTC' });
      expect(mockEmit).toHaveBeenCalled();
      expect(mockPendingInstrument.mock.invocationCallOrder[0]).toBeLessThan(
        mockSwitchTab.mock.invocationCallOrder[0],
      );
    }
  },
);

it.each([false, true])(
  'prepares an atomic detail exit for the selected Perps tab (web: %s)',
  async (showWeb) => {
    jest.useFakeTimers();
    mockTicker = 'BTC';
    mockRouteKey = 'detail';
    mockPerpTabShowWeb = showWeb;
    render(<PerpetualTradingBanner />);
    await act(async () => {
      mockPress?.();
      await jest.advanceTimersByTimeAsync(80);
    });
    const target = showWeb ? ETabRoutes.WebviewPerpTrade : ETabRoutes.Perp;
    const tabArgs = showWeb ? [target, expectedWebTradeParams] : [target];
    expect(mockDismissDiscoveryDetail).toHaveBeenCalledWith(
      'detail',
      ...tabArgs,
    );
    expect(mockSwitchTab).toHaveBeenCalledWith(...tabArgs);
    expect(mockDismissDiscoveryDetail.mock.invocationCallOrder[0]).toBeLessThan(
      mockSwitchTab.mock.invocationCallOrder[0],
    );
  },
);

it('does not switch tabs when the detail exit is cancelled', async () => {
  jest.useFakeTimers();
  mockTicker = 'BTC';
  mockRouteKey = 'detail';
  mockDismissDiscoveryDetail.mockReturnValueOnce('cancelled');
  render(<PerpetualTradingBanner />);
  await act(async () => {
    mockPress?.();
    await jest.advanceTimersByTimeAsync(80);
  });
  expect(mockSwitchTab).not.toHaveBeenCalled();
  expect(mockChangeAsset).not.toHaveBeenCalled();
  expect(mockToastError).not.toHaveBeenCalled();
});

it('captures the underlying detail when a token selector is closing', async () => {
  jest.useFakeTimers();
  mockTicker = 'BTC';
  mockRouteKey = 'selector';
  mockRouteName = EModalMarketRoutes.MobileTokenSelector;
  mockGetRootState.mockReturnValue({
    index: 1,
    routes: [
      {
        name: 'main',
        state: {
          index: 1,
          routes: [
            { key: 'list', name: 'TabDiscovery' },
            { key: 'detail', name: 'MarketDetailV2' },
          ],
        },
      },
      { key: 'selector', name: 'modal' },
    ],
  });
  const { unmount } = render(<PerpetualTradingBanner />);
  await act(async () => {
    mockPress?.();
    await jest.advanceTimersByTimeAsync(80);
  });
  expect(mockPendingInstrument).not.toHaveBeenCalled();
  expect(mockSwitchTab).not.toHaveBeenCalled();
  unmount();
  await act(async () => {
    mockRouteKey = 'detail';
    mockRouteName = 'MarketDetailV2';
    mockEmitNavigationState();
  });
  expect(mockNavigationListeners.size).toBe(0);
  expect(mockDismissDiscoveryDetail).toHaveBeenCalledWith(
    'detail',
    ETabRoutes.Perp,
  );
  expect(mockSwitchTab).toHaveBeenCalledWith(ETabRoutes.Perp);
});

it('keeps a selector opened over SwapPro bound to that modal detail', async () => {
  jest.useFakeTimers();
  mockTicker = 'BTC';
  mockRouteKey = 'selector';
  mockRouteName = EModalMarketRoutes.MobileTokenSelector;
  mockGetRootState.mockReturnValue({
    index: 2,
    routes: [
      {
        name: 'main',
        state: {
          routes: [{ key: 'background-detail', name: 'MarketDetailV2' }],
        },
      },
      {
        name: 'modal',
        state: {
          routes: [{ key: 'swap-detail', name: 'SwapProMarketDetail' }],
        },
      },
      { key: 'selector', name: 'modal' },
    ],
  });
  render(<PerpetualTradingBanner />);
  await act(async () => {
    mockPress?.();
    await jest.advanceTimersByTimeAsync(80);
  });
  expect(mockPendingInstrument).not.toHaveBeenCalled();
  expect(mockSwitchTab).not.toHaveBeenCalled();
  await act(async () => {
    mockRouteKey = 'swap-detail';
    mockRouteName = 'SwapProMarketDetail';
    mockEmitNavigationState();
  });
  expect(mockDismissDiscoveryDetail).toHaveBeenCalledWith(
    'swap-detail',
    ETabRoutes.Perp,
  );
  expect(mockSwitchTab).toHaveBeenCalledWith(ETabRoutes.Perp);
});

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
    mockRouteKey = 'market-detail';
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
    expect(mockDismissDiscoveryDetail).not.toHaveBeenCalled();
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
    expect(mockWebTarget).toHaveBeenLastCalledWith({
      coin: 'xyz:AAPL',
      requestId: expect.any(String),
    });
    expect(mockSwitchTab).toHaveBeenCalledWith(
      ETabRoutes.WebviewPerpTrade,
      expectedWebTradeParams,
    );
    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockDismissDiscoveryDetail).toHaveBeenCalledWith(
      'market-detail',
      ETabRoutes.WebviewPerpTrade,
      expectedWebTradeParams,
    );
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

it('commits Web Perps after the source route loses focus and cleans up a failed commit', async () => {
  jest.useFakeTimers();
  mockTicker = 'BTC';
  mockRouteKey = 'detail';
  mockPerpTabShowWeb = true;
  mockSwitchTab.mockImplementationOnce(() => {
    mockRouteKey = 'web-perps';
  });
  mockCommitWebTarget.mockRejectedValueOnce(
    new OneKeyLocalError('Commit unavailable'),
  );
  render(<PerpetualTradingBanner />);
  await act(async () => {
    mockPress?.();
    await jest.advanceTimersByTimeAsync(80);
  });
  const { requestId } = mockWebTarget.mock.calls[0][0];
  expect(mockCommitWebTarget).toHaveBeenCalledWith({ requestId });
  expect(mockClearWebTarget).toHaveBeenCalledWith({ requestId });
  expect(mockToastError).toHaveBeenCalledTimes(1);
  expect(mockChangeAsset).not.toHaveBeenCalled();
});

it('reports and cleans up an expired or missing Web Perps commit', async () => {
  jest.useFakeTimers();
  mockTicker = 'BTC';
  mockRouteKey = 'detail';
  mockPerpTabShowWeb = true;
  mockCommitWebTarget.mockResolvedValueOnce(false);
  render(<PerpetualTradingBanner />);
  await act(async () => {
    mockPress?.();
    await jest.advanceTimersByTimeAsync(80);
  });
  expect(mockClearWebTarget).toHaveBeenCalledWith({
    requestId: mockWebTarget.mock.calls[0][0].requestId,
  });
  expect(mockToastError).toHaveBeenCalledTimes(1);
  expect(mockLogError).toHaveBeenCalled();
});

it('logs a failed cleanup RPC and releases the navigation lock for retry', async () => {
  jest.useFakeTimers();
  mockTicker = 'BTC';
  mockRouteKey = 'detail';
  mockPerpTabShowWeb = true;
  mockCommitWebTarget.mockResolvedValueOnce(false);
  mockClearWebTarget.mockRejectedValueOnce(
    new OneKeyLocalError('RPC unavailable'),
  );
  render(<PerpetualTradingBanner />);
  await act(async () => {
    mockPress?.();
    await jest.advanceTimersByTimeAsync(80);
  });
  expect(mockLogError).toHaveBeenCalledWith(
    expect.stringContaining('Failed to clear cancelled Perps target'),
  );
  await act(async () => {
    mockPress?.();
    await jest.advanceTimersByTimeAsync(80);
  });
  expect(mockCommitWebTarget).toHaveBeenCalledTimes(2);
  expect(mockClearWebTarget).toHaveBeenCalledTimes(1);
  expect(mockToastError).toHaveBeenCalledTimes(1);
});

it.each(['source', 'switch', 'dismiss'])(
  'cleans up preparation if the %s step throws before commit',
  async (step) => {
    jest.useFakeTimers();
    mockTicker = 'BTC';
    mockRouteKey = 'detail';
    mockPerpTabShowWeb = true;
    const fail = () => {
      throw new OneKeyLocalError('Navigation unavailable');
    };
    if (step === 'source') mockPageEnterSource.mockImplementationOnce(fail);
    if (step === 'switch') mockSwitchTab.mockImplementationOnce(fail);
    if (step === 'dismiss')
      mockDismissDiscoveryDetail.mockImplementationOnce(fail);
    render(<PerpetualTradingBanner />);
    await act(async () => {
      mockPress?.();
      await jest.advanceTimersByTimeAsync(80);
    });
    expect(mockCommitWebTarget).not.toHaveBeenCalled();
    expect(mockClearWebTarget).toHaveBeenCalledWith({
      requestId: mockWebTarget.mock.calls[0][0].requestId,
    });
    expect(mockToastError).toHaveBeenCalledTimes(1);
  },
);

it.each([false, true])(
  'does not prepare a target after leaving the source route (web: %s)',
  async (showWeb) => {
    jest.useFakeTimers();
    mockTicker = 'BTC';
    mockRouteKey = 'detail';
    mockPerpTabShowWeb = showWeb;
    render(<PerpetualTradingBanner />);
    await act(async () => {
      mockPress?.();
      mockRouteKey = 'wallet';
      await jest.advanceTimersByTimeAsync(80);
    });
    expect(mockPendingInstrument).not.toHaveBeenCalled();
    expect(mockWebTarget).not.toHaveBeenCalled();
    expect(mockSwitchTab).not.toHaveBeenCalled();
  },
);

it.each([false, true])(
  'clears its owned target when the user leaves during preparation (web: %s)',
  async (showWeb) => {
    jest.useFakeTimers();
    mockTicker = 'BTC';
    mockRouteKey = 'detail';
    mockPerpTabShowWeb = showWeb;
    let finishPreparation: (() => void) | undefined;
    const setter = showWeb ? mockWebTarget : mockPendingInstrument;
    setter.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishPreparation = resolve;
      }),
    );
    render(<PerpetualTradingBanner />);
    await act(async () => {
      mockPress?.();
      await jest.advanceTimersByTimeAsync(80);
    });
    expect(setter).toHaveBeenCalledTimes(1);
    await act(async () => {
      mockRouteKey = 'wallet';
      finishPreparation?.();
    });
    const params = setter.mock.calls[0][0] as { requestId: string };
    expect(
      showWeb ? mockClearWebTarget : mockClearPendingInstrument,
    ).toHaveBeenCalledWith({ requestId: params.requestId });
    expect(mockSwitchTab).not.toHaveBeenCalled();
    expect(mockChangeAsset).not.toHaveBeenCalled();
    expect(mockCommitWebTarget).not.toHaveBeenCalled();
  },
);

it.each([false, true])(
  'finishes the old write and rollback before preparing the newer request (web: %s)',
  async (showWeb) => {
    jest.useFakeTimers();
    mockTicker = 'BTC';
    mockRouteKey = 'detail';
    mockPerpTabShowWeb = showWeb;
    let finishFirst: (() => void) | undefined;
    let finishRollback: (() => void) | undefined;
    let writtenTarget: string | undefined;
    const setter = showWeb ? mockWebTarget : mockPendingInstrument;
    const clearer = showWeb ? mockClearWebTarget : mockClearPendingInstrument;
    setter.mockImplementationOnce(
      ({ coin }: { coin: string }) =>
        new Promise<void>((resolve) => {
          finishFirst = () => {
            writtenTarget = coin;
            resolve();
          };
        }),
    );
    setter.mockImplementationOnce(async ({ coin }: { coin: string }) => {
      writtenTarget = coin;
    });
    clearer.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishRollback = () => {
            writtenTarget = undefined;
            resolve();
          };
        }),
    );
    const { rerender } = render(<PerpetualTradingBanner />);
    await act(async () => {
      mockPress?.();
      await jest.advanceTimersByTimeAsync(80);
    });
    mockTicker = 'ETH';
    rerender(<PerpetualTradingBanner />);
    await act(async () => {
      mockPress?.();
      await jest.advanceTimersByTimeAsync(80);
    });
    expect(setter).toHaveBeenCalledTimes(1);
    expect(mockSwitchTab).not.toHaveBeenCalled();
    await act(async () => {
      finishFirst?.();
    });
    expect(writtenTarget).toBe('BTC');
    expect(setter).toHaveBeenCalledTimes(1);
    const first = setter.mock.calls[0][0] as { requestId: string };
    expect(clearer).toHaveBeenCalledWith({ requestId: first.requestId });
    await act(async () => {
      finishRollback?.();
    });
    expect(writtenTarget).toBe('ETH');
    const second = setter.mock.calls[1][0] as { requestId: string };
    expect(first.requestId).not.toBe(second.requestId);
    expect(mockSwitchTab).toHaveBeenCalledTimes(1);
    expect(clearer.mock.invocationCallOrder[0]).toBeLessThan(
      setter.mock.invocationCallOrder[1],
    );
  },
);

it('cancels a selector request when another route takes focus', async () => {
  jest.useFakeTimers();
  mockTicker = 'BTC';
  mockRouteKey = 'selector';
  mockRouteName = EModalMarketRoutes.MobileTokenSelector;
  mockGetRootState.mockReturnValue({
    index: 1,
    routes: [
      { key: 'detail', name: 'MarketDetailV2' },
      { key: 'selector', name: 'modal' },
    ],
  });
  render(<PerpetualTradingBanner />);
  await act(async () => {
    mockPress?.();
    await jest.advanceTimersByTimeAsync(80);
  });
  await act(async () => {
    mockRouteKey = 'wallet';
    mockEmitNavigationState();
  });
  expect(mockNavigationListeners.size).toBe(0);
  expect(mockPendingInstrument).not.toHaveBeenCalled();
  expect(mockSwitchTab).not.toHaveBeenCalled();
});

it('cleans up a selector wait that never completes', async () => {
  jest.useFakeTimers();
  mockTicker = 'BTC';
  mockRouteKey = 'selector';
  mockRouteName = EModalMarketRoutes.MobileTokenSelector;
  mockGetRootState.mockReturnValue({
    index: 1,
    routes: [
      { key: 'detail', name: 'MarketDetailV2' },
      { key: 'selector', name: 'modal' },
    ],
  });
  render(<PerpetualTradingBanner />);
  await act(async () => {
    mockPress?.();
    await jest.advanceTimersByTimeAsync(1580);
  });
  expect(mockNavigationListeners.size).toBe(0);
  expect(mockPendingInstrument).not.toHaveBeenCalled();
  expect(mockSwitchTab).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});
