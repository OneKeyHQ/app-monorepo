/** @jest-environment jsdom */
/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, react-perf/jsx-no-new-function-as-prop */
import type { ReactNode } from 'react';

import { Toast, ToastContent } from '.';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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
const { OverlayToastStore: ActualOverlayToastStore } = jest.requireActual<
  typeof import('@onekeyfe/react-native-native-overlay')
>('@onekeyfe/react-native-native-overlay');
const realToastStore = new ActualOverlayToastStore();
const mockShow = jest.fn(
  (spec: IOverlayToastSpec, handlers: IOverlayToastHandlers) =>
    realToastStore.show(spec, handlers),
);
const mockUpdate = jest.fn((spec: IOverlayToastSpec) =>
  realToastStore.update(spec),
);
const mockDismiss = jest.fn((id: string) => realToastStore.dismiss(id));
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
    getSnapshot: () => realToastStore.getSnapshot(),
    subscribe: (listener: () => void) => realToastStore.subscribe(listener),
    show: (spec: IOverlayToastSpec, handlers: IOverlayToastHandlers) =>
      mockShow(spec, handlers),
    update: (spec: IOverlayToastSpec) => mockUpdate(spec),
    dismiss: (id: string) => mockDismiss(id),
    dismissAll: () => realToastStore.dismissAll(),
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
  realToastStore.dismissAll();
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

it('logs button click analytics with testID when pressing a toast action', () => {
  const clickSpy = jest.spyOn(defaultLogger.ui.button, 'click');
  const onPress = jest.fn();
  Toast.message({
    title: 'Action analytics',
    actions: {
      label: 'Track me',
      testID: 'tracked-toast-action',
      onPress,
    },
  });
  pressAction('tracked-toast-action');
  expect(clickSpy).toHaveBeenCalledWith({
    trackId: 'tracked-toast-action',
  });
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('evicts the oldest toast past 20 items, fires its onClose once, and stops rebuilding it', () => {
  const closeCallbacks = Array.from({ length: 21 }, () => jest.fn());
  const instances = closeCallbacks.map((onClose, index) =>
    Toast.message({
      toastId: `queue-toast-${index + 1}`,
      title: `Toast ${index + 1}`,
      onClose,
    }),
  );

  expect(realToastStore.getSnapshot().items).toHaveLength(20);
  expect(
    realToastStore.getSnapshot().items.map((item) => item.spec.id),
  ).not.toContain('queue-toast-1');
  expect(closeCallbacks[0]).toHaveBeenCalledTimes(1);
  closeCallbacks.slice(1).forEach((callback) => {
    expect(callback).not.toHaveBeenCalled();
  });

  mockUpdate.mockClear();
  setToastStyleContext(createContext());
  expect(mockUpdate).toHaveBeenCalledTimes(20);
  expect(mockUpdate.mock.calls.map(([spec]) => spec.id)).not.toContain(
    'queue-toast-1',
  );

  instances[0]?.close();
  expect(closeCallbacks[0]).toHaveBeenCalledTimes(1);
});

it('preserves deduplication record when replacing an unclosed toast with the same toastId', () => {
  let now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  const firstClose = jest.fn();
  const secondClose = jest.fn();
  const thirdClose = jest.fn();

  Toast.error({
    toastId: 'rate-limit-429',
    title: 'First 429',
    duration: 1000,
    onClose: firstClose,
  });
  const firstHandlers = latest().handlers;
  expect(mockShow).toHaveBeenCalledTimes(1);

  // Advance past the first deduplication window (duration + 500ms) while the
  // first card is still active (e.g. paused or in exit animation).
  now += 1600;
  Toast.error({
    toastId: 'rate-limit-429',
    title: 'Second 429',
    duration: 1000,
    onClose: secondClose,
  });
  expect(firstClose).toHaveBeenCalledTimes(1);
  expect(mockShow).toHaveBeenCalledTimes(2);

  // Even if the first card's SDK onClose fires late, the second card's
  // deduplication window must remain intact.
  firstHandlers.onClose?.('timeout');
  now += 100;
  const duplicateResult = Toast.error({
    toastId: 'rate-limit-429',
    title: 'Duplicate 429 within window',
    duration: 1000,
    onClose: thirdClose,
  });
  expect(duplicateResult).toBeUndefined();
  expect(mockShow).toHaveBeenCalledTimes(2);
  expect(secondClose).not.toHaveBeenCalled();
  expect(thirdClose).not.toHaveBeenCalled();
});

it('does not prematurely finish a follow-up toast created inside an evicted onClose callback', () => {
  const followUpOnClose = jest.fn();
  let followUpInstance: { close: () => void } | undefined;

  Toast.message({
    toastId: 'evict-trigger-1',
    title: 'Toast 1',
    onClose: () => {
      followUpInstance = Toast.message({
        toastId: 'follow-up-toast',
        title: 'Follow-up toast',
        onClose: followUpOnClose,
      });
    },
  });

  for (let i = 2; i <= 21; i += 1) {
    Toast.message({
      toastId: `evict-trigger-${i}`,
      title: `Toast ${i}`,
    });
  }

  expect(followUpInstance).toBeDefined();
  expect(followUpOnClose).not.toHaveBeenCalled();
  expect(
    realToastStore.getSnapshot().items.map((item) => item.spec.id),
  ).toContain('follow-up-toast');

  mockUpdate.mockClear();
  setToastStyleContext(createContext());
  expect(mockUpdate.mock.calls.map(([spec]) => spec.id)).toContain(
    'follow-up-toast',
  );

  followUpInstance?.close();
  expect(mockDismiss).toHaveBeenCalledWith('follow-up-toast');
  expect(followUpOnClose).toHaveBeenCalledTimes(1);
});

it('passes raw notification badge and thumbnail image URIs to the overlay spec', () => {
  const rawUri = 'https://uni.onekey-asset.com/push/banner.png';
  Toast.notification({
    title: 'Push with image',
    message: 'Preserve original URL',
    iconImageUri: rawUri,
    imageUri: rawUri,
  });
  const { spec } = latest();
  expect(spec.layout).toBe('notification');
  if (spec.layout === 'notification') {
    expect(spec.icon).toEqual({
      kind: 'image',
      uri: rawUri,
      size: 18,
    });
    expect(spec.image).toEqual({
      uri: rawUri,
      size: 48,
      borderRadius: 4,
    });
  }
});
