/** @jest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import type { IMarketWidgetEditorState } from '@onekeyhq/shared/src/modules/MarketWidget/types';

import { useMarketWidgetEditorState } from './useMarketWidgetEditorState';

const mockGetEditorState = jest.fn<Promise<IMarketWidgetEditorState>, []>();
const mockRemoveListener = jest.fn();
let mockMasked = false;
let mockAppStateChanged: ((value: string) => void) | undefined;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => (() => void) | undefined) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(effect, [effect]);
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
  default: { getEditorState: () => mockGetEditorState() },
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
  const promise = new Promise<IMarketWidgetEditorState>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
}

describe('market widget editor native snapshot lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEditorState.mockReset();
    mockMasked = false;
    mockAppStateChanged = undefined;
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
