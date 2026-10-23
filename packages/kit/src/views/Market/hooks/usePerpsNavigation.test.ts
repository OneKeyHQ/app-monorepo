/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  ERootRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

import { usePerpsNavigation } from './usePerpsNavigation';

const mockNavigation = {
  switchTab: jest.fn(),
  pushModal: jest.fn(),
};
let mockRouteKey: string | undefined;
let mockRootName: string = ERootRoutes.Main;
let mockActiveTab: string = ETabRoutes.Market;
const mockConfig = { perpDisabled: false, perpTabShowWeb: false };
const mockMedia = { gtMd: false };
const mockSettings = {
  ready: jest.fn(async () => undefined),
  get: jest.fn(async () => ({ mobileTradingMode: 'simple' })),
};
const mockService = {
  setPendingInitialTradeInstrument: jest.fn(async () => undefined),
  clearPendingInitialTradeInstrument: jest.fn(async () => undefined),
  changeActiveAsset: jest.fn<Promise<void>, [{ coin: string }]>(
    async () => undefined,
  ),
  getActiveTradeInstrumentTarget: jest.fn<
    Promise<{
      mode: 'perp' | 'spot';
      perpAsset?: { coin: string };
      spotAsset?: { coin: string };
    }>,
    []
  >(),
};
const mockSetTradeTarget = jest
  .fn<Promise<void>, [{ coin: string; requestId: string }]>()
  .mockResolvedValue(undefined);
const mockCommitTradeTarget = jest.fn(async () => true);
const mockEmit = jest.fn<void, unknown[]>();
let mockInstrumentCurrent = true;
const mockCaptureInstrumentGuard = jest.fn(
  (_target: unknown) => () => mockInstrumentCurrent,
);

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/actions',
  () => ({
    capturePerpsInstrumentChangeGuard: (target: unknown) =>
      mockCaptureInstrumentGuard(target),
  }),
);

jest.mock('../utils/marketDetailNavigation', () => ({
  dismissDiscoveryMarketDetailForTrade: jest.fn(),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  Toast: { error: jest.fn() },
  useMedia: () => mockMedia,
  rootNavigationRef: {
    current: {
      getCurrentRoute: () => (mockRouteKey ? { key: mockRouteKey } : undefined),
      getRootState: () => ({
        index: 0,
        routes: [
          {
            name: mockRootName,
            state: { index: 0, routes: [{ name: mockActiveTab }] },
          },
        ],
      }),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));
jest.mock('@onekeyhq/kit/src/hooks/usePerpTabConfig', () => ({
  usePerpTabConfig: () => mockConfig,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  get perpsCustomSettingsAtom() {
    return mockSettings;
  },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    get serviceHyperliquid() {
      return mockService;
    },
    get serviceWebviewPerp() {
      return {
        setTradeTarget: mockSetTradeTarget,
        commitTradeTarget: mockCommitTradeTarget,
      };
    },
  },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  appEventBus: { emit: (...args: unknown[]) => mockEmit(...args) },
}));
jest.mock('@onekeyhq/shared/src/logger/scopes/perp/perpPageSource', () => ({
  EPerpPageEnterSource: { MarketList: 'MarketList' },
  setPerpPageEnterSource: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { app: { error: { log: jest.fn() } } },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));

async function navigate(coin = 'STRK') {
  const { result } = renderHook(() => usePerpsNavigation());
  await act(async () => {
    result.current.navigateToPerps(coin);
    await jest.runAllTimersAsync();
  });
}

describe('market entry into Perps', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockRouteKey = undefined;
    mockInstrumentCurrent = true;
    mockRootName = ERootRoutes.Main;
    mockActiveTab = ETabRoutes.Market;
    mockNavigation.switchTab.mockImplementation((tab: ETabRoutes) => {
      mockActiveTab = tab;
    });
    mockConfig.perpDisabled = false;
    mockConfig.perpTabShowWeb = false;
    mockMedia.gtMd = false;
    platformEnv.isNative = true;
    mockSettings.get.mockResolvedValue({ mobileTradingMode: 'simple' });
    mockService.getActiveTradeInstrumentTarget.mockImplementation(async () => ({
      mode: 'perp',
      perpAsset: mockService.changeActiveAsset.mock.calls.at(-1)?.[0],
    }));
  });

  afterEach(() => jest.useRealTimers());

  it('opens the selected Easy market after switching tab and asset', async () => {
    await navigate('xyz:TSLA');
    expect(mockCaptureInstrumentGuard).toHaveBeenCalledWith({
      mode: 'perp',
      coin: 'xyz:TSLA',
    });
    expect(mockNavigation.switchTab).toHaveBeenCalledWith(ETabRoutes.Perp);
    expect(mockService.changeActiveAsset).toHaveBeenCalledWith({
      coin: 'xyz:TSLA',
    });
    expect(mockNavigation.pushModal).toHaveBeenCalledWith(
      EModalRoutes.PerpModal,
      {
        screen: EModalPerpRoutes.MobilePerpSimpleMarket,
        params: { coin: 'xyz:TSLA' },
      },
    );
    expect(mockSettings.ready).toHaveBeenCalledTimes(1);
    expect(
      mockService.changeActiveAsset.mock.invocationCallOrder[0],
    ).toBeLessThan(mockNavigation.pushModal.mock.invocationCallOrder[0]);
  });

  it('aligns the committed asset without opening details after leaving during asset selection', async () => {
    mockService.changeActiveAsset.mockImplementationOnce(async () => {
      mockRouteKey = 'wallet-home';
      mockActiveTab = ETabRoutes.Home;
    });
    await navigate();
    expect(mockNavigation.pushModal).not.toHaveBeenCalled();
    expect(mockEmit).toHaveBeenCalledWith(expect.any(String), {
      mode: 'perp',
      coin: 'STRK',
    });
  });

  it('aligns the committed asset when a modal opens during the asset RPC', async () => {
    let finish!: () => void;
    mockService.changeActiveAsset.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => usePerpsNavigation());
    await act(async () => {
      result.current.navigateToPerps('BTC');
      await jest.advanceTimersByTimeAsync(80);
    });
    expect(mockService.changeActiveAsset).toHaveBeenCalledTimes(1);
    mockRootName = ERootRoutes.Modal;
    await act(async () => {
      finish();
      await jest.runAllTimersAsync();
    });
    expect(mockEmit).toHaveBeenCalledWith(expect.any(String), {
      mode: 'perp',
      coin: 'BTC',
    });
    expect(mockNavigation.pushModal).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'preserves a newer UI selection while BG still names the old target (overlay: %s)',
    async (overlay) => {
      let finish!: () => void;
      mockService.changeActiveAsset.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
      const { result } = renderHook(() => usePerpsNavigation());
      await act(async () => {
        result.current.navigateToPerps('BTC');
        await jest.advanceTimersByTimeAsync(80);
      });
      expect(mockService.changeActiveAsset).toHaveBeenCalledTimes(1);
      if (overlay) mockRootName = ERootRoutes.Modal;
      mockInstrumentCurrent = false;
      await act(async () => {
        finish();
        await jest.runAllTimersAsync();
      });
      expect(mockService.getActiveTradeInstrumentTarget).toHaveBeenCalledTimes(
        2,
      );
      expect(mockEmit).not.toHaveBeenCalled();
      expect(mockNavigation.pushModal).not.toHaveBeenCalled();
    },
  );

  it('captures UI requests before reading the previous background target', async () => {
    let finishPrevious!: (target: {
      mode: 'perp';
      perpAsset: { coin: string };
    }) => void;
    mockService.getActiveTradeInstrumentTarget.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishPrevious = resolve;
        }),
    );
    const { result } = renderHook(() => usePerpsNavigation());
    await act(async () => {
      result.current.navigateToPerps('BTC');
      await jest.advanceTimersByTimeAsync(80);
    });
    expect(mockCaptureInstrumentGuard).toHaveBeenCalledWith({
      mode: 'perp',
      coin: 'BTC',
    });
    expect(mockCaptureInstrumentGuard.mock.invocationCallOrder[0]).toBeLessThan(
      mockService.getActiveTradeInstrumentTarget.mock.invocationCallOrder[0],
    );
    mockInstrumentCurrent = false;
    await act(async () => {
      finishPrevious({ mode: 'perp', perpAsset: { coin: 'ETH' } });
      await jest.runAllTimersAsync();
    });
    expect(mockService.changeActiveAsset).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
    expect(mockNavigation.pushModal).not.toHaveBeenCalled();
  });

  it('does not push the old market if a newer UI target starts during settings hydration', async () => {
    let finish!: (settings: { mobileTradingMode: string }) => void;
    mockSettings.get.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() => usePerpsNavigation());
    await act(async () => {
      result.current.navigateToPerps('BTC');
      await jest.advanceTimersByTimeAsync(80);
    });
    expect(mockEmit).toHaveBeenCalledWith(expect.any(String), {
      mode: 'perp',
      coin: 'BTC',
    });
    mockInstrumentCurrent = false;
    await act(async () => {
      finish({ mobileTradingMode: 'simple' });
      await jest.runAllTimersAsync();
    });
    expect(mockNavigation.pushModal).not.toHaveBeenCalled();
  });

  it.each([
    { mode: 'perp' as const, perpAsset: { coin: 'ETH' } },
    {
      mode: 'spot' as const,
      perpAsset: { coin: 'BTC' },
      spotAsset: { coin: '@1' },
    },
  ])(
    'does not restore an old asset over a newer background target: %j',
    async (target) => {
      let finish!: () => void;
      mockService.changeActiveAsset.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
      const { result } = renderHook(() => usePerpsNavigation());
      await act(async () => {
        result.current.navigateToPerps('BTC');
        await jest.advanceTimersByTimeAsync(80);
      });
      mockService.getActiveTradeInstrumentTarget.mockResolvedValueOnce(target);
      await act(async () => {
        finish();
        await jest.runAllTimersAsync();
      });
      expect(mockEmit).not.toHaveBeenCalled();
      expect(mockNavigation.pushModal).not.toHaveBeenCalled();
    },
  );

  it('does not align an entry superseded while reading its committed target', async () => {
    let finish!: (target: {
      mode: 'perp';
      perpAsset: { coin: string };
    }) => void;
    mockService.getActiveTradeInstrumentTarget
      .mockResolvedValueOnce({ mode: 'perp', perpAsset: { coin: 'ETH' } })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
    const { result } = renderHook(() => usePerpsNavigation());
    await act(async () => {
      result.current.navigateToPerps('BTC');
      await jest.advanceTimersByTimeAsync(80);
      result.current.navigateToPerps('ETH');
      await jest.advanceTimersByTimeAsync(80);
    });
    await act(async () => {
      finish({ mode: 'perp', perpAsset: { coin: 'BTC' } });
      await jest.runAllTimersAsync();
    });
    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledWith(expect.any(String), {
      mode: 'perp',
      coin: 'ETH',
    });
    expect(mockNavigation.pushModal).toHaveBeenCalledTimes(1);
    expect(mockNavigation.pushModal).toHaveBeenCalledWith(
      EModalRoutes.PerpModal,
      {
        screen: EModalPerpRoutes.MobilePerpSimpleMarket,
        params: { coin: 'ETH' },
      },
    );
  });

  it('cancels before writing the asset if a modal opens while reading the previous target', async () => {
    let finish!: (target: {
      mode: 'perp';
      perpAsset: { coin: string };
    }) => void;
    mockService.getActiveTradeInstrumentTarget.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => usePerpsNavigation());
    await act(async () => {
      result.current.navigateToPerps('BTC');
      await jest.advanceTimersByTimeAsync(80);
    });
    mockRootName = ERootRoutes.Modal;
    await act(async () => {
      finish({ mode: 'perp', perpAsset: { coin: 'ETH' } });
      await jest.runAllTimersAsync();
    });
    expect(mockService.changeActiveAsset).not.toHaveBeenCalled();
    expect(
      mockService.clearPendingInitialTradeInstrument,
    ).toHaveBeenCalledTimes(1);
    expect(mockEmit).not.toHaveBeenCalled();
    expect(mockNavigation.pushModal).not.toHaveBeenCalled();
  });

  it('preserves an intentional entry into Perps from an unchanged spot target', async () => {
    mockService.getActiveTradeInstrumentTarget.mockResolvedValue({
      mode: 'spot',
      spotAsset: { coin: '@1' },
      perpAsset: { coin: 'BTC' },
    });
    await navigate('BTC');
    expect(mockEmit).toHaveBeenCalledWith(expect.any(String), {
      mode: 'perp',
      coin: 'BTC',
    });
    expect(mockNavigation.pushModal).toHaveBeenCalledWith(
      EModalRoutes.PerpModal,
      {
        screen: EModalPerpRoutes.MobilePerpSimpleMarket,
        params: { coin: 'BTC' },
      },
    );
  });

  it('does not open Easy details after leaving during settings hydration', async () => {
    mockSettings.get.mockImplementationOnce(async () => {
      mockRouteKey = 'wallet-home';
      mockActiveTab = ETabRoutes.Home;
      return { mobileTradingMode: 'simple' };
    });
    await navigate();
    expect(mockNavigation.pushModal).not.toHaveBeenCalled();
  });

  it('keeps Pro on its trading page', async () => {
    mockSettings.get.mockResolvedValue({ mobileTradingMode: 'pro' });
    await navigate();
    expect(mockService.changeActiveAsset).toHaveBeenCalledWith({
      coin: 'STRK',
    });
    expect(mockNavigation.pushModal).not.toHaveBeenCalled();
  });

  it('opens Easy details when lazy tab mounting changes the leaf key', async () => {
    mockNavigation.switchTab.mockImplementationOnce((tab: ETabRoutes) => {
      mockActiveTab = tab;
      mockRouteKey = 'perp-tab';
    });
    mockService.changeActiveAsset.mockImplementationOnce(async () => {
      mockRouteKey = 'perp-mounted-page';
    });
    await navigate();
    expect(mockEmit).toHaveBeenCalled();
    expect(mockNavigation.pushModal).toHaveBeenCalledTimes(1);
  });

  it('does not push details over a newly opened modal', async () => {
    mockSettings.get.mockImplementationOnce(async () => {
      mockRootName = ERootRoutes.Modal;
      return { mobileTradingMode: 'simple' };
    });
    await navigate();
    expect(mockNavigation.pushModal).not.toHaveBeenCalled();
  });

  it('does not open mobile Easy details on wide web', async () => {
    platformEnv.isNative = false;
    mockMedia.gtMd = true;
    await navigate();
    expect(mockNavigation.pushModal).not.toHaveBeenCalled();
  });

  it('opens Easy details on narrow web', async () => {
    platformEnv.isNative = false;
    await navigate();
    expect(mockNavigation.pushModal).toHaveBeenCalledTimes(1);
  });

  it('preserves the Web Perps target flow', async () => {
    mockConfig.perpTabShowWeb = true;
    await navigate();
    expect(mockSetTradeTarget).toHaveBeenCalledWith({
      coin: 'STRK',
      requestId: expect.any(String),
    });
    expect(mockNavigation.switchTab).toHaveBeenCalledWith(
      ETabRoutes.WebviewPerpTrade,
      expect.objectContaining({
        screen: ETabRoutes.WebviewPerpTrade,
        params: {
          tradeRequest: {
            requestId: expect.any(String),
            expiresAt: expect.any(Number),
          },
        },
      }),
    );
    expect(mockCommitTradeTarget).toHaveBeenCalledWith({
      requestId: mockSetTradeTarget.mock.calls[0][0].requestId,
    });
    expect(mockNavigation.pushModal).not.toHaveBeenCalled();
    expect(mockService.changeActiveAsset).not.toHaveBeenCalled();
  });

  it('does not open details when switching the asset fails', async () => {
    const log = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      mockService.changeActiveAsset.mockRejectedValueOnce(
        new Error('unavailable'),
      );
      await navigate();
      expect(mockNavigation.pushModal).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it('ignores disabled Perps and empty targets', async () => {
    await navigate(' ');
    mockConfig.perpDisabled = true;
    await navigate();
    expect(mockNavigation.switchTab).not.toHaveBeenCalled();
    expect(mockNavigation.pushModal).not.toHaveBeenCalled();
  });
});
