/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { useSharedValue } from 'react-native-reanimated';

import { OrbShader } from './OrbShader';
import { OrbShader as NativeOrbShader } from './OrbShader.native';

let mockInitializationFails = false;
let mockIsMacCatalyst = false;
let mockReduceMotion = false;
const mockCompileShader = jest.fn(() => null);

jest.mock('@shopify/react-native-skia/lib/module/web', () => {
  const { useLayoutEffect } =
    jest.requireActual<typeof import('react')>('react');
  const { OneKeyLocalError } = jest.requireMock<
    typeof import('@onekeyhq/shared/src/errors')
  >('@onekeyhq/shared/src/errors');
  return {
    WithSkiaWeb: function MockSkiaWeb() {
      useLayoutEffect(() => {
        if (mockInitializationFails) {
          throw new OneKeyLocalError('Could not create a WebGL context');
        }
      }, []);
      return <canvas data-testid="skia-orb" />;
    },
  };
});

jest.mock('canvaskit-wasm/bin/full/canvaskit.wasm', () => 'canvaskit.wasm');

jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
}));

jest.mock('react-native-reanimated', () => ({
  useDerivedValue: jest.fn(),
  useReducedMotion: () => mockReduceMotion,
  useSharedValue: (value: number) => ({ value }),
}));

jest.mock('@onekeyhq/components', () => ({
  Image: function MockImage({
    testID,
    autoplay,
    onError,
  }: {
    testID: string;
    autoplay?: boolean;
    onError: () => void;
  }) {
    return (
      <img
        alt=""
        data-testid={testID}
        data-autoplay={autoplay}
        onError={onError}
      />
    );
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNativeIOSMacCatalyst() {
      return mockIsMacCatalyst;
    },
  },
}));

jest.mock('@onekeyhq/shared/src/errors', () => ({
  OneKeyLocalError: Error,
}));

jest.mock('@shopify/react-native-skia', () => ({
  Skia: { RuntimeEffect: { Make: mockCompileShader } },
  useClock: () => ({ value: 0 }),
}));

jest.mock('@onekeyhq/shared/src/modules3rdParty/sentry', () => ({
  captureException: jest.fn(),
  initSentry: jest.fn(),
}));

function SetupContent({ native = false }: { native?: boolean }) {
  const intensity = useSharedValue(1);
  const Orb = native ? NativeOrbShader : OrbShader;
  return (
    <>
      <Orb intensity={intensity} />
      <button type="button">Enter wallet</button>
    </>
  );
}

beforeEach(() => {
  mockInitializationFails = false;
  mockIsMacCatalyst = false;
  mockReduceMotion = false;
  mockCompileShader.mockClear();
});

it('keeps wallet setup mounted when Skia throws while initializing WebGL', () => {
  mockInitializationFails = true;
  const onCaughtError = jest.fn();

  render(<SetupContent />, { onCaughtError });

  expect(
    screen.getByTestId('onboarding-orb-fallback').closest('picture'),
  ).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Enter wallet' })).toBeTruthy();
  expect(screen.queryByTestId('skia-orb')).toBeNull();
  expect(onCaughtError).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'Could not create a WebGL context' }),
    expect.any(Object),
  );
});

it('switches away from the Skia canvas when the context is lost', () => {
  render(<SetupContent />);

  expect(screen.queryByTestId('onboarding-orb-fallback')).toBeNull();
  fireEvent(screen.getByTestId('skia-orb'), new Event('webglcontextlost'));

  expect(screen.getByTestId('onboarding-orb-fallback')).toBeTruthy();
  expect(screen.queryByTestId('skia-orb')).toBeNull();
  expect(screen.getByRole('button', { name: 'Enter wallet' })).toBeTruthy();
});

it('loops the image on native platforms without Skia', () => {
  mockIsMacCatalyst = true;
  render(<SetupContent native />);

  const fallback = screen.getByTestId('onboarding-orb-fallback');
  expect(fallback.getAttribute('data-autoplay')).toBe('true');
  fireEvent.error(fallback);
  expect(fallback.getAttribute('data-autoplay')).toBe('false');
  expect(mockCompileShader).not.toHaveBeenCalled();
});

it('preserves reduced motion when the native shader cannot compile', () => {
  mockReduceMotion = true;
  render(<SetupContent native />, { onCaughtError: jest.fn() });

  expect(mockCompileShader).toHaveBeenCalled();
  expect(
    screen.getByTestId('onboarding-orb-fallback').getAttribute('data-autoplay'),
  ).toBe('false');
  expect(screen.getByRole('button', { name: 'Enter wallet' })).toBeTruthy();
});
