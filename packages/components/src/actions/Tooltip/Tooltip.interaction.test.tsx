/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
import type { ReactNode } from 'react';
import { useState } from 'react';

import { Tooltip } from '.';

import { autoUpdate, computePosition } from '@floating-ui/dom';
import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('../../primitives', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Box = React.forwardRef<
    HTMLDivElement,
    { children?: ReactNode; asChild?: boolean }
  >(function Box({ children, asChild }, ref) {
    if (
      asChild &&
      React.isValidElement<{ ref?: React.Ref<HTMLDivElement> }>(children)
    ) {
      return React.cloneElement(children, { ref });
    }
    return (
      <div ref={ref} data-testid="trigger">
        {children}
      </div>
    );
  });
  return { Stack: Box, YStack: Box };
});
jest.mock('./TooltipText', () => ({
  TooltipText: ({ children }: { children?: ReactNode }) => children,
}));
jest.mock('@floating-ui/dom', () => ({
  autoUpdate: jest.fn((...[, , update]: Parameters<typeof autoUpdate>) => {
    update();
    return jest.fn();
  }),
  computePosition: jest.fn(async () => ({ x: 10, y: 20 })),
  flip: () => ({}),
  offset: () => ({}),
  shift: () => ({}),
  size: () => ({}),
}));
jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  OVERLAY_LEVEL_ORDER: { modal: 0 },
  useNestedOverlayLevel: () => 'modal',
  OverlayView: ({
    visible,
    children,
  }: {
    visible: boolean;
    children?: ReactNode;
  }) => (visible ? <div data-testid="tooltip">{children}</div> : null),
}));

function pointer(node: HTMLElement, type: string, pointerType = 'mouse') {
  fireEvent(
    node,
    Object.assign(new Event(type, { bubbles: true }), { pointerType }),
  );
}

const triggerA = <button key="a">A</button>;
const triggerB = (
  <a key="b" href="#b">
    B
  </a>
);

it('rebinds hover, touch and focus when asChild replaces button A with anchor B', () => {
  const onOpenChange = jest.fn();
  const view = render(
    <Tooltip
      triggerAsChild
      open={false}
      onOpenChange={onOpenChange}
      renderTrigger={triggerA}
      renderContent="Hint"
    />,
  );
  const oldTrigger = screen.getByRole('button');
  pointer(oldTrigger, 'pointerenter');
  expect(onOpenChange).toHaveBeenLastCalledWith(true);
  view.rerender(
    <Tooltip
      triggerAsChild
      open={false}
      onOpenChange={onOpenChange}
      renderTrigger={triggerB}
      renderContent="Hint"
    />,
  );
  onOpenChange.mockClear();
  pointer(oldTrigger, 'pointerenter');
  pointer(oldTrigger, 'pointerdown', 'touch');
  fireEvent.focusOut(oldTrigger);
  expect(onOpenChange).not.toHaveBeenCalled();
  const trigger = screen.getByRole('link');
  pointer(trigger, 'pointerenter');
  expect(onOpenChange).toHaveBeenLastCalledWith(true);
  pointer(trigger, 'pointerleave');
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  pointer(trigger, 'pointerdown', 'touch');
  expect(onOpenChange).toHaveBeenLastCalledWith(true);
  jest.spyOn(trigger, 'matches').mockReturnValue(true);
  fireEvent.focusIn(trigger);
  expect(onOpenChange).toHaveBeenLastCalledWith(true);
  fireEvent.focusOut(trigger);
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
});

it('reanchors the actual positioning hook to B while open and cleans up A', async () => {
  jest.mocked(autoUpdate).mockClear();
  jest.mocked(computePosition).mockClear();
  const view = render(
    <Tooltip
      triggerAsChild
      open
      renderTrigger={triggerA}
      renderContent="Hint"
    />,
  );
  const a = screen.getByRole('button');
  expect(autoUpdate).toHaveBeenLastCalledWith(
    a,
    expect.any(HTMLDivElement),
    expect.any(Function),
  );
  const releaseA = jest.mocked(autoUpdate).mock.results.at(-1)
    ?.value as jest.Mock;
  view.rerender(
    <Tooltip
      triggerAsChild
      open
      renderTrigger={triggerB}
      renderContent="Hint"
    />,
  );
  const b = screen.getByRole('link');
  expect(releaseA).toHaveBeenCalledTimes(1);
  expect(autoUpdate).toHaveBeenLastCalledWith(
    b,
    expect.any(HTMLDivElement),
    expect.any(Function),
  );
  expect(computePosition).toHaveBeenLastCalledWith(
    b,
    expect.any(HTMLDivElement),
    expect.any(Object),
  );
  const releaseB = jest.mocked(autoUpdate).mock.results.at(-1)
    ?.value as jest.Mock;
  pointer(b, 'pointerdown', 'touch');
  await act(async () => {});
  view.unmount();
  expect(releaseB).toHaveBeenCalledTimes(1);
});
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
