/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen, within } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { StakeTaskProgress } from './StakeProgress';

import type { IStakeTaskProgressStep } from './StakeProgress';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) =>
      id === 'feedback.transaction_submitted' ? 'Submitted' : id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  XStack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SizableText: ({
    children,
    color,
  }: {
    children: ReactNode;
    color?: string;
  }) => (
    <span data-testid="task-step-label" data-color={color}>
      {children}
    </span>
  ),
  Icon: ({ name }: { name: string }) =>
    name === 'CheckRadioOutline' ? <span aria-label="Completed" /> : null,
}));

function stepContainer(text: string) {
  const container = screen.getByText(text).parentElement;
  if (!container) throw new OneKeyLocalError('Missing task step container');
  return container;
}

function labels() {
  return screen
    .getAllByTestId('task-step-label')
    .map((item) => item.textContent);
}

describe('StakeTaskProgress', () => {
  it('shows a completed wrap, current approval and waiting deposit in order', () => {
    const steps: IStakeTaskProgressStep[] = [
      { id: 'wrap', label: 'Wrap', status: 'completed' },
      { id: 'approve', label: 'Approve', status: 'current' },
      { id: 'deposit', label: 'Deposit', status: 'waiting' },
    ];
    render(<StakeTaskProgress steps={steps} />);

    expect(labels()).toEqual(['1. Wrap', '2. Approve', '3. Deposit']);
    expect(
      within(stepContainer('1. Wrap')).getByLabelText('Completed'),
    ).toBeTruthy();
    expect(
      within(stepContainer('2. Approve')).queryByLabelText('Completed'),
    ).toBeNull();
    expect(
      within(stepContainer('3. Deposit')).queryByLabelText('Completed'),
    ).toBeNull();
    expect(screen.getByText('3. Deposit').getAttribute('data-color')).toBe(
      '$textDisabled',
    );
  });

  it('marks a deposit as submitted without showing it as chain-confirmed', () => {
    const steps: IStakeTaskProgressStep[] = [
      { id: 'wrap', label: 'Wrap', status: 'completed' },
      { id: 'approve', label: 'Approve', status: 'completed' },
      { id: 'deposit', label: 'Deposit', status: 'submitted' },
    ];
    render(<StakeTaskProgress steps={steps} />);

    expect(labels()).toEqual([
      '1. Wrap',
      '2. Approve',
      '3. Deposit (Submitted)',
    ]);
    expect(screen.getAllByLabelText('Completed')).toHaveLength(2);
    expect(
      within(stepContainer('3. Deposit (Submitted)')).queryByLabelText(
        'Completed',
      ),
    ).toBeNull();
  });

  it('keeps reset, approval and deposit in their supplied order when reset is inserted', () => {
    const withoutReset: IStakeTaskProgressStep[] = [
      { id: 'approve', label: 'Approve', status: 'current' },
      { id: 'deposit', label: 'Deposit', status: 'waiting' },
    ];
    const { rerender } = render(<StakeTaskProgress steps={withoutReset} />);
    expect(labels()).toEqual(['1. Approve', '2. Deposit']);

    rerender(
      <StakeTaskProgress
        steps={[
          { id: 'resetApproval', label: 'Reset approval', status: 'current' },
          { id: 'approve', label: 'Approve', status: 'waiting' },
          { id: 'deposit', label: 'Deposit', status: 'waiting' },
        ]}
      />,
    );

    expect(labels()).toEqual(['1. Reset approval', '2. Approve', '3. Deposit']);
    expect(screen.queryByLabelText('Completed')).toBeNull();
  });
});
