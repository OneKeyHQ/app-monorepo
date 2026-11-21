/** @jest-environment jsdom */
/* cspell:ignore hoverable */
import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import { OneKeyIdUsagePopover } from './OneKeyIdUsagePopover';

// The real Popover's presentation is covered in the components package; here
// the panel's own focus and breakpoint handling is driven through the props
// it hands to it.
let mockMd = false;
const mockPopoverProps = jest.fn();
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Box = ({
    children,
    ref,
    id,
    tabIndex,
  }: {
    children?: ReactNode;
    ref?: import('react').Ref<HTMLDivElement>;
    id?: string;
    tabIndex?: number;
  }) => React.createElement('div', { ref, id, tabIndex }, children);
  return {
    Icon: () => null,
    SizableText: Box,
    XStack: Box,
    YStack: Box,
    useMedia: () => ({ md: mockMd }),
    Popover: (props: { open: boolean; renderContent: ReactNode }) => {
      mockPopoverProps(props);
      return props.open ? props.renderContent : null;
    },
  };
});

const lastPopoverProps = () =>
  mockPopoverProps.mock.calls[mockPopoverProps.mock.calls.length - 1]?.[0] as {
    floatingPanelProps: { onOpenAutoFocus: (event: Event) => void };
  };

function renderPanel(open: boolean, onOpenChange = jest.fn()) {
  const view = render(
    <OneKeyIdUsagePopover
      open={open}
      onOpenChange={onOpenChange}
      hoverable={false}
      contentId="usage"
    />,
  );
  return { ...view, onOpenChange };
}

beforeEach(() => {
  mockMd = false;
  mockPopoverProps.mockClear();
});

it('moves focus into the anchored panel when it opens', () => {
  renderPanel(true);
  const content = document.getElementById('usage');
  expect(content?.tabIndex).toBe(-1);
  const event = new Event('focus');
  const preventDefault = jest.spyOn(event, 'preventDefault');
  act(() => lastPopoverProps().floatingPanelProps.onOpenAutoFocus(event));
  expect(preventDefault).toHaveBeenCalled();
  expect(document.activeElement).toBe(content);
});

it('closes an open panel when the window crosses the breakpoint', () => {
  const { rerender, onOpenChange } = renderPanel(true);
  mockMd = true;
  rerender(
    <OneKeyIdUsagePopover
      open
      onOpenChange={onOpenChange}
      hoverable={false}
      contentId="usage"
    />,
  );
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it('leaves a closed panel alone when the window crosses the breakpoint', () => {
  const { rerender, onOpenChange } = renderPanel(false);
  mockMd = true;
  rerender(
    <OneKeyIdUsagePopover
      open={false}
      onOpenChange={onOpenChange}
      hoverable={false}
      contentId="usage"
    />,
  );
  expect(onOpenChange).not.toHaveBeenCalled();
});
