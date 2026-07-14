/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { DESKTOP_OFFLINE_CHART_ENTRY_URL } from '@onekeyhq/shared/src/consts/desktopChartConsts';

import { useTradingViewUrl } from './useTradingViewUrl';

const mockDevSettings = {
  enabled: true,
  settings: { useLocalTradingViewUrl: true },
};

jest.mock('expo-localization', () => ({
  useCalendars: () => [],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings', () => ({
  useDevSettingsPersistAtom: () => [mockDevSettings],
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    appPlatform: 'desktop',
    isDesktop: true,
    isNativeAndroid: false,
    version: '1.0.0',
  },
}));

jest.mock('../../../hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => 'en-US',
}));

jest.mock('../../../hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'dark',
}));

jest.mock('../utils/desktopOfflineChartReady', () => ({
  useDesktopOfflineChartReady: () => true,
}));

jest.mock('../utils/tradingViewTimezone', () => ({
  getTradingViewTimezone: () => 'Etc/UTC',
}));

describe('useTradingViewUrl', () => {
  it('keeps the local chart override for normal development charts', () => {
    const { result } = renderHook(() => useTradingViewUrl());

    expect(result.current.baseUrl).toBe('http://localhost:5173/');
    expect(result.current.isOfflineChart).toBe(false);
  });

  it('forces migration hosts onto the packaged offline chart origin', () => {
    const { result } = renderHook(() =>
      useTradingViewUrl({ forceDesktopOfflineChart: true }),
    );

    expect(result.current.baseUrl).toBe(DESKTOP_OFFLINE_CHART_ENTRY_URL);
    expect(result.current.isOfflineChart).toBe(true);
  });
});
