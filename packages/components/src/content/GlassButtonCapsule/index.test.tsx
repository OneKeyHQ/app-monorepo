/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
import type { PropsWithChildren } from 'react';

import { GlassButtonCapsule as FallbackCapsule } from '.';

import { fireEvent, render, screen } from '@testing-library/react';

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
jest.mock('../../primitives', () => ({
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
jest.mock('react-native-safe-area-context', () => ({}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {},
}));

function CloseControl({ onClose }: { onClose: () => void }) {
  const inGlass = useInGlassHeader();
  return (
    <button type="button" data-in-glass={inGlass} onClick={onClose}>
      Close
    </button>
  );
}

beforeEach(() => {
  mockGlassAvailable = true;
});

it('gives a single close control symmetric glass padding and preserves clicks', () => {
  const onClose = jest.fn();
  render(
    <GlassButtonCapsule circular>
      <CloseControl onClose={onClose} />
    </GlassButtonCapsule>,
  );
  expect(screen.getByTestId('glass-surface').dataset).toMatchObject({
    interactive: 'true',
    effect: 'regular',
  });
  expect(screen.getByTestId('capsule-inset').dataset).toMatchObject({
    px: '$1',
    py: '$1',
  });
  expect(screen.getByRole('button').dataset.inGlass).toBe('true');
  fireEvent.click(screen.getByRole('button'));
  expect(onClose).toHaveBeenCalledTimes(1);
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
      <CloseControl onClose={onClose} />
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
        <CloseControl onClose={jest.fn()} />
      </FallbackCapsule>
    </GlassHeaderProvider>,
  );
  expect(screen.queryByTestId('glass-surface')).toBeNull();
  expect(screen.queryByTestId('capsule-inset')).toBeNull();
  expect(screen.getByRole('button').dataset.inGlass).toBe('true');
});
