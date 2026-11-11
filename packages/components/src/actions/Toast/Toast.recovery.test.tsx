/** @jest-environment jsdom */
/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, react-perf/jsx-no-new-function-as-prop */
import type { ReactNode } from 'react';

import { Toast, ToastContent } from '.';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  dismissNativeStorageRecovery,
  getRequestedNativeStorageRecovery,
  getRequestedNativeStorageRecoveryTestSessionId,
} from '@onekeyhq/shared/src/storage/nativeStorageRecovery';
import { createNativeStorageMigrationInconsistentErrorMessage } from '@onekeyhq/shared/src/storage/nativeStorageTypes';

import { Button } from '../../primitives/Button';

import type { IToastMessageOptions } from './type';

const mockClose = jest.fn<void, []>();
const mockMount = jest.fn<
  { destroy: () => void },
  [{ node: ReactNode; target: string }]
>(() => ({
  destroy: jest.fn(),
}));
const mockShowMessage = jest.fn((_options: IToastMessageOptions) => ({
  close: mockClose,
}));
function mockView({
  children,
  onPress,
}: {
  children?: ReactNode;
  onPress?: () => void;
}) {
  return <div onClick={onPress}>{children}</div>;
}
jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ height: 900 }),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isDev: false },
}));
jest.mock('@onekeyhq/shared/src/keyboard', () => ({
  dismissKeyboard: jest.fn(),
}));
jest.mock('@onekeyhq/components/src/shared/tamagui', () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
jest.mock('../../shared/imperativeOverlayMount', () => ({
  mountImperativeOverlay: (options: { node: ReactNode; target: string }) =>
    mockMount(options),
}));
jest.mock('../../hocs/Provider/hooks/useProviderValue', () => ({
  useSettingConfig: () => ({
    HyperlinkText: ({ defaultMessage }: { defaultMessage: string }) => (
      <span>{defaultMessage}</span>
    ),
  }),
}));
jest.mock('../../hooks/usePage', () => ({ usePageWidth: () => 400 }));
jest.mock('../../hooks/useStyle', () => ({
  useMedia: () => ({ gtMd: false }),
}));
jest.mock('../../primitives', () => ({
  Icon: () => <i />,
  Image: () => null,
  SizableText: mockView,
  View: mockView,
  XStack: mockView,
  YStack: mockView,
}));
jest.mock('../../primitives/Spinner/Spinner', () => ({ Spinner: () => null }));
jest.mock('../../primitives/Button', () => ({
  Button: ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button
      type="button"
      data-testid={testID}
      onClick={(event) => {
        event.stopPropagation();
        onPress?.();
      }}
    >
      {children}
    </button>
  ),
}));
jest.mock('./ShowCustom', () => ({
  ShowCustom: ({ children }: { children: ReactNode }) => <>{children}</>,
  ShowToasterClose: () => null,
}));
jest.mock('./showMessage', () => ({
  showMessage: (options: IToastMessageOptions) => mockShowMessage(options),
  dismissToast: jest.fn(),
}));
jest.mock('./Toaster', () => ({ __esModule: true, default: () => null }));

const appStorageError =
  createNativeStorageMigrationInconsistentErrorMessage('appStorage');
const jotaiError =
  createNativeStorageMigrationInconsistentErrorMessage('jotai');
function showLatest() {
  const options = mockShowMessage.mock.calls.at(-1)![0];
  return render(options.renderContent());
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(platformEnv, 'isNative', true);
  dismissNativeStorageRecovery();
});
afterEach(() => jest.restoreAllMocks());

it.each([true, false])(
  'renders ordinary notification actions with isNative=%s',
  (isNative) => {
    jest.replaceProperty(platformEnv, 'isNative', isNative);
    const open = jest.fn();
    Toast.notification({
      title: 'Support reply',
      message: 'A test reply',
      onPress: open,
      actions: (
        <Button testID="test-support-notification-open" onPress={open}>
          View conversation
        </Button>
      ),
    });
    showLatest();
    fireEvent.click(screen.getByRole('button', { name: 'View conversation' }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByTestId('native-storage-repair-toast-action'),
    ).toBeNull();
  },
);

it.each(['error', 'warning', 'success', 'message', 'loading'] as const)(
  'adds one recovery action to direct Toast.%s without changing text or presentation',
  async (method) => {
    const title = `Wrapped error: ${appStorageError}`;
    Toast[method]({
      title,
      message: 'Original message\nkept verbatim',
      duration: 8123,
      icon: 'ErrorOutline',
      toastId: `direct-${method}`,
    });
    const options = mockShowMessage.mock.calls[0][0];
    expect(options).toMatchObject({
      duration: 8123,
      toastId: `direct-${method}`,
      haptic: method === 'message' ? 'info' : method,
    });
    const content = options.renderContent();
    expect(content.props).toMatchObject({
      title,
      message: 'Original message\nkept verbatim',
    });
    expect(content.props.icon.props.name).toBe('ErrorOutline');
    render(content);
    expect(
      screen.getAllByTestId('native-storage-repair-toast-action'),
    ).toHaveLength(1);
    expect(getRequestedNativeStorageRecovery()).toBeUndefined();
    fireEvent.click(screen.getByTestId('native-storage-repair-toast-action'));
    await waitFor(() =>
      expect(getRequestedNativeStorageRecovery()).toBe('appStorage'),
    );
    expect(mockClose).toHaveBeenCalledTimes(1);
  },
);

it('matches a diagnostic only in message and preserves existing actions', async () => {
  const copy = jest.fn();
  Toast.error({
    title: 'Original title',
    message: jotaiError,
    actions: (
      <button type="button" onClick={copy}>
        Copy diagnostic
      </button>
    ),
    nativeStorageRecoveryTestSessionId: 'storage-repair-test-123-abc',
  });
  showLatest();
  fireEvent.click(screen.getByRole('button', { name: 'Copy diagnostic' }));
  expect(copy).toHaveBeenCalledTimes(1);
  expect(getRequestedNativeStorageRecovery()).toBeUndefined();
  fireEvent.click(screen.getByTestId('native-storage-repair-toast-action'));
  await waitFor(() =>
    expect(getRequestedNativeStorageRecovery()).toBe('jotai'),
  );
  expect(getRequestedNativeStorageRecoveryTestSessionId()).toBeUndefined();
});

it('retains isolated AppStorage test routing', async () => {
  Toast.error({
    title: appStorageError,
    nativeStorageRecoveryTestSessionId: 'storage-repair-test-123-abc',
  });
  showLatest();
  fireEvent.click(screen.getByTestId('native-storage-repair-toast-action'));
  await waitFor(() =>
    expect(getRequestedNativeStorageRecoveryTestSessionId()).toBe(
      'storage-repair-test-123-abc',
    ),
  );
});

it('does not append a second managed recovery button inside existing actions', () => {
  Toast.error({
    title: appStorageError,
    actions: (
      <>
        <Button testID="native-storage-repair-toast-action">
          Existing repair
        </Button>
      </>
    ),
  });
  showLatest();
  expect(
    screen.getAllByTestId('native-storage-repair-toast-action'),
  ).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Existing repair' })).toBeTruthy();
});

it.each([
  'Ordinary failure',
  'Native storage migration target is inconsistent:appStorageFake',
  'App-storage MMKV migration marker is missing',
  `${appStorageError}\n${jotaiError}`,
])(
  'does not modify an unrelated, incomplete or ambiguous diagnostic',
  (title) => {
    Toast.error({
      title,
      actions: <button type="button">Existing action</button>,
    });
    showLatest();
    expect(
      screen.queryByTestId('native-storage-repair-toast-action'),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Existing action' }),
    ).toBeTruthy();
  },
);

it('does not add a repair action on non-native platforms', () => {
  jest.replaceProperty(platformEnv, 'isNative', false);
  Toast.error({
    title: appStorageError,
    message: 'Unchanged',
    actions: <button type="button">Existing action</button>,
  });
  showLatest();
  expect(screen.queryByTestId('native-storage-repair-toast-action')).toBeNull();
  expect(screen.getByText(appStorageError)).toBeTruthy();
  expect(screen.getByText('Unchanged')).toBeTruthy();
});

it('covers notifications without replacing their click action or icon', async () => {
  const onPress = jest.fn();
  Toast.notification({
    title: 'Original notification',
    message: appStorageError,
    icon: 'ErrorOutline',
    onPress,
  });
  const content = mockShowMessage.mock.calls[0][0].renderContent();
  expect(content.props.icon).toBe('ErrorOutline');
  render(content);
  fireEvent.click(screen.getByText('Original notification'));
  expect(onPress).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByTestId('native-storage-repair-toast-action'));
  await waitFor(() =>
    expect(getRequestedNativeStorageRecovery()).toBe('appStorage'),
  );
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('covers Toast.show when custom content uses ToastContent', async () => {
  Toast.show({
    children: <ToastContent title={appStorageError} message="Custom details" />,
  });
  expect(mockMount.mock.calls[0][0].target).toBe('global');
  render(mockMount.mock.calls[0][0].node);
  expect(screen.getByText('Custom details')).toBeTruthy();
  fireEvent.click(screen.getByTestId('native-storage-repair-toast-action'));
  await waitFor(() =>
    expect(getRequestedNativeStorageRecovery()).toBe('appStorage'),
  );
});
