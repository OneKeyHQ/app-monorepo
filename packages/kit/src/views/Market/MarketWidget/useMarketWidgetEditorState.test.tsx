/** @jest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import type { IMarketWidgetEditorState } from '@onekeyhq/shared/src/modules/MarketWidget/types';

import { useMarketWidgetEditorState } from './useMarketWidgetEditorState';

const mockGetEditorState = jest.fn<Promise<IMarketWidgetEditorState>, []>();
const mockRefreshEditorState = jest.fn<Promise<IMarketWidgetEditorState>, []>();
const mockRemoveListener = jest.fn();
let mockMasked = false;
let mockBackgroundRefreshSupported = false;
let mockAppStateChanged: ((value: string) => void) | undefined;
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
jest.mock('@onekeyhq/shared/src/modules/MarketWidget', () => ({
  __esModule: true,
  default: {
    getEditorState: () => mockGetEditorState(),
    get refreshEditorState() {
      return mockBackgroundRefreshSupported
        ? () => mockRefreshEditorState()
        : undefined;
    },
  },
}));
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
    mockMasked = false;
    mockBackgroundRefreshSupported = false;
    mockAppStateChanged = undefined;
    mockFocusEffect = undefined;
    mockFocusCleanup = undefined;
  });
  afterEach(cleanup);

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
