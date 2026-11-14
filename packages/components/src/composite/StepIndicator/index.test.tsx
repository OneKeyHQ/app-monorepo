/** @jest-environment jsdom */
/* oxlint-disable react-perf/jsx-no-new-array-as-prop */
import type { ReactNode } from 'react';

import { StepIndicator } from '.';

import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducedMotion } from 'react-native-reanimated';

import type { IStepIndicatorItem } from '.';

jest.mock('react-native', () => ({
  ...jest.requireActual<typeof import('react-native')>('react-native'),
}));

jest.mock('react-native-reanimated', () => ({
  useReducedMotion: jest.fn(() => true),
}));

jest.mock('../../primitives', () => {
  const View = ({
    children,
    outlineWidth,
    'aria-hidden': ariaHidden,
  }: {
    children?: ReactNode;
    outlineWidth?: number;
    'aria-hidden'?: boolean;
  }) => (
    <div data-outline-width={outlineWidth} aria-hidden={ariaHidden}>
      {children}
    </div>
  );
  const Text = ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  );
  return {
    AnimatePresence: View,
    Icon: () => <span data-testid="completed-mark" />,
    SizableText: Text,
    Stack: View,
    XStack: View,
  };
});

const steps: IStepIndicatorItem[] = [
  { id: 'first', label: 'First', status: 'current' },
  { id: 'second', label: 'Second', status: 'upcoming' },
  { id: 'third', label: 'Third', status: 'upcoming', disabled: true },
];
const updatedSteps: IStepIndicatorItem[] = steps.map((step) => ({
  ...step,
  status: step.id === 'second' ? 'current' : 'done',
}));

it('shows the latest mark after rapid status changes', () => {
  jest.mocked(useReducedMotion).mockReturnValue(false);
  const singleStep = [steps[0]];
  const { container, rerender, unmount } = render(
    <StepIndicator steps={singleStep} />,
  );
  expect(container.querySelector('[aria-hidden="false"]')?.textContent).toBe(
    '1',
  );

  rerender(<StepIndicator steps={[{ ...singleStep[0], status: 'done' }]} />);
  expect(
    container.querySelector(
      '[aria-hidden="false"] [data-testid="completed-mark"]',
    ),
  ).not.toBeNull();
  rerender(<StepIndicator steps={singleStep} />);
  expect(container.querySelector('[aria-hidden="false"]')?.textContent).toBe(
    '1',
  );
  unmount();
  jest.mocked(useReducedMotion).mockReturnValue(true);
});

it('reports an enabled selection without changing controlled state until its props change', () => {
  const onStepPress = jest.fn();
  const { rerender } = render(
    <StepIndicator steps={steps} onStepPress={onStepPress} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Second' }));
  expect(onStepPress).toHaveBeenCalledWith('second');
  expect(
    screen.getByRole('button', { name: 'First' }).getAttribute('aria-current'),
  ).toBe('step');
  expect(
    screen.getByRole('button', { name: 'Second' }).getAttribute('aria-current'),
  ).toBeNull();

  rerender(<StepIndicator steps={updatedSteps} onStepPress={onStepPress} />);
  expect(
    screen.getByRole('button', { name: 'Second' }).getAttribute('aria-current'),
  ).toBe('step');
  expect(
    screen.getByRole('button', { name: 'First' }).getAttribute('aria-current'),
  ).toBeNull();
});

it('supports keyboard activation and does not activate a disabled step', async () => {
  const user = userEvent.setup();
  const onStepPress = jest.fn();
  render(<StepIndicator steps={steps} onStepPress={onStepPress} />);
  const enabled = screen.getByRole('button', { name: 'Second' });
  act(() => enabled.focus());
  await user.keyboard('{Enter}');
  expect(onStepPress).toHaveBeenCalledWith('second');
  await user.keyboard(' ');
  expect(onStepPress).toHaveBeenCalledTimes(2);

  onStepPress.mockClear();
  const disabled = screen.getByRole('button', { name: 'Third' });
  expect(disabled.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(disabled);
  await user.keyboard('{Tab}{Enter}');
  expect(onStepPress).not.toHaveBeenCalled();
});

it('exposes the current static step without rendering buttons', () => {
  render(<StepIndicator steps={steps} testID="static" />);
  expect(screen.queryByRole('button')).toBeNull();
  expect(
    screen.getByTestId('static-step-first').getAttribute('aria-current'),
  ).toBe('step');
});

it('shows a focus ring only while an interactive step can receive focus', () => {
  const onStepPress = jest.fn();
  const { rerender } = render(
    <StepIndicator steps={steps} onStepPress={onStepPress} testID="focus" />,
  );
  const first = screen.getByRole('button', { name: 'First' });
  act(() => first.focus());
  expect(first.querySelector('[data-outline-width="2"]')).not.toBeNull();

  const disabledSteps = steps.map((step) =>
    step.id === 'first' ? { ...step, disabled: true } : step,
  );
  rerender(
    <StepIndicator
      steps={disabledSteps}
      onStepPress={onStepPress}
      testID="focus"
    />,
  );
  expect(first.querySelector('[data-outline-width="2"]')).toBeNull();

  rerender(
    <StepIndicator steps={steps} onStepPress={onStepPress} testID="focus" />,
  );
  expect(document.activeElement).toBe(first);
  expect(first.querySelector('[data-outline-width="2"]')).not.toBeNull();

  rerender(<StepIndicator steps={steps} testID="focus" />);
  expect(
    screen
      .getByTestId('focus-step-first')
      .querySelector('[data-outline-width="2"]'),
  ).toBeNull();

  rerender(
    <StepIndicator steps={steps} onStepPress={onStepPress} testID="focus" />,
  );
  expect(
    screen
      .getByRole('button', { name: 'First' })
      .querySelector('[data-outline-width="2"]'),
  ).toBeNull();
});
