/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import type { IDialogShowProps } from '@onekeyhq/components';
import type {
  ILocalWalletAccountState,
  ILocalWalletAccountSupport,
} from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { useMoneroPortfolioGate } from './useMoneroPortfolioGate';

type IAccountParams = { networkId: string; accountId: string };
const mockGetDeriveType = jest.fn<
  Promise<IAccountDeriveTypes>,
  [{ networkId: string }]
>();
const mockResolveAccountId = jest.fn<
  Promise<string>,
  [
    {
      indexedAccountId: string;
      networkId: string;
      deriveType: IAccountDeriveTypes;
    },
  ]
>();
const mockGetSupport = jest.fn<
  Promise<ILocalWalletAccountSupport>,
  [IAccountParams]
>();
const mockGetState = jest.fn<
  Promise<ILocalWalletAccountState>,
  [IAccountParams]
>();
const mockClose = jest.fn<Promise<void>, []>();
const mockShow = jest.fn((_props: IDialogShowProps) => ({
  close: mockClose,
  getForm: () => undefined,
  isExist: () => true,
}));
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };

jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: (props: IDialogShowProps) => mockShow(props) },
  SizableText: ({ children }: { children?: ReactNode }) => children,
  YStack: ({ children }: { children?: ReactNode }) => children,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: (params: { networkId: string }) =>
        mockGetDeriveType(params),
    },
    serviceAccount: {
      getDbAccountIdFromIndexedAccountId: (params: {
        indexedAccountId: string;
        networkId: string;
        deriveType: IAccountDeriveTypes;
      }) => mockResolveAccountId(params),
    },
    servicePrivacyChain: {
      getLocalWalletAccountSupport: (params: {
        networkId: string;
        accountId: string;
      }) => mockGetSupport(params),
      getLocalWalletAccountState: (params: {
        networkId: string;
        accountId: string;
      }) => mockGetState(params),
    },
  },
}));

const network = { id: 'xmr--0', name: 'Monero' } as IServerNetwork;
const owner = {
  walletId: 'hd--wallet',
  accountId: 'hd--wallet-evm-account',
  indexedAccountId: 'hd--wallet-0',
  activeNetworkId: 'evm--1',
};
const mockOpenNetwork = jest.fn<Promise<void>, [IServerNetwork]>();
const mockPreserveDraft = jest.fn<void, []>();

function renderGate(initialOwner = owner) {
  return renderHook(
    (props) =>
      useMoneroPortfolioGate({
        ...props,
        onOpenNetwork: mockOpenNetwork,
        onBeforeOpenNetwork: mockPreserveDraft,
      }),
    { initialProps: initialOwner },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDeriveType.mockResolvedValue('default');
  mockResolveAccountId.mockResolvedValue('hd--wallet-xmr-account');
  mockGetSupport.mockResolvedValue('supported');
  mockGetState.mockResolvedValue({ enabled: false, paused: false });
  mockClose.mockResolvedValue(undefined);
  mockOpenNetwork.mockResolvedValue(undefined);
});

it('checks the selected account’s Monero identity and only navigates after Go to', async () => {
  const { result } = renderGate();
  await act(async () => {
    expect(await result.current(network)).toBe(true);
  });
  expect(mockResolveAccountId).toHaveBeenCalledWith({
    indexedAccountId: owner.indexedAccountId,
    networkId: network.id,
    deriveType: 'default',
  });
  expect(mockGetState).toHaveBeenCalledWith({
    networkId: network.id,
    accountId: 'hd--wallet-xmr-account',
  });
  const dialog = mockShow.mock.calls[0][0];
  expect(dialog.showCancelButton).toBe(true);
  expect(dialog.onConfirmText).toBe(ETranslations.global_go_to);
  expect(mockOpenNetwork).not.toHaveBeenCalled();
  expect(mockPreserveDraft).not.toHaveBeenCalled();
  await act(async () => {
    await dialog.onConfirm?.({
      close: mockClose,
      getForm: () => undefined,
      isExist: () => true,
      preventClose: jest.fn(),
    });
  });
  expect(mockClose).toHaveBeenCalledTimes(1);
  expect(mockPreserveDraft).toHaveBeenCalledTimes(1);
  expect(mockOpenNetwork).toHaveBeenCalledWith(network);
  expect(mockClose.mock.invocationCallOrder[0]).toBeLessThan(
    mockOpenNetwork.mock.invocationCallOrder[0],
  );
});

it.each([
  { enabled: true, paused: false },
  { enabled: false, paused: true },
])('does not prompt an already enabled account: %j', async (state) => {
  mockGetState.mockResolvedValue(state);
  const { result } = renderGate();
  await act(async () => {
    expect(await result.current(network)).toBe(false);
  });
  expect(mockShow).not.toHaveBeenCalled();
});

it('closing the prompt leaves navigation and the draft untouched', async () => {
  const { result } = renderGate();
  await act(async () => {
    await result.current(network);
    await mockShow.mock.calls[0][0].onClose?.();
  });
  expect(mockOpenNetwork).not.toHaveBeenCalled();
  expect(mockPreserveDraft).not.toHaveBeenCalled();
});

it('ignores a state response after the selected account changes', async () => {
  let finishRead: ((state: ILocalWalletAccountState) => void) | undefined;
  mockGetState.mockImplementation(
    () =>
      new Promise<ILocalWalletAccountState>((resolve) => {
        finishRead = resolve;
      }),
  );
  const { result, rerender } = renderGate();
  let pending: Promise<boolean> | undefined;
  await act(async () => {
    pending = result.current(network);
  });
  await waitFor(() => expect(mockGetState).toHaveBeenCalled());
  rerender({ ...owner, indexedAccountId: 'hd--wallet-1' });
  await act(async () => {
    finishRead?.({ enabled: false, paused: false });
    expect(await pending).toBe(true);
  });
  expect(mockShow).not.toHaveBeenCalled();
  expect(mockOpenNetwork).not.toHaveBeenCalled();
});

it('does not offer activation when privacy is unavailable', async () => {
  mockGetState.mockResolvedValue({
    enabled: false,
    paused: false,
    privacyDisabled: true,
  });
  const { result } = renderGate();
  await act(async () => {
    expect(await result.current(network)).toBe(true);
  });
  expect(mockShow.mock.calls[0][0]).toMatchObject({
    title: ETranslations.global_not_available,
    showCancelButton: false,
    onConfirmText: ETranslations.global_got_it,
  });
});
