/** @jest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { useSharedValue } from 'react-native-reanimated';

import { OrbShader } from './OrbShader';
import { OrbShader as NativeOrbShader } from './OrbShader.native';

import type { FrameInfo } from 'react-native-reanimated';

const fallbackTestId = 'onboarding-orb-fallback';
let mockIsMacCatalyst = false;
let mockFrame: (info: FrameInfo) => void;
let mockUniforms: { readonly value: { uRot: number; uTime: number } };
const mockGetReduceMotion = jest.fn<Promise<boolean>, []>();
const mockRemoveReduceMotionListener = jest.fn();
const mockAddReduceMotionListener = jest.fn<
  { remove: () => void },
  [event: 'reduceMotionChanged', listener: (enabled: boolean) => void]
>(() => ({ remove: mockRemoveReduceMotionListener }));
const mockCompileShader = jest.fn<unknown, []>();
const mockLoadSkiaWeb = jest.fn<
  Promise<void>,
  [{ locateFile: () => string }]
>();

jest.mock('@shopify/react-native-skia/lib/module/web', () =>
  jest.requireActual<
    typeof import('@shopify/react-native-skia/lib/module/web')
  >('@shopify/react-native-skia/lib/commonjs/web/WithSkiaWeb'),
);

jest.mock('@shopify/react-native-skia/lib/commonjs/Platform', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@shopify/react-native-skia/lib/commonjs/web/LoadSkiaWeb', () => ({
  LoadSkiaWeb: (opts: { locateFile: () => string }) => mockLoadSkiaWeb(opts),
}));

jest.mock('canvaskit-wasm/bin/full/canvaskit.wasm', () => 'canvaskit.wasm');

jest.mock('react-native', () => ({
  AccessibilityInfo: {
    addEventListener: (
      ...args: Parameters<typeof mockAddReduceMotionListener>
    ) => mockAddReduceMotionListener(...args),
    isReduceMotionEnabled: () => mockGetReduceMotion(),
  },
  StyleSheet: { create: (styles: unknown) => styles },
}));

jest.mock('react-native-reanimated', () => {
  const { useState } = jest.requireActual<typeof import('react')>('react');
  return {
    useDerivedValue: (getValue: () => unknown) => ({
      get value() {
        return getValue();
      },
    }),
    useFrameCallback: (callback: (info: FrameInfo) => void) => {
      mockFrame = callback;
    },
    useSharedValue: (value: unknown) => useState(() => ({ value }))[0],
  };
});

jest.mock('@onekeyhq/components', () => ({
  Image: function MockImage({
    testID,
    source,
    width,
    height,
    autoplay,
    onError,
  }: {
    testID: string;
    source: string;
    width: number;
    height: number;
    autoplay?: boolean;
    onError?: () => void;
  }) {
    return (
      <img
        alt=""
        src={source}
        width={width}
        height={height}
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
  Canvas: function MockCanvas({ children }: React.PropsWithChildren) {
    return <canvas data-testid="skia-orb">{children}</canvas>;
  },
  Fill: function MockFill({ children }: React.PropsWithChildren) {
    return children;
  },
  Shader: function MockShader({ uniforms }: { uniforms: typeof mockUniforms }) {
    mockUniforms = uniforms;
    return null;
  },
  Skia: { RuntimeEffect: { Make: mockCompileShader } },
}));

jest.mock('@onekeyhq/shared/src/modules3rdParty/sentry', () => ({
  captureException: jest.fn(),
  initSentry: jest.fn(),
}));

function SetupContent({
  native = false,
  paused = false,
}: {
  native?: boolean;
  paused?: boolean;
}) {
  const intensity = useSharedValue(1);
  const Orb = native ? NativeOrbShader : OrbShader;
  return (
    <>
      <Orb intensity={intensity} paused={paused} size={180} />
      <button type="button">Enter wallet</button>
    </>
  );
}

const motionPreference = Object.assign(new EventTarget(), { matches: false });
const originalMatchMedia = globalThis.matchMedia;

beforeEach(() => {
  mockIsMacCatalyst = false;
  mockGetReduceMotion.mockReset().mockResolvedValue(false);
  mockAddReduceMotionListener.mockClear();
  mockRemoveReduceMotionListener.mockClear();
  mockCompileShader.mockReset().mockReturnValue({});
  mockLoadSkiaWeb.mockReset().mockResolvedValue(undefined);
  motionPreference.matches = false;
  globalThis.matchMedia = jest.fn(() => motionPreference as MediaQueryList);
});

afterEach(() => {
  globalThis.matchMedia = originalMatchMedia;
});

it('shows the still image at the supplied size until CanvasKit loads', async () => {
  let finishLoading!: () => void;
  mockLoadSkiaWeb.mockReturnValue(
    new Promise((resolve) => {
      finishLoading = resolve;
    }),
  );

  render(<SetupContent />);

  const fallback = screen.getByTestId(fallbackTestId);
  expect(fallback.hasAttribute('src')).toBe(true);
  expect(fallback.getAttribute('width')).toBe('180');
  expect(fallback.getAttribute('height')).toBe('180');
  expect(fallback.className).toBe('');
  expect(mockLoadSkiaWeb.mock.calls[0][0].locateFile()).toBe('canvaskit.wasm');
  expect(mockCompileShader).not.toHaveBeenCalled();

  await act(async () => finishLoading());

  expect(screen.getByTestId('skia-orb')).toBeTruthy();
  expect(screen.queryByTestId(fallbackTestId)).toBeNull();
});

it('keeps wallet setup mounted when CanvasKit fails to load', async () => {
  const error = new Error('Could not initialize CanvasKit');
  mockLoadSkiaWeb.mockRejectedValue(error);
  const onCaughtError = jest.fn();

  await act(async () => render(<SetupContent />, { onCaughtError }));

  expect(
    screen
      .getByTestId(fallbackTestId)
      .closest('picture')
      ?.querySelector('source')?.media,
  ).toBe('(prefers-reduced-motion: reduce)');
  expect(screen.getByRole('button', { name: 'Enter wallet' })).toBeTruthy();
  expect(screen.queryByTestId('skia-orb')).toBeNull();
  expect(onCaughtError).toHaveBeenCalledWith(error, expect.any(Object));
  expect(mockCompileShader).not.toHaveBeenCalled();
});

it('switches from the Skia canvas to the CSS orb when the context is lost', async () => {
  await act(async () =>
    render(
      <>
        <style>{`
          .onekey-onboarding-orb-image {
            animation-name: onekey-onboarding-orb-breathe;
          }
        `}</style>
        <SetupContent />
      </>,
    ),
  );

  fireEvent(screen.getByTestId('skia-orb'), new Event('webglcontextlost'));

  const fallback = screen.getByTestId(fallbackTestId);
  expect(fallback.className).toBe('onekey-onboarding-orb-image');
  expect(screen.queryByTestId('skia-orb')).toBeNull();
  expect(screen.getByRole('button', { name: 'Enter wallet' })).toBeTruthy();
});

it('honors Web reduced motion before loading CanvasKit and responds to changes', async () => {
  motionPreference.matches = true;
  render(<SetupContent />);

  expect(screen.getByTestId(fallbackTestId).className).toBe('');
  expect(mockLoadSkiaWeb).not.toHaveBeenCalled();
  expect(mockCompileShader).not.toHaveBeenCalled();

  await act(async () => {
    motionPreference.matches = false;
    motionPreference.dispatchEvent(new Event('change'));
  });
  expect(screen.getByTestId('skia-orb')).toBeTruthy();

  act(() => {
    motionPreference.matches = true;
    motionPreference.dispatchEvent(new Event('change'));
  });
  expect(screen.getByTestId(fallbackTestId).className).toBe('');
  expect(screen.queryByTestId('skia-orb')).toBeNull();
});

it('updates GIF playback on Catalyst when the live preference changes', async () => {
  mockIsMacCatalyst = true;
  await act(async () => render(<SetupContent native />));

  const fallback = screen.getByTestId(fallbackTestId);
  const [event, onMotionChange] = mockAddReduceMotionListener.mock.calls[0];
  expect(event).toBe('reduceMotionChanged');
  expect(fallback.getAttribute('data-autoplay')).toBe('true');
  act(() => onMotionChange(true));
  expect(fallback.getAttribute('data-autoplay')).toBe('false');
  fireEvent.error(fallback);
  act(() => onMotionChange(false));
  expect(fallback.getAttribute('data-autoplay')).toBe('true');
  fireEvent.error(fallback);
  expect(fallback.getAttribute('data-autoplay')).toBe('false');
  expect(mockCompileShader).not.toHaveBeenCalled();
});

it('uses the animated native fallback when the shader cannot compile', async () => {
  mockCompileShader.mockReturnValue(null);
  await act(async () =>
    render(<SetupContent native />, { onCaughtError: jest.fn() }),
  );

  expect(mockCompileShader).toHaveBeenCalled();
  expect(screen.getByTestId(fallbackTestId).getAttribute('data-autoplay')).toBe(
    'true',
  );
  expect(screen.getByRole('button', { name: 'Enter wallet' })).toBeTruthy();
});

it('starts with the still image for native reduced motion and switches renderers on change', async () => {
  mockGetReduceMotion.mockResolvedValue(true);
  await act(async () => render(<SetupContent native />));

  const fallback = screen.getByTestId(fallbackTestId);
  expect(fallback.getAttribute('width')).toBe('180');
  expect(fallback.getAttribute('height')).toBe('180');
  expect(fallback.getAttribute('data-autoplay')).toBe('false');
  expect(mockCompileShader).not.toHaveBeenCalled();
  expect(screen.queryByTestId('skia-orb')).toBeNull();

  const [, onMotionChange] = mockAddReduceMotionListener.mock.calls[0];
  act(() => onMotionChange(false));
  expect(screen.getByTestId('skia-orb')).toBeTruthy();
  act(() => onMotionChange(true));
  expect(screen.getByTestId(fallbackTestId).getAttribute('data-autoplay')).toBe(
    'false',
  );
  expect(screen.queryByTestId('skia-orb')).toBeNull();
});

it('keeps the newer native preference when the initial read resolves late', async () => {
  let resolveInitialPreference!: (value: boolean) => void;
  mockGetReduceMotion.mockReturnValue(
    new Promise((resolve) => {
      resolveInitialPreference = resolve;
    }),
  );
  const { unmount } = render(<SetupContent native />);
  expect(screen.queryByTestId('skia-orb')).toBeNull();

  const [, onMotionChange] = mockAddReduceMotionListener.mock.calls[0];
  act(() => onMotionChange(true));
  await act(async () => resolveInitialPreference(false));
  expect(screen.queryByTestId('skia-orb')).toBeNull();
  expect(mockCompileShader).not.toHaveBeenCalled();

  unmount();
  expect(mockRemoveReduceMotionListener).toHaveBeenCalledTimes(1);
});

it('holds the rotation on Ready while texture time continues and resumes from that angle', async () => {
  const { rerender } = await act(async () => render(<SetupContent native />));
  mockFrame({
    timestamp: 1000,
    timeSinceFirstFrame: 1000,
    timeSincePreviousFrame: 1000,
  });
  expect(mockUniforms.value.uRot).toBeCloseTo(0.2);

  rerender(<SetupContent native paused />);
  mockFrame({
    timestamp: 2000,
    timeSinceFirstFrame: 2000,
    timeSincePreviousFrame: 1000,
  });
  expect(mockUniforms.value.uRot).toBeCloseTo(0.2);
  expect(mockUniforms.value.uTime).toBe(2);

  rerender(<SetupContent native />);
  mockFrame({
    timestamp: 2500,
    timeSinceFirstFrame: 2500,
    timeSincePreviousFrame: 500,
  });
  expect(mockUniforms.value.uRot).toBeCloseTo(0.3);
});
