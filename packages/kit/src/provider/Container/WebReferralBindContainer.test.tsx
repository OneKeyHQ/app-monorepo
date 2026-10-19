/**
 * @jest-environment jsdom
 */

import { act, render, waitFor } from '@testing-library/react';

import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

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
  SizableText: () => null,
  YStack: ({ children }: { children: React.ReactNode }) => children,
  rootNavigationRef: {
    current: {
      getRootState: () => ({ routes: [{ name: 'main' }], index: 0 }),
      addListener: () => () => undefined,
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
    },
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
  captureWebReferralCode('AUDIT661');
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

it('prefers a concrete active EVM chain over createAtNetwork', async () => {
  if (mockBag.__webReferralTest) {
    mockBag.__webReferralTest.active.network = { id: 'evm--10' };
    mockBag.__webReferralTest.selected.networkId = 'evm--10';
  }
  render(<WebReferralBindContainer />);
  await waitFor(() =>
    expect(batchMock).toHaveBeenCalledWith(
      [{ address: normalizedAddress, networkId: 'evm--10' }],
      3000,
    ),
  );
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
});
