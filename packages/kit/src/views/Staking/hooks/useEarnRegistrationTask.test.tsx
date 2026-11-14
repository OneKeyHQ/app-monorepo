/** @jest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';

import { createEarnRegistrationTask } from '@onekeyhq/kit/src/views/Earn/tasks/earnRegistrationTask';
import { showKYCDialog } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/showKYCDialog';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { useEarnRegistrationTask } from './useEarnRegistrationTask';

const mockGetAccount = jest.fn<Promise<{ address: string }>, [unknown]>();
const mockBuildMessage = jest.fn<Promise<{ message: string }>, [unknown]>();
const mockSign = jest.fn<Promise<string>, [unknown]>();
const mockVerify = jest.fn<Promise<{ result: boolean }>, [unknown]>();
const mockDialogShow = jest.fn<void, [{ onCloseStart?: () => void }]>();
const mockToastMessage = jest.fn<void, [unknown]>();

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: (value: { onCloseStart?: () => void }) => mockDialogShow(value),
  },
  Toast: {
    message: (params: unknown) => mockToastMessage(params),
  },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText',
  () => ({
    EarnText: () => null,
  }),
);
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/utils/messageUtils', () => ({
  autoFixPersonalSignMessage: ({ message }: { message: string }) => message,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: { getAccount: (value: unknown) => mockGetAccount(value) },
    serviceStaking: {
      buildRegisterSignMessageData: (value: unknown) => mockBuildMessage(value),
      verifyRegisterSignMessage: (value: unknown) => mockVerify(value),
    },
    serviceDApp: { openSignMessageModal: (value: unknown) => mockSign(value) },
  },
}));

const scope = {
  accountId: 'account-a',
  networkId: 'evm--1',
  accountAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  provider: 'lista',
  symbol: 'LISTA',
};

beforeEach(() => {
  jest.resetAllMocks();
  mockGetAccount.mockResolvedValue({ address: scope.accountAddress });
  mockBuildMessage.mockResolvedValue({ message: 'registration message' });
  mockSign.mockResolvedValue('0xsignature');
  mockVerify.mockResolvedValue({ result: true });
});

it('runs a signed registration as signature followed by remote verification', async () => {
  const { result } = renderHook(() => useEarnRegistrationTask(scope));
  await expect(
    result.current({
      mode: 'signed',
      request: { origin: 'https://lista.org/', scope: 'ethereum' },
    }),
  ).resolves.toEqual({ result: true });
  expect(mockSign).toHaveBeenCalledTimes(1);
  expect(mockVerify).toHaveBeenCalledWith({
    networkId: scope.networkId,
    provider: scope.provider,
    symbol: scope.symbol,
    accountAddress: scope.accountAddress,
    signature: '0xsignature',
    message: 'registration message',
  });
  expect(mockSign.mock.invocationCallOrder[0]).toBeLessThan(
    mockVerify.mock.invocationCallOrder[0],
  );
});

it('does not verify a late signature after the account scope changes', async () => {
  let resolveSign: (value: string) => void = () => undefined;
  mockSign.mockReturnValue(
    new Promise<string>((resolve) => {
      resolveSign = resolve;
    }),
  );
  const { result, rerender } = renderHook(
    ({ accountId }: { accountId: string }) =>
      useEarnRegistrationTask({ ...scope, accountId }),
    { initialProps: { accountId: scope.accountId } },
  );
  const operation = result.current({
    mode: 'signed',
    request: { origin: 'https://lista.org/', scope: 'ethereum' },
  });
  await waitFor(() => expect(mockSign).toHaveBeenCalledTimes(1));
  rerender({ accountId: 'account-b' });
  resolveSign('0xsignature');
  await expect(operation).resolves.toBeUndefined();
  expect(mockVerify).not.toHaveBeenCalled();
});

it('activates without constructing or signing a message', async () => {
  const { result } = renderHook(() =>
    useEarnRegistrationTask({ ...scope, provider: 'ethena', symbol: 'USDE' }),
  );
  await expect(result.current({ mode: 'activation' })).resolves.toEqual({
    result: true,
  });
  expect(mockBuildMessage).not.toHaveBeenCalled();
  expect(mockSign).not.toHaveBeenCalled();
  expect(mockVerify).toHaveBeenCalledWith(
    expect.objectContaining({ provider: 'ethena', signature: '', message: '' }),
  );
});

it('returns the activation response unchanged', async () => {
  mockVerify.mockResolvedValueOnce({ result: false });
  const { result } = renderHook(() =>
    useEarnRegistrationTask({ ...scope, provider: 'ethena', symbol: 'USDE' }),
  );
  await expect(result.current({ mode: 'activation' })).resolves.toEqual({
    result: false,
  });
});

it('allows another registration attempt after a failed request', async () => {
  mockVerify.mockRejectedValueOnce(new Error('connection lost'));
  const { result } = renderHook(() => useEarnRegistrationTask(scope));
  await expect(result.current({ mode: 'activation' })).rejects.toThrow(
    'connection lost',
  );
  await expect(result.current({ mode: 'activation' })).resolves.toEqual({
    result: true,
  });
  expect(mockVerify).toHaveBeenCalledTimes(2);
});

it('prevents concurrent registration for the same address and provider across symbols', async () => {
  let resolveVerify: (value: { result: boolean }) => void = () => undefined;
  mockVerify.mockReturnValue(
    new Promise<{ result: boolean }>((resolve) => {
      resolveVerify = resolve;
    }),
  );
  const first = renderHook(() => useEarnRegistrationTask(scope));
  const second = renderHook(() =>
    useEarnRegistrationTask({ ...scope, symbol: 'another-symbol' }),
  );
  const operation = first.result.current({ mode: 'activation' });
  await waitFor(() => expect(mockVerify).toHaveBeenCalledTimes(1));
  await expect(second.result.current({ mode: 'activation' })).rejects.toThrow(
    'Earn registration already in progress',
  );
  resolveVerify({ result: true });
  await expect(operation).resolves.toEqual({ result: true });
});

it('does not report a result after the activation dialog is closed', async () => {
  let resolveVerify: (value: { result: boolean }) => void = () => undefined;
  mockVerify.mockReturnValue(
    new Promise<{ result: boolean }>((resolve) => {
      resolveVerify = resolve;
    }),
  );
  const { result } = renderHook(() =>
    useEarnRegistrationTask({ ...scope, provider: 'ethena', symbol: 'USDE' }),
  );
  const controller = new AbortController();
  showKYCDialog({
    actionData: {
      type: 'activate',
      disabled: false,
      text: { text: 'Activate' },
      data: { title: { text: 'Activate' }, description: [] },
    },
    onConfirm: async () => undefined,
    onCloseStart: () => controller.abort(),
  });
  const operation = result.current({
    mode: 'activation',
    signal: controller.signal,
  });
  await waitFor(() => expect(mockVerify).toHaveBeenCalledTimes(1));
  const dialogOptions = mockDialogShow.mock.calls[0][0];
  expect(dialogOptions.onCloseStart).toBeDefined();
  dialogOptions.onCloseStart?.();
  resolveVerify({ result: true });
  await expect(operation).resolves.toBeUndefined();
});

it('retains an unknown external result without publishing the signature', async () => {
  const task = createEarnRegistrationTask({
    identity: {
      ...scope,
      action: 'register',
      intent: { symbol: scope.symbol, mode: 'signed' },
    },
    sign: async () => ({ message: 'message', signature: 'private-signature' }),
    verify: async () => {
      throw new OneKeyLocalError('connection lost');
    },
    ensureAccount: async () => undefined,
    isCurrent: () => true,
  });
  await expect(task.runRegistration()).rejects.toThrow('connection lost');
  expect(task.getTask().steps.map((step) => step.status.type)).toEqual([
    'completed',
    'unknown',
  ]);
  expect(JSON.stringify(task.getTask())).not.toContain('private-signature');
});

it('returns a negative verification result without changing its meaning', async () => {
  const task = createEarnRegistrationTask({
    identity: {
      ...scope,
      provider: 'ethena',
      action: 'register',
      intent: { symbol: scope.symbol, mode: 'activation' },
    },
    verify: async () => ({ result: false }),
    ensureAccount: async () => undefined,
    isCurrent: () => true,
  });
  await expect(task.runRegistration()).resolves.toEqual({ result: false });
  expect(task.getTask().steps[0]?.status.type).toBe('completed');
});

it('does not return a late activation response after cancellation', async () => {
  let resolveVerify: (value: { result: boolean }) => void = () => undefined;
  const task = createEarnRegistrationTask({
    identity: {
      ...scope,
      provider: 'ethena',
      action: 'register',
      intent: { symbol: scope.symbol, mode: 'activation' },
    },
    verify: () =>
      new Promise<{ result: boolean }>((resolve) => {
        resolveVerify = resolve;
      }),
    ensureAccount: async () => undefined,
    isCurrent: () => true,
  });
  const operation = task.runRegistration();
  await waitFor(() =>
    expect(task.getTask().steps[0]?.status.type).toBe('executing'),
  );
  task.cancel();
  resolveVerify({ result: false });
  await expect(operation).resolves.toBeUndefined();
  expect(task.getTask().steps[0]?.status.type).toBe('completed');
});
