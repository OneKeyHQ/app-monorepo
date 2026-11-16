/** @jest-environment jsdom */
/* eslint-disable import/first */

const mockNavigation = jest.fn<
  Promise<void>,
  [
    {
      onBeforeSend?: () => Promise<void>;
      onBroadcastStart?: (uuid: string) => void;
      onCancel?: () => void;
      onLateBroadcastAccepted?: (
        fact: import('@onekeyhq/shared/types/tx').IBroadcastAcceptedFact,
      ) => void | Promise<void>;
      onSuccess?: (
        data: {
          decodedTx: {
            txid: string;
            status?: import('@onekeyhq/shared/types/tx').EDecodedTxStatus;
          };
          signedTx?: { txid: string };
        }[],
      ) => void;
    },
  ]
>();
const mockAccount = jest.fn<Promise<{ address: string }>, []>();
const mockRecoveryStatus = jest.fn<Promise<'success' | 'pending'>, []>();
const mockBuildStake = jest.fn<
  Promise<{ tx: object; orderId?: string }>,
  [unknown]
>();
const mockBuildWithdraw = jest.fn<
  Promise<{ tx: object; orderId?: string }>,
  [unknown]
>();
const mockRecordLateOrder = jest.fn<Promise<'synced'>, [unknown]>();
const mockAddOrder = jest.fn<Promise<'synced'>, [unknown, unknown?]>();
const mockWaitForFinalStatus = jest.fn<Promise<string>, [unknown]>();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  Toast: { error: jest.fn(), success: jest.fn() },
}));
jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({ navigationToTxConfirm: mockNavigation }),
}));
jest.mock('@onekeyhq/kit/src/utils/waitForTxFinalStatus', () => ({
  waitForTxFinalStatus: (params: unknown) => mockWaitForFinalStatus(params),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: { getAccount: () => mockAccount() },
    serviceStaking: {
      getStakingConfigs: async () => ({}),
      buildStakeTransaction: (params: unknown) => mockBuildStake(params),
      buildUnstakeTransaction: (params: unknown) => mockBuildWithdraw(params),
      recordLateEtherFiOrder: (params: unknown) => mockRecordLateOrder(params),
      addEarnOrder: (order: unknown, options?: unknown) =>
        mockAddOrder(order, options),
      buildInternalDappTx: async () => ({}),
      checkEtherFiNativeDepositTx: () => mockRecoveryStatus(),
      fetchTokenAllowance: async () => ({ allowanceParsed: '1' }),
    },
    serviceToken: {
      fetchTokensDetailsBatch: async () => [
        {
          accountAddress: '0x1111111111111111111111111111111111111111',
          tokens: [
            {
              info: {
                address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
                decimals: 18,
                isNative: false,
                networkId: 'evm--1',
              },
              balance: '100000000000000000',
              balanceParsed: '0.1',
            },
          ],
        },
      ],
    },
  },
}));
jest.mock('../components/EarnRiskWarningDialog', () => ({
  showEarnRiskWarningDialog: async () => true,
  useEarnRiskWarningGate: () => async () => true,
}));
jest.mock('../components/ClaimConversionDialog', () => ({
  runClaimConversion: jest.fn(),
}));
jest.mock('../components/EstimateNetworkFee', () => ({
  useShowClaimEstimateGasAlert: () => jest.fn(),
}));
jest.mock('../components/ServerExecutedOrderDialog', () => ({
  showServerExecutedOrderDialog: jest.fn(),
}));

import { act, renderHook, waitFor } from '@testing-library/react';

import {
  EtherFiLiquidReferContract,
  EthereumWETH,
} from '@onekeyhq/shared/src/consts/addresses';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { etherFiDepositRecovery } from './etherFiDepositRecovery';
import { refreshEtherFiNativeDepositRecovery } from './useEtherFiNativeDepositRecovery';
import { useUniversalStake, useUniversalWithdraw } from './useUniversalHooks';

const account = '0x1111111111111111111111111111111111111111';
const common = { accountId: 'account-1', networkId: 'evm--1' };

describe('EtherFi Legacy verification at confirmation', () => {
  beforeEach(() => {
    mockNavigation.mockReset().mockResolvedValue(undefined);
    mockAccount.mockReset().mockResolvedValue({ address: account });
    mockRecoveryStatus.mockReset().mockResolvedValue('pending');
    mockBuildStake.mockReset().mockResolvedValue({ tx: {} });
    mockBuildWithdraw.mockReset().mockResolvedValue({ tx: {} });
    mockRecordLateOrder.mockReset().mockResolvedValue('synced');
    mockAddOrder.mockReset().mockResolvedValue('synced');
    mockWaitForFinalStatus.mockReset().mockResolvedValue('success');
  });

  it.each(['stake', 'withdraw'] as const)(
    'blocks %s before sending when Legacy verification fails',
    async (action) => {
      const verify = jest.fn<Promise<boolean>, []>().mockResolvedValue(false);
      const controller = new AbortController();
      const hook = renderHook(() => ({
        stake: useUniversalStake(common),
        withdraw: useUniversalWithdraw(common),
      }));
      await act(async () => {
        if (action === 'stake') {
          await hook.result.current.stake({
            amount: '1',
            symbol: 'liquidUSD',
            provider: 'etherfi',
            expectedAccountAddress: account,
            actionSignal: controller.signal,
            verifyEtherFiLegacyApproval: verify,
          });
        } else {
          await hook.result.current.withdraw({
            amount: '1',
            symbol: 'liquidUSD',
            provider: 'etherfi',
            expectedAccountAddress: account,
            protocolVault: '0xvault',
            withdrawAll: false,
            withdrawType: 'queued',
            signal: controller.signal,
            verifyEtherFiLegacyApproval: verify,
          });
        }
      });
      expect(mockNavigation).toHaveBeenCalledTimes(1);
      const beforeSend = mockNavigation.mock.calls[0][0].onBeforeSend;
      expect(beforeSend).toBeDefined();
      if (!beforeSend) return;
      await expect(beforeSend()).rejects.toThrow('Legacy approval changed');
      expect(verify).toHaveBeenCalledTimes(1);
      verify.mockResolvedValueOnce(true);
      await expect(beforeSend()).resolves.toBeUndefined();
      mockAccount.mockResolvedValueOnce({
        address: '0x2222222222222222222222222222222222222222',
      });
      await expect(beforeSend()).rejects.toThrow(/account changed/);
      expect(verify).toHaveBeenCalledTimes(2);
      let resolveVerification: (value: boolean) => void = () => undefined;
      verify.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveVerification = resolve;
          }),
      );
      const pending = beforeSend();
      await waitFor(() => expect(verify).toHaveBeenCalledTimes(3));
      controller.abort();
      resolveVerification(true);
      await expect(pending).rejects.toThrow(/context expired/);
    },
  );

  it.each(['stake', 'withdraw'] as const)(
    'reconciles a verified late %s without continuing the old UI flow',
    async (action) => {
      const controller = new AbortController();
      const onSuccess = jest.fn();
      mockBuildStake.mockResolvedValueOnce({ tx: {}, orderId: 'order-1' });
      mockBuildWithdraw.mockResolvedValueOnce({ tx: {}, orderId: 'order-1' });
      const hook = renderHook(() => ({
        stake: useUniversalStake(common),
        withdraw: useUniversalWithdraw(common),
      }));
      const stakingInfo: IStakingInfo = {
        protocol: 'etherfi',
        label: action === 'stake' ? EEarnLabels.Stake : EEarnLabels.Withdraw,
        tags: [],
      };
      await act(async () => {
        if (action === 'stake') {
          await hook.result.current.stake({
            amount: '0.1',
            symbol: 'WETH',
            provider: 'etherfi',
            expectedAccountAddress: account,
            actionSignal: controller.signal,
            stakingInfo,
            onSuccess,
          });
        } else {
          await hook.result.current.withdraw({
            amount: '0.1',
            symbol: 'WETH',
            provider: 'etherfi',
            expectedAccountAddress: account,
            protocolVault: '0xvault',
            withdrawAll: false,
            withdrawType: 'queued',
            signal: controller.signal,
            stakingInfo,
            onSuccess,
          });
        }
      });
      const callback = mockNavigation.mock.calls[0][0].onLateBroadcastAccepted;
      if (!callback)
        throw new OneKeyLocalError('Missing late broadcast callback');
      controller.abort();
      const txid = `0x${'7'.repeat(64)}`;
      await act(async () => callback({ uuid: 'tx-1', ...common, txid }));
      expect(mockRecordLateOrder).toHaveBeenCalledWith({
        uuid: 'tx-1',
        ...common,
        order: expect.objectContaining({
          orderId: 'order-1',
          txId: txid,
          status: EDecodedTxStatus.Pending,
        }),
      });
      expect(onSuccess).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['stake', 'etherfi', true],
    ['withdraw', 'etherfi', true],
    ['stake', 'native', false],
    ['withdraw', 'native', false],
  ] as const)(
    'uses the scoped order sync for %s with provider %s',
    async (action, provider, isEtherFi) => {
      const controller = new AbortController();
      mockBuildStake.mockResolvedValueOnce({ tx: {}, orderId: 'order-1' });
      mockBuildWithdraw.mockResolvedValueOnce({ tx: {}, orderId: 'order-1' });
      const hook = renderHook(() => ({
        stake: useUniversalStake(common),
        withdraw: useUniversalWithdraw(common),
      }));
      const stakingInfo: IStakingInfo = {
        protocol: provider,
        label: action === 'stake' ? EEarnLabels.Stake : EEarnLabels.Withdraw,
        tags: [],
      };
      await act(async () => {
        if (action === 'stake') {
          await hook.result.current.stake({
            amount: '0.1',
            symbol: 'WETH',
            provider,
            expectedAccountAddress: account,
            actionSignal: controller.signal,
            stakingInfo,
          });
        } else {
          await hook.result.current.withdraw({
            amount: '0.1',
            symbol: 'WETH',
            provider,
            expectedAccountAddress: account,
            protocolVault: '0xvault',
            withdrawAll: false,
            withdrawType: 'queued',
            signal: controller.signal,
            stakingInfo,
          });
        }
      });
      const callback = mockNavigation.mock.calls[0][0].onSuccess;
      if (!callback) throw new OneKeyLocalError('Missing success callback');
      const txid = `0x${'6'.repeat(64)}`;
      await act(async () =>
        callback([
          {
            signedTx: { txid },
            decodedTx: { txid, status: EDecodedTxStatus.Pending },
          },
        ]),
      );
      await waitFor(() => expect(mockAddOrder).toHaveBeenCalledTimes(1));
      expect(mockAddOrder).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'order-1', txId: txid }),
        isEtherFi ? { etherFiOnce: true, accountId: 'account-1' } : undefined,
      );
      expect(
        mockNavigation.mock.calls[0][0].onLateBroadcastAccepted !== undefined,
      ).toBe(isEtherFi);
    },
  );

  it('retains an uncertain wrap after detaching and records a late matching transaction without auto-continuing', async () => {
    const controller = new AbortController();
    const vault = '0xf0bb20865277abd641a307ece5ee04e79073416c';
    const scope = { ...common, accountAddress: account, vault };
    const hook = renderHook(() => useUniversalStake(common));
    let completion: Promise<boolean> | undefined;
    await act(async () => {
      completion = hook.result.current({
        amount: '0.1',
        symbol: 'ETH',
        provider: 'etherfi',
        protocolVault: vault,
        expectedAccountAddress: account,
        actionSignal: controller.signal,
        stakeType: 'wrap',
        postWrapStakeToken: {
          address: EthereumWETH,
          symbol: 'WETH',
          name: 'Wrapped Ether',
          decimals: 18,
          isNative: false,
          networkId: 'evm--1',
        },
        postWrapApproveSpenderAddress: EtherFiLiquidReferContract,
      });
    });
    await waitFor(() => expect(mockNavigation).toHaveBeenCalledTimes(1));
    const confirm = mockNavigation.mock.calls[0][0];
    if (!confirm.onBeforeSend || !confirm.onSuccess || !completion)
      throw new OneKeyLocalError('Missing confirmation fixture');
    await act(async () => {
      await confirm.onBeforeSend?.();
      confirm.onBroadcastStart?.('wrap-uuid');
      expect(() => confirm.onBroadcastStart?.('wrap-uuid')).not.toThrow();
      expect(() => confirm.onBroadcastStart?.('different-uuid')).toThrow();
      controller.abort();
    });
    await expect(completion).resolves.toBe(false);
    const [record] = etherFiDepositRecovery.list(scope);
    expect(record.status).toBe('unknown');
    const txid = `0x${'a'.repeat(64)}`;
    act(() => confirm.onSuccess?.([{ decodedTx: { txid } }]));
    expect(etherFiDepositRecovery.list(scope)[0].status).toBe('confirming');
    mockRecoveryStatus.mockResolvedValueOnce('success');
    await refreshEtherFiNativeDepositRecovery(record.id);
    expect(etherFiDepositRecovery.list(scope)[0].status).toBe('ready');
    expect(mockNavigation).toHaveBeenCalledTimes(1);
  });

  it('does not create an attempt when account verification finishes after confirmation cancellation', async () => {
    const controller = new AbortController();
    const vault = '0xf0bb20865277abd641a307ece5ee04e79073416c';
    const isolatedAccount = { ...common, accountId: 'cancel-before-send' };
    const scope = { ...isolatedAccount, accountAddress: account, vault };
    const hook = renderHook(() => useUniversalStake(isolatedAccount));
    let completeAccount: (value: { address: string }) => void = () => undefined;
    mockAccount.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          completeAccount = resolve;
        }),
    );
    let completion: Promise<boolean> | undefined;
    await act(async () => {
      completion = hook.result.current({
        amount: '0.1',
        symbol: 'ETH',
        provider: 'etherfi',
        protocolVault: vault,
        expectedAccountAddress: account,
        actionSignal: controller.signal,
        stakeType: 'wrap',
        postWrapStakeToken: {
          address: EthereumWETH,
          symbol: 'WETH',
          name: 'Wrapped Ether',
          decimals: 18,
          isNative: false,
          networkId: 'evm--1',
        },
        postWrapApproveSpenderAddress: EtherFiLiquidReferContract,
      });
    });
    await waitFor(() => expect(mockNavigation).toHaveBeenCalledTimes(1));
    const confirmation = mockNavigation.mock.calls[0][0];
    if (!confirmation.onBeforeSend || !confirmation.onCancel || !completion)
      throw new OneKeyLocalError('Missing confirmation fixture');
    let preSend: Promise<string> | undefined;
    await act(async () => {
      preSend = confirmation.onBeforeSend?.().then(
        () => 'sent',
        () => 'cancelled',
      );
      confirmation.onCancel?.();
      await Promise.resolve();
    });
    await expect(completion).resolves.toBe(false);
    await act(async () => completeAccount({ address: account }));
    await expect(preSend).resolves.toBe('cancelled');
    expect(etherFiDepositRecovery.list(scope, true)).toEqual([]);
  });

  it('resumes a confirmed wrap without building a second wrap transaction', async () => {
    const controller = new AbortController();
    const vault = '0xf0bb20865277abd641a307ece5ee04e79073416c';
    const scope = { ...common, accountAddress: account, vault };
    const id = etherFiDepositRecovery.begin(scope, '0.1', 'wrap');
    const attempt = etherFiDepositRecovery.markSending(id, id, 'wrap');
    if (!attempt) throw new OneKeyLocalError('Missing attempt');
    const txid = `0x${'e'.repeat(64)}`;
    etherFiDepositRecovery.recordTxid(id, attempt, txid);
    etherFiDepositRecovery.recordFinal(id, attempt, txid, 'success');
    etherFiDepositRecovery.detach(id, id);
    const owner = etherFiDepositRecovery.claim(id);
    if (!owner) throw new OneKeyLocalError('Missing owner');
    const hook = renderHook(() => useUniversalStake(common));
    await act(async () => {
      await hook.result.current({
        amount: '0.1',
        symbol: 'WETH',
        provider: 'etherfi',
        protocolVault: vault,
        expectedAccountAddress: account,
        actionSignal: controller.signal,
        stakeType: 'wrap',
        etherFiNativeRecovery: { id, owner, amount: '0.1' },
        beforeEtherFiPostWrapDeposit: async () => true,
        postWrapStakeToken: {
          address: EthereumWETH,
          symbol: 'WETH',
          name: 'Wrapped Ether',
          decimals: 18,
          isNative: false,
          networkId: 'evm--1',
        },
        postWrapApproveSpenderAddress: EtherFiLiquidReferContract,
      });
    });
    expect(mockBuildStake).toHaveBeenCalledTimes(1);
    expect(mockBuildStake.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        stakeType: 'normal',
        inputTokenAddress: EthereumWETH,
      }),
    );
    expect(mockNavigation).toHaveBeenCalledTimes(1);
    controller.abort();
  });

  it('continues a confirmed wrap when only its decoded transaction has a hash', async () => {
    const controller = new AbortController();
    const vault = '0xf0bb20865277abd641a307ece5ee04e79073416c';
    const hook = renderHook(() => useUniversalStake(common));
    mockRecoveryStatus.mockResolvedValue('success');
    let completion: Promise<boolean> | undefined;
    await act(async () => {
      completion = hook.result.current({
        amount: '0.1',
        symbol: 'ETH',
        provider: 'etherfi',
        protocolVault: vault,
        expectedAccountAddress: account,
        actionSignal: controller.signal,
        stakeType: 'wrap',
        beforeEtherFiPostWrapDeposit: async () => true,
        postWrapStakeToken: {
          address: EthereumWETH,
          symbol: 'WETH',
          name: 'Wrapped Ether',
          decimals: 18,
          isNative: false,
          networkId: 'evm--1',
        },
        postWrapApproveSpenderAddress: EtherFiLiquidReferContract,
      });
    });
    await waitFor(() => expect(mockNavigation).toHaveBeenCalledTimes(1));
    const confirmation = mockNavigation.mock.calls[0][0];
    if (!confirmation.onBeforeSend || !confirmation.onSuccess || !completion)
      throw new OneKeyLocalError('Missing confirmation fixture');
    const txid = `0x${'8'.repeat(64)}`;
    await act(async () => {
      await confirmation.onBeforeSend?.();
      confirmation.onBroadcastStart?.('wrap-uuid');
      confirmation.onSuccess?.([
        { signedTx: { txid: '' }, decodedTx: { txid } },
      ]);
    });
    await act(async () => expect(await completion).toBe(true));
    expect(mockWaitForFinalStatus).toHaveBeenCalledWith(
      expect.objectContaining({ txid }),
    );
    expect(mockNavigation).toHaveBeenCalledTimes(2);
    controller.abort();
  });

  it('keeps the claimed intent after gas cancellation and retries without wrapping again', async () => {
    const controller = new AbortController();
    const vault = '0xf0bb20865277abd641a307ece5ee04e79073416c';
    const scope = { ...common, accountAddress: account, vault };
    const id = etherFiDepositRecovery.begin(scope, '0.1', 'wrap');
    const attempt = etherFiDepositRecovery.markSending(id, id, 'wrap');
    if (!attempt) throw new OneKeyLocalError('Missing attempt');
    const txid = `0x${'f'.repeat(64)}`;
    etherFiDepositRecovery.recordTxid(id, attempt, txid);
    etherFiDepositRecovery.recordFinal(id, attempt, txid, 'success');
    etherFiDepositRecovery.detach(id, id);
    const owner = etherFiDepositRecovery.claim(id);
    if (!owner) throw new OneKeyLocalError('Missing owner');
    const hook = renderHook(() => useUniversalStake(common));
    const confirmGas = jest
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    const params: Parameters<typeof hook.result.current>[0] = {
      amount: '0.1',
      symbol: 'WETH',
      provider: 'etherfi',
      protocolVault: vault,
      expectedAccountAddress: account,
      actionSignal: controller.signal,
      stakeType: 'wrap',
      etherFiNativeRecovery: { id, owner, amount: '0.1' },
      beforeEtherFiPostWrapDeposit: confirmGas,
      postWrapStakeToken: {
        address: EthereumWETH,
        symbol: 'WETH',
        name: 'Wrapped Ether',
        decimals: 18,
        isNative: false,
        networkId: 'evm--1',
      },
      postWrapApproveSpenderAddress: EtherFiLiquidReferContract,
    };
    await act(async () => {
      expect(await hook.result.current(params)).toBe(false);
    });
    expect(etherFiDepositRecovery.get(id)).toEqual(
      expect.objectContaining({ owner, detached: false, phase: 'deposit' }),
    );
    expect(mockNavigation).not.toHaveBeenCalled();
    await act(async () => {
      expect(await hook.result.current(params)).toBe(true);
    });
    expect(mockBuildStake).toHaveBeenCalledTimes(1);
    expect(mockBuildStake.mock.calls[0][0]).toEqual(
      expect.objectContaining({ stakeType: 'normal' }),
    );
    expect(mockNavigation).toHaveBeenCalledTimes(1);
    controller.abort();
  });
});
