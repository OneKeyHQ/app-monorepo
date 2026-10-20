/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
import type { ReactNode } from 'react';
import { useState } from 'react';

import { Tooltip } from '.';

import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('../../primitives', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Box = React.forwardRef<HTMLDivElement, { children?: ReactNode }>(
    function Box({ children }, ref) {
      return (
        <div ref={ref} data-testid="trigger">
          {children}
        </div>
      );
    },
  );
  return { Stack: Box, YStack: Box };
});
jest.mock('./TooltipText', () => ({
  TooltipText: ({ children }: { children?: ReactNode }) => children,
}));
jest.mock('../Popover/anchoredPopover', () => ({
  useAnchoredPosition: () => () => {},
  useOutsidePress: jest.fn(),
}));
jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  useNestedOverlayLevel: () => 'modal',
  OverlayView: ({
    visible,
    children,
  }: {
    visible: boolean;
    children?: ReactNode;
  }) => (visible ? <div data-testid="tooltip">{children}</div> : null),
}));
it('ignores hover and touch open requests while disabled', () => {
  const onOpenChange = jest.fn();
  const view = render(
    <Tooltip
      disabled
      onOpenChange={onOpenChange}
      renderTrigger="Trigger"
      renderContent="Hint"
    />,
  );
  fireEvent.pointerEnter(screen.getByTestId('trigger'));
  fireEvent.pointerDown(screen.getByTestId('trigger'), {
    pointerType: 'touch',
  });
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(screen.queryByTestId('tooltip')).toBeNull();
  view.rerender(
    <Tooltip disabled open renderTrigger="Trigger" renderContent="Hint" />,
  );
  expect(screen.queryByTestId('tooltip')).toBeNull();
});
it('routes controlled ref open and close commands to the parent', async () => {
  jest.useFakeTimers();
  // This ref is created once per test and is stable across component renders.
  // oxlint-disable-next-line react-perf/jsx-no-new-object-as-prop
  const ref = {
    current: { openTooltip: async () => {}, closeTooltip: async () => {} },
  };
  function Example() {
    const [open, setOpen] = useState(false);
    return (
      <Tooltip
        ref={ref}
        open={open}
        onOpenChange={setOpen}
        renderTrigger="Trigger"
        renderContent="Hint"
      />
    );
  }
  render(<Example />);
  let opened: Promise<void> | undefined;
  act(() => {
    opened = ref.current?.openTooltip();
    jest.advanceTimersByTime(50);
  });
  await opened;
  expect(screen.getByTestId('tooltip')).toBeTruthy();
  let closed: Promise<void> | undefined;
  act(() => {
    closed = ref.current?.closeTooltip();
    jest.advanceTimersByTime(200);
  });
  await closed;
  expect(screen.queryByTestId('tooltip')).toBeNull();
  jest.useRealTimers();
});
