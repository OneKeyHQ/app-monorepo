/** @jest-environment jsdom */
/* cspell:ignore hoverable */
import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { OneKeyIdUsagePopover } from './OneKeyIdUsagePopover';

// The real Popover's presentation is covered in the components package; here
// only the panel's own breakpoint handling is driven.
let mockMd = false;
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Box = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);
  return {
    Icon: () => null,
    SizableText: Box,
    XStack: Box,
    YStack: Box,
    useMedia: () => ({ md: mockMd }),
    Popover: (props: { open: boolean; renderContent: ReactNode }) =>
      props.open ? props.renderContent : null,
  };
});

function renderPanel(open: boolean, onOpenChange = jest.fn()) {
  const view = render(
    <OneKeyIdUsagePopover
      open={open}
      onOpenChange={onOpenChange}
      hoverable={false}
    />,
  );
  return { ...view, onOpenChange };
}

beforeEach(() => {
  mockMd = false;
});

it('closes an open panel when the window crosses the breakpoint', () => {
  const popoverClose = jest
    .spyOn(defaultLogger.ui.popover, 'popoverClose')
    .mockImplementation((params) => params);
  const { rerender, onOpenChange } = renderPanel(true);
  mockMd = true;
  rerender(
    <OneKeyIdUsagePopover open onOpenChange={onOpenChange} hoverable={false} />,
  );
  expect(onOpenChange).toHaveBeenCalledWith(false);
  // The popover does not see this close, so the panel logs it.
  expect(popoverClose.mock.calls).toEqual([[{ trackId: 'onekey-id-usage' }]]);
  popoverClose.mockRestore();
});

it('leaves a closed panel alone when the window crosses the breakpoint', () => {
  const { rerender, onOpenChange } = renderPanel(false);
  mockMd = true;
  rerender(
    <OneKeyIdUsagePopover
      open={false}
      onOpenChange={onOpenChange}
      hoverable={false}
    />,
  );
  expect(onOpenChange).not.toHaveBeenCalled();
});
