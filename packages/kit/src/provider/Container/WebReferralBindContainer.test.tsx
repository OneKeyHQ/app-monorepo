/**
 * @jest-environment jsdom
 */

import { act, render, waitFor } from '@testing-library/react';

import { Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import {
  captureWebReferralCode,
  readWebReferralCode,
} from '../../utils/webReferralCode';

import { WebReferralBindContainer } from './WebReferralBindContainer';

type ITestState = {
  active: {
    ready: boolean;
    account?: { id: string; address: string; createAtNetwork: string };
    wallet?: { id: string };
    network?: { id: string };
    accountName: string;
  };
  selected: {
    walletId: string;
    othersWalletAccountId: string;
    networkId?: string;
  };
  storageReady: boolean;
  connecting: boolean;
  syncing: boolean;
  navigate: jest.Mock;
  rootRouteName: string;
  routeStateListener?: () => void;
};

const mockBag = globalThis as typeof globalThis & {
  __webReferralTest?: ITestState;
};

jest.mock('react-intl', () => {
  const intl = { formatMessage: ({ id }: { id: string }) => id };
  return { useIntl: () => intl };
});

jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: jest.fn() },
  Toast: { success: jest.fn() },
  SizableText: () => null,
  YStack: ({ children }: { children: React.ReactNode }) => children,
  rootNavigationRef: {
    current: {
      getRootState: () => ({
        routes: [
          {
            name:
              (globalThis as typeof mockBag).__webReferralTest?.rootRouteName ??
              'main',
          },
        ],
        index: 0,
      }),
      addListener: (_name: string, listener: () => void) => {
        const state = (globalThis as typeof mockBag).__webReferralTest;
        if (state) state.routeStateListener = listener;
        return () => undefined;
      },
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({
    children,
  }: {
    children: React.ReactNode;
  }) => children,
}));

jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => {
  const navigationToMessageConfirmAsync = (
    ...args: Parameters<ITestState['navigate']>
  ) =>
    (globalThis as typeof mockBag).__webReferralTest?.navigate(...args) as
      | Promise<string>
      | undefined;
  return {
    useSignatureConfirm: () => ({ navigationToMessageConfirmAsync }),
  };
});

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/atoms',
  () => ({
    useAccountSelectorStorageInitDoneAtom: () => [
      (globalThis as typeof mockBag).__webReferralTest?.storageReady,
    ],
    useActiveAccount: () => ({
      activeAccount: (globalThis as typeof mockBag).__webReferralTest?.active,
    }),
    useSelectedAccount: () => ({
      selectedAccount: (globalThis as typeof mockBag).__webReferralTest
        ?.selected,
    }),
    useIsAccountSelectorSyncLoading: () =>
      (globalThis as typeof mockBag).__webReferralTest?.syncing,
  }),
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useOnboardingConnectWalletLoadingAtom: () => [
    (globalThis as typeof mockBag).__webReferralTest?.connecting,
  ],
}));

jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/InvitedByFriend/components',
  () => ({ InvitedByFriendContent: () => null }),
);

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWebDappMode: true },
}));

jest.mock('@onekeyhq/shared/src/utils/messageUtils', () => ({
  autoFixPersonalSignMessage: ({ message }: { message: string }) => message,
}));

jest.mock('@onekeyhq/shared/src/utils/tokenUtils', () => ({
  normalizeTokenContractAddress: ({
    contractAddress,
  }: {
    contractAddress: string;
  }) => contractAddress.toLowerCase(),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceReferralCode: {
      batchCheckWalletsBoundReferralCodeV2: jest.fn(),
      getBoundReferralCodeUnsignedMessage: jest.fn(),
      boundReferralCodeWithSignedMessage: jest.fn(),
      setCachedInviteCode: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    referral: { page: { referralBindingCompleted: jest.fn() } },
  },
}));

const referralService = backgroundApiProxy.serviceReferralCode;
const batchMock = jest.spyOn(
  referralService,
  'batchCheckWalletsBoundReferralCodeV2',
);
const unsignedMessageMock = jest.spyOn(
  referralService,
  'getBoundReferralCodeUnsignedMessage',
);
const bindMock = jest.spyOn(
  referralService,
  'boundReferralCodeWithSignedMessage',
);
const clearCachedCodeMock = jest.spyOn(referralService, 'setCachedInviteCode');
const completedEventMock = jest.spyOn(
  defaultLogger.referral.page,
  'referralBindingCompleted',
);

const address = '0xAbCd';
const normalizedAddress = address.toLowerCase();

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
}

function dialogInstance() {
  return {
    close: jest.fn(async () => undefined),
    isExist: jest.fn(() => false),
    getForm: jest.fn(),
    preventClose: jest.fn(),
  };
}

function setAccount(accountId: string) {
  if (!mockBag.__webReferralTest) return;
  mockBag.__webReferralTest.active = {
    ...mockBag.__webReferralTest.active,
    account: {
      id: accountId,
      address,
      createAtNetwork: 'evm--1',
    },
  };
  mockBag.__webReferralTest.selected = {
    walletId: 'external',
    othersWalletAccountId: accountId,
  };
}

function changeRoute(name: string) {
  if (!mockBag.__webReferralTest) return;
  mockBag.__webReferralTest.rootRouteName = name;
  act(() => mockBag.__webReferralTest?.routeStateListener?.());
}

function expectNoSuccessSideEffects() {
  expect(clearCachedCodeMock).not.toHaveBeenCalled();
  expect(completedEventMock).not.toHaveBeenCalled();
  expect(Toast.success).not.toHaveBeenCalled();
}

async function showPrompt() {
  await waitFor(() => expect(Dialog.show).toHaveBeenCalledTimes(1));
  return jest.mocked(Dialog.show).mock.calls[0][0];
}

beforeEach(() => {
  sessionStorage.clear();
  mockBag.__webReferralTest = {
    active: {
      ready: true,
      account: { id: 'account-A', address, createAtNetwork: 'evm--1' },
      wallet: { id: 'external' },
      network: { id: 'onekeyall--0' },
      accountName: 'Audit wallet',
    },
    selected: { walletId: 'external', othersWalletAccountId: 'account-A' },
    storageReady: true,
    connecting: false,
    syncing: false,
    navigate: jest.fn().mockResolvedValue('signature'),
    rootRouteName: 'main',
  };
  jest.clearAllMocks();
  const instance = dialogInstance();
  jest
    .mocked(Dialog.show)
    .mockReturnValue(instance as ReturnType<typeof Dialog.show>);
  batchMock.mockResolvedValue({
    [`evm--1:${normalizedAddress}`]: { bound: false, bindable: true },
  });
  unsignedMessageMock.mockResolvedValue('message');
  bindMock.mockResolvedValue(true);
  clearCachedCodeMock.mockResolvedValue(undefined);
  captureWebReferralCode('AUDIT661');
  globalThis.history.replaceState({}, '', '/market');
});

afterEach(() => {
  sessionStorage.clear();
});

it('requires server bindable and uses the real EVM chain behind all-networks', async () => {
  const batch = batchMock;
  batch.mockResolvedValue({
    [`evm--1:${normalizedAddress}`]: { bound: false, bindable: false },
  });
  const view = render(<WebReferralBindContainer />);
  await waitFor(() => expect(batch).toHaveBeenCalled());
  expect(batch).toHaveBeenCalledWith(
    [{ address: normalizedAddress, networkId: 'evm--1' }],
    3000,
  );
  expect(Dialog.show).not.toHaveBeenCalled();
  view.unmount();
});

it('uses ETH for referral APIs while signing on the active EVM chain', async () => {
  if (mockBag.__webReferralTest) {
    mockBag.__webReferralTest.active.network = { id: 'evm--10' };
    mockBag.__webReferralTest.selected.networkId = 'evm--10';
  }
  render(<WebReferralBindContainer />);
  const prompt = await showPrompt();
  expect(batchMock).toHaveBeenCalledWith(
    [{ address: normalizedAddress, networkId: 'evm--1' }],
    3000,
  );
  const instance = jest.mocked(Dialog.show).mock.results[0].value as ReturnType<
    typeof Dialog.show
  >;
  await act(async () => {
    await prompt.onConfirm?.({ ...instance, preventClose: jest.fn() });
  });
  expect(unsignedMessageMock).toHaveBeenCalledWith({
    address,
    networkId: 'evm--1',
    inviteCode: 'AUDIT661',
  });
  expect(mockBag.__webReferralTest?.navigate).toHaveBeenCalledWith(
    expect.objectContaining({ networkId: 'evm--10' }),
  );
  expect(bindMock).toHaveBeenCalledWith({
    address,
    networkId: 'evm--1',
    referralCode: 'AUDIT661',
    signature: 'signature',
  });
  expect(clearCachedCodeMock).toHaveBeenCalledWith('');
  expect(completedEventMock).toHaveBeenCalledWith({
    referralCode: 'AUDIT661',
    address,
    networkId: 'evm--1',
  });
  expect(Toast.success).toHaveBeenCalledTimes(1);
  expect(readWebReferralCode()).toBeUndefined();
});

it('does not prompt when selected and active networks differ', async () => {
  if (mockBag.__webReferralTest) {
    mockBag.__webReferralTest.selected.networkId = 'evm--10';
  }
  render(<WebReferralBindContainer />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(batchMock).not.toHaveBeenCalled();
  expect(Dialog.show).not.toHaveBeenCalled();
});

it('does not infer an EVM bind from an active non-EVM network', async () => {
  if (mockBag.__webReferralTest) {
    mockBag.__webReferralTest.active.network = { id: 'sol--101' };
    mockBag.__webReferralTest.selected.networkId = 'sol--101';
  }
  render(<WebReferralBindContainer />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(Dialog.show).not.toHaveBeenCalled();
});

it('waits for dialog close before opening message confirmation', async () => {
  const closed = deferred<undefined>();
  const instance = dialogInstance();
  instance.close.mockReturnValue(closed.promise);
  jest
    .mocked(Dialog.show)
    .mockReturnValue(instance as ReturnType<typeof Dialog.show>);
  render(<WebReferralBindContainer />);
  const prompt = await showPrompt();
  let confirming: void | Promise<void> | undefined;
  act(() => {
    confirming = prompt.onConfirm?.({ ...instance, preventClose: jest.fn() });
  });
  expect(instance.close).toHaveBeenCalledWith({ flag: 'confirm' });
  expect(mockBag.__webReferralTest?.navigate).not.toHaveBeenCalled();
  await act(async () => {
    closed.resolve(undefined);
    await confirming;
  });
  expect(mockBag.__webReferralTest?.navigate).toHaveBeenCalledTimes(1);
  expect(bindMock).toHaveBeenCalledTimes(1);
});

it('keeps binding after its own message confirmation opens a root modal', async () => {
  const instance = dialogInstance();
  jest
    .mocked(Dialog.show)
    .mockReturnValue(instance as ReturnType<typeof Dialog.show>);
  if (mockBag.__webReferralTest) {
    mockBag.__webReferralTest.navigate.mockImplementation(async () => {
      changeRoute('modal');
      return 'signature';
    });
  }
  render(<WebReferralBindContainer />);
  const prompt = await showPrompt();
  instance.close.mockImplementation(async () => {
    await prompt.onClose?.();
    return undefined;
  });
  await act(async () => {
    await prompt.onConfirm?.({ ...instance, preventClose: jest.fn() });
  });
  expect(bindMock).toHaveBeenCalledTimes(1);
  expect(completedEventMock).toHaveBeenCalledTimes(1);
});

it('keeps a newer Web code when cached invite cleanup finishes late', async () => {
  const cacheCleanup = deferred<undefined>();
  clearCachedCodeMock.mockReturnValue(cacheCleanup.promise);
  const view = render(<WebReferralBindContainer />);
  const prompt = await showPrompt();
  const instance = jest.mocked(Dialog.show).mock.results[0].value as ReturnType<
    typeof Dialog.show
  >;
  let confirming: void | Promise<void> | undefined;
  await act(async () => {
    confirming = prompt.onConfirm?.({ ...instance, preventClose: jest.fn() });
    await waitFor(() => expect(clearCachedCodeMock).toHaveBeenCalledTimes(1));
  });
  await act(async () => {
    captureWebReferralCode('NEXT');
  });
  setAccount('account-B');
  view.rerender(<WebReferralBindContainer />);
  await act(async () => {
    cacheCleanup.resolve(undefined);
    await confirming;
  });
  expect(readWebReferralCode()?.code).toBe('NEXT');
  expect(completedEventMock).toHaveBeenCalledTimes(1);
  expect(completedEventMock).toHaveBeenCalledWith({
    referralCode: 'AUDIT661',
    address,
    networkId: 'evm--1',
  });
  expect(Toast.success).toHaveBeenCalledTimes(1);
});

it('reports a completed bind when cached invite cleanup rejects', async () => {
  clearCachedCodeMock.mockRejectedValue(
    new OneKeyLocalError('Cache unavailable'),
  );
  render(<WebReferralBindContainer />);
  const prompt = await showPrompt();
  const instance = jest.mocked(Dialog.show).mock.results[0].value as ReturnType<
    typeof Dialog.show
  >;
  await act(async () => {
    await prompt.onConfirm?.({ ...instance, preventClose: jest.fn() });
  });
  expect(bindMock).toHaveBeenCalledTimes(1);
  expect(readWebReferralCode()).toBeUndefined();
  expect(clearCachedCodeMock).toHaveBeenCalledWith('');
  expect(completedEventMock).toHaveBeenCalledTimes(1);
  expect(completedEventMock).toHaveBeenCalledWith({
    referralCode: 'AUDIT661',
    address,
    networkId: 'evm--1',
  });
  expect(Toast.success).toHaveBeenCalledTimes(1);
});

it('suppresses the same prompt across EVM chains and all-networks after cancel', async () => {
  const view = render(<WebReferralBindContainer />);
  const prompt = await showPrompt();
  await act(async () => {
    await prompt.onClose?.();
  });
  const initialChecks = batchMock.mock.calls.length;
  if (mockBag.__webReferralTest) {
    mockBag.__webReferralTest.active.network = { id: 'evm--10' };
    mockBag.__webReferralTest.selected.networkId = 'evm--10';
  }
  view.rerender(<WebReferralBindContainer />);
  expect(Dialog.show).toHaveBeenCalledTimes(1);
  expect(batchMock).toHaveBeenCalledTimes(initialChecks);

  if (mockBag.__webReferralTest) {
    mockBag.__webReferralTest.active.network = { id: 'onekeyall--0' };
    mockBag.__webReferralTest.selected.networkId = undefined;
  }
  view.rerender(<WebReferralBindContainer />);
  expect(Dialog.show).toHaveBeenCalledTimes(1);
  expect(batchMock).toHaveBeenCalledTimes(initialChecks);

  await act(async () => {
    captureWebReferralCode('NEXT');
  });
  await waitFor(() => expect(Dialog.show).toHaveBeenCalledTimes(2));
  expect(batchMock.mock.calls.length).toBeGreaterThan(initialChecks);
});

it('retries on the new EVM chain only after the stale dialog closes', async () => {
  const closed = deferred<undefined>();
  const firstDialog = dialogInstance();
  firstDialog.close.mockReturnValue(closed.promise);
  jest
    .mocked(Dialog.show)
    .mockReturnValueOnce(firstDialog as ReturnType<typeof Dialog.show>)
    .mockReturnValueOnce(dialogInstance() as ReturnType<typeof Dialog.show>);
  const view = render(<WebReferralBindContainer />);
  const firstPrompt = await showPrompt();

  if (mockBag.__webReferralTest) {
    mockBag.__webReferralTest.active.network = { id: 'evm--10' };
    mockBag.__webReferralTest.selected.networkId = 'evm--10';
  }
  view.rerender(<WebReferralBindContainer />);
  expect(firstDialog.close).toHaveBeenCalledWith({
    flag: 'referral-context-changed',
  });
  expect(Dialog.show).toHaveBeenCalledTimes(1);

  await act(async () => {
    await firstPrompt.onClose?.({ flag: 'referral-context-changed' });
    closed.resolve(undefined);
  });
  await waitFor(() => expect(Dialog.show).toHaveBeenCalledTimes(2));
  await act(async () => {
    await firstPrompt.onConfirm?.({
      ...firstDialog,
      preventClose: jest.fn(),
    });
  });
  expect(unsignedMessageMock).not.toHaveBeenCalled();

  const secondPrompt = jest.mocked(Dialog.show).mock.calls[1][0];
  const secondDialog = jest.mocked(Dialog.show).mock.results[1]
    .value as ReturnType<typeof Dialog.show>;
  await act(async () => {
    await secondPrompt.onConfirm?.({
      ...secondDialog,
      preventClose: jest.fn(),
    });
  });
  expect(mockBag.__webReferralTest?.navigate).toHaveBeenCalledWith(
    expect.objectContaining({ networkId: 'evm--10' }),
  );
  expect(bindMock).toHaveBeenCalledWith(
    expect.objectContaining({ networkId: 'evm--1' }),
  );
});

it('retries after leaving and returning to an eligible route', async () => {
  const firstDialog = dialogInstance();
  jest
    .mocked(Dialog.show)
    .mockReturnValueOnce(firstDialog as ReturnType<typeof Dialog.show>);
  render(<WebReferralBindContainer />);
  const firstPrompt = await showPrompt();

  changeRoute('modal');
  expect(firstDialog.close).toHaveBeenCalledWith({
    flag: 'referral-context-changed',
  });
  await act(async () => {
    await firstPrompt.onClose?.({ flag: 'referral-context-changed' });
  });
  expect(Dialog.show).toHaveBeenCalledTimes(1);

  changeRoute('main');
  await waitFor(() => expect(Dialog.show).toHaveBeenCalledTimes(2));
});

it('keeps a user cancellation when the chain changes during dialog close', async () => {
  const closed = deferred<undefined>();
  const instance = dialogInstance();
  instance.close.mockReturnValue(closed.promise);
  jest
    .mocked(Dialog.show)
    .mockReturnValue(instance as ReturnType<typeof Dialog.show>);
  const view = render(<WebReferralBindContainer />);
  const prompt = await showPrompt();
  const initialChecks = batchMock.mock.calls.length;

  void (instance as ReturnType<typeof Dialog.show>).close({ flag: 'cancel' });
  if (mockBag.__webReferralTest) {
    mockBag.__webReferralTest.active.network = { id: 'evm--10' };
    mockBag.__webReferralTest.selected.networkId = 'evm--10';
  }
  view.rerender(<WebReferralBindContainer />);
  expect(instance.close).toHaveBeenCalledWith({
    flag: 'referral-context-changed',
  });

  await act(async () => {
    await prompt.onClose?.({ flag: 'cancel' });
    closed.resolve(undefined);
  });
  await act(async () => {
    await prompt.onClose?.({ flag: 'referral-context-changed' });
  });
  expect(Dialog.show).toHaveBeenCalledTimes(1);
  expect(batchMock).toHaveBeenCalledTimes(initialChecks);
});

it('stops a delayed message after the account changes', async () => {
  const message = deferred<string>();
  unsignedMessageMock.mockReturnValue(message.promise);
  const view = render(<WebReferralBindContainer />);
  const prompt = await showPrompt();
  const instance = jest.mocked(Dialog.show).mock.results[0].value as ReturnType<
    typeof Dialog.show
  >;
  let confirming: void | Promise<void> | undefined;
  await act(async () => {
    confirming = prompt.onConfirm?.({ ...instance, preventClose: jest.fn() });
    await Promise.resolve();
  });
  setAccount('account-B');
  view.rerender(<WebReferralBindContainer />);
  await act(async () => {
    message.resolve('message');
    await confirming;
  });
  expect(mockBag.__webReferralTest?.navigate).not.toHaveBeenCalled();
  expect(bindMock).not.toHaveBeenCalled();
  expectNoSuccessSideEffects();
});

it('stops a delayed signature after the invite code changes', async () => {
  const signature = deferred<string>();
  mockBag.__webReferralTest?.navigate.mockReturnValue(signature.promise);
  const view = render(<WebReferralBindContainer />);
  const prompt = await showPrompt();
  const instance = jest.mocked(Dialog.show).mock.results[0].value as ReturnType<
    typeof Dialog.show
  >;
  let confirming: void | Promise<void> | undefined;
  await act(async () => {
    confirming = prompt.onConfirm?.({ ...instance, preventClose: jest.fn() });
    await waitFor(() =>
      expect(mockBag.__webReferralTest?.navigate).toHaveBeenCalledTimes(1),
    );
  });
  await act(async () => {
    captureWebReferralCode('NEXT');
  });
  view.rerender(<WebReferralBindContainer />);
  await act(async () => {
    signature.resolve('signature');
    await confirming;
  });
  expect(bindMock).not.toHaveBeenCalled();
  expect(readWebReferralCode()?.code).toBe('NEXT');
  expectNoSuccessSideEffects();
});

it('does not resume an old signature after account A changes to B and back', async () => {
  const signature = deferred<string>();
  mockBag.__webReferralTest?.navigate.mockReturnValue(signature.promise);
  const view = render(<WebReferralBindContainer />);
  const prompt = await showPrompt();
  const instance = jest.mocked(Dialog.show).mock.results[0].value as ReturnType<
    typeof Dialog.show
  >;
  let confirming: void | Promise<void> | undefined;
  await act(async () => {
    confirming = prompt.onConfirm?.({ ...instance, preventClose: jest.fn() });
    await waitFor(() =>
      expect(mockBag.__webReferralTest?.navigate).toHaveBeenCalledTimes(1),
    );
  });
  setAccount('account-B');
  view.rerender(<WebReferralBindContainer />);
  setAccount('account-A');
  view.rerender(<WebReferralBindContainer />);
  await act(async () => {
    signature.resolve('signature');
    await confirming;
  });
  expect(bindMock).not.toHaveBeenCalled();
  expectNoSuccessSideEffects();
});

it('does not resume an old signature after EVM chain A changes to B and back', async () => {
  const signature = deferred<string>();
  mockBag.__webReferralTest?.navigate.mockReturnValue(signature.promise);
  if (mockBag.__webReferralTest) {
    mockBag.__webReferralTest.active.network = { id: 'evm--10' };
    mockBag.__webReferralTest.selected.networkId = 'evm--10';
  }
  const view = render(<WebReferralBindContainer />);
  const prompt = await showPrompt();
  const instance = jest.mocked(Dialog.show).mock.results[0].value as ReturnType<
    typeof Dialog.show
  >;
  jest.mocked(instance.close).mockImplementation(async (extra) => {
    await prompt.onClose?.(extra);
  });
  let confirming: void | Promise<void> | undefined;
  await act(async () => {
    confirming = prompt.onConfirm?.({ ...instance, preventClose: jest.fn() });
    await waitFor(() =>
      expect(mockBag.__webReferralTest?.navigate).toHaveBeenCalledTimes(1),
    );
  });
  if (mockBag.__webReferralTest) {
    mockBag.__webReferralTest.active.network = { id: 'evm--137' };
    mockBag.__webReferralTest.selected.networkId = 'evm--137';
  }
  view.rerender(<WebReferralBindContainer />);
  if (mockBag.__webReferralTest) {
    mockBag.__webReferralTest.active.network = { id: 'evm--10' };
    mockBag.__webReferralTest.selected.networkId = 'evm--10';
  }
  view.rerender(<WebReferralBindContainer />);
  await act(async () => {
    signature.resolve('signature');
    await confirming;
  });
  expect(bindMock).not.toHaveBeenCalled();
  expect(Dialog.show).toHaveBeenCalledTimes(1);
  expectNoSuccessSideEffects();
});

it('closes its dialog and prevents a delayed bind after unmount', async () => {
  const signature = deferred<string>();
  mockBag.__webReferralTest?.navigate.mockReturnValue(signature.promise);
  const view = render(<WebReferralBindContainer />);
  const prompt = await showPrompt();
  const instance = jest.mocked(Dialog.show).mock.results[0].value as ReturnType<
    typeof Dialog.show
  >;
  let confirming: void | Promise<void> | undefined;
  await act(async () => {
    confirming = prompt.onConfirm?.({ ...instance, preventClose: jest.fn() });
    await waitFor(() =>
      expect(mockBag.__webReferralTest?.navigate).toHaveBeenCalledTimes(1),
    );
  });
  view.unmount();
  expect(instance.close).toHaveBeenCalled();
  await act(async () => {
    signature.resolve('signature');
    await confirming;
  });
  expect(bindMock).not.toHaveBeenCalled();
  expectNoSuccessSideEffects();
});

it.each(['rejected signature', 'bind failure'])(
  'does not emit success effects on %s',
  async (failure) => {
    if (failure === 'rejected signature') {
      mockBag.__webReferralTest?.navigate.mockRejectedValue(
        new OneKeyLocalError('Rejected'),
      );
    } else {
      bindMock.mockResolvedValue(false);
    }
    render(<WebReferralBindContainer />);
    const prompt = await showPrompt();
    const instance = jest.mocked(Dialog.show).mock.results[0]
      .value as ReturnType<typeof Dialog.show>;
    await act(async () => {
      await prompt.onConfirm?.({ ...instance, preventClose: jest.fn() });
    });
    expect(readWebReferralCode()?.code).toBe('AUDIT661');
    expectNoSuccessSideEffects();
  },
);

it.each([
  { route: 'main', path: '/r/AUDIT661' },
  { route: 'main', path: '/oauth_callback_web' },
])(
  'closes the invite prompt on $path and blocks a stale confirm',
  async ({ route, path }) => {
    const view = render(<WebReferralBindContainer />);
    const prompt = await showPrompt();
    const instance = jest.mocked(Dialog.show).mock.results[0]
      .value as ReturnType<typeof Dialog.show>;
    globalThis.history.pushState({}, '', path);
    changeRoute(route);
    view.rerender(<WebReferralBindContainer />);
    expect(instance.close).toHaveBeenCalled();
    await act(async () => {
      await prompt.onConfirm?.({ ...instance, preventClose: jest.fn() });
    });
    expect(unsignedMessageMock).not.toHaveBeenCalled();
    expectNoSuccessSideEffects();
  },
);

it.each([
  { name: 'bound', status: { bound: true, bindable: false } },
  {
    name: 'already bound',
    status: { bound: false, bindable: false, reason: 'already_bound' },
  },
  {
    name: 'expired window',
    status: { bound: false, bindable: false, reason: 'exceeded_bind_window' },
  },
] as const)(
  'caches terminal $name eligibility across new codes and EVM chains',
  async ({ status }) => {
    batchMock.mockResolvedValue({
      [`evm--1:${normalizedAddress}`]: status,
    });
    const view = render(<WebReferralBindContainer />);
    await waitFor(() => expect(batchMock).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });
    const initialChecks = batchMock.mock.calls.length;
    await act(async () => {
      captureWebReferralCode('NEXT');
    });
    if (mockBag.__webReferralTest) {
      mockBag.__webReferralTest.active.network = { id: 'evm--10' };
      mockBag.__webReferralTest.selected.networkId = 'evm--10';
    }
    view.rerender(<WebReferralBindContainer />);
    expect(batchMock).toHaveBeenCalledTimes(initialChecks);
    expect(Dialog.show).not.toHaveBeenCalled();
  },
);

it('rechecks a nonterminal unbindable result after the next navigation', async () => {
  batchMock.mockResolvedValue({
    [`evm--1:${normalizedAddress}`]: { bound: false, bindable: false },
  });
  render(<WebReferralBindContainer />);
  await waitFor(() => expect(batchMock).toHaveBeenCalled());
  await act(async () => {
    await Promise.resolve();
  });
  const initialChecks = batchMock.mock.calls.length;
  changeRoute('onboarding');
  changeRoute('main');
  await waitFor(() =>
    expect(batchMock.mock.calls.length).toBeGreaterThan(initialChecks),
  );
  expect(Dialog.show).not.toHaveBeenCalled();
});
