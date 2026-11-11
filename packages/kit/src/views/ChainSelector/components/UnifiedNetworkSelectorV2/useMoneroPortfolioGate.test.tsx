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

import type { IMoneroPortfolioOwnerGuard } from './useMoneroPortfolioGate';

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
const mockGetWallet = jest.fn<
  Promise<{ id: string; isTemp?: boolean } | undefined>,
  [{ walletId: string; withoutRefill: boolean }]
>();
const mockEnsureConfig = jest.fn<Promise<void>, []>();
const mockGetNetworkIds = jest.fn<Promise<string[]>, []>();
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
      getWalletSafe: (params: { walletId: string; withoutRefill: boolean }) =>
        mockGetWallet(params),
      getDbAccountIdFromIndexedAccountId: (params: {
        indexedAccountId: string;
        networkId: string;
        deriveType: IAccountDeriveTypes;
      }) => mockResolveAccountId(params),
    },
    servicePrivacyChain: {
      getLocalWalletNetworkIds: () => mockGetNetworkIds(),
      getLocalWalletAccountSupport: (params: {
        networkId: string;
        accountId: string;
      }) => mockGetSupport(params),
      getLocalWalletAccountState: (params: {
        networkId: string;
        accountId: string;
      }) => mockGetState(params),
    },
    serviceCustomRpc: {
      ensureLocalWalletRemoteConfigLoaded: () => mockEnsureConfig(),
    },
  },
}));

const network = { id: 'xmr--0', name: 'Monero' } as IServerNetwork;
const owner: Pick<
  Parameters<typeof useMoneroPortfolioGate>[0],
  'walletId' | 'accountId' | 'indexedAccountId' | 'activeNetworkId'
> = {
  walletId: 'hd--wallet',
  accountId: 'hd--wallet-evm-account',
  indexedAccountId: 'hd--wallet-0',
  activeNetworkId: 'evm--1',
};
const mockOpenNetwork = jest.fn<Promise<void>, [IServerNetwork]>();
const mockPreserveDraft = jest.fn<void, []>();
const mockSkipNetwork = jest.fn<
  Promise<void>,
  [IServerNetwork, IMoneroPortfolioOwnerGuard]
>();

function renderGate(initialOwner = owner) {
  return renderHook(
    (props) =>
      useMoneroPortfolioGate({
        ...props,
        onOpenNetwork: mockOpenNetwork,
        onBeforeOpenNetwork: mockPreserveDraft,
        onSkipNetwork: mockSkipNetwork,
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
  mockGetWallet.mockResolvedValue({ id: 'hd-wallet', isTemp: false });
  mockEnsureConfig.mockResolvedValue(undefined);
  mockGetNetworkIds.mockResolvedValue([network.id]);
  mockClose.mockResolvedValue(undefined);
  mockOpenNetwork.mockResolvedValue(undefined);
  mockSkipNetwork.mockResolvedValue(undefined);
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
  expect(dialog.onCancelText).toBe('monero_skip__action');
  expect(dialog.onConfirmText).toBe('privacy_go_to_enable__action');
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
  expect(mockSkipNetwork).not.toHaveBeenCalled();
});

it('Skip continues without Monero after closing, without invoking Go to or preserving the draft', async () => {
  const { result } = renderGate();
  await act(async () => {
    await result.current(network);
    await Promise.resolve(mockShow.mock.calls[0][0].onCancel?.(mockClose));
  });
  expect(mockSkipNetwork).toHaveBeenCalledWith(network, expect.any(Function));
  expect(mockSkipNetwork.mock.calls[0][1]()).toBe(true);
  expect(mockClose.mock.invocationCallOrder[0]).toBeLessThan(
    mockSkipNetwork.mock.invocationCallOrder[0],
  );
  expect(mockOpenNetwork).not.toHaveBeenCalled();
  expect(mockPreserveDraft).not.toHaveBeenCalled();
});

it('does not skip after the owner changes while the dialog is closing', async () => {
  const { result, rerender } = renderGate();
  await act(async () => {
    await result.current(network);
  });
  let finishClose: (() => void) | undefined;
  const close = () =>
    new Promise<void>((resolve) => {
      finishClose = resolve;
    });
  let pending: Promise<void> | undefined;
  await act(async () => {
    pending = Promise.resolve(mockShow.mock.calls[0][0].onCancel?.(close));
  });
  rerender({ ...owner, indexedAccountId: 'hd--wallet-1' });
  await act(async () => {
    finishClose?.();
    await pending;
  });
  expect(mockSkipNetwork).not.toHaveBeenCalled();
});

it('preserves Skip failures for the normal global account-creation recovery handler', async () => {
  const { result } = renderGate();
  const error = new Error('account creation requires hardware recovery');
  mockSkipNetwork.mockRejectedValueOnce(error);
  await act(async () => {
    await result.current(network);
  });
  await expect(mockShow.mock.calls[0][0].onCancel?.(mockClose)).rejects.toBe(
    error,
  );
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

it('does not read state after an obsolete support response', async () => {
  let finishSupport:
    | ((support: ILocalWalletAccountSupport) => void)
    | undefined;
  mockGetSupport.mockImplementationOnce(
    () =>
      new Promise<ILocalWalletAccountSupport>((resolve) => {
        finishSupport = resolve;
      }),
  );
  const { result, rerender } = renderGate();
  let pending: Promise<boolean> | undefined;
  await act(async () => {
    pending = result.current(network);
  });
  await waitFor(() => expect(mockGetSupport).toHaveBeenCalled());
  rerender({ ...owner, indexedAccountId: 'hd--wallet-1' });
  await act(async () => {
    finishSupport?.('supported');
    expect(await pending).toBe(true);
  });
  expect(mockGetState).not.toHaveBeenCalled();
  expect(mockShow).not.toHaveBeenCalled();
});

it('does not preserve or navigate if the owner changes while Go to closes the dialog', async () => {
  const { result, rerender } = renderGate();
  await act(async () => {
    await result.current(network);
  });
  let finishClose: (() => void) | undefined;
  const close = () =>
    new Promise<void>((resolve) => {
      finishClose = resolve;
    });
  let pending: ReturnType<NonNullable<IDialogShowProps['onConfirm']>>;
  await act(async () => {
    pending = mockShow.mock.calls[0][0].onConfirm?.({
      close,
      getForm: () => undefined,
      isExist: () => true,
      preventClose: jest.fn(),
    });
  });
  rerender({ ...owner, indexedAccountId: 'hd--wallet-1' });
  await act(async () => {
    finishClose?.();
    await pending;
  });
  expect(mockPreserveDraft).not.toHaveBeenCalled();
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

const emptyOwner = {
  walletId: 'hd-wallet',
  accountId: undefined,
  indexedAccountId: undefined,
  activeNetworkId: 'onekeyall',
};

it.each(['skip', 'goTo'] as const)(
  'an empty saved HD wallet offers %s without resolving or reading an account',
  async (action) => {
    const { result } = renderGate(emptyOwner);
    await act(async () => {
      expect(await result.current(network)).toBe(true);
    });
    expect(mockGetWallet).toHaveBeenCalledWith({
      walletId: emptyOwner.walletId,
      withoutRefill: true,
    });
    expect(mockGetNetworkIds).toHaveBeenCalledTimes(1);
    expect(mockGetDeriveType).not.toHaveBeenCalled();
    expect(mockResolveAccountId).not.toHaveBeenCalled();
    expect(mockGetSupport).not.toHaveBeenCalled();
    expect(mockGetState).not.toHaveBeenCalled();
    const dialog = mockShow.mock.calls[0][0];
    expect(dialog).toMatchObject({
      showCancelButton: true,
      onConfirmText: 'privacy_go_to_enable__action',
      onCancelText: 'monero_skip__action',
    });
    await act(async () => {
      if (action === 'skip') {
        await Promise.resolve(dialog.onCancel?.(mockClose));
      } else {
        await dialog.onConfirm?.({
          close: mockClose,
          getForm: () => undefined,
          isExist: () => true,
          preventClose: jest.fn(),
        });
      }
    });
    if (action === 'skip') {
      expect(mockSkipNetwork).toHaveBeenCalledWith(
        network,
        expect.any(Function),
      );
      expect(mockOpenNetwork).not.toHaveBeenCalled();
      expect(mockPreserveDraft).not.toHaveBeenCalled();
    } else {
      expect(mockOpenNetwork).toHaveBeenCalledWith(network);
      expect(mockPreserveDraft).toHaveBeenCalledTimes(1);
      expect(mockSkipNetwork).not.toHaveBeenCalled();
    }
  },
);

it.each([
  { wallet: undefined, name: 'missing' },
  { wallet: { id: 'watching-wallet' }, name: 'unsupported' },
  { wallet: { id: 'hd-wallet', isTemp: true }, name: 'temporary' },
])(
  'does not offer activation for an empty $name wallet',
  async ({ wallet }) => {
    mockGetWallet.mockResolvedValue(wallet);
    const { result } = renderGate(emptyOwner);
    await act(async () => {
      expect(await result.current(network)).toBe(true);
    });
    expect(mockShow.mock.calls[0][0]).toMatchObject({
      showCancelButton: false,
      onConfirmText: ETranslations.global_got_it,
    });
    expect(mockEnsureConfig).not.toHaveBeenCalled();
    expect(mockGetSupport).not.toHaveBeenCalled();
  },
);

it('does not offer empty-wallet activation for a server-disabled or unlisted network', async () => {
  mockGetNetworkIds.mockResolvedValue([]);
  const { result } = renderGate(emptyOwner);
  await act(async () => {
    await result.current(network);
  });
  expect(mockEnsureConfig).toHaveBeenCalledTimes(1);
  expect(mockEnsureConfig.mock.invocationCallOrder[0]).toBeLessThan(
    mockGetNetworkIds.mock.invocationCallOrder[0],
  );
  expect(mockShow.mock.calls[0][0]).toMatchObject({
    title: ETranslations.global_not_available,
    showCancelButton: false,
  });
});

it('drops empty-wallet availability after the selected wallet changes', async () => {
  let finishWallet: ((wallet: { id: string }) => void) | undefined;
  mockGetWallet.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishWallet = resolve;
      }),
  );
  const { result, rerender } = renderGate(emptyOwner);
  let pending: Promise<boolean> | undefined;
  await act(async () => {
    pending = result.current(network);
  });
  await waitFor(() => expect(mockGetWallet).toHaveBeenCalled());
  rerender({ ...emptyOwner, walletId: 'hd-other' });
  await act(async () => {
    finishWallet?.({ id: emptyOwner.walletId });
    await pending;
  });
  expect(mockEnsureConfig).not.toHaveBeenCalled();
  expect(mockShow).not.toHaveBeenCalled();
});

it('accepts only the explicit created first index and invalidates a later index switch', async () => {
  const { result, rerender, unmount } = renderGate(emptyOwner);
  await act(async () => {
    await result.current(network);
    await Promise.resolve(mockShow.mock.calls[0][0].onCancel?.(mockClose));
  });
  const guard = mockSkipNetwork.mock.calls[0][1];
  const created = {
    walletId: emptyOwner.walletId,
    indexedAccountId: 'hd-wallet--0',
  };
  rerender({ ...emptyOwner, indexedAccountId: created.indexedAccountId });
  expect(guard()).toBe(false);
  expect(guard(created)).toBe(true);
  rerender({
    ...emptyOwner,
    indexedAccountId: created.indexedAccountId,
    accountId: 'created-all-network-account',
  });
  expect(guard()).toBe(true);
  rerender({ ...emptyOwner, indexedAccountId: 'hd-wallet--1' });
  rerender({ ...emptyOwner, indexedAccountId: created.indexedAccountId });
  expect(guard(created)).toBe(false);
  unmount();
  expect(guard(created)).toBe(false);
});

it('rejects a first-index result after leaving and returning to the empty wallet', async () => {
  const { result, rerender } = renderGate(emptyOwner);
  await act(async () => {
    await result.current(network);
    await Promise.resolve(mockShow.mock.calls[0][0].onCancel?.(mockClose));
  });
  const guard = mockSkipNetwork.mock.calls[0][1];
  rerender({ ...emptyOwner, walletId: 'hd-other' });
  rerender(emptyOwner);
  expect(
    guard({ walletId: emptyOwner.walletId, indexedAccountId: 'hd-wallet--0' }),
  ).toBe(false);
});
