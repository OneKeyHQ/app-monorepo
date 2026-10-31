/** @jest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IMarketWidgetEditorState,
  IMarketWidgetKind,
  IMarketWidgetProfile,
} from '@onekeyhq/shared/src/modules/MarketWidget/types';

import { useMarketWidgetEditorState } from './useMarketWidgetEditorState';
import { useMarketWidgetProfileSave } from './useMarketWidgetProfileSave';

const mockGetEditorState = jest.fn<Promise<IMarketWidgetEditorState>, []>();
type ISettingsInput = Omit<IMarketWidgetProfile, 'id'>;
const mockSaveSettings = jest.fn<
  Promise<IMarketWidgetProfile>,
  [ISettingsInput]
>();
let mockPersistedSettings = new Map<IMarketWidgetKind, IMarketWidgetProfile>();
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
    saveSettings: (input: ISettingsInput) => mockSaveSettings(input),
  },
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: { isMaskingDataSync: () => mockMasked },
}));

const settings: IMarketWidgetProfile = {
  id: 'settings-list',
  name: 'Market list',
  kind: 'list',
  source: 'hot',
};
const state: IMarketWidgetEditorState = {
  profiles: [],
  settings: [settings],
  watchlist: [],
  hot: [],
  privacyMasked: false,
};

const settingsInput: ISettingsInput = {
  name: settings.name,
  kind: settings.kind,
  source: settings.source,
};

function persistSettings(input: ISettingsInput) {
  const saved = { ...input, id: `settings-${input.kind}` };
  mockPersistedSettings.set(input.kind, saved);
  return saved;
}

function pendingValue<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
}

function setup(
  validate = async () => true,
  input: ISettingsInput = settingsInput,
) {
  const onSaved = jest.fn();
  const onError = jest.fn();
  const rendered = renderHook(() => {
    const editor = useMarketWidgetEditorState();
    return useMarketWidgetProfileSave({
      editor,
      validate,
      getInput: () => input,
      onSaved,
      onError,
    });
  });
  return { ...rendered, onSaved, onError };
}

describe('widget settings save lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPersistedSettings = new Map([[settings.kind, settings]]);
    mockGetEditorState.mockReset().mockImplementation(async () => ({
      ...state,
      settings: [...mockPersistedSettings.values()],
    }));
    mockSaveSettings
      .mockReset()
      .mockImplementation(async (input) => persistSettings(input));
    mockFocused = true;
    mockMasked = false;
    mockAppStateChanged = undefined;
  });
  afterEach(cleanup);

  it('clears pending state when a save settles under a different modal', async () => {
    const pending = pendingValue<IMarketWidgetProfile>();
    mockSaveSettings.mockReturnValue(pending.promise);
    const { result, rerender, onSaved } = setup();
    act(() => {
      void result.current.save();
    });
    await waitFor(() => expect(mockSaveSettings).toHaveBeenCalledTimes(1));
    mockFocused = false;
    rerender();
    await act(async () => {
      pending.resolve(settings);
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
    mockSaveSettings.mockReturnValue(pending.promise);
    const { result, rerender, onSaved } = setup();
    act(() => {
      void result.current.save();
    });
    await waitFor(() => expect(mockSaveSettings).toHaveBeenCalledTimes(1));
    mockFocused = false;
    rerender();
    await act(async () => {
      mockFocused = true;
      rerender();
    });
    await act(async () => {
      pending.resolve(settings);
    });
    expect(result.current.isSaving).toBe(false);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it.each(['background', 'blur'])(
    'updates the same widget kind after %s interrupts its acknowledgement',
    async (interruption) => {
      const pending = pendingValue<IMarketWidgetProfile>();
      mockPersistedSettings.clear();
      mockSaveSettings.mockImplementationOnce((input) => {
        persistSettings(input);
        return pending.promise;
      });
      const input = { ...settingsInput };
      const { result, rerender, onSaved } = setup(async () => true, input);
      act(() => {
        void result.current.save();
      });
      await waitFor(() => expect(mockSaveSettings).toHaveBeenCalledTimes(1));
      act(() => {
        if (interruption === 'background') {
          mockAppStateChanged?.('background');
        } else {
          mockFocused = false;
          rerender();
        }
      });
      await act(async () => {
        pending.resolve(settings);
      });
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
      input.source = 'watchlist';
      await act(async () => {
        await result.current.save();
      });
      expect(mockSaveSettings).toHaveBeenCalledTimes(2);
      expect(mockSaveSettings).toHaveBeenLastCalledWith({
        ...settingsInput,
        source: 'watchlist',
      });
      expect(mockPersistedSettings.size).toBe(1);
      expect(mockPersistedSettings.get('list')?.source).toBe('watchlist');
      expect(onSaved).toHaveBeenCalledTimes(1);
    },
  );

  it('refreshes a refocused editor when an older save succeeds', async () => {
    const pending = pendingValue<IMarketWidgetProfile>();
    mockSaveSettings.mockReturnValueOnce(pending.promise);
    const { result, rerender, onSaved } = setup();
    act(() => {
      void result.current.save();
    });
    await waitFor(() => expect(mockSaveSettings).toHaveBeenCalledTimes(1));
    mockFocused = false;
    rerender();
    await act(async () => {
      mockFocused = true;
      rerender();
    });
    const readsBeforeCompletion = mockGetEditorState.mock.calls.length;
    await act(async () => {
      pending.resolve(settings);
    });
    expect(mockGetEditorState.mock.calls.length).toBe(
      readsBeforeCompletion + 1,
    );
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('retries the same widget kind after native persistence loses its response', async () => {
    mockPersistedSettings.clear();
    mockSaveSettings.mockImplementationOnce(async (input) => {
      persistSettings(input);
      throw new OneKeyLocalError('Native response lost');
    });
    const { result, onSaved, onError } = setup();
    await act(async () => {
      await result.current.save();
    });
    expect(onError).toHaveBeenLastCalledWith('failed');
    expect(result.current.isSaving).toBe(false);
    expect(mockPersistedSettings.size).toBe(1);
    expect(onSaved).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.save();
    });
    expect(mockSaveSettings).toHaveBeenCalledTimes(2);
    expect(mockSaveSettings.mock.calls.map(([input]) => input)).toEqual([
      settingsInput,
      settingsInput,
    ]);
    expect(mockPersistedSettings.size).toBe(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('retains an off-ranking hot coin from the settings of the same widget kind', async () => {
    const asset = {
      kind: 'asset',
      assetId: 'btc',
      symbol: 'BTC',
      name: 'Bitcoin',
    } as const;
    const single: ISettingsInput = {
      name: 'BTC',
      kind: 'single',
      source: 'hot',
      asset,
    };
    persistSettings(single);
    const { result, onSaved, onError } = setup(async () => true, single);
    await act(async () => {
      await result.current.save();
    });
    expect(mockSaveSettings).toHaveBeenCalledWith(single);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalledWith('unavailable');
  });

  it('does not use a legacy profile as the retained hot coin for type settings', async () => {
    const asset = {
      kind: 'asset',
      assetId: 'btc',
      symbol: 'BTC',
      name: 'Bitcoin',
    } as const;
    const single: ISettingsInput = {
      name: 'BTC',
      kind: 'single',
      source: 'hot',
      asset,
    };
    mockGetEditorState.mockResolvedValue({
      ...state,
      profiles: [{ ...single, id: 'old-profile' }],
      settings: [],
    });
    const { result, onSaved, onError } = setup(async () => true, single);
    await act(async () => {
      await result.current.save();
    });
    expect(mockSaveSettings).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('unavailable');
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
    expect(mockSaveSettings).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(result.current.isSaving).toBe(false);
  });

  it('checks native privacy again before writing', async () => {
    const { result, unmount } = setup();
    mockGetEditorState.mockResolvedValue({ ...state, privacyMasked: true });
    await act(async () => {
      await result.current.save();
    });
    expect(mockSaveSettings).not.toHaveBeenCalled();
    unmount();
    expect(mockSaveSettings).not.toHaveBeenCalled();
  });

  it('persists only on Save and completes the active editor once', async () => {
    const first = setup();
    await act(async () => {
      await Promise.resolve();
    });
    first.unmount();
    expect(mockSaveSettings).not.toHaveBeenCalled();
    const second = setup();
    await act(async () => {
      await second.result.current.save();
    });
    expect(mockSaveSettings).toHaveBeenCalledTimes(1);
    expect(mockSaveSettings).toHaveBeenCalledWith(settingsInput);
    expect(second.onSaved).toHaveBeenCalledTimes(1);
    expect(second.result.current.isSaving).toBe(false);
  });
});
