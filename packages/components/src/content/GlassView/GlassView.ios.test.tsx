/**
 * @jest-environment jsdom
 */

import { render } from '@testing-library/react';

import type { GlassViewProps } from 'expo-glass-effect';

const mockRenderedProps: GlassViewProps[] = [];
let mockThemeName = 'light';

jest.mock('expo-glass-effect', () => ({
  __esModule: true,
  GlassView: (props: GlassViewProps) => {
    mockRenderedProps.push(props);
    return null;
  },
  isLiquidGlassAvailable: () => true,
}));

jest.mock('../../hooks/useStyle', () => ({
  __esModule: true,
  useThemeName: () => mockThemeName,
}));

const glassViewModule: typeof import('./index.ios') = require('./index.ios');

const { GlassView } = glassViewModule;

describe('GlassView (iOS)', () => {
  beforeEach(() => {
    mockRenderedProps.length = 0;
  });

  it.each([
    ['light', 'light'],
    ['dark', 'dark'],
  ])('follows the %s app theme by default', (themeName, colorScheme) => {
    mockThemeName = themeName;

    render(<GlassView isInteractive glassEffectStyle="regular" />);

    expect(mockRenderedProps.at(-1)).toMatchObject({
      colorScheme,
      isInteractive: true,
      glassEffectStyle: 'regular',
    });
  });

  it('keeps an explicit colorScheme', () => {
    mockThemeName = 'dark';

    render(<GlassView colorScheme="auto" />);

    expect(mockRenderedProps.at(-1)?.colorScheme).toBe('auto');
  });
});
