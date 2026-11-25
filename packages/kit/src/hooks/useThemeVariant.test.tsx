import type { PropsWithChildren } from 'react';

import { act, renderHook } from '@testing-library/react-native';
import { Provider, createStore } from 'jotai';
import { Appearance } from 'react-native';

import {
  settingsAtomInitialValue,
  settingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import type { ISettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useThemeVariant } from './useThemeVariant';

// Keep the real settings selector, Jotai wrappers and React subscription. Only
// replace persistence and unrelated startup resources with in-memory fixtures.
jest.mock('@onekeyhq/kit-bg/src/states/jotai/jotaiStorage', () => ({
  atomWithStorage: <T,>(_key: string, initialValue: T) => {
    const { atom }: typeof import('jotai') = require('jotai');
    return atom(initialValue);
  },
  globalJotaiStorageReadyHandler: { ready: Promise.resolve() },
}));
jest.mock('@onekeyhq/shared/src/appGlobals', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDesktop: false },
}));
jest.mock('@onekeyhq/shared/src/utils/miscUtils', () => ({
  generateUUID: () => 'theme-test-fixture',
}));
jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheUtils: {},
}));
jest.mock('@onekeyhq/shared/src/config/appConfig', () => ({
  defaultColorScheme: 'light',
}));
jest.mock('react-native', () => ({
  ...jest.requireActual<typeof import('react-native')>('react-native'),
  Appearance: {
    getColorScheme: jest.fn(),
    addChangeListener: jest.fn(),
  },
}));

describe.each([
  { name: 'standard platform delay', isDesktop: false, delay: 500 },
  { name: 'desktop immediate updates', isDesktop: true, delay: 0 },
])('useThemeVariant: $name', ({ isDesktop, delay }) => {
  let store: ReturnType<typeof createStore>;
  let onChange: (preferences: Appearance.AppearancePreferences) => void;
  let remove: jest.Mock;

  const updateSettings = async (patch: Partial<ISettingsPersistAtom>) => {
    await act(async () => {
      await Promise.resolve(
        store.set(settingsPersistAtom.atom(), {
          ...store.get(settingsPersistAtom.atom()),
          ...patch,
        }),
      );
    });
  };

  const changeSystemTheme = (
    colorScheme: Appearance.AppearancePreferences['colorScheme'],
  ) => {
    act(() => onChange({ colorScheme }));
  };

  const settleSystemTheme = () => {
    act(() => jest.advanceTimersByTime(delay));
  };

  function Wrapper({ children }: PropsWithChildren) {
    return <Provider store={store}>{children}</Provider>;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    platformEnv.isDesktop = isDesktop;
    store = createStore();
    remove = jest.fn();
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('light');
    jest
      .spyOn(Appearance, 'addChangeListener')
      .mockImplementation((listener) => {
        onChange = listener;
        return { remove };
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('does not render a theme consumer for unrelated settings changes', async () => {
    const rendered = jest.fn();
    const { result } = renderHook(
      () => {
        const theme = useThemeVariant();
        rendered(theme);
        return theme;
      },
      { wrapper: Wrapper },
    );
    rendered.mockClear();

    for (const selectedBrowserTab of [
      ETranslations.global_market,
      ETranslations.global_earn,
      ETranslations.global_browser,
      ETranslations.global_market,
    ]) {
      await updateSettings({ selectedBrowserTab });
    }
    await updateSettings({ locale: 'en-US' });
    await updateSettings({ currencyInfo: { id: 'eur', symbol: '€' } });

    expect(store.get(settingsPersistAtom.atom()).selectedBrowserTab).toBe(
      ETranslations.global_market,
    );
    expect(result.current).toBe('light');
    expect(rendered).not.toHaveBeenCalled();
  });

  it('updates for every actual theme change and ignores repeated values', async () => {
    const rendered = jest.fn();
    const { result } = renderHook(
      () => {
        const theme = useThemeVariant();
        rendered(theme);
        return theme;
      },
      { wrapper: Wrapper },
    );

    for (const theme of ['dark', 'light', 'system', 'dark', 'light'] as const) {
      await updateSettings({ theme });
      expect(result.current).toBe(theme === 'system' ? 'light' : theme);
      rendered.mockClear();
      await updateSettings({ theme });
      expect(rendered).not.toHaveBeenCalled();
    }
  });

  it('follows live system changes in Auto and preserves the platform delay', () => {
    const { result } = renderHook(() => useThemeVariant(), {
      wrapper: Wrapper,
    });
    expect(result.current).toBe('light');

    changeSystemTheme('dark');
    expect(result.current).toBe(isDesktop ? 'dark' : 'light');
    settleSystemTheme();
    expect(result.current).toBe('dark');
    changeSystemTheme('light');
    settleSystemTheme();
    expect(result.current).toBe('light');
  });

  it('keeps explicit Light/Dark across system changes and resumes Auto', async () => {
    const { result } = renderHook(() => useThemeVariant(), {
      wrapper: Wrapper,
    });
    await updateSettings({ theme: 'light' });
    changeSystemTheme('dark');
    settleSystemTheme();
    expect(result.current).toBe('light');
    await updateSettings({ theme: 'system' });
    expect(result.current).toBe('dark');
    await updateSettings({ theme: 'dark' });
    changeSystemTheme('light');
    settleSystemTheme();
    expect(result.current).toBe('dark');
    await updateSettings({ theme: 'system' });
    expect(result.current).toBe('light');
  });

  it('uses the default when the system does not report a color scheme', () => {
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue(null);
    const { result } = renderHook(() => useThemeVariant(), {
      wrapper: Wrapper,
    });
    expect(result.current).toBe('light');
    changeSystemTheme('dark');
    settleSystemTheme();
    expect(result.current).toBe('dark');
    changeSystemTheme('unspecified');
    settleSystemTheme();
    expect(result.current).toBe('light');
  });

  it('settles rapid system changes to the final scheme and removes its listener', () => {
    const { result, unmount } = renderHook(() => useThemeVariant(), {
      wrapper: Wrapper,
    });
    changeSystemTheme('dark');
    changeSystemTheme('light');
    changeSystemTheme('dark');
    settleSystemTheme();
    expect(result.current).toBe('dark');

    changeSystemTheme('light');
    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('starts from the persisted theme instead of the system scheme', async () => {
    await Promise.resolve(
      store.set(settingsPersistAtom.atom(), {
        ...settingsAtomInitialValue,
        theme: 'dark',
      }),
    );
    const { result } = renderHook(() => useThemeVariant(), {
      wrapper: Wrapper,
    });
    expect(result.current).toBe('dark');
  });
});
