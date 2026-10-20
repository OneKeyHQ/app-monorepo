/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import { getTradingButtonStyleProps } from '../utils/styleUtils';

import { PerpActionButton } from './PerpActionButton';

jest.mock('@onekeyhq/components', () => ({
  Button: ({
    children,
    bg,
    hoverStyle,
    pressStyle,
    disabled,
    loading,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    loading?: boolean;
    bg: string;
    hoverStyle: { bg: string };
    pressStyle: { bg: string };
  }) => (
    <div
      data-bg={bg}
      data-hover={hoverStyle.bg}
      data-press={pressStyle.bg}
      data-disabled={disabled}
      data-loading={loading}
    >
      {children}
    </div>
  ),
  SizableText: ({
    children,
    color,
  }: {
    children: React.ReactNode;
    color: string;
  }) => <span data-color={color}>{children}</span>,
}));

it('keeps background, interaction and label colors paired for accent and destructive actions', () => {
  const { container, rerender } = render(
    <PerpActionButton variant="accent">Long BTC</PerpActionButton>,
  );
  expect(container.firstElementChild?.getAttribute('data-bg')).toBe(
    '$bgAccent',
  );
  expect(container.firstElementChild?.getAttribute('data-hover')).toBe(
    '$bgAccentHover',
  );
  expect(container.firstElementChild?.getAttribute('data-press')).toBe(
    '$bgAccentActive',
  );
  expect(container.querySelector('span')?.getAttribute('data-color')).toBe(
    '$textInverse',
  );
  rerender(<PerpActionButton variant="accent">Deposit</PerpActionButton>);
  expect(container.querySelector('span')?.textContent).toBe('Deposit');
  expect(container.firstElementChild?.getAttribute('data-bg')).toBe(
    '$bgAccent',
  );
  expect(container.querySelector('span')?.getAttribute('data-color')).toBe(
    '$textInverse',
  );
  rerender(
    <PerpActionButton variant="destructive">Short BTC</PerpActionButton>,
  );
  expect(container.firstElementChild?.getAttribute('data-bg')).toBe(
    '$bgCriticalStrong',
  );
  expect(container.firstElementChild?.getAttribute('data-hover')).toBe(
    '$bgCriticalStrongHover',
  );
  expect(container.firstElementChild?.getAttribute('data-press')).toBe(
    '$bgCriticalStrongActive',
  );
  expect(container.querySelector('span')?.getAttribute('data-color')).toBe(
    '$textOnColor',
  );
  expect(getTradingButtonStyleProps('long').textColor).toBe('$textInverse');
  expect(getTradingButtonStyleProps('short').textColor).toBe('$textOnColor');
  rerender(
    <PerpActionButton variant="accent" disabled>
      Long BTC
    </PerpActionButton>,
  );
  expect(container.querySelector('span')?.getAttribute('data-color')).toBe(
    '$textInverse',
  );
  expect(container.firstElementChild?.getAttribute('data-disabled')).toBe(
    'true',
  );
  rerender(
    <PerpActionButton variant="destructive" loading>
      Short BTC
    </PerpActionButton>,
  );
  expect(container.firstElementChild?.getAttribute('data-loading')).toBe(
    'true',
  );
  expect(container.querySelector('span')?.getAttribute('data-color')).toBe(
    '$textOnColor',
  );
});
