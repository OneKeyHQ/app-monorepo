/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { CameraSwitchButton } from './CameraSwitchButton';

import type { IScanCameraInfo } from './ScanCamera';

const mockShow = jest.fn<void, [unknown]>();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  YStack: ({ children }: { children: ReactNode }) => children,
  ScrollView: ({ children }: { children: ReactNode }) => children,
  Button: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  ActionList: { show: (params: unknown) => mockShow(params) },
  IconButton: ({
    onPress,
    onLongPress,
    testID,
    accessibilityLabel,
  }: {
    onPress: () => void;
    onLongPress: () => void;
    testID: string;
    accessibilityLabel: string;
  }) => (
    <button
      type="button"
      aria-label={accessibilityLabel}
      data-testid={testID}
      onClick={onPress}
      onContextMenu={onLongPress}
    />
  ),
}));

const back: IScanCameraInfo = { id: 'b', position: 'back', label: 'Back' };
const front: IScanCameraInfo = { id: 'f', position: 'front', label: 'Front' };
const usb: IScanCameraInfo = { id: 'u', position: 'external', label: 'USB' };

afterEach(() => {
  jest.clearAllMocks();
});

test('is hidden with fewer than two cameras', () => {
  render(
    <CameraSwitchButton
      cameras={[back]}
      cameraId={undefined}
      onSelect={jest.fn()}
    />,
  );
  expect(screen.queryByTestId('scan-camera-switch')).toBeNull();
});

test('a press moves to the next camera', () => {
  const onSelect = jest.fn();
  render(
    <CameraSwitchButton
      cameras={[back, front]}
      cameraId={undefined}
      onSelect={onSelect}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'global.switch' }));
  expect(onSelect).toHaveBeenCalledWith('f');
});

test('a long press lists three or more cameras and marks the current one', () => {
  const onSelect = jest.fn();
  const { rerender } = render(
    <CameraSwitchButton
      cameras={[back, front]}
      cameraId="f"
      onSelect={onSelect}
    />,
  );
  fireEvent.contextMenu(screen.getByTestId('scan-camera-switch'));
  expect(mockShow).not.toHaveBeenCalled();

  rerender(
    <CameraSwitchButton
      cameras={[back, front, usb]}
      cameraId="f"
      onSelect={onSelect}
    />,
  );
  fireEvent.contextMenu(screen.getByTestId('scan-camera-switch'));
  const { items } = mockShow.mock.calls[0][0] as {
    items: { label: string; icon: string; onPress: () => void }[];
  };
  expect(items.map((item) => item.label)).toEqual(['Back', 'Front', 'USB']);
  expect(items[1].icon).toBe('CheckLargeOutline');
  items[2].onPress();
  expect(onSelect).toHaveBeenCalledWith('u');
});

test('the inline picker stays closed when a third camera reconnects', () => {
  const onSelect = jest.fn();
  const { rerender } = render(
    <CameraSwitchButton
      cameras={[back, front, usb]}
      cameraId="f"
      onSelect={onSelect}
      inlinePicker
    />,
  );
  fireEvent.contextMenu(screen.getByTestId('scan-camera-switch'));
  expect(screen.getByRole('button', { name: 'USB' })).not.toBeNull();

  rerender(
    <CameraSwitchButton
      cameras={[back, front]}
      cameraId="f"
      onSelect={onSelect}
      inlinePicker
    />,
  );
  expect(screen.getByTestId('scan-camera-switch')).not.toBeNull();
  rerender(
    <CameraSwitchButton
      cameras={[back, front, usb]}
      cameraId="f"
      onSelect={onSelect}
      inlinePicker
    />,
  );
  expect(screen.getByTestId('scan-camera-switch')).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'USB' })).toBeNull();
});
