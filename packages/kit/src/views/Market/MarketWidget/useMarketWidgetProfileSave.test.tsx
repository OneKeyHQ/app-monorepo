/** @jest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import type {
  IMarketWidgetEditorState,
  IMarketWidgetProfile,
  IMarketWidgetProfileInput,
} from '@onekeyhq/shared/src/modules/MarketWidget/types';

import { useMarketWidgetEditorState } from './useMarketWidgetEditorState';
import { useMarketWidgetProfileSave } from './useMarketWidgetProfileSave';

const mockGetEditorState = jest.fn<Promise<IMarketWidgetEditorState>, []>();
const mockSaveProfile = jest.fn<Promise<IMarketWidgetProfile>, [unknown]>();
let mockFocused = true;
let mockMasked = false;
let mockAppStateChanged: ((value: string) => void) | undefined;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => (() => void) | undefined) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    const focused = mockFocused;
    useEffect(() => (focused ? effect() : undefined), [effect, focused]);
  },
}));
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (_event: string, callback: (value: string) => void) => {
      mockAppStateChanged = callback;
      return { remove: () => undefined };
    },
  },
}));
jest.mock('@onekeyhq/shared/src/modules/MarketWidget', () => ({
  __esModule: true,
  default: {
    getEditorState: () => mockGetEditorState(),
    saveProfile: (input: unknown) => mockSaveProfile(input),
  },
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: { isMaskingDataSync: () => mockMasked },
}));

const profile: IMarketWidgetProfile = {
  id: 'profile',
  name: 'Market list',
  kind: 'list',
  source: 'hot',
};
const state: IMarketWidgetEditorState = {
  profiles: [profile],
  watchlist: [],
  hot: [],
  privacyMasked: false,
};

function pendingValue<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
}

function setup(
  validate = async () => true,
  input: IMarketWidgetProfileInput = profile,
) {
  const onPersisted = jest.fn();
  const onSaved = jest.fn();
  const onError = jest.fn();
  const rendered = renderHook(() => {
    const editor = useMarketWidgetEditorState();
    return useMarketWidgetProfileSave({
      editor,
      validate,
      getInput: () => input,
      onPersisted,
      onSaved,
      onError,
    });
  });
  return { ...rendered, onPersisted, onSaved, onError };
}

describe('widget profile save lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEditorState.mockReset().mockResolvedValue(state);
    mockSaveProfile.mockReset().mockResolvedValue(profile);
    mockFocused = true;
    mockMasked = false;
    mockAppStateChanged = undefined;
  });
  afterEach(cleanup);

  it('clears pending state when a save settles under a different modal', async () => {
    const pending = pendingValue<IMarketWidgetProfile>();
    mockSaveProfile.mockReturnValue(pending.promise);
    const { result, rerender, onSaved } = setup();
    act(() => {
      void result.current.save();
    });
    await waitFor(() => expect(mockSaveProfile).toHaveBeenCalledTimes(1));
    mockFocused = false;
    rerender();
    await act(async () => {
      pending.resolve(profile);
    });
    expect(result.current.isSaving).toBe(false);
    await act(async () => {
      mockFocused = true;
      rerender();
    });
    expect(result.current.isSaving).toBe(false);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('does not navigate when an old save resolves after returning to the same editor', async () => {
    const pending = pendingValue<IMarketWidgetProfile>();
    mockSaveProfile.mockReturnValue(pending.promise);
    const { result, rerender, onSaved } = setup();
    act(() => {
      void result.current.save();
    });
    await waitFor(() => expect(mockSaveProfile).toHaveBeenCalledTimes(1));
    mockFocused = false;
    rerender();
    await act(async () => {
      mockFocused = true;
      rerender();
    });
    await act(async () => {
      pending.resolve(profile);
    });
    expect(result.current.isSaving).toBe(false);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it.each(['background', 'blur'])(
    'updates the same newly persisted profile after %s interrupts its acknowledgement',
    async (interruption) => {
      const pending = pendingValue<IMarketWidgetProfile>();
      const persisted: IMarketWidgetProfile[] = [];
      const created = {
        ...profile,
        id: '4bdfeb88-a55d-4a91-bedb-df13acfaea39',
      };
      mockGetEditorState.mockImplementation(async () => ({
        ...state,
        profiles: [...persisted],
      }));
      mockSaveProfile
        .mockImplementationOnce(() => {
          persisted.push(created);
          return pending.promise;
        })
        .mockImplementationOnce(async (input) => {
          expect(input).toMatchObject({ id: created.id });
          return created;
        });
      const { result, rerender, onPersisted, onSaved } = setup(
        async () => true,
        { name: profile.name, kind: profile.kind, source: profile.source },
      );
      act(() => {
        void result.current.save();
      });
      await waitFor(() => expect(mockSaveProfile).toHaveBeenCalledTimes(1));
      act(() => {
        if (interruption === 'background') {
          mockAppStateChanged?.('background');
        } else {
          mockFocused = false;
          rerender();
        }
      });
      await act(async () => {
        pending.resolve(created);
      });
      expect(onPersisted).toHaveBeenCalledWith(created);
      expect(onSaved).not.toHaveBeenCalled();
      expect(result.current.isSaving).toBe(false);
      await act(async () => {
        if (interruption === 'background') {
          mockAppStateChanged?.('active');
        } else {
          mockFocused = true;
          rerender();
        }
      });
      await act(async () => {
        await result.current.save();
      });
      expect(mockSaveProfile).toHaveBeenCalledTimes(2);
      expect(persisted).toHaveLength(1);
      expect(onSaved).toHaveBeenCalledTimes(1);
    },
  );

  it('refreshes a refocused editor when an older creation succeeds', async () => {
    const pending = pendingValue<IMarketWidgetProfile>();
    mockSaveProfile.mockReturnValueOnce(pending.promise);
    const { result, rerender, onPersisted, onSaved } = setup(async () => true, {
      name: profile.name,
      kind: profile.kind,
      source: profile.source,
    });
    act(() => {
      void result.current.save();
    });
    await waitFor(() => expect(mockSaveProfile).toHaveBeenCalledTimes(1));
    mockFocused = false;
    rerender();
    await act(async () => {
      mockFocused = true;
      rerender();
    });
    const readsBeforeCompletion = mockGetEditorState.mock.calls.length;
    await act(async () => {
      pending.resolve(profile);
    });
    expect(onPersisted).toHaveBeenCalledWith(profile);
    expect(mockGetEditorState.mock.calls.length).toBe(
      readsBeforeCompletion + 1,
    );
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('does not infer a persisted identity from an ambiguous failure', async () => {
    mockSaveProfile.mockRejectedValueOnce(new Error('Native response lost'));
    const { result, onPersisted, onError } = setup(async () => true, {
      name: profile.name,
      kind: profile.kind,
      source: profile.source,
    });
    await act(async () => {
      await result.current.save();
    });
    expect(onError).toHaveBeenLastCalledWith('failed');
    expect(onPersisted).not.toHaveBeenCalled();
    expect(result.current.isSaving).toBe(false);
  });

  it('does not start persistence if the editor is left during async validation', async () => {
    const validation = pendingValue<boolean>();
    const { result, rerender, onSaved } = setup(() => validation.promise);
    act(() => {
      void result.current.save();
    });
    mockFocused = false;
    rerender();
    await act(async () => {
      mockFocused = true;
      rerender();
    });
    await act(async () => {
      validation.resolve(true);
    });
    expect(mockSaveProfile).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(result.current.isSaving).toBe(false);
  });

  it('checks native privacy again before writing', async () => {
    const { result, unmount } = setup();
    mockGetEditorState.mockResolvedValue({ ...state, privacyMasked: true });
    await act(async () => {
      await result.current.save();
    });
    expect(mockSaveProfile).not.toHaveBeenCalled();
    unmount();
    expect(mockSaveProfile).not.toHaveBeenCalled();
  });

  it('persists only on Save and completes the active editor once', async () => {
    const first = setup();
    await act(async () => {
      await Promise.resolve();
    });
    first.unmount();
    expect(mockSaveProfile).not.toHaveBeenCalled();
    const second = setup();
    await act(async () => {
      await second.result.current.save();
    });
    expect(mockSaveProfile).toHaveBeenCalledTimes(1);
    expect(mockSaveProfile).toHaveBeenCalledWith(profile);
    expect(second.onSaved).toHaveBeenCalledTimes(1);
    expect(second.result.current.isSaving).toBe(false);
  });
});
