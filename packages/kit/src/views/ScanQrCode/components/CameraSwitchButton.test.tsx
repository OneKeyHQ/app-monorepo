/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { CameraSwitchButton } from './CameraSwitchButton';

import type { IScanCameraInfo } from './ScanCamera';

const mockShow = jest.fn<void, [unknown]>();
let mockIsNative = true;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockIsNative;
    },
  },
}));
jest.mock('@onekeyhq/components', () => ({
  YStack: ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) =>
    onPress ? (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    ),
  XStack: ({ children, testID }: { children: ReactNode; testID: string }) => (
    <div data-testid={testID}>{children}</div>
  ),
  ButtonFrame: ({
    children,
    onPress,
    testID,
    'aria-label': ariaLabel,
  }: {
    children: ReactNode;
    onPress?: () => void;
    testID?: string;
    'aria-label'?: string;
  }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      data-testid={testID}
      onClick={onPress}
    >
      {children}
    </button>
  ),
  ScrollView: ({ children }: { children: ReactNode }) => children,
  SizableText: ({
    children,
    testID,
  }: {
    children: ReactNode;
    testID?: string;
  }) => <span data-testid={testID}>{children}</span>,
  Icon: ({ name }: { name: string }) => <span data-icon={name} />,
  Button: ({
    children,
    onPress,
    testID,
  }: {
    children: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button type="button" data-testid={testID} onClick={onPress}>
      {children}
    </button>
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

beforeEach(() => {
  mockIsNative = true;
  jest.clearAllMocks();
});

test('native is hidden with fewer than two cameras', () => {
  render(
    <CameraSwitchButton
      cameras={[back]}
      cameraId={undefined}
      onSelect={jest.fn()}
    />,
  );
  expect(screen.queryByTestId('scan-camera-switch')).toBeNull();
});

test('native press cycles to the next camera and wraps around back to the first', () => {
  const onSelect = jest.fn();
  const { rerender } = render(
    <CameraSwitchButton
      cameras={[back, front]}
      cameraId={undefined}
      onSelect={onSelect}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'global.switch' }));
  expect(onSelect).toHaveBeenLastCalledWith('f');

  rerender(
    <CameraSwitchButton
      cameras={[back, front]}
      cameraId="f"
      onSelect={onSelect}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'global.switch' }));
  expect(onSelect).toHaveBeenLastCalledWith('b');
});

test('native long press lists three or more cameras and marks the current one', () => {
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

test('the inline picker stays closed when a third camera reconnects on native', () => {
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

test('desktop and web display the current camera label and open the in-viewfinder dropdown with two or more cameras', () => {
  mockIsNative = false;
  const onSelect = jest.fn();
  const { rerender } = render(
    <CameraSwitchButton cameras={[front]} cameraId="f" onSelect={onSelect} />,
  );
  expect(screen.getByTestId('scan-camera-info')).not.toBeNull();
  expect(screen.getByTestId('scan-camera-current-label').textContent).toBe(
    'Front',
  );
  expect(screen.queryByTestId('scan-camera-switch')).toBeNull();

  rerender(
    <CameraSwitchButton
      cameras={[front, usb]}
      cameraId="f"
      onSelect={onSelect}
    />,
  );
  expect(screen.getByTestId('scan-camera-current-label').textContent).toBe(
    'Front',
  );
  expect(screen.queryByTestId('scan-camera-dropdown')).toBeNull();

  fireEvent.click(screen.getByTestId('scan-camera-switch'));
  expect(screen.getByTestId('scan-camera-dropdown')).not.toBeNull();
  expect(
    screen.getByTestId('scan-camera-pick-0').querySelector('[data-icon]'),
  ).not.toBeNull();
  expect(
    screen.getByTestId('scan-camera-pick-1').querySelector('[data-icon]'),
  ).toBeNull();

  fireEvent.click(screen.getByTestId('scan-camera-pick-1'));
  expect(onSelect).toHaveBeenCalledWith('u');
  expect(screen.queryByTestId('scan-camera-dropdown')).toBeNull();

  rerender(
    <CameraSwitchButton
      cameras={[front, usb]}
      cameraId="u"
      onSelect={onSelect}
    />,
  );
  expect(screen.getByTestId('scan-camera-current-label').textContent).toBe(
    'USB',
  );
  fireEvent.click(screen.getByTestId('scan-camera-switch'));
  fireEvent.click(screen.getByTestId('scan-camera-dropdown-backdrop'));
  expect(screen.queryByTestId('scan-camera-dropdown')).toBeNull();
});
