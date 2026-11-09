/** @jest-environment jsdom */

import type { ReactElement } from 'react';

import { act, render, renderHook, screen } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { ILiteCardDiagnostic } from '@onekeyhq/shared/src/logger/scopes/hardware/scenes/litecard';

import useNFC from './useNFC';
import useOperationDialog from './useOperationDialog';
import usePIN from './usePIN';

type IDialogContent = {
  renderContent: ReactElement;
  onConfirm?: (instance: {
    preventClose: () => void;
    getForm?: () => { getValues: () => { password: string } };
  }) => void;
  onCloseStart?: () => void;
  onClose?: (extra?: { flag?: string }) => void;
};

const mockDiagnostic = jest.fn<void, [ILiteCardDiagnostic]>();

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    hardware: {
      liteCard: {
        diagnostic: (event: ILiteCardDiagnostic) => mockDiagnostic(event),
      },
    },
  },
}));

let mockAndroid = true;
let mockConnectListener: ((event: { code: number }) => void) | undefined;
let mockDialogContent: IDialogContent | undefined;
const mockClose = jest.fn(async () => undefined);
const mockPermission = jest.fn<
  Promise<{ error: { code: number; message: string | null } | null }>,
  []
>();
const mockRemoveConnectListeners = jest.fn();
const mockShowDialog = jest.fn((content: IDialogContent) => {
  mockDialogContent = content;
  return { close: mockClose };
});

jest.mock('../components/PasswordKeyboard', () => ({
  PasswordKeyboard: () => null,
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyfe/react-native-lite-card', () => ({
  __esModule: true,
  default: {
    cancel: jest.fn(),
    checkNFCPermission: () => mockPermission(),
    addConnectListener: (listener: (event: { code: number }) => void) => {
      mockConnectListener = listener;
    },
    removeConnectListeners: () => {
      mockRemoveConnectListeners();
    },
  },
  CardErrors: { UserCancel: 2004, InitializedError: 4001, PasswordWrong: 3001 },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNativeAndroid() {
      return mockAndroid;
    },
  },
}));
jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: (content: IDialogContent) => mockShowDialog(content),
    confirm: (content: IDialogContent) => mockShowDialog(content),
  },
  Stack: ({ children, height }: { children: ReactElement; height: number }) => (
    <div data-testid="nfc-animation-frame" style={{ height }}>
      {children}
    </div>
  ),
  LottieView: ({
    source,
    height,
  }: {
    source: { animation: string };
    height: number;
  }) => (
    <div data-testid="nfc-animation" data-height={height}>
      {source.animation}
    </div>
  ),
  RichSizeableText: () => null,
  SizableText: () => null,
}));
jest.mock(
  '@onekeyhq/kit/assets/animations/connect_onekeylite_connecting.json',
  () => ({ animation: 'connecting' }),
);
jest.mock(
  '@onekeyhq/kit/assets/animations/connect_onekeylite_searching.json',
  () => ({ animation: 'searching' }),
);
jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger',
  () => ({
    LogLevel: { Error: 'ERROR', Warning: 'WARNING' },
    NativeLogger: { write: jest.fn() },
  }),
);
jest.mock('@onekeyhq/shared/src/utils/appVisibility', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => undefined,
}));

beforeEach(() => {
  mockAndroid = true;
  mockConnectListener = undefined;
  mockDialogContent = undefined;
  jest.clearAllMocks();
});

it('starts Android NFC immediately and reserves searching animation height during lazy loading', async () => {
  const { result, unmount } = renderHook(() => useNFC());
  const callback = jest.fn(async () => undefined);
  await act(async () => result.current.createNFCConnection(callback)());
  expect(callback).toHaveBeenCalledTimes(1);
  render(mockDialogContent?.renderContent);
  expect(screen.getByTestId('nfc-animation-frame').style.height).toBe('205px');
  const animation = await screen.findByTestId('nfc-animation');
  expect(animation.textContent).toBe('searching');
  expect(animation.getAttribute('data-height')).toBe('205');
  unmount();
  expect(mockRemoveConnectListeners).toHaveBeenCalledTimes(1);
});

it('keeps the Android transfer event and its connecting animation dimensions', async () => {
  const { result, unmount } = renderHook(() => useNFC());
  const pending = result.current
    .createNFCConnection(() => new Promise<void>(() => undefined))()
    .catch(() => undefined);
  act(() => mockConnectListener?.({ code: 2 }));
  expect(mockShowDialog).toHaveBeenCalledTimes(2);
  render(mockDialogContent?.renderContent);
  expect(screen.getByTestId('nfc-animation-frame').style.height).toBe('225px');
  const animation = await screen.findByTestId('nfc-animation');
  expect(animation.textContent).toBe('connecting');
  expect(animation.getAttribute('data-height')).toBe('225');
  unmount();
  await pending;
});

it('keeps iOS connection behind confirmation while its animation loads independently', async () => {
  mockAndroid = false;
  const { result } = renderHook(() => useNFC());
  const callback = jest.fn(async () => undefined);
  const connection = result.current.createNFCConnection(callback)();
  expect(mockConnectListener).toBeUndefined();
  expect(callback).not.toHaveBeenCalled();
  render(mockDialogContent?.renderContent);
  expect(screen.getByTestId('nfc-animation-frame').style.height).toBe('205px');
  expect((await screen.findByTestId('nfc-animation')).textContent).toBe(
    'searching',
  );
  const preventClose = jest.fn();
  await act(async () => {
    mockDialogContent?.onConfirm?.({ preventClose });
    await connection;
  });
  expect(preventClose).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledTimes(1);
});

it('records dialog callbacks with the original local ID and whitelisted close reason', async () => {
  mockAndroid = false;
  const { result } = renderHook(() => useNFC());
  const callback = jest.fn(async () => undefined);
  const first = result.current
    .createNFCConnection(callback)()
    .catch(() => undefined);
  const firstDialog = mockDialogContent;
  const firstId = mockDiagnostic.mock.calls[0][0].operationId as string;
  const second = result.current
    .createNFCConnection(callback)()
    .catch(() => undefined);
  const secondDialog = mockDialogContent;
  const secondId = mockDiagnostic.mock.calls[2][0].operationId as string;
  expect(firstId).not.toBe(secondId);
  firstDialog?.onCloseStart?.();
  firstDialog?.onClose?.({ flag: 'excluded-private-value' });
  expect(mockDiagnostic).toHaveBeenLastCalledWith(
    expect.objectContaining({
      operation: 'nfc',
      operationId: firstId,
      phase: 'dialog-close',
      closeReason: 'other',
    }),
  );
  expect(JSON.stringify(mockDiagnostic.mock.calls)).not.toContain(
    'excluded-private-value',
  );
  expect(callback).not.toHaveBeenCalled();
  secondDialog?.onClose?.();
  await Promise.all([first, second]);
});

it('waits for the Android callback before settling the connection', async () => {
  const { result } = renderHook(() => useNFC());
  let complete: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const callback = jest.fn(() => pending);
  let settled = false;
  const connection = result.current
    .createNFCConnection(callback)()
    .then(() => {
      settled = true;
    });
  await act(async () => undefined);
  expect(settled).toBe(false);
  expect(callback).toHaveBeenCalledTimes(1);
  expect(mockDiagnostic.mock.calls.map(([event]) => event.phase)).toEqual([
    'dialog-show-request',
    'dialog-show-returned',
    'callback-enter',
  ]);
  complete?.();
  await connection;
  expect(settled).toBe(true);
});

it('propagates callback rejection', async () => {
  const { result } = renderHook(() => useNFC());
  await expect(
    result.current.createNFCConnection(async () => {
      throw new OneKeyLocalError('native failed');
    })(),
  ).rejects.toThrow('native failed');
  expect(mockClose).toHaveBeenCalledTimes(1);
});

it('starts iOS only once and rejects a pre-confirm close', async () => {
  mockAndroid = false;
  const { result } = renderHook(() => useNFC());
  const cancelled = result.current.createNFCConnection(async () => undefined)();
  const rejected = cancelled.catch((error: unknown) => error);
  mockDialogContent?.onClose?.({ flag: 'cancel' });
  expect(await rejected).toEqual(
    expect.objectContaining({ message: 'NFC operation cancelled' }),
  );
  const callback = jest.fn(async () => 42);
  const connection = result.current.createNFCConnection(callback)();
  const instance = { preventClose: jest.fn() };
  mockDialogContent?.onConfirm?.(instance);
  mockDialogContent?.onConfirm?.(instance);
  await expect(connection).resolves.toBe(42);
  expect(callback).toHaveBeenCalledTimes(1);
});

it('settles pending connections and error decisions on unmount', async () => {
  const { result, unmount } = renderHook(() => useNFC());
  const connection = result.current.createNFCConnection(
    () => new Promise<void>(() => undefined),
  )();
  const rejected = connection.catch((error: unknown) => error);
  const decision = result.current.handlerLiteCardError({
    error: { code: 4001, message: null },
  });
  unmount();
  expect(await rejected).toEqual(
    expect.objectContaining({ message: 'NFC operation cancelled' }),
  );
  await expect(decision).resolves.toBe('cancel');
});

it('keeps a retry decision pending until confirmation without running a nested operation', async () => {
  const { result } = renderHook(() => useNFC());
  let settled = false;
  const decision = result.current
    .handlerLiteCardError({ error: { code: 4001, message: null } })
    .then((action) => {
      settled = true;
      return action;
    });
  await Promise.resolve();
  expect(settled).toBe(false);
  mockDialogContent?.onConfirm?.({ preventClose: jest.fn() });
  mockDialogContent?.onClose?.({ flag: 'confirm' });
  await expect(decision).resolves.toBe('retry');
});

it('rejects mismatched card information even when the native result has no error', async () => {
  const { result } = renderHook(() => useNFC());
  const card = {
    serialNum: 'first',
    hasBackup: false,
    isNewCard: true,
    pinRetryCount: 10,
  };
  const decision = result.current.handlerLiteCardError({
    cardInfo: { ...card, serialNum: 'second' },
    lastCardInfo: card,
  });
  mockDialogContent?.onConfirm?.({ preventClose: jest.fn() });
  await expect(decision).resolves.toBe('cancel');
});

it('cancels an Android user close before starting native work and ignores late events', async () => {
  const { result } = renderHook(() => useNFC());
  const callback = jest.fn(async () => undefined);
  const pending = result.current
    .createNFCConnection(callback)()
    .catch((error: unknown) => error);
  mockDialogContent?.onClose?.({ flag: 'cancel' });
  expect(await pending).toEqual(
    expect.objectContaining({ message: 'NFC operation cancelled' }),
  );
  expect(callback).not.toHaveBeenCalled();
  const shown = mockShowDialog.mock.calls.length;
  act(() => mockConnectListener?.({ code: 2 }));
  expect(mockShowDialog).toHaveBeenCalledTimes(shown);
});

it.each(['pin', 'overwrite', 'reset'] as const)(
  'settles the %s prompt when it closes without confirmation',
  async (kind) => {
    const { result } = renderHook(() => ({
      ...usePIN(),
      ...useOperationDialog(),
    }));
    let pending: Promise<string | void>;
    if (kind === 'pin') pending = result.current.showPINFormDialog();
    else if (kind === 'overwrite')
      pending = result.current.showBackupOverwrittenDialog();
    else pending = result.current.showResetWarningDialog();
    const outcome = pending.catch((error: unknown) => error);
    mockDialogContent?.onClose?.({ flag: 'cancel' });
    expect(await outcome).toBeInstanceOf(Error);
  },
);

it.each(['pin', 'overwrite', 'reset'] as const)(
  'preserves a confirmed %s prompt across its automatic close',
  async (kind) => {
    const { result } = renderHook(() => ({
      ...usePIN(),
      ...useOperationDialog(),
    }));
    let pending: Promise<string | void>;
    if (kind === 'pin') pending = result.current.showPINFormDialog();
    else if (kind === 'overwrite')
      pending = result.current.showBackupOverwrittenDialog();
    else pending = result.current.showResetWarningDialog();
    mockDialogContent?.onConfirm?.({
      preventClose: jest.fn(),
      getForm: () => ({ getValues: () => ({ password: '000000' }) }),
    });
    mockDialogContent?.onClose?.({ flag: 'confirm' });
    expect(await pending).toBe(kind === 'pin' ? '000000' : undefined);
  },
);

it('closes and terminates owned PIN and overwrite prompts on unmount', async () => {
  const { result, unmount } = renderHook(() => ({
    ...usePIN(),
    ...useOperationDialog(),
  }));
  const pin = result.current
    .showPINFormDialog()
    .catch((error: unknown) => error);
  const overwrite = result.current
    .showBackupOverwrittenDialog()
    .catch((error: unknown) => error);
  unmount();
  expect(await pin).toBeInstanceOf(Error);
  expect(await overwrite).toBeInstanceOf(Error);
  expect(mockClose).toHaveBeenCalledTimes(2);
});

it('drops a late NFC permission error after unmount', async () => {
  let complete:
    | ((value: { error: { code: number; message: null } }) => void)
    | undefined;
  mockPermission.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const { result, unmount } = renderHook(() => useNFC());
  const pending = result.current
    .checkNFCEnabledPermission()
    .catch((error: unknown) => error);
  unmount();
  complete?.({ error: { code: 1001, message: null } });
  expect(await pending).toBeInstanceOf(Error);
  await Promise.resolve();
  expect(mockShowDialog).not.toHaveBeenCalled();
});
