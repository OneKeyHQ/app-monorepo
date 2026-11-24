/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, screen } from '@testing-library/react';

import { LightweightChart } from './index.native';

let mockIsCatalyst = true;
let mockSkiaModuleFails = false;
let mockOnSkiaError: (() => void) | undefined;
const mockLoadSkiaModule = jest.fn();
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNativeIOSMacCatalyst() {
      return mockIsCatalyst;
    },
  },
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

test('Catalyst displays text without initializing Skia', () => {
  render(<LightweightChart data={[[100, 1]]} height={200} />);

  expect(mockLoadSkiaModule).not.toHaveBeenCalled();
  expect(screen.getByText(fallbackText)).toBeTruthy();
});

test('the shared entry loads the original chart without evaluating native implementations', () => {
  jest.isolateModules(() => {
    const originalChart = () => null;
    jest.doMock('./LightweightChart', () => ({
      LightweightChart: originalChart,
    }));
    const {
      LightweightChart: SharedChart,
    }: typeof import('./index') = require('./index');
    expect(SharedChart).toBe(originalChart);
  });
});

test('displays text when the Skia module throws during initialization', () => {
  mockIsCatalyst = false;
  mockSkiaModuleFails = true;

  render(<LightweightChart data={[[100, 1]]} height={200} />, {
    onCaughtError: jest.fn(),
  });

  expect(mockLoadSkiaModule).toHaveBeenCalled();
  expect(screen.getByText(fallbackText)).toBeTruthy();
});

test('replaces Skia with text after a mapper fails', () => {
  mockIsCatalyst = false;
  mockSkiaModuleFails = false;
  render(<LightweightChart data={[[100, 1]]} height={200} />);
  expect(screen.getByTestId('skia-chart')).toBeTruthy();

  act(() => mockOnSkiaError?.());

  expect(screen.queryByTestId('skia-chart')).toBeNull();
  expect(screen.getByText(fallbackText)).toBeTruthy();
});
