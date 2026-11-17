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

import {
  TOAST_COLOR_KEYS,
  TOAST_FONT_KEYS,
  setToastStyleContext,
} from './toastStyleContext';

import type {
  IToastColorKey,
  IToastFont,
  IToastFontKey,
  IToastStyleContext,
} from './toastStyleContext';
import type {
  IOverlayToastHandlers,
  IOverlayToastSpec,
  IOverlayToastText,
} from '@onekeyfe/react-native-native-overlay';

const mockMount = jest.fn<
  { destroy: () => void },
  [{ node: ReactNode; target: string }]
>(() => ({
  destroy: jest.fn(),
}));
const mockShow = jest.fn(
  (_spec: IOverlayToastSpec, _handlers: IOverlayToastHandlers) => undefined,
);
const mockDismiss = jest.fn((_id: string) => undefined);
let mockNextId = 0;
function mockView({
  children,
  onPress,
}: {
  children?: ReactNode;
  onPress?: () => void;
}) {
  return <div onClick={onPress}>{children}</div>;
}
jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  OverlayToastHost: () => null,
  overlayToastStore: {
    createId: () => {
      mockNextId += 1;
      return `toast-${mockNextId}`;
    },
    show: (spec: IOverlayToastSpec, handlers: IOverlayToastHandlers) =>
      mockShow(spec, handlers),
    update: jest.fn(),
    dismiss: (id: string) => mockDismiss(id),
    configure: jest.fn(),
  },
}));
jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ height: 900 }),
  I18nManager: { isRTL: false },
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
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
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
  View: mockView,
  XStack: mockView,
  YStack: mockView,
}));
jest.mock('../../primitives/Icon/Icons', () => ({
  resolveIconName: (name: string) => name,
}));
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
jest.mock('./ToastHost', () => ({ ToastHost: () => null }));
jest.mock('./toastIconHref', () => ({ getToastIconHref: () => undefined }));

const RECOVERY_TEST_ID = 'native-storage-repair-toast-action';
const appStorageError =
  createNativeStorageMigrationInconsistentErrorMessage('appStorage');
const jotaiError =
  createNativeStorageMigrationInconsistentErrorMessage('jotai');

function createContext(): IToastStyleContext {
  const colors = {} as Record<IToastColorKey, string>;
  TOAST_COLOR_KEYS.forEach((key) => {
    colors[key] = `color-${key}`;
  });
  const fonts = {} as Record<IToastFontKey, IToastFont>;
  TOAST_FONT_KEYS.forEach((key) => {
    fonts[key] = {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '400',
      letterSpacing: 0,
    };
  });
  return {
    colors,
    fonts,
    isWide: false,
    isRTL: false,
    // The line is its own default message; plain text passes through.
    intl: {
      formatMessage: ({
        id,
        defaultMessage,
      }: {
        id: string;
        defaultMessage?: string;
      }) => defaultMessage ?? id,
    } as unknown as IToastStyleContext['intl'],
  };
}

function latest() {
  const [spec, handlers] = mockShow.mock.calls.at(-1)!;
  return { spec, handlers };
}

function textOf(text?: IOverlayToastText) {
  return (text?.paragraphs ?? [])
    .map((runs) => runs.map((run) => run.text).join(''))
    .join('\n');
}

function pressAction(testID: string) {
  const { spec, handlers } = latest();
  const action = spec.actions?.find((item) => item.testID === testID);
  expect(action).toBeTruthy();
  handlers.onAction?.(action!.id);
}

function recoveryActions() {
  return (latest().spec.actions ?? []).filter(
    (action) => action.testID === RECOVERY_TEST_ID,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(platformEnv, 'isNative', true);
  dismissNativeStorageRecovery();
  setToastStyleContext(createContext());
});
afterEach(() => jest.restoreAllMocks());

it.each([true, false])(
  'renders ordinary notification actions with isNative=%s',
  (isNative) => {
    jest.replaceProperty(platformEnv, 'isNative', isNative);
    const open = jest.fn();
    const pressCard = jest.fn();
    Toast.notification({
      title: 'Support reply',
      message: 'A test reply',
      onPress: pressCard,
      actions: {
        label: 'View conversation',
        testID: 'test-support-notification-open',
        onPress: open,
      },
      actionsAlign: 'left',
    });
    const { spec } = latest();
    expect(spec.layout).toBe('notification');
    expect(spec.actionsAlign).toBe('left');
    expect(spec.actions?.map((action) => action.label)).toEqual([
      'View conversation',
    ]);
    expect(recoveryActions()).toHaveLength(0);
    pressAction('test-support-notification-open');
    expect(open).toHaveBeenCalledTimes(1);
    expect(pressCard).not.toHaveBeenCalled();
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
    const { spec } = latest();
    expect(spec).toMatchObject({
      id: `direct-${method}`,
      layout: 'message',
      duration: 8123,
    });
    expect(textOf(spec.title)).toBe(title);
    expect(textOf(spec.message)).toBe('Original message\nkept verbatim');
    expect(spec.icon).toMatchObject({ kind: 'icon', name: 'ErrorOutline' });
    expect(recoveryActions()).toHaveLength(1);
    expect(getRequestedNativeStorageRecovery()).toBeUndefined();
    pressAction(RECOVERY_TEST_ID);
    await waitFor(() =>
      expect(getRequestedNativeStorageRecovery()).toBe('appStorage'),
    );
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(mockDismiss).toHaveBeenCalledWith(`direct-${method}`);
  },
);

it('matches a diagnostic only in message and preserves existing actions', async () => {
  const copy = jest.fn();
  Toast.error({
    title: 'Original title',
    message: jotaiError,
    actions: { label: 'Copy diagnostic', testID: 'copy', onPress: copy },
    nativeStorageRecoveryTestSessionId: 'storage-repair-test-123-abc',
  });
  expect(latest().spec.actions?.map((action) => action.label)).toEqual([
    'Copy diagnostic',
    'global.retry',
  ]);
  pressAction('copy');
  expect(copy).toHaveBeenCalledTimes(1);
  expect(getRequestedNativeStorageRecovery()).toBeUndefined();
  pressAction(RECOVERY_TEST_ID);
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
  pressAction(RECOVERY_TEST_ID);
  await waitFor(() =>
    expect(getRequestedNativeStorageRecoveryTestSessionId()).toBe(
      'storage-repair-test-123-abc',
    ),
  );
});

it('does not append a second managed recovery button to existing actions', () => {
  Toast.error({
    title: appStorageError,
    actions: [{ label: 'Existing repair', testID: RECOVERY_TEST_ID }],
  });
  expect(recoveryActions()).toHaveLength(1);
  expect(recoveryActions()[0]?.label).toBe('Existing repair');
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
      actions: { label: 'Existing action' },
    });
    expect(recoveryActions()).toHaveLength(0);
    expect(latest().spec.actions?.map((action) => action.label)).toEqual([
      'Existing action',
    ]);
  },
);

it('does not add a repair action on non-native platforms', () => {
  jest.replaceProperty(platformEnv, 'isNative', false);
  Toast.error({
    title: appStorageError,
    message: 'Unchanged',
    actions: { label: 'Existing action' },
  });
  const { spec } = latest();
  expect(recoveryActions()).toHaveLength(0);
  expect(textOf(spec.title)).toBe(appStorageError);
  expect(textOf(spec.message)).toBe('Unchanged');
});

it('covers notifications without replacing their click action or icon', async () => {
  const onPress = jest.fn();
  Toast.notification({
    title: 'Original notification',
    message: appStorageError,
    icon: 'ErrorOutline',
    onPress,
  });
  const { spec, handlers } = latest();
  expect(spec.layout).toBe('notification');
  expect(spec.icon).toMatchObject({ kind: 'icon', name: 'ErrorOutline' });
  handlers.onPress?.();
  expect(onPress).toHaveBeenCalledTimes(1);
  pressAction(RECOVERY_TEST_ID);
  await waitFor(() =>
    expect(getRequestedNativeStorageRecovery()).toBe('appStorage'),
  );
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('waits for the style context, then draws the pending toast', () => {
  setToastStyleContext(undefined);
  const onClose = jest.fn();
  const toast = Toast.success({ title: 'Early', onClose });
  expect(mockShow).not.toHaveBeenCalled();
  setToastStyleContext(createContext());
  expect(mockShow).toHaveBeenCalledTimes(1);
  expect(textOf(latest().spec.title)).toBe('Early');
  toast?.close();
  expect(mockDismiss).toHaveBeenCalledTimes(1);
});

it('covers Toast.show when custom content uses ToastContent', async () => {
  Toast.show({
    children: <ToastContent title={appStorageError} message="Custom details" />,
  });
  expect(mockMount.mock.calls[0][0].target).toBe('global');
  render(mockMount.mock.calls[0][0].node);
  expect(screen.getByText('Custom details')).toBeTruthy();
  fireEvent.click(screen.getByTestId(RECOVERY_TEST_ID));
  await waitFor(() =>
    expect(getRequestedNativeStorageRecovery()).toBe('appStorage'),
  );
});
