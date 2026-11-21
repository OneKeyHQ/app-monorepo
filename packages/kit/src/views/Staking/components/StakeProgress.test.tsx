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

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: ({ children }: { children?: ReactNode }) => <svg>{children}</svg>,
  Line: () => <line />,
}));

jest.mock('@onekeyhq/components', () => ({
  XStack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Spinner: () => <span aria-label="Running" />,
  useTheme: () => ({ borderStrong: { val: '#000' } }),
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
    name === 'CheckRadioSolid' ? <span aria-label="Completed" /> : null,
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

    expect(labels()).toEqual(['Wrap', 'Approve', 'Deposit']);
    expect(
      within(stepContainer('Wrap')).getByLabelText('Completed'),
    ).toBeTruthy();
    expect(
      within(stepContainer('Approve')).queryByLabelText('Completed'),
    ).toBeNull();
    expect(
      within(stepContainer('Deposit')).queryByLabelText('Completed'),
    ).toBeNull();
    expect(screen.getByText('Deposit').getAttribute('data-color')).toBe(
      '$textSubdued',
    );
  });

  it('marks a deposit as submitted without showing it as chain-confirmed', () => {
    const steps: IStakeTaskProgressStep[] = [
      { id: 'wrap', label: 'Wrap', status: 'completed' },
      { id: 'approve', label: 'Approve', status: 'completed' },
      { id: 'deposit', label: 'Deposit', status: 'submitted' },
    ];
    render(<StakeTaskProgress steps={steps} />);

    expect(labels()).toEqual(['Wrap', 'Approve', 'Deposit (Submitted)']);
    expect(screen.getAllByLabelText('Completed')).toHaveLength(2);
    expect(
      within(stepContainer('Deposit (Submitted)')).queryByLabelText(
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
    expect(labels()).toEqual(['Approve', 'Deposit']);

    rerender(
      <StakeTaskProgress
        steps={[
          { id: 'resetApproval', label: 'Reset approval', status: 'current' },
          { id: 'approve', label: 'Approve', status: 'waiting' },
          { id: 'deposit', label: 'Deposit', status: 'waiting' },
        ]}
      />,
    );

    expect(labels()).toEqual(['Reset approval', 'Approve', 'Deposit']);
    expect(screen.queryByLabelText('Completed')).toBeNull();
  });

  it('shows a spinner only while the current task is running', () => {
    const { rerender } = render(
      <StakeTaskProgress
        steps={[
          {
            id: 'approve',
            label: 'Approve',
            status: 'current',
            isRunning: true,
          },
        ]}
      />,
    );
    expect(screen.getByLabelText('Running')).toBeTruthy();
    rerender(
      <StakeTaskProgress
        steps={[{ id: 'approve', label: 'Approve', status: 'current' }]}
      />,
    );
    expect(screen.queryByLabelText('Running')).toBeNull();
  });
});
