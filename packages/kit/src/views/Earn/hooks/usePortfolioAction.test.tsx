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
const mockGetEarnAccount = jest.fn<Promise<{ accountId: string }>, [unknown]>();
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

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: mockEarnAccount }),
}));

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
const requestOne = `0x${'11'.repeat(32)}`;
const requestTwo = `0x${'22'.repeat(32)}`;
const params = {
  accountId: 'selected-account',
  networkId: 'evm--1',
  symbol: 'eETH',
  provider: 'etherfi',
  vault: hookVault,
  stakeTag: EEarnLabels.Stake,
};

/** 构造实际持仓按钮数据；data 缺省用于验证 Native/Spark 旧响应兼容性。 */
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

/** 保留待确认阶段，以验证点击期间 loading 不会提前关闭。 */
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
  });

  it('opens a cancellation request picker for an aggregated action without building a transaction', async () => {
    const onSuccess = jest.fn(async () => undefined);
    const { result } = renderHook(() =>
      usePortfolioAction({ ...params, onSuccess }),
    );

    await act(async () =>
      result.current.handleAction({
        actionIcon: cancelAction({ selectRequest: true, vault: otherVault }),
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
        protocolInfo: expect.objectContaining({ vault: otherVault }),
        onSuccess,
      }),
    });
    expect(mockWithdraw).not.toHaveBeenCalled();
    expect(mockClaim).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('keeps the selected request identity when two queue items are canceled in sequence', async () => {
    const { result } = renderHook(() => usePortfolioAction(params));
    const actions = [
      cancelAction({ identity: requestOne }),
      cancelAction({ identity: requestTwo }),
    ];

    for (const actionIcon of actions) {
      await act(async () => result.current.handleAction({ actionIcon }));
    }

    expect(mockWithdrawAccount).toHaveBeenCalledWith({
      accountId: 'earn-account',
      networkId: params.networkId,
    });
    expect(mockWithdraw).toHaveBeenCalledTimes(2);
    expect(
      mockWithdraw.mock.calls.map(([call]) => ({
        identity: call.identity,
        protocolVault: call.protocolVault,
      })),
    ).toEqual([
      {
        identity: requestOne,
        protocolVault: hookVault,
      },
      {
        identity: requestTwo,
        protocolVault: hookVault,
      },
    ]);
    expect(mockWithdraw.mock.calls[0][0]).toMatchObject({
      amount: '0',
      symbol: 'eETH',
      provider: 'etherfi',
      withdrawAll: false,
      withdrawType: 'cancel',
    });
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockSignMessage).not.toHaveBeenCalled();
    expect(mockShowKyc).not.toHaveBeenCalled();
  });

  it('uses each clicked action vault and falls back to the hook vault when omitted', async () => {
    const { result } = renderHook(() => usePortfolioAction(params));
    const actions = [
      cancelAction({ identity: requestOne, vault: otherVault }),
      cancelAction({ identity: requestTwo }),
    ];

    for (const actionIcon of actions) {
      await act(async () => result.current.handleAction({ actionIcon }));
    }

    expect(mockWithdraw.mock.calls.map(([call]) => call.protocolVault)).toEqual(
      [otherVault, hookVault],
    );
    expect(mockWithdraw.mock.calls.map(([call]) => call.identity)).toEqual([
      requestOne,
      requestTwo,
    ]);
  });

  it.each(['Native', 'Spark'])(
    'preserves the legacy %s cancellation without action data',
    async (provider) => {
      const { result } = renderHook(() =>
        usePortfolioAction({ ...params, provider, symbol: 'USDT' }),
      );

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
    const { result } = renderHook(() => usePortfolioAction(params));

    act(() => {
      result.current.handleAction({
        actionIcon: cancelAction({ identity: requestOne }),
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
      usePortfolioAction({ ...params, onSuccess }),
    );

    await act(async () => {
      result.current.handleAction({
        actionIcon: cancelAction({ identity: requestOne }),
      });
    });
    expect(onSuccess).not.toHaveBeenCalled();

    mockWithdraw.mock.calls[0][0].onSuccess?.([]);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
