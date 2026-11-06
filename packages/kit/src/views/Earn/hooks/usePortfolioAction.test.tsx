/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import {
  EEarnLabels,
  EStakingActionType,
  type IEarnCancelWithdrawalActionIcon,
} from '@onekeyhq/shared/types/staking';

import { usePortfolioAction } from './usePortfolioAction';

import type { useUniversalWithdraw } from '../../Staking/hooks/useUniversalHooks';

type IWithdrawParams = Parameters<ReturnType<typeof useUniversalWithdraw>>[0];
type IAccountParams = { accountId: string; networkId: string };

const mockWithdraw = jest.fn<Promise<boolean>, [IWithdrawParams]>();
const mockWithdrawAccount = jest.fn<void, [IAccountParams]>();
const mockClaim = jest.fn();
const mockSignMessage = jest.fn();
const mockShowKyc = jest.fn<void, [unknown]>();
const mockGetEarnAccount = jest.fn<
  Promise<{ accountId: string } | null>,
  [unknown]
>();
const mockEarnAccount = { accountId: 'earn-account' };
const mockPushModal = jest.fn();

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getEarnAccount: (input: unknown) => mockGetEarnAccount(input),
      getProtocolDetailsV2: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));

jest.mock('@onekeyhq/components', () => {
  const { useDeferredPromise } = jest.requireActual(
    '../../../../../components/src/hooks/useDeferredPromise',
  );
  return {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
  };
});

jest.mock('../../Staking/hooks/useUniversalHooks', () => ({
  useUniversalWithdraw: (input: IAccountParams) => {
    mockWithdrawAccount(input);
    return mockWithdraw;
  },
}));

jest.mock('../../Staking/pages/ProtocolDetails/useHandleClaim', () => ({
  useHandleClaim: () => mockClaim,
}));

jest.mock('../../Staking/hooks/useEarnSignMessage', () => ({
  useEarnSignMessage: () => mockSignMessage,
}));

jest.mock('../../Staking/components/ProtocolDetails/showKYCDialog', () => ({
  showClaimWithKycDialog: (input: unknown) => mockShowKyc(input),
}));

const hookVault = '0xf0bb20865277abd641a307ece5ee04e79073416c';
const otherVault = '0x08c6f91e2b681faf5e17227f2a44c307b3c1364c';
const params = {
  accountId: 'selected-account',
  networkId: 'evm--1',
  symbol: 'eETH',
  provider: 'etherfi',
  vault: hookVault,
  stakeTag: EEarnLabels.Stake,
};

function cancelAction(
  data?: IEarnCancelWithdrawalActionIcon['data'],
): IEarnCancelWithdrawalActionIcon {
  return {
    type: EStakingActionType.CancelWithdrawal,
    disabled: false,
    text: { text: 'Cancel' },
    ...(data ? { data } : {}),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('usePortfolioAction cancel withdrawal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithdraw.mockReset().mockResolvedValue(true);
    mockGetEarnAccount.mockReset().mockResolvedValue(mockEarnAccount);
  });

  it('opens a cancellation request picker for an aggregated action without building a transaction', async () => {
    const onSuccess = jest.fn(async () => undefined);
    const { result } = renderHook(() =>
      usePortfolioAction({ ...params, onSuccess }),
    );
    await waitFor(() =>
      expect(mockWithdrawAccount).toHaveBeenLastCalledWith({
        accountId: 'earn-account',
        networkId: params.networkId,
      }),
    );

    await act(async () =>
      result.current.handleAction({
        actionIcon: cancelAction(),
      }),
    );

    expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.WithdrawOptions,
      params: expect.objectContaining({
        accountId: 'earn-account',
        networkId: params.networkId,
        provider: 'etherfi',
        symbol: 'eETH',
        withdrawType: 'cancel',
        protocolInfo: expect.objectContaining({ vault: hookVault }),
        onSuccess,
      }),
    });
    expect(mockWithdraw).not.toHaveBeenCalled();
    expect(mockClaim).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('uses only the current account while a new account resolves', async () => {
    const nextAccount = deferred<{ accountId: string }>();
    mockGetEarnAccount
      .mockResolvedValueOnce({ accountId: 'earn-account-a' })
      .mockReturnValueOnce(nextAccount.promise);
    const { result, rerender } = renderHook(
      (value: typeof params) => usePortfolioAction(value),
      { initialProps: { ...params, accountId: 'account-a' } },
    );
    await waitFor(() =>
      expect(mockWithdrawAccount).toHaveBeenLastCalledWith({
        accountId: 'earn-account-a',
        networkId: params.networkId,
      }),
    );

    rerender({ ...params, accountId: 'account-b' });
    expect(result.current.loading).toBe(true);
    await act(async () =>
      result.current.handleAction({ actionIcon: cancelAction() }),
    );
    expect(mockPushModal).not.toHaveBeenCalled();

    await act(async () => nextAccount.resolve({ accountId: 'earn-account-b' }));
    await act(async () =>
      result.current.handleAction({ actionIcon: cancelAction() }),
    );
    expect(mockPushModal).toHaveBeenLastCalledWith(
      EModalRoutes.StakingModal,
      expect.objectContaining({
        params: expect.objectContaining({ accountId: 'earn-account-b' }),
      }),
    );
  });

  it('ignores a late result from a previous account', async () => {
    const previousAccount = deferred<{ accountId: string }>();
    mockGetEarnAccount
      .mockReturnValueOnce(previousAccount.promise)
      .mockResolvedValueOnce({ accountId: 'earn-account-b' });
    const { result, rerender } = renderHook(
      (value: typeof params) => usePortfolioAction(value),
      { initialProps: { ...params, accountId: 'account-a' } },
    );
    rerender({ ...params, accountId: 'account-b' });
    await waitFor(() =>
      expect(mockWithdrawAccount).toHaveBeenLastCalledWith({
        accountId: 'earn-account-b',
        networkId: params.networkId,
      }),
    );
    await act(async () =>
      previousAccount.resolve({ accountId: 'earn-account-a' }),
    );
    await act(async () =>
      result.current.handleAction({ actionIcon: cancelAction() }),
    );
    expect(mockPushModal).toHaveBeenLastCalledWith(
      EModalRoutes.StakingModal,
      expect.objectContaining({
        params: expect.objectContaining({ accountId: 'earn-account-b' }),
      }),
    );
  });

  it('waits for the network account when only an indexed account is present', async () => {
    const networkAccount = deferred<{ accountId: string }>();
    mockGetEarnAccount.mockReturnValueOnce(networkAccount.promise);
    const { result } = renderHook(() =>
      usePortfolioAction({
        ...params,
        accountId: '',
        indexedAccountId: 'indexed-account',
      }),
    );
    expect(result.current.loading).toBe(true);
    await act(async () =>
      result.current.handleAction({ actionIcon: cancelAction() }),
    );
    expect(mockPushModal).not.toHaveBeenCalled();

    await act(async () =>
      networkAccount.resolve({ accountId: 'network-account' }),
    );
    await act(async () =>
      result.current.handleAction({ actionIcon: cancelAction() }),
    );
    expect(mockPushModal).toHaveBeenLastCalledWith(
      EModalRoutes.StakingModal,
      expect.objectContaining({
        params: expect.objectContaining({ accountId: 'network-account' }),
      }),
    );
  });

  it('allows retrying a missing account instead of using an unverified fallback', async () => {
    mockGetEarnAccount.mockResolvedValueOnce(null);
    const { result } = renderHook(() => usePortfolioAction(params));
    await waitFor(() =>
      expect(result.current.accountResolutionFailed).toBe(true),
    );
    await act(async () =>
      result.current.handleAction({ actionIcon: cancelAction() }),
    );
    expect(mockPushModal).not.toHaveBeenCalled();

    mockGetEarnAccount.mockResolvedValueOnce({ accountId: 'resolved-account' });
    await act(async () => result.current.retryAccount());
    await act(async () =>
      result.current.handleAction({ actionIcon: cancelAction() }),
    );
    expect(mockPushModal).toHaveBeenLastCalledWith(
      EModalRoutes.StakingModal,
      expect.objectContaining({
        params: expect.objectContaining({ accountId: 'resolved-account' }),
      }),
    );
  });

  it('reports a resolution error and lets the user retry', async () => {
    mockGetEarnAccount.mockRejectedValueOnce(
      new Error('account lookup failed'),
    );
    const { result } = renderHook(() => usePortfolioAction(params));
    await waitFor(() =>
      expect(result.current.accountResolutionFailed).toBe(true),
    );
    expect(result.current.loading).toBe(false);
    await act(async () =>
      result.current.handleAction({ actionIcon: cancelAction() }),
    );
    expect(mockPushModal).not.toHaveBeenCalled();

    const retry = deferred<{ accountId: string }>();
    mockGetEarnAccount.mockReturnValueOnce(retry.promise);
    act(() => {
      void result.current.retryAccount();
    });
    expect(result.current.loading).toBe(true);
    await act(async () => retry.resolve({ accountId: 'recovered-account' }));
    expect(result.current.accountResolutionFailed).toBe(false);
    await act(async () =>
      result.current.handleAction({ actionIcon: cancelAction() }),
    );
    expect(mockPushModal).toHaveBeenLastCalledWith(
      EModalRoutes.StakingModal,
      expect.objectContaining({
        params: expect.objectContaining({ accountId: 'recovered-account' }),
      }),
    );
  });

  it('does not start an action when indexed-only account resolution returns no account', async () => {
    mockGetEarnAccount.mockResolvedValueOnce(null);
    const { result } = renderHook(() =>
      usePortfolioAction({
        ...params,
        accountId: '',
        indexedAccountId: 'indexed-account',
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () =>
      result.current.handleAction({ actionIcon: cancelAction() }),
    );
    expect(mockPushModal).not.toHaveBeenCalled();
  });

  it('uses the current protocol vault after switching vaults', async () => {
    const { result, rerender } = renderHook(
      (value: typeof params) => usePortfolioAction(value),
      { initialProps: params },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () =>
      result.current.handleAction({ actionIcon: cancelAction() }),
    );
    rerender({ ...params, vault: otherVault });
    await act(async () =>
      result.current.handleAction({ actionIcon: cancelAction() }),
    );
    expect(mockPushModal).toHaveBeenCalledTimes(2);
    expect(mockPushModal.mock.calls[0][1].params.protocolInfo.vault).toBe(
      hookVault,
    );
    expect(mockPushModal.mock.calls[1][1].params.protocolInfo.vault).toBe(
      otherVault,
    );
    expect(mockWithdraw).not.toHaveBeenCalled();
  });

  it.each(['Native', 'Spark'])(
    'preserves the legacy %s cancellation without action data',
    async (provider) => {
      const { result } = renderHook(() =>
        usePortfolioAction({ ...params, provider, symbol: 'USDT' }),
      );
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        result.current.handleAction({ actionIcon: cancelAction() });
      });

      expect(mockWithdraw).toHaveBeenCalledTimes(1);
      expect(mockWithdraw.mock.calls[0][0]).toMatchObject({
        provider,
        symbol: 'USDT',
        amount: '0',
        withdrawAll: false,
        withdrawType: 'cancel',
        protocolVault: hookVault,
      });
      expect(mockWithdraw.mock.calls[0][0]).not.toHaveProperty('requestId');
      expect(mockWithdraw.mock.calls[0][0].identity).toBeUndefined();
      expect(result.current.loading).toBe(false);
    },
  );

  it('clears loading when the transaction confirmation is canceled', async () => {
    const withdrawal = deferred<boolean>();
    mockWithdraw.mockReturnValueOnce(withdrawal.promise);
    const { result } = renderHook(() =>
      usePortfolioAction({ ...params, provider: 'Native' }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.handleAction({
        actionIcon: cancelAction(),
      });
    });
    expect(result.current.loading).toBe(true);

    await act(async () => withdrawal.resolve(false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockWithdraw).toHaveBeenCalledTimes(1);
  });

  it('refreshes the portfolio only through the withdrawal success callback', async () => {
    const onSuccess = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      usePortfolioAction({ ...params, provider: 'Native', onSuccess }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.handleAction({
        actionIcon: cancelAction(),
      });
    });
    expect(onSuccess).not.toHaveBeenCalled();

    mockWithdraw.mock.calls[0][0].onSuccess?.([]);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
