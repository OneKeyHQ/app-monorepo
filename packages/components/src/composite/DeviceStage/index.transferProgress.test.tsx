/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { DeviceStage } from '.';

import { render, screen } from '@testing-library/react';

let mockKeepExitingCapsule = false;

jest.mock('../../content/deviceScene', () => ({
  easeOutFn: (value: number) => value,
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('react-native', () => ({
  View: 'div',
  Keyboard: { dismiss: jest.fn() },
  AccessibilityInfo: { announceForAccessibility: jest.fn() },
  PixelRatio: { get: () => 1 },
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'div' },
  Extrapolation: { CLAMP: 'clamp' },
  interpolate: () => 0,
  useAnimatedStyle: () => ({}),
  useSharedValue: (value: number) => ({ value }),
  withTiming: (value: number) => value,
}));
jest.mock('../../primitives', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Box = ({
    children,
    testID,
    accessibilityRole,
    accessibilityValue,
    width,
  }: {
    children?: ReactNode;
    testID?: string;
    accessibilityRole?: string;
    accessibilityValue?: { now: number };
    width?: string;
  }) =>
    React.createElement(
      'div',
      {
        'data-testid': testID,
        role: accessibilityRole,
        'aria-valuenow': accessibilityValue?.now,
        'data-width': width,
      },
      children,
    );
  return {
    Button: Box,
    Icon: Box,
    Image: Box,
    SizableText: Box,
    Stack: Box,
    XStack: Box,
    YStack: Box,
    Haptics: { impact: jest.fn(), error: jest.fn(), success: jest.fn() },
    ImpactFeedbackStyle: { Light: 'light' },
  };
});
jest.mock('../MorphOverlay', () => ({
  MorphOverlay: ({
    capsule,
    capsuleKey,
  }: {
    capsule: ReactNode;
    capsuleKey: string;
  }) => {
    const { useRef } = jest.requireActual<typeof import('react')>('react');
    const previous = useRef({ key: capsuleKey, node: capsule });
    const exiting = useRef<ReactNode>(undefined);
    if (previous.current.key !== capsuleKey && mockKeepExitingCapsule) {
      exiting.current = previous.current.node;
    }
    previous.current = { key: capsuleKey, node: capsule };
    return (
      <>
        {mockKeepExitingCapsule ? exiting.current : null}
        {capsule}
      </>
    );
  },
  useMorphOverlay: ({ value, key }: { value: string; key: string }) => ({
    shown: value,
    shownKey: key,
    swapFade: { value: 1 },
    progress: { value: 0 },
    width: { value: 200 },
    reveal: { value: 1 },
    pillSize: { width: 200, height: 76 },
    reducedMotion: true,
  }),
  CARD: { padTop: 16 },
  PILL: { pad: 16 },
  arrangeEase: (value: number) => value,
  stageBgAlpha: () => 0,
}));
jest.mock('../../content/HardwareDevice', () => ({
  HardwareDevice: () => null,
}));
jest.mock('../../content/LinearGradient', () => ({
  LinearGradient: () => null,
}));
jest.mock('./AppInputs', () => ({
  PinPad: () => null,
  PassphraseForm: () => null,
}));
jest.mock('./AuthPanels', () => ({
  AuthChecklist: () => null,
  AuthFailureCard: () => null,
}));
jest.mock('./BluetoothBadge', () => ({ BluetoothBadge: () => null }));
jest.mock('./CardValue', () => ({ CardValue: () => null }));
jest.mock('./PassphraseIntro', () => ({ PassphraseIntro: () => null }));
jest.mock('./QrPanels', () => ({
  QrPresent: () => null,
  QrScanFrame: () => null,
}));
jest.mock('./ShimmerTitle', () => ({
  ShimmerTitle: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('./StepText', () => ({ StepText: () => null }));
jest.mock('./ThirdPartyPanels', () => ({
  InstallChecklist: () => null,
  InstallProgress: () => null,
  PairingCodeForm: () => null,
}));
jest.mock('./WalletTypeOptions', () => ({ WalletTypeOptions: () => null }));

it('renders SDK file-write progress and updates the same progress bar', () => {
  const { rerender } = render(
    <DeviceStage step="processing" transferProgress={0} />,
  );
  const bar = screen.getByRole('progressbar');
  expect(screen.queryByText('0%')).toBeNull();
  expect(bar.getAttribute('aria-valuenow')).toBe('0');
  rerender(<DeviceStage step="processing" transferProgress={42} />);
  expect(screen.getByRole('progressbar')).toBe(bar);
  expect(screen.queryByText('42%')).toBeNull();
  expect(bar.firstElementChild?.getAttribute('data-width')).toBe('42%');
  rerender(<DeviceStage step="processing" transferProgress={100} />);
  expect(screen.queryByText('100%')).toBeNull();
  expect(bar.getAttribute('aria-valuenow')).toBe('100');
});

it('shows progress only for the file-transfer processing step', () => {
  const { rerender } = render(<DeviceStage step="processing" />);
  expect(screen.queryByRole('progressbar')).toBeNull();
  rerender(<DeviceStage step="processing" transferProgress={NaN} />);
  expect(screen.queryByRole('progressbar')).toBeNull();
  rerender(<DeviceStage step="confirm" transferProgress={42} />);
  expect(screen.queryByRole('progressbar')).toBeNull();
  rerender(<DeviceStage step="enterPin" transferProgress={42} />);
  expect(screen.queryByRole('progressbar')).toBeNull();
});

it('removes the completed transfer bar before the success capsule resizes', () => {
  mockKeepExitingCapsule = true;
  try {
    const { rerender } = render(
      <DeviceStage step="processing" transferProgress={100} />,
    );
    expect(screen.getByRole('progressbar')).toBeTruthy();
    rerender(<DeviceStage step="done" />);
    expect(screen.queryByRole('progressbar')).toBeNull();
  } finally {
    mockKeepExitingCapsule = false;
  }
});

const transferTestMetrics = {
  transferredBytes: 32 * 1024,
  totalBytes: 128 * 1024,
  rateBytesPerSecond: 16 * 1024,
  retryCount: 1,
};

it('shows only communicating status and a progress bar, then replaces them with confirmation', () => {
  const { rerender } = render(
    <DeviceStage
      step="processing"
      transferProgress={25}
      transferMetrics={transferTestMetrics}
    />,
  );
  expect(screen.getByText('communication.communicating')).toBeTruthy();
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
    '25',
  );
  expect(screen.queryByText(/KiB|MiB|global.retry|25%/)).toBeNull();
  rerender(
    <DeviceStage
      step="confirm"
      transferProgress={100}
      transferMetrics={transferTestMetrics}
    />,
  );
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.queryByText('32.0 KiB / 128.0 KiB')).toBeNull();
  expect(screen.queryByText('global.retry 1 · 16.0 KiB/s')).toBeNull();
});
