/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';

const mockTheme = {
  bgApp: {
    val: '#ffffff',
  },
};
const mockUseTamaguiTheme = jest.fn(() => mockTheme);
const mockUseTamaguiThemeName = jest.fn(() => 'light');
const mockUseNativeThemeNameSubscription = jest.fn();

jest.mock('@tamagui/web', () => ({
  useTheme: () => mockUseTamaguiTheme(),
  useThemeName: () => mockUseTamaguiThemeName(),
}));
jest.mock('@tamagui/core', () => ({}));
jest.mock('./useNativeThemeNameSubscription', () => ({
  useNativeThemeNameSubscription: () => {
    mockUseNativeThemeNameSubscription();
  },
}));
jest.mock('@tamagui/spacer', () => ({}));
jest.mock('@tamagui/stacks', () => ({}));
jest.mock('@tamagui/animate-presence', () => ({}));
jest.mock('@tamagui/text', () => ({}));
jest.mock('@tamagui/font-size', () => ({}));
jest.mock('@tamagui/label', () => ({}));
jest.mock('@tamagui/group', () => ({}));
jest.mock('@tamagui/toggle-group', () => ({}));
jest.mock('@tamagui/accordion', () => ({}));
jest.mock('@tamagui/dialog', () => ({}));
jest.mock('@tamagui/sheet', () => ({}));
jest.mock('@tamagui/portal', () => ({}));
jest.mock('@tamagui/toast', () => ({}));
jest.mock('@tamagui/switch', () => ({}));
jest.mock('@tamagui/slider', () => ({}));
jest.mock('@tamagui/separator', () => ({}));
jest.mock('@tamagui/radio-group', () => ({}));
jest.mock('@tamagui/focusable', () => ({}));
jest.mock('@tamagui/get-button-sized', () => ({}));
jest.mock('@tamagui/get-font-sized', () => ({}));
jest.mock('@tamagui/get-token', () => ({}));
jest.mock('@tamagui/create-context', () => ({}));
jest.mock('@tamagui/form', () => ({}));
jest.mock('./stacks', () => ({}));

const { useTheme } = require('./tamagui') as typeof import('./tamagui');
const { useNativeThemeNameSubscription } =
  require('./useNativeThemeNameSubscription.native') as typeof import('./useNativeThemeNameSubscription.native');
const { useNativeThemeNameSubscription: useWebThemeNameSubscription } =
  jest.requireActual<typeof import('./useNativeThemeNameSubscription')>(
    './useNativeThemeNameSubscription',
  );

describe('useTheme', () => {
  beforeEach(() => {
    mockUseTamaguiTheme.mockClear();
    mockUseTamaguiThemeName.mockClear();
    mockUseNativeThemeNameSubscription.mockClear();
  });

  it('delegates raw theme value refreshes to the platform subscription', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current).toBe(mockTheme);
    expect(mockUseTamaguiTheme).toHaveBeenCalledTimes(1);
    expect(mockUseNativeThemeNameSubscription).toHaveBeenCalledTimes(1);
  });

  it('subscribes native consumers to theme name changes', () => {
    renderHook(() => useNativeThemeNameSubscription());

    expect(mockUseTamaguiThemeName).toHaveBeenCalledTimes(1);
  });

  it('does not add a theme name subscription on web', () => {
    renderHook(() => useWebThemeNameSubscription());

    expect(mockUseTamaguiThemeName).not.toHaveBeenCalled();
  });
});
