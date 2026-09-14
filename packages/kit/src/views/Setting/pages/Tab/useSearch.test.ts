/** @jest-environment jsdom */

/* eslint-disable import/first */

const mockSettingsSearched = jest.fn();
const mockNavigateToSettingsTabInModal = jest.fn();
let mockLayout = {
  isTabNavigator: false,
  isMobileLayout: true,
  preferMobileNaming: true,
};

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    setting: {
      page: {
        settingsSearched: (...args: unknown[]) => {
          mockSettingsSearched(...args);
        },
      },
    },
  },
}));

jest.mock('./navigateToSettingsTab', () => ({
  navigateToSettingsTabInModal: (...args: unknown[]) => {
    mockNavigateToSettingsTabInModal(...args);
  },
}));

jest.mock('./useIsTabNavigator', () => ({
  useSettingsLayout: () => mockLayout,
}));

jest.mock('./useSettingsSearchItems', () => ({
  flattenSettingsSearchItems: (
    config: Array<{
      name: string;
      title: string;
      icon: string;
      configs: Array<Array<{ id: string; title: string } | undefined>>;
    }>,
  ) =>
    config.flatMap((category) =>
      category.configs.flat().flatMap((item) =>
        item
          ? [
              {
                ...item,
                sectionName: category.name,
                sectionTitle: category.title,
                sectionIcon: category.icon,
              },
            ]
          : [],
      ),
    ),
}));

import { act, renderHook } from '@testing-library/react';

import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ESettingsTabNames } from '@onekeyhq/shared/src/routes';

import { SETTINGS_SEARCH_LOG_IDLE_MS } from './settingsAnalytics';
import { useSearch } from './useSearch';

import type { ISettingsConfig } from './config';

const settingsConfig = [
  {
    icon: 'SettingsOutline',
    title: 'Preferences',
    name: ESettingsTabNames.Preferences,
    configs: [
      [
        {
          id: 'theme',
          title: 'Theme',
        },
      ],
    ],
  },
] as ISettingsConfig;

describe('useSearch idle logger', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockLayout = {
      isTabNavigator: false,
      isMobileLayout: true,
      preferMobileNaming: true,
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('emits settingsSearched once after idle on a theme query', () => {
    const { result } = renderHook(() => useSearch(settingsConfig));

    act(() => {
      result.current.onSearch('theme');
    });
    expect(mockSettingsSearched).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(SETTINGS_SEARCH_LOG_IDLE_MS);
    });

    expect(mockSettingsSearched).toHaveBeenCalledTimes(1);
    expect(mockSettingsSearched).toHaveBeenCalledWith({
      queryLength: 5,
      resultCount: expect.any(Number),
      topResultId: 'theme',
      layout: 'mobile',
    });
    expect(result.current.searchText).toBe('theme');
    expect(result.current.isSearching).toBe(true);
  });

  it('cancels a pending idle log when the query is cleared', () => {
    const { result } = renderHook(() => useSearch(settingsConfig));

    act(() => {
      result.current.onSearch('theme');
    });
    act(() => {
      jest.advanceTimersByTime(SETTINGS_SEARCH_LOG_IDLE_MS / 2);
    });
    act(() => {
      result.current.onSearch('');
    });
    act(() => {
      jest.advanceTimersByTime(SETTINGS_SEARCH_LOG_IDLE_MS);
    });

    expect(mockSettingsSearched).not.toHaveBeenCalled();
    expect(result.current.searchText).toBe('');
  });

  it('emits again when the same query is typed after a clear', () => {
    const { result } = renderHook(() => useSearch(settingsConfig));

    act(() => {
      result.current.onSearch('theme');
    });
    act(() => {
      jest.advanceTimersByTime(SETTINGS_SEARCH_LOG_IDLE_MS);
    });
    act(() => {
      result.current.onSearch('');
    });
    act(() => {
      result.current.onSearch('theme');
    });
    act(() => {
      jest.advanceTimersByTime(SETTINGS_SEARCH_LOG_IDLE_MS);
    });

    expect(mockSettingsSearched).toHaveBeenCalledTimes(2);
  });

  it('skips a consecutive identical query without a clear', () => {
    const { result } = renderHook(() => useSearch(settingsConfig));

    act(() => {
      result.current.onSearch('theme');
    });
    act(() => {
      jest.advanceTimersByTime(SETTINGS_SEARCH_LOG_IDLE_MS);
    });
    act(() => {
      result.current.onSearch('theme');
    });
    act(() => {
      jest.advanceTimersByTime(SETTINGS_SEARCH_LOG_IDLE_MS);
    });

    expect(mockSettingsSearched).toHaveBeenCalledTimes(1);
  });

  it('does not write searchText on the sidebar path', () => {
    mockLayout = {
      isTabNavigator: true,
      isMobileLayout: false,
      preferMobileNaming: true,
    };
    const emitToSelf = jest.spyOn(appEventBus, 'emitToSelf');
    const { result } = renderHook(() => useSearch(settingsConfig));

    act(() => {
      result.current.onSearch('theme');
    });

    expect(result.current.searchText).toBe('');
    expect(result.current.isSearching).toBe(false);
    expect(result.current.searchResult).toEqual([]);
    expect(mockNavigateToSettingsTabInModal).toHaveBeenCalledWith(
      ESettingsTabNames.Search,
    );
    expect(emitToSelf).toHaveBeenCalledWith(
      expect.objectContaining({
        type: EAppEventBusNames.SettingsSearchResult,
        cloned: false,
      }),
    );

    act(() => {
      jest.advanceTimersByTime(SETTINGS_SEARCH_LOG_IDLE_MS);
    });
    expect(mockSettingsSearched).toHaveBeenCalledTimes(1);
    expect(mockSettingsSearched).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: 'sidebar',
        topResultId: 'theme',
      }),
    );

    emitToSelf.mockRestore();
  });
});
