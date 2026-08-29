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

jest.mock('@tamagui/web', () => ({
  useTheme: () => mockUseTamaguiTheme(),
  useThemeName: () => mockUseTamaguiThemeName(),
}));
jest.mock('@tamagui/core', () => ({}));
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

describe('useTheme', () => {
  beforeEach(() => {
    mockUseTamaguiTheme.mockClear();
    mockUseTamaguiThemeName.mockClear();
  });

  it('subscribes to theme name changes for raw theme value consumers', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current).toBe(mockTheme);
    expect(mockUseTamaguiTheme).toHaveBeenCalledTimes(1);
    expect(mockUseTamaguiThemeName).toHaveBeenCalledTimes(1);
  });
});
