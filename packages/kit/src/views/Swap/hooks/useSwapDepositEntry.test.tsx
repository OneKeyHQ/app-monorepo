import { act, renderHook } from '@testing-library/react-native';

import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { useSwapDepositEntryPress } from './useSwapDepositEntry';

const mockPushModal = jest.fn();
const mockNavigation = { pushModal: mockPushModal };
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));

const mockResolveSwapNetworkAccount = jest.fn<
  Promise<{ account: INetworkAccount | undefined }>,
  [
    {
      accountId?: string;
      indexedAccountId?: string;
      dbAccount?: IAccountSelectorActiveAccountInfo['dbAccount'];
      networkId: string;
    },
  ]
>();
jest.mock('./useSwapAccount', () => ({
  resolveSwapNetworkAccount: (
    ...args: Parameters<typeof mockResolveSwapNetworkAccount>
  ) => mockResolveSwapNetworkAccount(...args),
}));

const mockToastMessage = jest.fn();
jest.mock('@onekeyhq/components', () => ({
  Toast: {
    message: (...args: unknown[]) => {
      mockToastMessage(...args);
    },
  },
}));

const mockIntl = { formatMessage: ({ id }: { id: string }) => id };
jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));

const mockBuyOnLowBalance = jest.fn();
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    wallet: {
      walletActions: {
        buyOnLowBalance: (...args: unknown[]) => {
          mockBuyOnLowBalance(...args);
        },
      },
    },
  },
}));

const bnbUsdc = {
  networkId: 'evm--56',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
} as unknown as ISwapToken;
const ethUsdc = { ...bnbUsdc, networkId: 'evm--1' } as ISwapToken;

const activeAccount = {
  ready: true,
  account: { id: 'hd-1--evm--1' },
  indexedAccount: { id: 'indexed-1' },
  wallet: { id: 'wallet-1', type: 'hd' },
} as unknown as IAccountSelectorActiveAccountInfo;
const bnbAccount = { id: 'hd-1--evm--56' } as unknown as INetworkAccount;

function createDeferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve: (value: T) => resolve?.(value) };
}

function receiveParams() {
  return mockPushModal.mock.calls[0][1].params as {
    accountId: string;
    networkId: string;
    indexedAccountId?: string;
  };
}

describe('useSwapDepositEntryPress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens with the resolved account and skips the lookup', async () => {
    const onClose = jest.fn();
    const { result } = renderHook(() =>
      useSwapDepositEntryPress({
        token: bnbUsdc,
        accountInfo: { ...activeAccount, account: bnbAccount },
        activeAccount,
        onClose,
      }),
    );
    await act(async () => {
      result.current();
    });
    expect(mockResolveSwapNetworkAccount).not.toHaveBeenCalled();
    expect(mockPushModal).toHaveBeenCalledTimes(1);
    expect(receiveParams()).toEqual(
      expect.objectContaining({
        accountId: 'hd-1--evm--56',
        networkId: 'evm--56',
        indexedAccountId: 'indexed-1',
      }),
    );
  });

  it('resolves the token network account on demand while the lookup is pending', async () => {
    mockResolveSwapNetworkAccount.mockResolvedValue({ account: bnbAccount });
    const { result } = renderHook(() =>
      useSwapDepositEntryPress({
        token: bnbUsdc,
        accountInfo: undefined,
        activeAccount,
        onClose: jest.fn(),
      }),
    );
    await act(async () => {
      result.current();
    });
    expect(mockResolveSwapNetworkAccount).toHaveBeenCalledWith({
      accountId: 'hd-1--evm--1',
      indexedAccountId: 'indexed-1',
      dbAccount: undefined,
      networkId: 'evm--56',
    });
    expect(mockPushModal).toHaveBeenCalledTimes(1);
    // The wallet and indexed account come from the active account, the
    // account id from the resolved network account.
    expect(receiveParams()).toEqual(
      expect.objectContaining({
        accountId: 'hd-1--evm--56',
        networkId: 'evm--56',
        indexedAccountId: 'indexed-1',
      }),
    );
  });

  it('resolves an identity-only account context before opening Receive', async () => {
    mockResolveSwapNetworkAccount.mockResolvedValue({ account: bnbAccount });
    const { result } = renderHook(() =>
      useSwapDepositEntryPress({
        token: bnbUsdc,
        accountInfo: { ...activeAccount, account: undefined },
        activeAccount,
        onClose: jest.fn(),
      }),
    );

    await act(async () => {
      result.current();
    });

    expect(mockResolveSwapNetworkAccount).toHaveBeenCalledWith({
      accountId: 'hd-1--evm--1',
      indexedAccountId: 'indexed-1',
      dbAccount: undefined,
      networkId: 'evm--56',
    });
    expect(receiveParams()).toEqual(
      expect.objectContaining({
        accountId: 'hd-1--evm--56',
        networkId: 'evm--56',
      }),
    );
  });

  it('runs one lookup for repeated taps and drops a result for a replaced token', async () => {
    const lookup = createDeferred<{ account: INetworkAccount | undefined }>();
    mockResolveSwapNetworkAccount.mockReturnValue(lookup.promise);
    const { result, rerender } = renderHook(
      ({ token }: { token: ISwapToken }) =>
        useSwapDepositEntryPress({
          token,
          accountInfo: undefined,
          activeAccount,
          onClose: jest.fn(),
        }),
      { initialProps: { token: bnbUsdc } },
    );
    act(() => {
      result.current();
      result.current();
    });
    expect(mockResolveSwapNetworkAccount).toHaveBeenCalledTimes(1);

    rerender({ token: ethUsdc });
    await act(async () => {
      lookup.resolve({ account: bnbAccount });
      await lookup.promise;
    });
    expect(mockPushModal).not.toHaveBeenCalled();
  });

  it('opens Receive only for the latest lookup after an A-B-A selection cycle', async () => {
    const firstA = createDeferred<{ account: INetworkAccount | undefined }>();
    const b = createDeferred<{ account: INetworkAccount | undefined }>();
    const secondA = createDeferred<{
      account: INetworkAccount | undefined;
    }>();
    mockResolveSwapNetworkAccount
      .mockReturnValueOnce(firstA.promise)
      .mockReturnValueOnce(b.promise)
      .mockReturnValueOnce(secondA.promise);
    const { result, rerender } = renderHook(
      ({ token }: { token: ISwapToken }) =>
        useSwapDepositEntryPress({
          token,
          accountInfo: undefined,
          activeAccount,
          onClose: jest.fn(),
        }),
      { initialProps: { token: bnbUsdc } },
    );

    act(() => {
      result.current();
    });
    rerender({ token: ethUsdc });
    act(() => {
      result.current();
    });
    rerender({ token: bnbUsdc });
    act(() => {
      result.current();
    });
    expect(mockResolveSwapNetworkAccount).toHaveBeenCalledTimes(3);

    await act(async () => {
      firstA.resolve({ account: bnbAccount });
      await firstA.promise;
    });
    await act(async () => {
      b.resolve({ account: { id: 'hd-1--evm--1' } as INetworkAccount });
      await b.promise;
    });
    expect(mockPushModal).not.toHaveBeenCalled();

    await act(async () => {
      secondA.resolve({ account: bnbAccount });
      await secondA.promise;
    });
    expect(mockPushModal).toHaveBeenCalledTimes(1);
    expect(receiveParams()).toEqual(
      expect.objectContaining({ networkId: 'evm--56' }),
    );
  });

  it('drops a result when the active account changes during the lookup', async () => {
    const lookup = createDeferred<{ account: INetworkAccount | undefined }>();
    mockResolveSwapNetworkAccount.mockReturnValue(lookup.promise);
    const { result, rerender } = renderHook(
      ({ account }: { account: IAccountSelectorActiveAccountInfo }) =>
        useSwapDepositEntryPress({
          token: bnbUsdc,
          accountInfo: undefined,
          activeAccount: account,
          onClose: jest.fn(),
        }),
      { initialProps: { account: activeAccount } },
    );
    act(() => {
      result.current();
    });
    rerender({
      account: {
        ...activeAccount,
        indexedAccount: { id: 'indexed-2' },
      } as unknown as IAccountSelectorActiveAccountInfo,
    });
    await act(async () => {
      lookup.resolve({ account: bnbAccount });
      await lookup.promise;
    });
    // The lookup ran for the previous wallet; Receive must not open for it.
    expect(mockPushModal).not.toHaveBeenCalled();
  });

  it('stays a no-op when no account can be resolved', async () => {
    mockResolveSwapNetworkAccount.mockResolvedValue({ account: undefined });
    const { result } = renderHook(() =>
      useSwapDepositEntryPress({
        token: bnbUsdc,
        accountInfo: undefined,
        activeAccount,
        onClose: jest.fn(),
      }),
    );
    await act(async () => {
      result.current();
    });
    expect(mockPushModal).not.toHaveBeenCalled();
  });

  it('reports the failure instead of leaving a dead tap when the lookup fails', async () => {
    mockResolveSwapNetworkAccount.mockRejectedValue(new Error('lookup failed'));
    const { result } = renderHook(() =>
      useSwapDepositEntryPress({
        token: bnbUsdc,
        accountInfo: undefined,
        activeAccount,
        onClose: jest.fn(),
      }),
    );
    await act(async () => {
      result.current();
    });
    expect(mockPushModal).not.toHaveBeenCalled();
    expect(mockToastMessage).toHaveBeenCalledWith({
      title: ETranslations.swap_page_toast_address_generated_fail,
    });
  });

  it('does not toast when the deposit entry opens', async () => {
    const { result } = renderHook(() =>
      useSwapDepositEntryPress({
        token: bnbUsdc,
        accountInfo: { ...activeAccount, account: bnbAccount },
        activeAccount,
        onClose: jest.fn(),
      }),
    );
    await act(async () => {
      result.current();
    });
    expect(mockPushModal).toHaveBeenCalledTimes(1);
    expect(mockToastMessage).not.toHaveBeenCalled();
  });

  it('drops a pending lookup when the entry unmounts', async () => {
    const lookup = createDeferred<{ account: INetworkAccount | undefined }>();
    mockResolveSwapNetworkAccount.mockReturnValue(lookup.promise);
    const { result, unmount } = renderHook(() =>
      useSwapDepositEntryPress({
        token: bnbUsdc,
        accountInfo: undefined,
        activeAccount,
        onClose: jest.fn(),
      }),
    );
    act(() => {
      result.current();
    });
    expect(mockResolveSwapNetworkAccount).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      lookup.resolve({ account: bnbAccount });
      await lookup.promise;
    });

    // The user left the page; Receive must not open (nor toast) afterwards.
    expect(mockPushModal).not.toHaveBeenCalled();
    expect(mockToastMessage).not.toHaveBeenCalled();
  });

  it('lets a new selection run its own lookup while the previous one is in flight', async () => {
    const first = createDeferred<{ account: INetworkAccount | undefined }>();
    const second = createDeferred<{ account: INetworkAccount | undefined }>();
    mockResolveSwapNetworkAccount
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(
      ({ token }: { token: ISwapToken }) =>
        useSwapDepositEntryPress({
          token,
          accountInfo: undefined,
          activeAccount,
          onClose: jest.fn(),
        }),
      { initialProps: { token: bnbUsdc } },
    );
    act(() => {
      result.current();
    });
    expect(mockResolveSwapNetworkAccount).toHaveBeenCalledTimes(1);

    rerender({ token: ethUsdc });
    act(() => {
      result.current();
    });
    // The new selection is not swallowed by the in-flight lookup.
    expect(mockResolveSwapNetworkAccount).toHaveBeenCalledTimes(2);
    expect(mockResolveSwapNetworkAccount).toHaveBeenLastCalledWith(
      expect.objectContaining({ networkId: 'evm--1' }),
    );

    await act(async () => {
      second.resolve({ account: { id: 'hd-1--evm--1' } as INetworkAccount });
      await second.promise;
    });
    expect(mockPushModal).toHaveBeenCalledTimes(1);
    expect(receiveParams()).toEqual(
      expect.objectContaining({ networkId: 'evm--1' }),
    );

    // The superseded lookup result is dropped instead of opening a second time.
    await act(async () => {
      first.resolve({ account: bnbAccount });
      await first.promise;
    });
    expect(mockPushModal).toHaveBeenCalledTimes(1);
  });

  it('skips the funnel event for always-visible entries', async () => {
    const { result } = renderHook(() =>
      useSwapDepositEntryPress({
        token: bnbUsdc,
        accountInfo: { ...activeAccount, account: bnbAccount },
        activeAccount,
        onClose: jest.fn(),
        logLowBalance: false,
      }),
    );
    await act(async () => {
      result.current();
    });
    expect(mockPushModal).toHaveBeenCalledTimes(1);
    expect(mockBuyOnLowBalance).not.toHaveBeenCalled();
  });

  it('counts the funnel event for low-balance entries', async () => {
    const { result } = renderHook(() =>
      useSwapDepositEntryPress({
        token: bnbUsdc,
        accountInfo: { ...activeAccount, account: bnbAccount },
        activeAccount,
        onClose: jest.fn(),
      }),
    );
    await act(async () => {
      result.current();
    });
    expect(mockPushModal).toHaveBeenCalledTimes(1);
    expect(mockBuyOnLowBalance).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['network', ethUsdc],
    ['contract', { ...bnbUsdc, contractAddress: '0xother' }],
    ['token kind', { ...bnbUsdc, isNative: true }],
  ])(
    'invalidates a press after an A-B-A %s cycle without another tap',
    async (_kind, otherToken) => {
      const lookup = createDeferred<{ account: INetworkAccount | undefined }>();
      mockResolveSwapNetworkAccount.mockReturnValue(lookup.promise);
      const { result, rerender } = renderHook(
        ({ token }: { token: ISwapToken }) =>
          useSwapDepositEntryPress({
            token,
            activeAccount,
            onClose: jest.fn(),
          }),
        { initialProps: { token: bnbUsdc } },
      );
      act(() => {
        result.current();
      });
      rerender({ token: otherToken as ISwapToken });
      rerender({ token: bnbUsdc });
      await act(async () => {
        lookup.resolve({ account: bnbAccount });
        await lookup.promise;
      });
      expect(mockPushModal).not.toHaveBeenCalled();
      expect(mockToastMessage).not.toHaveBeenCalled();
      expect(mockBuyOnLowBalance).not.toHaveBeenCalled();
    },
  );

  it('drops a failed lookup after leaving and returning to the same token', async () => {
    const lookup = createDeferred<void>();
    mockResolveSwapNetworkAccount.mockReturnValue(
      lookup.promise.then(() => {
        throw new OneKeyLocalError('old lookup failed');
      }),
    );
    const { result, rerender } = renderHook(
      ({ token }: { token: ISwapToken }) =>
        useSwapDepositEntryPress({ token, activeAccount, onClose: jest.fn() }),
      { initialProps: { token: bnbUsdc } },
    );
    act(() => {
      result.current();
    });
    rerender({ token: ethUsdc });
    rerender({ token: bnbUsdc });
    await act(async () => {
      lookup.resolve();
      await lookup.promise;
    });
    expect(mockPushModal).not.toHaveBeenCalled();
    expect(mockToastMessage).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'allows a fresh return-A tap and drops the old lookup (old completes first: %s)',
    async (oldCompletesFirst) => {
      const oldLookup = createDeferred<{
        account: INetworkAccount | undefined;
      }>();
      const newLookup = createDeferred<{
        account: INetworkAccount | undefined;
      }>();
      mockResolveSwapNetworkAccount
        .mockReturnValueOnce(oldLookup.promise)
        .mockReturnValueOnce(newLookup.promise);
      const { result, rerender } = renderHook(
        ({ token }: { token: ISwapToken }) =>
          useSwapDepositEntryPress({
            token,
            activeAccount,
            onClose: jest.fn(),
          }),
        { initialProps: { token: bnbUsdc } },
      );
      act(() => {
        result.current();
      });
      rerender({ token: ethUsdc });
      rerender({ token: bnbUsdc });
      act(() => {
        result.current();
      });
      expect(mockResolveSwapNetworkAccount).toHaveBeenCalledTimes(2);
      if (oldCompletesFirst) {
        await act(async () => {
          oldLookup.resolve({ account: bnbAccount });
          await oldLookup.promise;
        });
        expect(mockPushModal).not.toHaveBeenCalled();
        act(() => {
          result.current();
        });
        expect(mockResolveSwapNetworkAccount).toHaveBeenCalledTimes(2);
      }
      await act(async () => {
        newLookup.resolve({ account: bnbAccount });
        await newLookup.promise;
      });
      if (!oldCompletesFirst) {
        await act(async () => {
          oldLookup.resolve({ account: bnbAccount });
          await oldLookup.promise;
        });
      }
      expect(mockPushModal).toHaveBeenCalledTimes(1);
      expect(mockBuyOnLowBalance).toHaveBeenCalledTimes(1);
      expect(mockToastMessage).not.toHaveBeenCalled();
    },
  );

  it.each([
    { wallet: { id: 'wallet-2', type: 'hd' } },
    { indexedAccount: { id: 'indexed-2' } },
    { account: { id: 'hd-2--evm--1' } },
    { dbAccount: { id: 'db-account-2' } },
  ])(
    'invalidates an account identity cycle without another tap: %j',
    async (change) => {
      const lookup = createDeferred<{ account: INetworkAccount | undefined }>();
      mockResolveSwapNetworkAccount.mockReturnValue(lookup.promise);
      const { result, rerender } = renderHook(
        ({ account }: { account: IAccountSelectorActiveAccountInfo }) =>
          useSwapDepositEntryPress({
            token: bnbUsdc,
            activeAccount: account,
            onClose: jest.fn(),
          }),
        { initialProps: { account: activeAccount } },
      );
      act(() => {
        result.current();
      });
      rerender({
        account: {
          ...activeAccount,
          ...change,
        } as IAccountSelectorActiveAccountInfo,
      });
      rerender({ account: activeAccount });
      await act(async () => {
        lookup.resolve({ account: bnbAccount });
        await lookup.promise;
      });
      expect(mockPushModal).not.toHaveBeenCalled();
      expect(mockToastMessage).not.toHaveBeenCalled();
    },
  );

  it('keeps a pending press through balance and metadata refreshes with the latest close callback', async () => {
    const lookup = createDeferred<{ account: INetworkAccount | undefined }>();
    mockResolveSwapNetworkAccount.mockReturnValue(lookup.promise);
    const firstClose = jest.fn();
    const latestClose = jest.fn();
    const { result, rerender } = renderHook(
      (props: {
        token: ISwapToken;
        account: IAccountSelectorActiveAccountInfo;
        accountInfo?: IAccountSelectorActiveAccountInfo;
        onClose: () => void;
      }) =>
        useSwapDepositEntryPress({ ...props, activeAccount: props.account }),
      {
        initialProps: {
          token: bnbUsdc,
          account: activeAccount,
          accountInfo: undefined as
            | IAccountSelectorActiveAccountInfo
            | undefined,
          onClose: firstClose,
        },
      },
    );
    const handler = result.current;
    act(() => {
      handler();
    });
    rerender({
      token: { ...bnbUsdc, balanceParsed: '1' },
      account: {
        ...activeAccount,
        wallet: { ...activeAccount.wallet! },
        indexedAccount: { ...activeAccount.indexedAccount! },
      },
      accountInfo: { ...activeAccount, account: bnbAccount },
      onClose: latestClose,
    });
    expect(result.current).toBe(handler);
    act(() => {
      result.current();
    });
    expect(mockResolveSwapNetworkAccount).toHaveBeenCalledTimes(1);
    await act(async () => {
      lookup.resolve({ account: bnbAccount });
      await lookup.promise;
    });
    expect(mockPushModal).toHaveBeenCalledTimes(1);
    expect(mockPushModal.mock.calls[0][1].params.onClose).toBe(latestClose);
  });

  it('blocks disabled entries and invalidates a pending press when disabled', async () => {
    const lookup = createDeferred<{ account: INetworkAccount | undefined }>();
    mockResolveSwapNetworkAccount.mockReturnValue(lookup.promise);
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useSwapDepositEntryPress({
          token: bnbUsdc,
          activeAccount,
          onClose: jest.fn(),
          enabled,
        }),
      { initialProps: { enabled: false } },
    );
    act(() => {
      result.current();
    });
    expect(mockResolveSwapNetworkAccount).not.toHaveBeenCalled();
    expect(mockToastMessage).not.toHaveBeenCalled();
    rerender({ enabled: true });
    act(() => {
      result.current();
    });
    rerender({ enabled: false });
    rerender({ enabled: true });
    await act(async () => {
      lookup.resolve({ account: bnbAccount });
      await lookup.promise;
    });
    expect(mockPushModal).not.toHaveBeenCalled();
    expect(mockToastMessage).not.toHaveBeenCalled();
  });
});
