/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import { ChannelCornerBadge } from './ChannelCornerBadge';

jest.mock('../MorphOverlay', () => ({ STAGE_BG: '#060606' }));

jest.mock('../../primitives', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Stack: ({ children, testID }: { children?: ReactNode; testID?: string }) =>
      React.createElement('div', { 'data-testid': testID }, children),
    Icon: ({ name }: { name: string }) =>
      React.createElement('i', { 'data-testid': `icon-${name}` }),
  };
});

describe('ChannelCornerBadge', () => {
  it.each([
    ['bluetooth', 'BluetoothSolid'],
    ['usb', 'UsbSolid'],
  ] as const)('marks a %s connection with its own icon', (channel, icon) => {
    render(<ChannelCornerBadge connectionType={channel} />);

    expect(
      screen.getByTestId(`device-stage-channel-badge-${channel}`),
    ).toBeTruthy();
    expect(screen.getByTestId(`icon-${icon}`)).toBeTruthy();
  });
});
