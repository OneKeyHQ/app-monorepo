/** @jest-environment jsdom */

import { isValidElement } from 'react';
import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { PrimeTransferDirection } from './PrimeTransferDirection';

const mockDialogs: IDialogShowProps[] = [];
const mockClosedDialogs = new Set<IDialogShowProps>();
const mockBegin = jest.fn<Promise<string>, []>();
const mockBuild = jest.fn<Promise<IPrimeTransferData>, [unknown]>();
const mockSend = jest.fn<Promise<void>, [unknown]>();
const mockCancel = jest.fn(async (_params?: unknown) => undefined);
const mockExit = jest.fn();
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };
const mockNavigation = { navigate: jest.fn() };
const mockSetState = jest.fn();
const mockRoomUsers = [
  { id: 'sender--123456', appPlatformName: 'Sender' },
  { id: 'receiver--654321', appPlatformName: 'Receiver' },
];
const mockState = {
  status: 'transferring',
  pairedRoomId: 'fixture-room',
  myUserId: mockRoomUsers[0].id,
  transferDirection: {
    fromUserId: mockRoomUsers[0].id,
    toUserId: mockRoomUsers[1].id,
    randomNumber: '123456',
  },
};

jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Alert: () => null,
    Badge: Container,
    Button: Container,
    Icon: () => null,
    IconButton: () => null,
    Page: { Header: () => null, Footer: () => null },
    SizableText: Container,
    Stack: Container,
    XStack: Container,
    YStack: Container,
    Toast: { error: jest.fn() },
    Dialog: {
      show: (props: IDialogShowProps) => {
        mockDialogs.push(props);
        return {
          close: async () => {
            mockClosedDialogs.add(props);
            return props.onClose?.();
          },
        };
      },
    },
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrimeTransfer: {
      beginTransferPreparation: () => mockBegin(),
      buildTransferData: (params: unknown) => mockBuild(params),
      sendTransferData: (params: unknown) => mockSend(params),
      cancelTransfer: (params?: unknown) => mockCancel(params),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/EmailOTPDialog', () => ({
  EmailOTPDialog: () => null,
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: mockRoomUsers }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EPrimeTransferStatus: {
    paired: 'paired',
    transferring: 'transferring',
    init: 'init',
  },
  usePrimeTransferAtom: () => [mockState, mockSetState],
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {},
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));
jest.mock(
  '@onekeyhq/shared/src/appDeviceInfo/utils/getAppDeviceIcon',
  () => ({}),
);
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDev: false },
}));
jest.mock('@onekeyhq/shared/src/utils/primeTransferVerificationCode', () => ({
  buildPrimeTransferVerificationCode: () => ({ ok: true, code: '123456' }),
}));
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: async () => undefined },
}));
jest.mock('./hooks/usePrimeTransferExit', () => ({
  usePrimeTransferExit: () => ({ exitTransferFlow: mockExit }),
}));
jest.mock('./PrimeTransferProcessingDialog', () => ({
  showPrimeTransferProcessingDialog: jest.fn(),
}));

function fixture(): IPrimeTransferData {
  return {
    appVersion: 'fixture',
    publicData: undefined,
    isWatchingOnly: true,
    isEmptyData: false,
    privateData: {
      wallets: {},
      importedAccounts: {},
      watchingAccounts: {},
      credentials: {},
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderConfirmation() {
  render(<PrimeTransferDirection remotePairingCode="fixture-pairing" />);
  const content = mockDialogs[0]?.renderContent;
  if (
    !isValidElement<{ onConfirm: (code: string) => Promise<void> }>(content)
  ) {
    throw new OneKeyLocalError('Expected the verification dialog');
  }
  return content.props.onConfirm;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDialogs.length = 0;
  mockClosedDialogs.clear();
  mockBegin.mockReset().mockResolvedValue('fixture-task');
  mockBuild.mockReset().mockResolvedValue(fixture());
  mockSend.mockReset().mockResolvedValue(undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('same-tick and later duplicate confirmations preserve the active transfer', async () => {
  const delivery = deferred<void>();
  const sending = deferred<void>();
  mockBegin.mockImplementation(async () => {
    if (mockBegin.mock.calls.length > 1)
      throw new OneKeyLocalError('Transfer already in progress');
    return 'fixture-task';
  });
  mockSend.mockImplementation(() => {
    sending.resolve();
    return delivery.promise;
  });
  const confirm = renderConfirmation();
  await act(async () => {
    const first = confirm('123456');
    const duplicate = confirm('123456');
    await sending.promise;
    await expect(duplicate).resolves.toBeUndefined();
    await expect(confirm('123456')).resolves.toBeUndefined();
    expect(mockBegin).toHaveBeenCalledTimes(1);
    expect(mockBuild).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockCancel).not.toHaveBeenCalled();
    delivery.resolve();
    await first;
  });
  expect(mockExit).toHaveBeenCalledTimes(1);
});

test.each(['invalid-code', 'busy-service'] as const)(
  'failure without a task cannot cancel another transfer and allows retry: %s',
  async (failure) => {
    if (failure === 'busy-service') {
      mockBegin.mockRejectedValueOnce(
        new OneKeyLocalError('Transfer already in progress'),
      );
    }
    const confirm = renderConfirmation();
    await act(async () => {
      await expect(
        confirm(failure === 'invalid-code' ? '000000' : '123456'),
      ).rejects.toThrow();
      expect(mockCancel).not.toHaveBeenCalled();
      await confirm('123456');
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockCancel).not.toHaveBeenCalled();
  },
);

test('a rejected reservation keeps the verification dialog open for a real retry', async () => {
  const reservation = deferred<void>();
  const started = deferred<void>();
  mockBegin.mockImplementationOnce(async () => {
    started.resolve();
    await reservation.promise;
    throw new OneKeyLocalError('Transfer already in progress');
  });
  const confirm = renderConfirmation();
  let result: Promise<unknown> = Promise.resolve();
  await act(async () => {
    result = confirm('123456').catch((error: unknown) => error);
    await started.promise;
  });
  expect(mockClosedDialogs.has(mockDialogs[0])).toBe(false);
  expect(mockBuild).not.toHaveBeenCalled();
  await act(async () => {
    reservation.resolve();
    expect(await result).toMatchObject({
      message: 'Transfer already in progress',
    });
  });
  expect(mockDialogs).toHaveLength(1);
  expect(mockClosedDialogs.has(mockDialogs[0])).toBe(false);
  expect(mockCancel).not.toHaveBeenCalled();
  const openDialog = mockDialogs.find(
    (dialog) => !mockClosedDialogs.has(dialog),
  );
  const content = openDialog?.renderContent;
  if (
    !isValidElement<{ onConfirm: (code: string) => Promise<void> }>(content)
  ) {
    throw new OneKeyLocalError(
      'Expected an open verification dialog for retry',
    );
  }
  await act(async () => content.props.onConfirm('123456'));
  expect(mockBegin).toHaveBeenCalledTimes(2);
  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockClosedDialogs.has(mockDialogs[0])).toBe(true);
});

test('preparation failure cancels only its task and releases the submission lock', async () => {
  mockBegin
    .mockResolvedValueOnce('failed-task')
    .mockResolvedValueOnce('retry-task');
  mockBuild.mockRejectedValueOnce(new OneKeyLocalError('Preparation failed'));
  const confirm = renderConfirmation();
  await act(async () => {
    await expect(confirm('123456')).rejects.toThrow('Preparation failed');
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockCancel).toHaveBeenCalledWith({ taskId: 'failed-task' });
    await confirm('123456');
  });
  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({ preparationTaskId: 'retry-task' }),
  );
  expect(mockCancel).toHaveBeenCalledTimes(1);
});

test('declining unavailable credentials cancels the owned task exactly once', async () => {
  mockBuild.mockResolvedValue({
    ...fixture(),
    unavailableCredentials: [
      { credentialId: 'fixture-id', label: 'Fixture wallet' },
    ],
  });
  const shown = deferred<void>();
  mockBuild.mockImplementationOnce(async () => {
    // Resolve before the caller's next continuation so the test can answer its dialog.
    shown.resolve();
    return {
      ...fixture(),
      unavailableCredentials: [
        { credentialId: 'fixture-id', label: 'Fixture wallet' },
      ],
    };
  });
  const confirm = renderConfirmation();
  await act(async () => {
    const result = confirm('123456').catch((error: unknown) => error);
    await shown.promise;
    await Promise.resolve();
    const skipDialog = mockDialogs.find(
      (dialog) => dialog.title === "Some items can't be transferred",
    );
    if (!skipDialog)
      throw new OneKeyLocalError(
        'Expected unavailable-credential confirmation',
      );
    await skipDialog.onClose?.();
    expect(await result).toEqual(
      expect.objectContaining({ message: 'Transfer cancelled by user' }),
    );
  });
  expect(mockCancel).toHaveBeenCalledTimes(1);
  expect(mockCancel).toHaveBeenCalledWith({ taskId: 'fixture-task' });
  expect(mockSend).not.toHaveBeenCalled();
});
