/** @jest-environment jsdom */

import React, { type ReactNode } from 'react';

import { act, render, screen } from '@testing-library/react';

import { LightweightChart } from './index.native';

let mockSkiaModuleFails = false;
let mockOnSkiaError: (() => void) | undefined;
const mockLoadSkiaModule = jest.fn();
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOSMacCatalyst: false },
}));
jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/sentry', () => ({
  initSentry: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('./LightweightChart.native', () => {
  mockLoadSkiaModule();
  if (mockSkiaModuleFails) {
    const { OneKeyLocalError: MockSkiaError } = jest.requireActual<
      typeof import('@onekeyhq/shared/src/errors')
    >('@onekeyhq/shared/src/errors');
    throw new MockSkiaError('Skia initialization failed');
  }
  return {
    LightweightChart: function MockSkiaChart({
      onSkiaError,
    }: {
      onSkiaError: () => void;
    }) {
      mockOnSkiaError = onSkiaError;
      return <div data-testid="skia-chart" />;
    },
  };
});
jest.mock('@onekeyhq/components', () => ({
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SizableText: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const fallbackText = 'Charts are not supported on this device.';

test('displays text when the Skia module throws during initialization', () => {
  mockSkiaModuleFails = true;

  // Isolate the first load because the adapter caches its result.
  jest.isolateModules(() => {
    jest.doMock('react', () => React);
    const { LightweightChart: Chart } =
      require('./index.native') as typeof import('./index.native');
    render(<Chart data={[[100, 1]]} height={200} />, {
      onCaughtError: jest.fn(),
    });
  });
  jest.dontMock('react');

  expect(mockLoadSkiaModule).toHaveBeenCalled();
  expect(screen.getByText(fallbackText)).toBeTruthy();
});

test('replaces Skia with text after a mapper fails', () => {
  mockSkiaModuleFails = false;
  render(<LightweightChart data={[[100, 1]]} height={200} />);
  expect(screen.getByTestId('skia-chart')).toBeTruthy();

  act(() => mockOnSkiaError?.());

  expect(screen.queryByTestId('skia-chart')).toBeNull();
  expect(screen.getByText(fallbackText)).toBeTruthy();
});
