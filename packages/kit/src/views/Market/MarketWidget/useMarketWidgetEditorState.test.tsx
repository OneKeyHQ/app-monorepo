/** @jest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import type {
  IMarketWidgetAsset,
  IMarketWidgetEditorState,
} from '@onekeyhq/shared/src/modules/MarketWidget/types';

import { useMarketWidgetEditorState } from './useMarketWidgetEditorState';

const mockGetEditorState = jest.fn<
  Promise<IMarketWidgetEditorState>,
  [string?]
>();
const mockBeginEditing = jest.fn<Promise<string | undefined>, []>();
const mockFinishEditing = jest.fn<Promise<void>, [string, boolean]>();
const mockSetEditorDraft = jest.fn<
  Promise<IMarketWidgetEditorState>,
  [IMarketWidgetAsset[], string, IMarketWidgetAsset[]]
>();
const mockRefreshEditorState = jest.fn<Promise<IMarketWidgetEditorState>, []>();
const mockSearchStocks = jest.fn<
  Promise<IMarketWidgetEditorState>,
  [string, string | undefined]
>();
const mockRemoveListener = jest.fn();
let mockMasked = false;
let mockBackgroundRefreshSupported = false;
let mockDraftSessionsSupported = false;
let mockAppStateChanged: ((value: string) => void) | undefined;
let mockConfigurationSynced: (() => void) | undefined;
let mockFocusEffect: (() => (() => void) | undefined) | undefined;
let mockFocusCleanup: (() => void) | undefined;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => (() => void) | undefined) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => {
      mockFocusEffect = effect;
      mockFocusCleanup = effect();
      return () => {
        mockFocusCleanup?.();
        mockFocusCleanup = undefined;
        mockFocusEffect = undefined;
      };
    }, [effect]);
  },
}));
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (_event: string, callback: (value: string) => void) => {
      mockAppStateChanged = callback;
      return { remove: mockRemoveListener };
    },
  },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    MarketWidgetConfigurationSynced: 'MarketWidgetConfigurationSynced',
  },
  appEventBus: {
    on: (_name: string, listener: () => void) => {
      mockConfigurationSynced = listener;
    },
    off: () => {
      mockConfigurationSynced = undefined;
    },
  },
}));
jest.mock('@onekeyhq/shared/src/modules/MarketWidget', () => ({
  __esModule: true,
  default: {
    getEditorState: (session?: string) => mockGetEditorState(session),
    get beginEditing() {
      return mockDraftSessionsSupported ? mockBeginEditing : undefined;
    },
    setEditorDraft: (
      assets: IMarketWidgetAsset[],
      session: string,
      visibleAssets: IMarketWidgetAsset[],
    ) => mockSetEditorDraft(assets, session, visibleAssets),
    finishEditing: (session: string, saved: boolean) =>
      mockFinishEditing(session, saved),
    searchAssets: (query: string, session?: string) =>
      mockSearchStocks(query, session),
    get refreshEditorState() {
      return mockBackgroundRefreshSupported
        ? () => mockRefreshEditorState()
        : undefined;
    },
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({ isNativeIOS: true }));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: { isMaskingDataSync: () => mockMasked },
}));

function createState(
  name: string,
  privacyMasked = false,
): IMarketWidgetEditorState {
  return {
    profiles: [{ id: name, name, kind: 'list', source: 'hot' }],
    hot: [],
    watchlist: [],
    privacyMasked,
  };
}

function createPendingState() {
  let resolve: (state: IMarketWidgetEditorState) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<IMarketWidgetEditorState>(
    (onResolve, onReject) => {
      resolve = onResolve;
      reject = onReject;
    },
  );
  return { promise, resolve, reject };
}

describe('market widget editor native snapshot lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEditorState.mockReset();
    mockRefreshEditorState.mockReset();
    mockSearchStocks.mockReset();
    mockBeginEditing.mockReset();
    mockFinishEditing.mockReset().mockResolvedValue(undefined);
    mockSetEditorDraft.mockReset();
    mockMasked = false;
    mockBackgroundRefreshSupported = false;
    mockDraftSessionsSupported = false;
    mockAppStateChanged = undefined;
    mockConfigurationSynced = undefined;
    mockFocusEffect = undefined;
    mockFocusCleanup = undefined;
  });
  afterEach(cleanup);

  it('exposes the saved slot order only after a missing iOS binding recovers', async () => {
    mockBackgroundRefreshSupported = true;
    const missing = { ...createState('missing'), settings: [] };
    const pending = createPendingState();
    mockGetEditorState.mockResolvedValue(missing);
    mockRefreshEditorState.mockReturnValue(pending.promise);
    const { result } = renderHook(() =>
      useMarketWidgetEditorState('session', undefined, 'binding', 'list'),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.unavailable).toBe(true);
    expect(result.current.state).toBeUndefined();

    const assets: IMarketWidgetAsset[] = ['SOL', 'BTC', 'ETH'].map(
      (symbol) => ({
        kind: 'asset',
        assetId: symbol.toLowerCase(),
        name: symbol,
        symbol,
      }),
    );
    await act(async () =>
      pending.resolve({
        ...missing,
        hot: [...assets].toReversed(),
        settings: [
          { id: 'binding', kind: 'list', source: 'hot', name: 'List', assets },
        ],
      }),
    );
    expect(result.current.unavailable).toBe(false);
    expect(result.current.state?.settings?.[0]?.assets).toEqual(assets);
  });

  it('keeps selected assets in one native draft across searches and releases it on close', async () => {
    mockDraftSessionsSupported = true;
    mockBeginEditing.mockResolvedValue('draft-session');
    mockGetEditorState.mockResolvedValue(createState('local'));
    const asset: IMarketWidgetAsset = {
      kind: 'stock',
      stockId: 'QQQ',
      symbol: 'QQQ',
      name: 'Invesco QQQ Trust',
    };
    const retained = { ...createState('retained'), searchAssets: [asset] };
    mockSetEditorDraft.mockResolvedValue(retained);
    mockSearchStocks.mockResolvedValue(retained);
    const { result, unmount } = renderHook(useMarketWidgetEditorState);
    await waitFor(() => expect(result.current.state).toBeDefined());
    expect(result.current.editorSession).toBe('draft-session');
    expect(mockGetEditorState).toHaveBeenCalledWith('draft-session');
    await act(async () => {
      expect(await result.current.retainDraft([asset])).toBe(true);
    });
    expect(mockSetEditorDraft).toHaveBeenCalledWith(
      [asset],
      'draft-session',
      [],
    );
    await act(async () => result.current.searchAssets('AAPL'));
    expect(result.current.state?.searchAssets).toEqual([asset]);
    expect(mockBeginEditing).toHaveBeenCalledTimes(1);
    unmount();
    expect(mockFinishEditing).toHaveBeenCalledWith('draft-session', false);
  });

  it('releases a native session that finishes opening after the editor closes', async () => {
    mockDraftSessionsSupported = true;
    let resolveSession!: (token: string) => void;
    mockBeginEditing.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveSession = resolve;
      }),
    );
    const { unmount } = renderHook(useMarketWidgetEditorState);
    unmount();
    await act(async () => resolveSession('late-session'));
    expect(mockFinishEditing).toHaveBeenCalledWith('late-session', false);
    expect(mockGetEditorState).not.toHaveBeenCalled();
  });

  it.each(['back', 'inactive'] as const)(
    'preserves visible draft pins when %s cancels a replacement before native resolves',
    async (cancellation) => {
      const visible: IMarketWidgetAsset = {
        kind: 'stock',
        stockId: 'QQQ',
        symbol: 'QQQ',
        name: 'QQQ',
      };
      const proposed: IMarketWidgetAsset = {
        kind: 'stock',
        stockId: 'AAPL',
        symbol: 'AAPL',
        name: 'Apple',
      };
      const pending = createPendingState();
      let nativePins: IMarketWidgetAsset[] = [visible];
      mockGetEditorState.mockImplementation(async () => ({
        ...createState('native'),
        searchAssets: nativePins,
      }));
      mockSetEditorDraft.mockImplementation(
        (assets, _session, visibleAssets) => {
          nativePins = [...visibleAssets, ...assets];
          return pending.promise;
        },
      );
      const { result } = renderHook(() =>
        useMarketWidgetEditorState('session'),
      );
      await waitFor(() => expect(result.current.state).toBeDefined());
      let accepted: Promise<boolean> | undefined;
      act(() => {
        accepted = result.current.retainDraft([proposed], [visible]);
      });
      await waitFor(() => expect(mockSetEditorDraft).toHaveBeenCalledTimes(1));
      act(() => {
        if (cancellation === 'inactive') mockAppStateChanged?.('inactive');
        else result.current.cancelDraft();
      });
      await act(async () =>
        pending.resolve({
          ...createState('pending'),
          searchAssets: nativePins,
        }),
      );
      await expect(accepted).resolves.toBe(false);
      expect(nativePins).toContainEqual(visible);
      if (cancellation === 'inactive') {
        act(() => mockAppStateChanged?.('active'));
        await waitFor(() =>
          expect(result.current.state?.searchAssets).toContainEqual(visible),
        );
      } else {
        expect(result.current.state?.profiles[0].name).toBe('native');
      }
    },
  );

  it('serializes native draft writes and ignores a superseded response', async () => {
    mockGetEditorState.mockResolvedValue(createState('local'));
    const first = createPendingState();
    const second = createPendingState();
    mockSetEditorDraft
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const visible: IMarketWidgetAsset = {
      kind: 'stock',
      stockId: 'QQQ',
      symbol: 'QQQ',
      name: 'QQQ',
    };
    const apple: IMarketWidgetAsset = {
      kind: 'stock',
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple',
    };
    const msft: IMarketWidgetAsset = {
      kind: 'stock',
      stockId: 'MSFT',
      symbol: 'MSFT',
      name: 'Microsoft',
    };
    const { result } = renderHook(() => useMarketWidgetEditorState('session'));
    await waitFor(() => expect(result.current.state).toBeDefined());
    let firstAccepted: Promise<boolean> | undefined;
    let secondAccepted: Promise<boolean> | undefined;
    act(() => {
      firstAccepted = result.current.retainDraft([apple], [visible]);
    });
    await waitFor(() => expect(mockSetEditorDraft).toHaveBeenCalledTimes(1));
    act(() => {
      secondAccepted = result.current.retainDraft([msft], [visible]);
    });
    await act(async () => undefined);
    expect(mockSetEditorDraft).toHaveBeenCalledTimes(1);
    await act(async () => first.resolve(createState('stale')));
    await expect(firstAccepted).resolves.toBe(false);
    expect(result.current.state?.profiles[0].name).toBe('local');
    expect(mockSetEditorDraft).toHaveBeenNthCalledWith(2, [msft], 'session', [
      visible,
    ]);
    await act(async () =>
      second.resolve({ ...createState('local'), searchAssets: [msft] }),
    );
    await expect(secondAccepted).resolves.toBe(true);
    expect(result.current.state?.searchAssets).toEqual([msft]);
  });

  it('suppresses canceled native failures and permits the next choice', async () => {
    mockGetEditorState.mockResolvedValue(createState('local'));
    const pending = createPendingState();
    const recovered: IMarketWidgetAsset = {
      kind: 'stock',
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple',
    };
    mockSetEditorDraft
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce({
        ...createState('local'),
        searchAssets: [recovered],
      });
    const { result } = renderHook(() => useMarketWidgetEditorState('session'));
    await waitFor(() => expect(result.current.state).toBeDefined());
    let accepted: Promise<boolean> | undefined;
    act(() => {
      accepted = result.current.retainDraft([]);
    });
    await waitFor(() => expect(mockSetEditorDraft).toHaveBeenCalledTimes(1));
    act(() => result.current.cancelDraft());
    await act(async () => pending.reject(new Error('late native failure')));
    await expect(accepted).resolves.toBe(false);
    await act(async () =>
      expect(await result.current.retainDraft([recovered])).toBe(true),
    );
    expect(result.current.state?.searchAssets).toEqual([recovered]);
  });

  it('ignores a draft response after blur and preserves launcher-owned Android sessions', async () => {
    const pending = createPendingState();
    mockGetEditorState.mockResolvedValue(createState('local'));
    mockSetEditorDraft.mockReturnValue(pending.promise);
    const { result, unmount } = renderHook(() =>
      useMarketWidgetEditorState('android-session'),
    );
    await waitFor(() => expect(result.current.state).toBeDefined());
    let retained: Promise<boolean> | undefined;
    act(() => {
      retained = result.current.retainDraft([]);
    });
    await act(async () => undefined);
    act(() => mockFocusCleanup?.());
    await act(async () => pending.resolve(createState('late')));
    await expect(retained).resolves.toBe(false);
    unmount();
    expect(mockFinishEditing).not.toHaveBeenCalled();
  });

  it('keeps the focus read when duplicate active events arrive during foreground entry', async () => {
    const pending = createPendingState();
    mockGetEditorState.mockReturnValue(pending.promise);
    const { result } = renderHook(useMarketWidgetEditorState);
    act(() => {
      mockAppStateChanged?.('active');
      mockAppStateChanged?.('active');
    });
    expect(mockGetEditorState).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(createState('ready')));
    expect(result.current.state?.profiles[0].name).toBe('ready');
    act(() => mockAppStateChanged?.('active'));
    expect(mockGetEditorState).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
  });

  it('searches iOS stocks without an Android editor session', async () => {
    const metadata = createPendingState();
    mockBackgroundRefreshSupported = true;
    mockRefreshEditorState.mockReturnValueOnce(metadata.promise);
    mockGetEditorState.mockResolvedValue(createState('local'));
    mockSearchStocks.mockResolvedValue({
      ...createState('searched'),
      searchAssets: [
        {
          kind: 'stock',
          stockId: 'QQQ',
          symbol: 'QQQ',
          name: 'Invesco QQQ Trust',
        },
      ],
    });
    const { result } = renderHook(useMarketWidgetEditorState);
    await waitFor(() => expect(result.current.state).toBeDefined());
    await act(async () => result.current.searchAssets('QQQ'));
    expect(mockSearchStocks).toHaveBeenCalledWith('QQQ', undefined);
    expect(result.current.state?.searchAssets?.[0]).toMatchObject({
      stockId: 'QQQ',
    });
    act(() => result.current.cancelSearch());
    await act(async () => metadata.resolve(createState('enriched')));
    expect(result.current.state?.searchAssets?.[0]).toMatchObject({
      stockId: 'QQQ',
    });
  });

  it('accepts stock candidates only from the current search and ignores canceled results', async () => {
    mockGetEditorState.mockResolvedValue(createState('local'));
    const first = createPendingState();
    const second = createPendingState();
    mockSearchStocks
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useMarketWidgetEditorState('session'));
    await waitFor(() =>
      expect(result.current.state?.profiles[0].name).toBe('local'),
    );
    act(() => {
      void result.current.searchAssets('A');
    });
    await act(async () => undefined);
    act(() => {
      void result.current.searchAssets('AAPL');
    });
    await act(async () => undefined);
    await act(async () => {
      second.resolve({
        ...createState('AAPL'),
        searchResults: [
          { kind: 'stock', stockId: 'AAPL', symbol: 'AAPL', name: 'Apple' },
        ],
      });
    });
    await act(async () => {
      first.resolve(createState('outdated'));
    });
    expect(result.current.state?.searchResults?.[0]).toMatchObject({
      stockId: 'AAPL',
    });
    expect(mockSearchStocks).toHaveBeenLastCalledWith('AAPL', 'session');
    const canceled = createPendingState();
    mockSearchStocks.mockReturnValueOnce(canceled.promise);
    act(() => {
      void result.current.searchAssets('NVDA');
    });
    await act(async () => undefined);
    act(() => result.current.cancelSearch());
    await act(async () => {
      canceled.resolve(createState('canceled'));
    });
    expect(result.current.state?.searchResults).toBeUndefined();
    expect(result.current.isSearching).toBe(false);
  });

  it('keeps partial search results visible and allows the same query to be retried', async () => {
    const local = createState('local');
    mockGetEditorState.mockResolvedValue(local);
    const asset: IMarketWidgetAsset = {
      kind: 'stock',
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple',
    };
    mockSearchStocks
      .mockResolvedValueOnce({
        ...local,
        searchResults: [asset],
        searchIncomplete: true,
      })
      .mockResolvedValueOnce({
        ...local,
        searchResults: [asset],
        searchIncomplete: false,
      });
    const { result } = renderHook(() => useMarketWidgetEditorState('session'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => result.current.searchAssets('AAPL'));
    expect(result.current.state?.searchResults).toEqual([asset]);
    expect(result.current.state?.searchIncomplete).toBe(true);
    expect(result.current.searchError).toBe(true);
    await act(async () => result.current.searchAssets('AAPL'));
    expect(mockSearchStocks).toHaveBeenCalledTimes(2);
    expect(result.current.state?.searchIncomplete).toBe(false);
    expect(result.current.searchError).toBe(false);
  });

  it('repeats an open picker query after the foreground snapshot has loaded', async () => {
    const foreground = createPendingState();
    mockGetEditorState
      .mockResolvedValueOnce(createState('local'))
      .mockReturnValueOnce(foreground.promise);
    mockSearchStocks.mockResolvedValue(createState('search results'));
    const { result } = renderHook(() =>
      useMarketWidgetEditorState('session', 'AAPL'),
    );
    await waitFor(() => expect(result.current.searchQuery).toBe('AAPL'));

    act(() => mockAppStateChanged?.('background'));
    act(() => mockAppStateChanged?.('active'));
    expect(result.current.searchQuery).toBeUndefined();
    expect(result.current.isLoading).toBe(true);

    await act(async () => foreground.resolve(createState('foreground')));
    await waitFor(() => expect(result.current.searchQuery).toBe('AAPL'));
    expect(mockSearchStocks.mock.calls).toEqual([
      ['AAPL', 'session'],
      ['AAPL', 'session'],
    ]);
  });

  it('prevents stock search while masked and ignores a result received in the background', async () => {
    mockGetEditorState.mockResolvedValue(createState('local'));
    const pending = createPendingState();
    mockSearchStocks.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useMarketWidgetEditorState('session'));
    await waitFor(() => expect(result.current.state).toBeDefined());
    mockMasked = true;
    await act(async () => {
      await result.current.searchAssets('AAPL');
    });
    expect(mockSearchStocks).not.toHaveBeenCalled();
    mockMasked = false;
    act(() => {
      void result.current.searchAssets('NVDA');
    });
    await act(async () => undefined);
    act(() => mockAppStateChanged?.('background'));
    await act(async () => {
      pending.resolve(createState('hidden'));
    });
    expect(result.current.state).toBeUndefined();
    expect(result.current.isSearching).toBe(false);
  });

  it.each([true, false])(
    'keeps updated browse lists and search results when search finishes first: %s',
    async (searchFirst) => {
      const metadata = createPendingState();
      const search = createPendingState();
      const local = createState('local');
      const btc: IMarketWidgetAsset = {
        kind: 'asset',
        assetId: 'btc',
        symbol: 'BTC',
        name: 'Bitcoin',
      };
      const eth: IMarketWidgetAsset = {
        kind: 'asset',
        assetId: 'eth',
        symbol: 'ETH',
        name: 'Ethereum',
      };
      const apple: IMarketWidgetAsset = {
        kind: 'stock',
        stockId: 'AAPL',
        symbol: 'AAPL',
        name: 'Apple',
      };
      mockBackgroundRefreshSupported = true;
      mockGetEditorState.mockResolvedValue(local);
      mockRefreshEditorState.mockReturnValueOnce(metadata.promise);
      mockSearchStocks.mockReturnValueOnce(search.promise);
      const { result } = renderHook(() =>
        useMarketWidgetEditorState('session'),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => {
        void result.current.searchAssets('AAPL');
      });

      const finishSearch = () =>
        act(async () => search.resolve({ ...local, searchResults: [apple] }));
      const finishRefresh = () =>
        act(async () =>
          metadata.resolve({ ...local, watchlist: [btc], hot: [eth] }),
        );
      if (searchFirst) {
        await finishSearch();
        await finishRefresh();
      } else {
        await finishRefresh();
        await finishSearch();
      }

      expect(result.current.state?.searchResults).toEqual([apple]);
      expect(result.current.state?.watchlist).toEqual([btc]);
      expect(result.current.state?.hot).toEqual([eth]);

      act(() => result.current.cancelSearch());
      expect(result.current.state?.searchResults).toBeUndefined();
      expect(result.current.state?.watchlist).toEqual([btc]);
      expect(result.current.state?.hot).toEqual([eth]);
    },
  );

  it('updates an open editor after favorites are synced without resetting its search', async () => {
    const local = createState('local');
    const synced = createPendingState();
    const btc: IMarketWidgetAsset = {
      kind: 'asset',
      assetId: 'btc',
      symbol: 'BTC',
      name: 'Bitcoin',
    };
    mockGetEditorState
      .mockResolvedValueOnce(local)
      .mockReturnValueOnce(synced.promise);
    mockSearchStocks.mockResolvedValue({ ...local, searchResults: [btc] });
    const { result, unmount } = renderHook(() =>
      useMarketWidgetEditorState('session'),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => result.current.searchAssets('BTC'));
    await act(async () => mockConfigurationSynced?.());
    expect(result.current.state?.searchResults).toEqual([btc]);
    expect(result.current.isLoading).toBe(false);

    await act(async () => synced.resolve({ ...local, watchlist: [btc] }));
    expect(result.current.searchQuery).toBe('BTC');
    expect(result.current.state?.watchlist).toEqual([btc]);
    expect(result.current.state?.searchResults).toEqual([btc]);

    unmount();
    expect(mockConfigurationSynced).toBeUndefined();
  });

  it.each(['single', 'list'] as const)(
    'applies recovered %s slot metadata after configuration sync without replacing selections or drafts',
    async (kind) => {
      const selected: IMarketWidgetAsset = {
        kind: 'token',
        chainId: 'evm--1',
        contractAddress: '0xabc',
        requestTokenAddress: 'selected-request',
        isNative: false,
        symbol: 'OLD',
        name: 'Old name',
      };
      const otherNetwork: IMarketWidgetAsset = {
        ...selected,
        chainId: 'evm--10',
      };
      const recovered: IMarketWidgetAsset = {
        ...selected,
        requestTokenAddress: 'server-request',
        symbol: 'NEW',
        name: 'Recovered name',
        logoURL: 'https://example.com/recovered.png',
      };
      const draft: IMarketWidgetAsset = {
        kind: 'stock',
        stockId: 'QQQ',
        symbol: 'QQQ',
        name: 'Draft stock',
      };
      const setting = {
        id: 'binding',
        kind,
        source: 'hot' as const,
        name: 'Selected widget',
        ...(kind === 'single'
          ? { asset: selected }
          : { assets: [selected, otherNetwork, selected] }),
      };
      const local = { ...createState('local'), settings: [setting] };
      const initialMetadata = createPendingState();
      const syncedMetadata = createPendingState();
      mockBackgroundRefreshSupported = true;
      mockGetEditorState.mockResolvedValue(local);
      mockRefreshEditorState
        .mockReturnValueOnce(initialMetadata.promise)
        .mockReturnValueOnce(syncedMetadata.promise);
      mockSetEditorDraft.mockResolvedValue({ ...local, searchAssets: [draft] });
      mockSearchStocks.mockResolvedValue({ ...local, searchResults: [draft] });
      const { result } = renderHook(() =>
        useMarketWidgetEditorState('session'),
      );
      await waitFor(() =>
        expect(mockRefreshEditorState).toHaveBeenCalledTimes(1),
      );
      await act(async () => mockConfigurationSynced?.());
      await waitFor(() =>
        expect(mockRefreshEditorState).toHaveBeenCalledTimes(2),
      );
      await act(async () => result.current.retainDraft([draft]));
      await act(async () => result.current.searchAssets('QQQ'));
      await act(async () => initialMetadata.resolve(createState('outdated')));
      await act(async () =>
        syncedMetadata.resolve({
          ...createState('refreshed'),
          settings: [
            {
              ...setting,
              name: 'Server name',
              ...(kind === 'single'
                ? { asset: recovered }
                : { assets: [recovered] }),
            },
          ],
        }),
      );

      const display = {
        ...recovered,
        requestTokenAddress: selected.requestTokenAddress,
      };
      expect(result.current.state?.settings).toEqual([
        {
          ...setting,
          ...(kind === 'single'
            ? { asset: display }
            : { assets: [display, otherNetwork, display] }),
        },
      ]);
      expect(result.current.state?.profiles).toEqual(local.profiles);
      expect(result.current.state?.searchAssets).toEqual([draft]);
      expect(result.current.state?.searchResults).toEqual([draft]);
      expect(result.current.searchQuery).toBe('QQQ');
      expect(result.current.isLoading).toBe(false);
    },
  );

  it('uses the latest native Trending list from a draft when browse reads have finished', async () => {
    const local = createState('local');
    const btc: IMarketWidgetAsset = {
      kind: 'asset',
      assetId: 'btc',
      symbol: 'BTC',
      name: 'Bitcoin',
    };
    const eth: IMarketWidgetAsset = {
      kind: 'asset',
      assetId: 'eth',
      symbol: 'ETH',
      name: 'Ethereum',
    };
    mockGetEditorState.mockResolvedValue({ ...local, hot: [btc] });
    mockSetEditorDraft.mockResolvedValue({
      ...local,
      hot: [eth],
      searchAssets: [btc],
    });
    const { result } = renderHook(() => useMarketWidgetEditorState('session'));
    await waitFor(() => expect(result.current.state?.hot).toEqual([btc]));

    await act(async () =>
      expect(await result.current.retainDraft([btc])).toBe(true),
    );

    expect(result.current.state?.hot).toEqual([eth]);
    expect(result.current.state?.searchAssets).toEqual([btc]);
  });

  it.each([true, false])(
    'retains draft candidates and refreshed browse lists when draft finishes first: %s',
    async (draftFirst) => {
      const local = createState('local');
      const draft = createPendingState();
      const metadata = createPendingState();
      mockBackgroundRefreshSupported = true;
      const stock: IMarketWidgetAsset = {
        kind: 'stock',
        stockId: 'QQQ',
        symbol: 'QQQ',
        name: 'Invesco QQQ Trust',
      };
      const btc: IMarketWidgetAsset = {
        kind: 'asset',
        assetId: 'btc',
        symbol: 'BTC',
        name: 'Bitcoin',
      };
      mockGetEditorState
        .mockResolvedValueOnce(local)
        .mockResolvedValueOnce({ ...local, watchlist: [btc] });
      mockRefreshEditorState
        .mockResolvedValueOnce(local)
        .mockReturnValueOnce(metadata.promise);
      mockSetEditorDraft.mockReturnValueOnce(draft.promise);
      const { result } = renderHook(() =>
        useMarketWidgetEditorState('session'),
      );
      await waitFor(() =>
        expect(mockRefreshEditorState).toHaveBeenCalledTimes(1),
      );
      await act(async () => mockConfigurationSynced?.());
      await waitFor(() =>
        expect(mockRefreshEditorState).toHaveBeenCalledTimes(2),
      );
      await act(async () => {
        void result.current.retainDraft([stock]);
      });
      const finishDraft = () =>
        act(async () => draft.resolve({ ...local, searchAssets: [stock] }));
      const finishMetadata = () =>
        act(async () =>
          metadata.resolve({ ...local, watchlist: [btc], hot: [btc] }),
        );
      if (draftFirst) {
        await finishDraft();
        await finishMetadata();
      } else {
        await finishMetadata();
        await finishDraft();
      }

      expect(result.current.state?.watchlist).toEqual([btc]);
      expect(result.current.state?.hot).toEqual([btc]);
      expect(result.current.state?.searchAssets).toEqual([stock]);
    },
  );

  it('ignores an older native response after a newer refresh', async () => {
    const first = createPendingState();
    const second = createPendingState();
    mockGetEditorState
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(useMarketWidgetEditorState);
    act(() => {
      void result.current.refresh();
    });
    await act(async () => {
      second.resolve(createState('latest'));
    });
    expect(result.current.state?.profiles[0].name).toBe('latest');
    await act(async () => {
      first.resolve(createState('outdated'));
    });
    expect(result.current.state?.profiles[0].name).toBe('latest');
  });

  it('clears a blurred page without showing an error behind navigation', async () => {
    const returning = createPendingState();
    mockGetEditorState
      .mockResolvedValueOnce(createState('visible'))
      .mockReturnValueOnce(returning.promise);
    const { result } = renderHook(useMarketWidgetEditorState);
    await waitFor(() =>
      expect(result.current.state?.profiles[0].name).toBe('visible'),
    );
    expect(result.current.isLoading).toBe(false);

    act(() => {
      mockFocusCleanup?.();
      mockFocusCleanup = undefined;
    });
    expect(result.current.state).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasError).toBe(false);
    expect(result.current.isActive()).toBe(false);

    act(() => {
      mockFocusCleanup = mockFocusEffect?.();
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasError).toBe(false);
    await act(async () => {
      returning.resolve(createState('returned'));
    });
    expect(result.current.state?.profiles[0].name).toBe('returned');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(false);
  });

  it('shows the local snapshot while background enrichment is pending', async () => {
    const pending = createPendingState();
    const cached = createState('cached');
    mockBackgroundRefreshSupported = true;
    mockGetEditorState.mockResolvedValue(cached);
    mockRefreshEditorState.mockReturnValue(pending.promise);
    const { result } = renderHook(useMarketWidgetEditorState);
    await waitFor(() =>
      expect(mockRefreshEditorState).toHaveBeenCalledTimes(1),
    );
    expect(result.current.state).toEqual(cached);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(false);

    await act(async () => {
      pending.resolve(createState('enriched'));
    });
    expect(result.current.state?.profiles[0].name).toBe('enriched');
    expect(result.current.isLoading).toBe(false);
  });

  it('keeps usable local data when background enrichment fails', async () => {
    const pending = createPendingState();
    const cached = createState('cached');
    mockBackgroundRefreshSupported = true;
    mockGetEditorState.mockResolvedValue(cached);
    mockRefreshEditorState.mockReturnValue(pending.promise);
    const { result } = renderHook(useMarketWidgetEditorState);
    await waitFor(() =>
      expect(mockRefreshEditorState).toHaveBeenCalledTimes(1),
    );
    await act(async () => {
      pending.reject(new Error('Metadata request failed'));
    });
    expect(result.current.state).toEqual(cached);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(false);
  });

  it('ignores background results from a previous focus session', async () => {
    const previous = createPendingState();
    const current = createPendingState();
    mockBackgroundRefreshSupported = true;
    mockGetEditorState
      .mockResolvedValueOnce(createState('first-focus'))
      .mockResolvedValueOnce(createState('current-focus'));
    mockRefreshEditorState
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(current.promise);
    const { result } = renderHook(useMarketWidgetEditorState);
    await waitFor(() =>
      expect(mockRefreshEditorState).toHaveBeenCalledTimes(1),
    );
    act(() => {
      mockFocusCleanup?.();
      mockFocusCleanup = undefined;
    });
    act(() => {
      mockFocusCleanup = mockFocusEffect?.();
    });
    await waitFor(() =>
      expect(mockRefreshEditorState).toHaveBeenCalledTimes(2),
    );
    await act(async () => {
      previous.resolve(createState('outdated'));
    });
    expect(result.current.state?.profiles[0].name).toBe('current-focus');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(false);
    await act(async () => {
      current.resolve(createState('current-enriched'));
    });
    expect(result.current.state?.profiles[0].name).toBe('current-enriched');
  });

  it('clears visible data when background enrichment reports native privacy masking', async () => {
    const pending = createPendingState();
    mockBackgroundRefreshSupported = true;
    mockGetEditorState.mockResolvedValue(createState('visible'));
    mockRefreshEditorState.mockReturnValue(pending.promise);
    const { result } = renderHook(useMarketWidgetEditorState);
    await waitFor(() =>
      expect(result.current.state?.profiles[0].name).toBe('visible'),
    );
    await act(async () => {
      pending.resolve(createState('masked', true));
    });
    expect(result.current.privacyMasked).toBe(true);
    expect(result.current.state).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(false);
  });

  it('reports a real local read failure and clears it when navigating away', async () => {
    mockGetEditorState.mockRejectedValue(new Error('Native storage failed'));
    const { result } = renderHook(useMarketWidgetEditorState);
    await waitFor(() => expect(result.current.hasError).toBe(true));
    expect(result.current.state).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    act(() => {
      mockFocusCleanup?.();
      mockFocusCleanup = undefined;
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasError).toBe(false);
  });

  it('discards an unmasked response if privacy starts while it is pending', async () => {
    const pending = createPendingState();
    mockGetEditorState.mockReturnValue(pending.promise);
    const { result } = renderHook(useMarketWidgetEditorState);
    mockMasked = true;
    await act(async () => {
      pending.resolve(createState('private'));
    });
    expect(result.current.privacyMasked).toBe(true);
    expect(result.current.state).toBeUndefined();
    await act(async () => {
      await result.current.refresh();
    });
    expect(mockGetEditorState).toHaveBeenCalledTimes(1);
  });

  it('clears cached content while backgrounded and reloads the native privacy state', async () => {
    mockGetEditorState
      .mockResolvedValueOnce(createState('visible'))
      .mockResolvedValueOnce(createState('masked', true));
    const { result } = renderHook(useMarketWidgetEditorState);
    await waitFor(() =>
      expect(result.current.state?.profiles[0].name).toBe('visible'),
    );
    act(() => mockAppStateChanged?.('background'));
    expect(result.current.state).toBeUndefined();
    act(() => mockAppStateChanged?.('active'));
    await waitFor(() => expect(result.current.privacyMasked).toBe(true));
    expect(result.current.state).toBeUndefined();
  });

  it('removes the lifecycle subscription and invalidates in-flight work on unmount', async () => {
    const pending = createPendingState();
    mockGetEditorState.mockReturnValue(pending.promise);
    const { unmount } = renderHook(useMarketWidgetEditorState);
    unmount();
    expect(mockRemoveListener).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve(createState('late'));
    });
    expect(mockGetEditorState).toHaveBeenCalledTimes(1);
  });
});
