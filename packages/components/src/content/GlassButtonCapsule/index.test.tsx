/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
import type { PropsWithChildren } from 'react';

import { GlassButtonCapsule as FallbackCapsule } from '.';

import { fireEvent, render, screen } from '@testing-library/react';

import { NavCloseButton } from '../../layouts/Navigation/Header/HeaderBackButton';
import {
  GlassHeaderProvider,
  useInGlassHeader,
} from '../../primitives/Button/GlassHeaderContext';

import { GlassButtonCapsule } from './index.ios';

let mockGlassAvailable = true;

jest.mock('../GlassView', () => ({
  isLiquidGlassAvailable: () => mockGlassAvailable,
  GlassView: ({
    children,
    isInteractive,
    glassEffectStyle,
  }: PropsWithChildren<{
    isInteractive?: boolean;
    glassEffectStyle?: string;
  }>) => (
    <div
      data-testid="glass-surface"
      data-interactive={isInteractive}
      data-effect={glassEffectStyle}
    >
      {children}
    </div>
  ),
}));
jest.mock('../../utils/getFontSize', () => ({}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { ui: { button: { click: jest.fn() } } },
}));
jest.mock('../../primitives', () => ({
  ButtonFrame: MockButtonFrame,
  Icon: () => null,
  getSharedButtonStyles: () => ({}),
  XStack: ({
    children,
    px,
    py,
  }: PropsWithChildren<{ px: string; py: string }>) => (
    <div data-testid="capsule-inset" data-px={px} data-py={py}>
      {children}
    </div>
  ),
}));
jest.mock('@react-navigation/elements', () => ({
  HeaderHeightContext: jest
    .requireActual<typeof import('react')>('react')
    .createContext<number | undefined>(undefined),
}));
jest.mock('react-native-safe-area-context', () => ({}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {},
}));

function MockButtonFrame({ onPress }: { onPress: () => void }) {
  const inGlass = useInGlassHeader();
  return (
    <button type="button" data-in-glass={inGlass} onClick={onPress}>
      Close
    </button>
  );
}

beforeEach(() => {
  mockGlassAvailable = true;
});

afterEach(() => {
  jest.useRealTimers();
});

it('closes immediately and ignores repeated presses inside the glass capsule', () => {
  jest.useFakeTimers();
  const onClose = jest.fn();
  const nextClose = jest.fn();
  const capsule = (close: () => void) => (
    <GlassButtonCapsule circular>
      <NavCloseButton onPress={close} />
    </GlassButtonCapsule>
  );
  const { rerender } = render(capsule(onClose));
  expect(screen.getByTestId('glass-surface').dataset).toMatchObject({
    interactive: 'true',
    effect: 'regular',
  });
  expect(screen.getByTestId('capsule-inset').dataset).toMatchObject({
    px: '$1',
    py: '$1',
  });
  const button = screen.getByRole('button');
  expect(button.dataset.inGlass).toBe('true');
  fireEvent.click(button);
  expect(onClose).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(200);
  rerender(capsule(nextClose));
  fireEvent.click(button);
  jest.advanceTimersByTime(300);
  expect(nextClose).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent.click(button);
  expect(nextClose).toHaveBeenCalledTimes(1);
});

it('keeps the existing grouped-header capsule spacing', () => {
  render(<GlassButtonCapsule>Header actions</GlassButtonCapsule>);
  expect(screen.getByTestId('capsule-inset').dataset.px).toBe('$1.5');
});

it('keeps the original close control and context when glass is unavailable', () => {
  mockGlassAvailable = false;
  const onClose = jest.fn();
  render(
    <GlassButtonCapsule circular>
      <NavCloseButton onPress={onClose} />
    </GlassButtonCapsule>,
  );
  expect(screen.queryByTestId('glass-surface')).toBeNull();
  expect(screen.queryByTestId('capsule-inset')).toBeNull();
  expect(screen.getByRole('button').dataset.inGlass).toBe('false');
  fireEvent.click(screen.getByRole('button'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('keeps other platforms as a passthrough without changing ancestor context', () => {
  render(
    <GlassHeaderProvider>
      <FallbackCapsule circular>
        <NavCloseButton onPress={jest.fn()} />
      </FallbackCapsule>
    </GlassHeaderProvider>,
  );
  expect(screen.queryByTestId('glass-surface')).toBeNull();
  expect(screen.queryByTestId('capsule-inset')).toBeNull();
  expect(screen.getByRole('button').dataset.inGlass).toBe('true');
});
