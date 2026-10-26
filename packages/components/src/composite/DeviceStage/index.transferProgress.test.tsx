/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { DeviceStage } from '.';

import { render, screen } from '@testing-library/react';

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
    Haptics: { impact: jest.fn(), error: jest.fn() },
    ImpactFeedbackStyle: { Light: 'light' },
  };
});
jest.mock('../MorphOverlay', () => ({
  MorphOverlay: ({ capsule }: { capsule: ReactNode }) => capsule,
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
  expect(screen.getByText('0%')).toBeTruthy();
  expect(bar.getAttribute('aria-valuenow')).toBe('0');
  rerender(<DeviceStage step="processing" transferProgress={42} />);
  expect(screen.getByRole('progressbar')).toBe(bar);
  expect(screen.getByText('42%')).toBeTruthy();
  expect(bar.firstElementChild?.getAttribute('data-width')).toBe('42%');
  rerender(<DeviceStage step="processing" transferProgress={100} />);
  expect(screen.getByText('100%')).toBeTruthy();
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
