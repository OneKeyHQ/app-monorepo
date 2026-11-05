/** @jest-environment jsdom */

import type { ReactElement } from 'react';

import { act, render, renderHook, screen } from '@testing-library/react';

import type { ILiteCardDiagnostic } from '@onekeyhq/shared/src/logger/scopes/hardware/scenes/litecard';

import useNFC from './useNFC';

type IDialogContent = {
  renderContent: ReactElement;
  onConfirm?: (instance: { preventClose: () => void }) => void;
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
const mockRemoveConnectListeners = jest.fn();
const mockShowDialog = jest.fn((content: IDialogContent) => {
  mockDialogContent = content;
  return { close: mockClose };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyfe/react-native-lite-card', () => ({
  __esModule: true,
  default: {
    addConnectListener: (listener: (event: { code: number }) => void) => {
      mockConnectListener = listener;
    },
    removeConnectListeners: () => {
      mockRemoveConnectListeners();
    },
  },
  CardErrors: {},
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
  const callback = jest.fn();
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
  renderHook(() => useNFC());
  act(() => mockConnectListener?.({ code: 2 }));
  expect(mockShowDialog).toHaveBeenCalledTimes(1);
  render(mockDialogContent?.renderContent);
  expect(screen.getByTestId('nfc-animation-frame').style.height).toBe('225px');
  const animation = await screen.findByTestId('nfc-animation');
  expect(animation.textContent).toBe('connecting');
  expect(animation.getAttribute('data-height')).toBe('225');
});

it('keeps iOS connection behind confirmation while its animation loads independently', async () => {
  mockAndroid = false;
  const { result } = renderHook(() => useNFC());
  const callback = jest.fn();
  await act(async () => result.current.createNFCConnection(callback)());
  expect(mockConnectListener).toBeUndefined();
  expect(callback).not.toHaveBeenCalled();
  render(mockDialogContent?.renderContent);
  expect(screen.getByTestId('nfc-animation-frame').style.height).toBe('205px');
  expect((await screen.findByTestId('nfc-animation')).textContent).toBe(
    'searching',
  );
  const preventClose = jest.fn();
  act(() => mockDialogContent?.onConfirm?.({ preventClose }));
  expect(preventClose).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledTimes(1);
});

it('records dialog callbacks with the original local ID and whitelisted close reason', async () => {
  mockAndroid = false;
  const { result } = renderHook(() => useNFC());
  const callback = jest.fn();
  await act(async () => result.current.createNFCConnection(callback)());
  const firstDialog = mockDialogContent;
  const firstId = mockDiagnostic.mock.calls[0][0].operationId as string;
  await act(async () => result.current.createNFCConnection(callback)());
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
});

it('keeps Android callback completion independent from the connection wrapper', async () => {
  const { result } = renderHook(() => useNFC());
  let complete: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const callback = jest.fn(() => pending);
  await act(async () => result.current.createNFCConnection(callback)());
  expect(callback).toHaveBeenCalledTimes(1);
  expect(mockDiagnostic.mock.calls.map(([event]) => event.phase)).toEqual([
    'dialog-show-request',
    'dialog-show-returned',
    'callback-enter',
  ]);
  complete?.();
  await pending;
});
