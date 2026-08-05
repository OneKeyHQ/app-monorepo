/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OverviewMetric } from './OverviewMetric';

jest.mock('@onekeyhq/components', () => ({
  ButtonFrame: ({
    accessibilityLabel,
    children,
    focusable,
    focusVisibleStyle,
    onPress,
    testID,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    focusable?: boolean;
    focusVisibleStyle?: {
      outlineColor?: string;
      outlineStyle?: string;
      outlineWidth?: number;
    };
    onPress?: () => void;
    testID?: string;
  }) => (
    <button
      aria-label={accessibilityLabel}
      data-focusable={focusable}
      data-focus-outline-color={focusVisibleStyle?.outlineColor}
      data-focus-outline-style={focusVisibleStyle?.outlineStyle}
      data-focus-outline-width={focusVisibleStyle?.outlineWidth}
      data-testid={testID}
      onClick={onPress}
      type="button"
    >
      {children}
    </button>
  ),
  Skeleton: () => <div data-testid="skeleton" />,
  XStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  YStack: ({ children, testID }: { children?: ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  ),
}));

jest.mock('../../Staking/components/ProtocolDetails/EarnText', () => ({
  EarnText: ({ text }: { text: { text: string } }) => <span>{text.text}</span>,
}));

describe('OverviewMetric', () => {
  it('uses native button semantics for keyboard activation', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();

    render(
      <OverviewMetric
        testID="e-mode-metric"
        title={{ text: 'E-Mode' }}
        text={{ text: 'Enabled' }}
        onPress={onPress}
      />,
    );

    const button = screen.getByRole('button', { name: 'E-Mode' });

    expect(button.tabIndex).toBe(0);
    expect(button.getAttribute('data-focusable')).toBe('true');
    expect(button.getAttribute('data-focus-outline-color')).toBe('$focusRing');
    expect(button.getAttribute('data-focus-outline-style')).toBe('solid');
    expect(button.getAttribute('data-focus-outline-width')).toBe('2');

    await user.tab();
    expect(document.activeElement).toBe(button);

    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('keeps non-interactive metrics out of the button tab order', () => {
    render(
      <OverviewMetric
        testID="static-metric"
        title={{ text: 'Net APY' }}
        text={{ text: '2.5%' }}
      />,
    );

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTestId('static-metric').tagName).toBe('DIV');
  });
});
