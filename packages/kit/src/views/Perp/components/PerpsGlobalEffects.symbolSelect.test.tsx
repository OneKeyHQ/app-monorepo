/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { useHyperliquidSymbolSelect } from './PerpsGlobalEffects';

type IInstrument = { mode: 'perp' | 'spot'; coin: string };
type IPreparation = {
  claimed: boolean;
  pendingInitialTradeInstrument?: IInstrument;
  instrumentTarget: {
    mode: 'perp' | 'spot';
    perpAsset?: { coin: string };
    spotAsset?: { coin: string };
  };
  tradingUniverse?: { universesByDex: unknown[][] };
};

let mockInstrument: IInstrument = { mode: 'perp', coin: 'OLD' };
let mockGeneration = 0;
let mockFocusListener: ((focused: boolean) => void) | undefined;
const mockSetColdCache = jest.fn();
const mockActions = {
  switchTradeInstrument: jest.fn<
    Promise<boolean>,
    [IInstrument & { force?: boolean }]
  >(async ({ mode, coin }) => {
    mockGeneration += 1;
    mockInstrument = { mode, coin };
    return true;
  }),
};
const mockActionsRef = { current: mockActions };
const mockService = {
  prepareInitialSymbolSelect: jest.fn<Promise<IPreparation>, []>(),
  refreshTradingMeta: jest.fn<Promise<void>, []>(),
  refreshSpotMeta: jest.fn<Promise<void>, []>(),
  refreshActiveAssetCtxSnapshot: jest.fn<Promise<void>, [{ coin: string }]>(),
  hydrateActiveAssetCtxSnapshotCache: jest.fn<
    Promise<undefined>,
    [{ coin: string }]
  >(),
};

jest.mock('@onekeyhq/components', () => ({}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/perps', () => ({}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/spot', () => ({}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    perp: { hyperliquid: { coldStartInitializationError: jest.fn() } },
  },
}));
jest.mock('@onekeyhq/shared/src/performance/perpsColdStartPerf', () => ({
  markPerpsColdStartPerf: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/debug/debugUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/perpsDexUtils', () => ({
  isPerpsUniverseCacheComplete: () => false,
}));
jest.mock(
  '@onekeyhq/shared/src/utils/perpsOrderBookTickOptionsCache',
  () => ({}),
);
jest.mock('@onekeyhq/shared/src/utils/perpsUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/utils/timerUtils')
  >('@onekeyhq/shared/src/utils/timerUtils');
  return {
    ...actual,
    __esModule: true,
    default: { ...actual.default, wait: async () => {} },
  };
});
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: {
      prepareInitialSymbolSelect: () =>
        mockService.prepareInitialSymbolSelect(),
      refreshTradingMeta: () => mockService.refreshTradingMeta(),
      refreshSpotMeta: () => mockService.refreshSpotMeta(),
      refreshActiveAssetCtxSnapshot: (params: { coin: string }) =>
        mockService.refreshActiveAssetCtxSnapshot(params),
      hydrateActiveAssetCtxSnapshotCache: (params: { coin: string }) =>
        mockService.hydrateActiveAssetCtxSnapshotCache(params),
    },
  },
}));
jest.mock('../../../hooks/useHandleAppStateActive', () => ({}));
jest.mock('../../../hooks/useListenTabFocusState', () => ({
  __esModule: true,
  default: (_tab: unknown, callback: (focused: boolean) => void) => {
    mockFocusListener = callback;
  },
}));
jest.mock('../../../hooks/useLocaleVariant', () => ({}));
jest.mock('../../../hooks/useNetworkRestore', () => ({}));
jest.mock('../../../hooks/usePromiseResult', () => ({}));
jest.mock('../../../hooks/useRouteIsFocused', () => ({}));
jest.mock('../../../states/jotai/contexts/accountSelector', () => ({}));
jest.mock('../../../states/jotai/contexts/hyperliquid', () => ({
  useHyperliquidActions: () => mockActionsRef,
  useActiveTradeInstrumentAtom: () => [mockInstrument],
}));
jest.mock('../../../states/jotai/contexts/hyperliquid/actions', () => ({
  capturePerpsInstrumentChangeGuard: () => {
    const generation = mockGeneration;
    return () => generation === mockGeneration;
  },
}));
jest.mock('../../../states/jotai/contexts/hyperliquid/atoms', () => ({
  usePerpsActiveAssetCtxColdCacheAtom: () => [undefined, mockSetColdCache],
}));
jest.mock('../hooks/usePerpsActiveAssetCtxDisplay', () => ({}));
jest.mock('../hooks/usePrewarmPerpsTokenSelectorImages', () => ({}));
jest.mock('../utils/subscriptionPlanner', () => ({}));
jest.mock('./usePerpTokenUrlSync', () => ({}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function focus() {
  act(() => mockFocusListener?.(true));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGeneration = 0;
  mockInstrument = { mode: 'perp', coin: 'OLD' };
  mockFocusListener = undefined;
  mockService.prepareInitialSymbolSelect.mockResolvedValue({
    claimed: true,
    pendingInitialTradeInstrument: { mode: 'perp', coin: 'BTC' },
    instrumentTarget: { mode: 'perp', perpAsset: { coin: 'OLD' } },
    tradingUniverse: { universesByDex: [] },
  });
  mockService.refreshTradingMeta.mockResolvedValue();
  mockService.refreshSpotMeta.mockResolvedValue();
  mockService.refreshActiveAssetCtxSnapshot.mockResolvedValue();
  mockService.hydrateActiveAssetCtxSnapshotCache.mockResolvedValue(undefined);
});

it('does not restore an old pending market after a user switches during metadata loading', async () => {
  const metadata = createDeferred<void>();
  mockService.refreshTradingMeta.mockReturnValueOnce(metadata.promise);
  const { rerender } = renderHook(() => useHyperliquidSymbolSelect());
  focus();
  await waitFor(() =>
    expect(mockService.refreshTradingMeta).toHaveBeenCalledTimes(1),
  );
  await act(async () => {
    await mockActions.switchTradeInstrument({ mode: 'perp', coin: 'ETH' });
  });
  rerender();
  await act(async () => metadata.resolve());
  expect(
    mockActions.switchTradeInstrument.mock.calls.map(([target]) => target.coin),
  ).toEqual(['ETH']);
  expect(mockInstrument).toEqual({ mode: 'perp', coin: 'ETH' });
  expect(mockService.refreshActiveAssetCtxSnapshot).not.toHaveBeenCalled();
});

it('captures the current request before initial preparation resolves', async () => {
  const preparation = createDeferred<IPreparation>();
  mockService.prepareInitialSymbolSelect.mockReturnValueOnce(
    preparation.promise,
  );
  const { rerender } = renderHook(() => useHyperliquidSymbolSelect());
  focus();
  await act(async () => {
    await mockActions.switchTradeInstrument({ mode: 'perp', coin: 'ETH' });
  });
  rerender();
  await act(async () =>
    preparation.resolve({
      claimed: true,
      pendingInitialTradeInstrument: { mode: 'perp', coin: 'BTC' },
      instrumentTarget: { mode: 'perp', perpAsset: { coin: 'OLD' } },
      tradingUniverse: { universesByDex: [] },
    }),
  );
  expect(
    mockActions.switchTradeInstrument.mock.calls.map(([target]) => target.coin),
  ).toEqual(['ETH']);
  expect(mockInstrument).toEqual({ mode: 'perp', coin: 'ETH' });
});

it.each<IInstrument>([
  { mode: 'perp', coin: 'BTC' },
  { mode: 'spot', coin: '@107' },
])(
  'honors an unchanged first-entry request for $mode $coin',
  async (target) => {
    mockService.prepareInitialSymbolSelect.mockResolvedValueOnce({
      claimed: true,
      pendingInitialTradeInstrument: target,
      instrumentTarget: { mode: 'perp', perpAsset: { coin: 'OLD' } },
      tradingUniverse: { universesByDex: [] },
    });
    renderHook(() => useHyperliquidSymbolSelect());
    focus();
    await waitFor(() =>
      expect(mockActions.switchTradeInstrument).toHaveBeenCalledWith(
        expect.objectContaining({ ...target, force: true }),
      ),
    );
    expect(mockInstrument).toEqual(target);
  },
);

it('resynchronizes a remounted context when the background target diverges', async () => {
  mockService.prepareInitialSymbolSelect.mockResolvedValueOnce({
    claimed: false,
    instrumentTarget: { mode: 'perp', perpAsset: { coin: 'ETH' } },
  });
  renderHook(() => useHyperliquidSymbolSelect());
  focus();
  await waitFor(() =>
    expect(mockActions.switchTradeInstrument).toHaveBeenCalledWith({
      mode: 'perp',
      coin: 'ETH',
      force: true,
    }),
  );
  expect(mockService.refreshTradingMeta).not.toHaveBeenCalled();
});

it('keeps an already aligned context unchanged on focus', async () => {
  mockInstrument = { mode: 'perp', coin: 'BTC' };
  mockService.prepareInitialSymbolSelect.mockResolvedValueOnce({
    claimed: false,
    instrumentTarget: { mode: 'perp', perpAsset: { coin: 'BTC' } },
  });
  renderHook(() => useHyperliquidSymbolSelect());
  await act(async () => focus());
  expect(mockActions.switchTradeInstrument).not.toHaveBeenCalled();
});
