/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { showIntercom } from '@onekeyhq/kit/src/views/Intercom/client';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import {
  DeviceNotFoundDialogContent,
  TrezorDeviceNotFoundDialogContent,
} from './ConnectionTroubleShootingAccordion';

const mockClose = jest.fn<Promise<void>, []>();
jest.mock('@onekeyhq/components', () => ({
  Button: ({
    children,
    onPress,
    testID,
  }: {
    children: ReactNode;
    onPress: () => void;
    testID: string;
  }) => (
    <button data-testid={testID} onClick={onPress}>
      {children}
    </button>
  ),
  YStack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useDialogInstance: () => ({ close: mockClose }),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/views/Intercom/client', () => ({
  showIntercom: jest.fn(async () => {}),
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));

describe.each([
  {
    name: 'OneKey',
    Content: DeviceNotFoundDialogContent,
    helpId: 'hardware-ui-troubleshooting-btn',
  },
  {
    name: 'Trezor',
    Content: TrezorDeviceNotFoundDialogContent,
    helpId: 'hardware-ui-trezor-troubleshooting-btn',
  },
])('$name device-not-found support', ({ Content, helpId }) => {
  beforeEach(() => jest.clearAllMocks());

  it('waits until the hardware overlay closes before navigating to support', async () => {
    let finishClose: () => void = () => {};
    mockClose.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishClose = resolve;
        }),
    );
    render(<Content />);
    fireEvent.click(screen.getByTestId('hardware-ui-contact-us-btn'));
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(showIntercom).not.toHaveBeenCalled();
    await act(async () => finishClose());
    expect(showIntercom).toHaveBeenCalledTimes(1);
  });

  it('keeps external troubleshooting in the existing dialog', () => {
    render(<Content />);
    fireEvent.click(screen.getByTestId(helpId));
    expect(openUrlExternal).toHaveBeenCalledTimes(1);
    expect(mockClose).not.toHaveBeenCalled();
    expect(showIntercom).not.toHaveBeenCalled();
  });
});
