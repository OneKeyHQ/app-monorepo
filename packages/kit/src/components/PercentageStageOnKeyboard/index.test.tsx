/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { PercentageStageOnKeyboard } from '.';

import { render, screen } from '@testing-library/react';

const mockPlatformEnv = { isNative: false };
const mockUseIsKeyboardShown = jest.fn(() => false);

jest.mock('@onekeyhq/components', () => ({
  XStack: ({
    children,
    opacity,
  }: {
    children?: ReactNode;
    opacity?: number;
  }) => (
    <div data-opacity={opacity} data-testid="percentage-stage">
      {children}
    </div>
  ),
  useIsKeyboardShown: () => mockUseIsKeyboardShown(),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Swap/components/SwapPercentageStageBadge',
  () =>
    ({ stage }: { stage: number }) => <span>{stage}</span>,
);

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockPlatformEnv.isNative;
    },
  },
}));

describe('PercentageStageOnKeyboard', () => {
  beforeEach(() => {
    mockPlatformEnv.isNative = false;
    mockUseIsKeyboardShown.mockReturnValue(false);
  });

  it('does not reserve keyboard space on non-native platforms', () => {
    render(<PercentageStageOnKeyboard reserveSpaceUntilKeyboardShown />);

    expect(screen.queryByTestId('percentage-stage')).toBeNull();
  });

  it('reserves hidden space before an expected native keyboard opens', () => {
    mockPlatformEnv.isNative = true;

    render(<PercentageStageOnKeyboard reserveSpaceUntilKeyboardShown />);

    expect(
      screen.getByTestId('percentage-stage').getAttribute('data-opacity'),
    ).toBe('0');
  });

  it('does not reserve native space when auto-focus is disabled', () => {
    mockPlatformEnv.isNative = true;

    render(
      <PercentageStageOnKeyboard reserveSpaceUntilKeyboardShown={false} />,
    );

    expect(screen.queryByTestId('percentage-stage')).toBeNull();
  });
});
