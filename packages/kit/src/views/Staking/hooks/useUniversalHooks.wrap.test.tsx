/** @jest-environment jsdom */

import {
  StrictMode,
  Suspense,
  startTransition,
  useLayoutEffect,
  useState,
} from 'react';

import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from '@testing-library/react';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type {
  IApproveInfo,
  IWrappedInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import {
  EtherFiLiquidReferContract,
  EthereumWETH,
} from '@onekeyhq/shared/src/consts/addresses';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { UserCancel } from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import {
  EEarnLabels,
  type IEarnStakeType,
  type IStakeTxResponse,
  type IStakingInfo,
} from '@onekeyhq/shared/types/staking';
import { EWrappedType } from '@onekeyhq/shared/types/swap/types';
import type {
  IFetchTokenDetailItem,
  IToken,
} from '@onekeyhq/shared/types/token';
import {
  EDecodedTxStatus,
  type IBroadcastAcceptedFact,
  type ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';

import { depositTaskRegistry } from '../earnDepositTask/registry';
import { getDepositTaskOwnerKey } from '../earnDepositTask/useRetainedDepositTask';

import { useUniversalStake } from './useUniversalHooks';

import type { IDepositTaskHandle } from '../earnDepositTask/types';

type IConfirmParams = {
  encodedTx?: IEncodedTx;
  wrappedInfo?: IWrappedInfo;
  stakingInfo?: IStakingInfo;
  approvesInfo?: IApproveInfo[];
  onSuccess?: (data: ISendTxOnSuccessData[]) => void | Promise<void>;
  onFail?: (error: Error) => void;
  onConfirmationFail?: (error: Error) => void;
  onSafePreSendFail?: (error: Error) => void;
  onCancel?: () => void;
  onBeforeSend?: () => void | Promise<void>;
  onLateBroadcastAccepted?: (
    fact: IBroadcastAcceptedFact,
  ) => void | Promise<void>;
  isNavigationCurrent?: () => boolean;
};
type IAllowance = { allowance: string; allowanceParsed: string };

const mockPrepareWrap = jest.fn<Promise<IWrappedInfo>, [unknown]>();
const mockNavigate = jest.fn<Promise<void>, [IConfirmParams]>();
const mockBuildStake = jest.fn<
  Promise<IStakeTxResponse>,
  [{ stakeType?: IEarnStakeType }]
>();
const mockBuildInternal = jest.fn<Promise<IEncodedTx>, [unknown]>();
const mockAllowance = jest.fn<Promise<IAllowance>, [unknown]>();
const mockWrappedBalance = jest.fn<
  Promise<IFetchTokenDetailItem[]>,
  [unknown]
>();
const mockGetAccount = jest.fn<Promise<{ address: string }>, [unknown]>();
const mockGetAccountAddress = jest.fn<Promise<string>, [unknown]>();
const mockTrackOrder = jest.fn<
  Promise<
    | void
    | {
        localStatus: 'saved' | 'unavailable';
        remoteStatus: 'failed' | 'synced';
      }
    | { localStatus: 'superseded'; remoteStatus: 'skipped' }
    | { localStatus: 'superseded'; remoteStatus: 'notAttempted' }
    | { localStatus: 'saved'; remoteStatus: 'skipped' }
    | { localStatus: 'failed' | 'unavailable'; remoteStatus: 'notAttempted' }
  >,
  [unknown]
>();
const mockWaitForFinal = jest.fn<
  Promise<EOnChainHistoryTxStatus | undefined>,
  [unknown]
>();
const mockRiskAccepted = jest.fn<Promise<boolean>, [unknown]>();
const mockToastError = jest.fn<void, [unknown]>();
const mockToastMessage = jest.fn<void, [unknown]>();
const mockTrackOrderOptions = jest.fn<void, [unknown]>();

jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({ navigationToTxConfirm: mockNavigate }),
}));

jest.mock('../../Earn/earnSwap', () => ({
  prepareEarnWrap: (input: unknown) => mockPrepareWrap(input),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceToken: {
      fetchTokensDetails: (input: unknown) => mockWrappedBalance(input),
    },
    serviceStaking: {
      buildStakeTransaction: (input: { stakeType?: IEarnStakeType }) =>
        mockBuildStake(input),
      buildInternalDappTx: (input: unknown) => mockBuildInternal(input),
      fetchTokenAllowance: (input: unknown) => mockAllowance(input),
      addEarnOrder: (input: unknown, options: unknown) => {
        mockTrackOrderOptions(options);
        return mockTrackOrder(input);
      },
    },
    serviceAccount: {
      getAccount: (input: unknown) => mockGetAccount(input),
      getAccountAddressForApi: (input: unknown) => mockGetAccountAddress(input),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/utils/waitForTxFinalStatus', () => ({
  waitForTxFinalStatus: (input: unknown) => mockWaitForFinal(input),
}));

jest.mock('../components/EarnRiskWarningDialog', () => ({
  showEarnRiskWarningDialog: (input: unknown) => mockRiskAccepted(input),
  useEarnRiskWarningGate: () => mockRiskAccepted,
}));

jest.mock('../components/EstimateNetworkFee', () => ({
  useShowClaimEstimateGasAlert: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/utils/timerUtils')
  >('@onekeyhq/shared/src/utils/timerUtils');
  return {
    __esModule: true,
    default: { ...actual.default, wait: jest.fn(async () => undefined) },
  };
});

jest.mock('@onekeyhq/components', () => ({
  Toast: {
    error: (input: unknown) => mockToastError(input),
    message: (input: unknown) => mockToastMessage(input),
  },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

const account = {
  accountId: 'account-1',
  networkId: 'evm--1',
};
const owner = '0x1111111111111111111111111111111111111111';
const vault = '0xf0bb20865277abd641a307ece5ee04e79073416c';
const weth: IToken = {
  address: EthereumWETH,
  symbol: 'WETH',
  name: 'Wrapped Ether',
  decimals: 18,
  isNative: false,
};
const eth: IToken = {
  address: '',
  symbol: 'ETH',
  name: 'Ether',
  decimals: 18,
  isNative: true,
};
const stakingInfo: IStakingInfo = {
  protocol: 'EtherFi',
  label: EEarnLabels.Stake,
  tags: [EEarnLabels.Stake],
  send: { amount: '1', token: eth },
};
const params: Parameters<ReturnType<typeof useUniversalStake>>[0] = {
  amount: '1',
  symbol: 'ETH',
  provider: 'etherfi',
  protocolVault: vault,
  inputTokenAddress: '',
  stakeType: 'wrap',
  inputToken: eth,
  taskAccountAddress: owner,
  postWrapStakeToken: weth,
  postWrapApproveSpenderAddress: EtherFiLiquidReferContract,
  stakingInfo,
};
const wrapTx = {
  from: owner,
  to: EthereumWETH,
  value: '0xde0b6b3a7640000',
  data: '0xd0e30db0',
};
const depositTx = {
  from: owner,
  to: EtherFiLiquidReferContract,
  value: '0x0',
  data: '0x1234',
};

function successData(txid: string): ISendTxOnSuccessData[] {
  return [
    {
      signedTx: { txid, rawTx: '0x', encodedTx: null },
      decodedTx: {
        ...account,
        txid,
        status: EDecodedTxStatus.Pending,
        owner,
        signer: owner,
        nonce: 0,
        actions: [],
        extraInfo: null,
      },
    },
  ];
}

function decodedOnlySuccessData(txid: string): ISendTxOnSuccessData[] {
  return successData(txid).map((data) => ({
    ...data,
    signedTx: { ...data.signedTx, txid: '' },
  }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function confirmationTxid(
  encodedTx: IEncodedTx | undefined,
  approvesInfo: IApproveInfo[] | undefined,
) {
  if (approvesInfo) return 'approve-tx';
  return encodedTx ? 'deposit-tx' : 'wrap-tx';
}

function allowance(amount: string): IAllowance {
  return { allowance: amount, allowanceParsed: amount };
}

describe('useUniversalStake deposits and wrapping', () => {
  afterEach(() => {
    for (const provider of ['etherfi', 'native']) {
      const ownerKey = getDepositTaskOwnerKey({
        ...account,
        accountAddress: owner,
        provider,
        vault,
      });
      const entry = depositTaskRegistry.find(ownerKey);
      if (entry) depositTaskRegistry.release(ownerKey, entry.token);
    }
  });
  beforeEach(() => {
    jest.resetAllMocks();
    mockRiskAccepted.mockResolvedValue(true);
    mockBuildStake.mockImplementation(async ({ stakeType }) => ({
      tx: stakeType === 'wrap' ? wrapTx : depositTx,
      orderId: stakeType === 'wrap' ? undefined : 'deposit-order',
    }));
    mockBuildInternal.mockResolvedValue(depositTx);
    mockPrepareWrap.mockResolvedValue({
      from: owner,
      contract: EthereumWETH,
      amount: '1',
      type: EWrappedType.DEPOSIT,
    });
    mockAllowance.mockResolvedValue(allowance('1'));
    mockWrappedBalance.mockResolvedValue([
      {
        info: weth,
        balance: '100000000000000000000',
        balanceParsed: '100',
        fiatValue: '0',
        price: 0,
      },
    ]);
    mockGetAccount.mockResolvedValue({ address: owner });
    mockGetAccountAddress.mockResolvedValue(owner);
    mockWaitForFinal.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    mockTrackOrder.mockResolvedValue({
      localStatus: 'saved',
      remoteStatus: 'synced',
    });
    mockNavigate.mockImplementation(async ({ wrappedInfo, onSuccess }) => {
      await onSuccess?.(successData(wrappedInfo ? 'wrap-tx' : 'deposit-tx'));
    });
  });

  it('runs Stakefish validator signing and deposit in the same task after the fee gate', async () => {
    const steps: string[] = [];
    const snapshots: string[] = [];
    const { result } = renderHook(() => useUniversalStake(account));
    const sign = jest.fn(async () => {
      steps.push('sign');
      return { signature: 'private-signature', message: 'provider-message' };
    });
    const beforeDeposit = jest.fn(async () => {
      steps.push('fee');
      return true;
    });
    mockBuildStake.mockImplementationOnce(async () => {
      steps.push('build');
      return { tx: depositTx, orderId: 'deposit-order' };
    });
    await expect(
      result.current({
        ...params,
        provider: 'stakefish',
        stakeType: 'normal',
        stakefishSignTask: {
          sign,
          beforeDeposit,
          onTaskChange: (task) => snapshots.push(JSON.stringify(task)),
        },
      }),
    ).resolves.toBe(true);
    expect(steps).toEqual(['sign', 'fee', 'build']);
    expect(mockBuildStake).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'stakefish',
        permitSignature: 'private-signature',
        message: 'provider-message',
      }),
    );
    expect(
      snapshots.some(
        (snapshot) =>
          snapshot.includes('validatorSign') && snapshot.includes('deposit'),
      ),
    ).toBe(true);
    expect(snapshots.join()).not.toContain('private-signature');
    expect(snapshots.join()).not.toContain('provider-message');
  });

  it.each([true, false])(
    'records the original Stakefish order and only notifies while the actual address remains current: %s',
    async (addressRemainsCurrent) => {
      const pending = deferred<{
        localStatus: 'saved';
        remoteStatus: 'synced';
      }>();
      mockTrackOrder.mockReturnValueOnce(pending.promise);
      mockNavigate.mockResolvedValueOnce(undefined);
      const onSuccess = jest.fn();
      const resultCurrent = jest.fn(() => true);
      const { result } = renderHook(() => useUniversalStake(account));
      await expect(
        result.current({
          ...params,
          provider: 'stakefish',
          stakeType: 'normal',
          stakefishSignTask: {
            sign: async () => ({ signature: 'sig', message: 'message' }),
            beforeDeposit: async () => true,
            isResultCurrent: resultCurrent,
          },
          onSuccess,
        }),
      ).resolves.toBe(true);
      const callback = mockNavigate.mock.calls[0][0].onSuccess;
      expect(callback).toBeDefined();
      const completion = callback?.(successData('stakefish-tx'));
      await waitFor(() => expect(mockTrackOrder).toHaveBeenCalledTimes(1));
      if (!addressRemainsCurrent)
        mockGetAccountAddress.mockResolvedValue(
          '0x2222222222222222222222222222222222222222',
        );
      pending.resolve({ localStatus: 'saved', remoteStatus: 'synced' });
      await completion;
      expect(mockTrackOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'deposit-order',
          networkId: account.networkId,
          txId: 'stakefish-tx',
        }),
      );
      expect(onSuccess).toHaveBeenCalledTimes(addressRemainsCurrent ? 1 : 0);
    },
  );

  it('suppresses the Stakefish success callback if the owner changes during its address check', async () => {
    mockNavigate.mockResolvedValueOnce(undefined);
    let isCurrent = true;
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        provider: 'stakefish',
        stakeType: 'normal',
        stakefishSignTask: {
          sign: async () => ({ signature: 'sig', message: 'message' }),
          beforeDeposit: async () => true,
          isResultCurrent: () => isCurrent,
        },
        onSuccess,
      }),
    ).resolves.toBe(true);
    const pendingAddress = deferred<string>();
    mockGetAccountAddress.mockReturnValueOnce(pendingAddress.promise);
    const previousChecks = mockGetAccountAddress.mock.calls.length;
    const completion = mockNavigate.mock.calls[0][0].onSuccess?.(
      successData('stakefish-tx'),
    );
    await waitFor(() =>
      expect(mockGetAccountAddress).toHaveBeenCalledTimes(previousChecks + 1),
    );
    isCurrent = false;
    pendingAddress.resolve(owner);
    await completion;
    expect(mockTrackOrder).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('preserves a Stakefish order recording failure without notifying success', async () => {
    mockNavigate.mockResolvedValueOnce(undefined);
    const error = new OneKeyLocalError('order recording failed');
    mockTrackOrder.mockRejectedValueOnce(error);
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        provider: 'stakefish',
        stakeType: 'normal',
        stakefishSignTask: {
          sign: async () => ({ signature: 'sig', message: 'message' }),
          beforeDeposit: async () => true,
        },
        onSuccess,
      }),
    ).resolves.toBe(true);
    await expect(
      mockNavigate.mock.calls[0][0].onSuccess?.(successData('stakefish-tx')),
    ).rejects.toBe(error);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('does not build a Stakefish transaction when its post-sign fee prompt is cancelled', async () => {
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        provider: 'stakefish',
        stakeType: 'normal',
        stakefishSignTask: {
          sign: async () => ({ signature: 'sig', message: 'message' }),
          beforeDeposit: async () => false,
        },
      }),
    ).resolves.toBe(false);
    expect(mockBuildStake).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('releases a pending Stakefish signature on owner unmount and ignores its late result', async () => {
    const signature = deferred<{ signature: string; message: string }>();
    const sign = jest.fn(() => signature.promise);
    const { result, unmount } = renderHook(() => useUniversalStake(account));
    const operation = result.current({
      ...params,
      provider: 'stakefish',
      stakeType: 'normal',
      stakefishSignTask: { sign, beforeDeposit: async () => true },
    });
    await waitFor(() => expect(sign).toHaveBeenCalledTimes(1));
    unmount();
    await expect(operation).resolves.toBe(false);
    signature.resolve({ signature: 'late', message: 'late' });
    await Promise.resolve();
    expect(mockBuildStake).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('builds a Pendle native-asset buy directly with the original quote inputs', async () => {
    const pendleVault = '0x2222222222222222222222222222222222222222';
    const ptAddress = '0x3333333333333333333333333333333333333333';
    const buyInfo: IStakingInfo = {
      protocol: 'Pendle',
      label: EEarnLabels.Buy,
      tags: [EEarnLabels.Buy],
      send: { amount: '0.5', token: eth },
    };
    const { result } = renderHook(() => useUniversalStake(account));

    await expect(
      result.current({
        amount: '0.5',
        symbol: 'PT-sKAITO',
        provider: 'pendle',
        protocolVault: pendleVault,
        inputTokenAddress: '',
        outputTokenAddress: ptAddress,
        slippage: 0.5,
        effectiveApy: '0.04',
        stakingInfo: buyInfo,
      }),
    ).resolves.toBe(true);

    expect(mockPrepareWrap).not.toHaveBeenCalled();
    expect(mockAllowance).not.toHaveBeenCalled();
    expect(mockWaitForFinal).not.toHaveBeenCalled();
    expect(mockBuildStake).toHaveBeenCalledTimes(1);
    expect(mockBuildStake).toHaveBeenCalledWith(
      expect.objectContaining({
        ...account,
        amount: '0.5',
        symbol: 'PT-sKAITO',
        provider: 'pendle',
        protocolVault: pendleVault,
        inputTokenAddress: '',
        outputTokenAddress: ptAddress,
        slippage: 0.5,
        effectiveApy: '0.04',
        stakeType: undefined,
      }),
    );
    expect(mockBuildInternal).toHaveBeenCalledTimes(1);
    expect(mockBuildInternal).toHaveBeenCalledWith(
      expect.objectContaining({ ...account, tx: depositTx }),
    );
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        encodedTx: depositTx,
        stakingInfo: expect.objectContaining(buyInfo),
      }),
    );
  });

  it('records a Pendle order when confirmation succeeds after navigation returns', async () => {
    mockNavigate.mockResolvedValueOnce(undefined);
    const onSuccess = jest.fn();
    const buyInfo: IStakingInfo = {
      protocol: 'Pendle',
      label: EEarnLabels.Buy,
      tags: [EEarnLabels.Buy],
      send: { amount: '0.5', token: eth },
    };
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        amount: '0.5',
        symbol: 'PT-sKAITO',
        provider: 'pendle',
        protocolVault: vault,
        inputTokenAddress: '',
        outputTokenAddress: 'pt-token',
        slippage: 0.5,
        stakingInfo: buyInfo,
        onSuccess,
      }),
    ).resolves.toBe(true);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockTrackOrder).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();

    const confirmation = mockNavigate.mock.calls[0][0];
    expect(confirmation.isNavigationCurrent?.()).toBe(true);
    const data = successData('pendle-tx');
    await confirmation.onSuccess?.(data);
    expect(mockTrackOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'deposit-order',
        networkId: account.networkId,
        txId: 'pendle-tx',
        status: EDecodedTxStatus.Pending,
        stakingLabel: EEarnLabels.Buy,
        stakingProtocol: 'Pendle',
        stakingTags: [EEarnLabels.Buy],
      }),
    );
    expect(onSuccess).toHaveBeenCalledWith(data);
    expect(mockTrackOrder.mock.invocationCallOrder[0]).toBeLessThan(
      onSuccess.mock.invocationCallOrder[0],
    );
  });

  it('preserves the submitted stake fact after its owner unmounts', async () => {
    mockNavigate.mockResolvedValueOnce(undefined);
    const onSubmitted = jest.fn();
    const { result, unmount } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({ ...params, stakeType: 'normal', onSubmitted }),
    ).resolves.toBe(true);
    const confirmation = mockNavigate.mock.calls[0][0];
    unmount();
    await confirmation.onSuccess?.(successData('late-stake-tx'));
    await waitFor(() =>
      expect(onSubmitted).toHaveBeenCalledWith('late-stake-tx'),
    );
    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });

  it('records a submitted stake without notifying the old account after its address changes', async () => {
    mockNavigate.mockResolvedValueOnce(undefined);
    const onSuccess = jest.fn();
    const onSubmitted = jest.fn();
    const { result } = renderHook(() => useUniversalStake(account));
    await result.current({
      ...params,
      stakeType: 'normal',
      onSuccess,
      onSubmitted,
    });
    const confirmation = mockNavigate.mock.calls[0][0];
    mockGetAccountAddress.mockResolvedValue(
      '0x2222222222222222222222222222222222222222',
    );
    await confirmation.onSuccess?.(successData('late-stake-tx'));
    await waitFor(() =>
      expect(onSubmitted).toHaveBeenCalledWith('late-stake-tx'),
    );
    expect(mockTrackOrder).toHaveBeenCalledWith(
      expect.objectContaining({ txId: 'late-stake-tx' }),
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it.each(['cancel', 'fail'] as const)(
    'records a stake after %s without notifying the old confirmation',
    async (outcome) => {
      mockNavigate.mockResolvedValueOnce(undefined);
      const onSubmitted = jest.fn();
      const onSuccess = jest.fn();
      const { result } = renderHook(() => useUniversalStake(account));
      await result.current({
        ...params,
        stakeType: 'normal',
        onSubmitted,
        onSuccess,
      });
      const confirmation = mockNavigate.mock.calls[0][0];
      await confirmation.onBeforeSend?.();
      if (outcome === 'cancel') confirmation.onCancel?.();
      else confirmation.onConfirmationFail?.(new Error('uncertain'));
      await confirmation.onSuccess?.(successData('late-stake-tx'));
      await waitFor(() =>
        expect(onSubmitted).toHaveBeenCalledWith('late-stake-tx'),
      );
      expect(mockTrackOrderOptions).toHaveBeenCalledWith({
        remoteSync: 'once',
        preserveExistingTx: true,
      });
      expect(onSuccess).not.toHaveBeenCalled();
    },
  );

  it('blocks an expired stake owner even when the displayed address was unavailable', async () => {
    mockNavigate.mockResolvedValueOnce(undefined);
    let ownerCurrent = true;
    const { result } = renderHook(() => useUniversalStake(account));
    await result.current({
      ...params,
      stakeType: 'normal',
      taskAccountAddress: undefined,
      isSendCurrent: () => ownerCurrent,
    });
    const confirmation = mockNavigate.mock.calls[0][0];
    ownerCurrent = false;
    await expect(
      Promise.resolve().then(() => confirmation.onBeforeSend?.()),
    ).rejects.toThrow();
  });

  it('records the submitted stake before a delayed account recheck resolves', async () => {
    mockNavigate.mockResolvedValueOnce(undefined);
    const onSuccess = jest.fn();
    const address = deferred<string>();
    const { result } = renderHook(() => useUniversalStake(account));
    await result.current({ ...params, stakeType: 'normal', onSuccess });
    mockGetAccountAddress.mockReturnValueOnce(address.promise);
    const pending = mockNavigate.mock.calls[0][0].onSuccess?.(
      successData('stake-tx'),
    );
    await waitFor(() => expect(mockTrackOrder).toHaveBeenCalledTimes(1));
    expect(onSuccess).not.toHaveBeenCalled();
    address.resolve(owner);
    await pending;
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('notifies a current stake without waiting for slow tracking', async () => {
    const tracking = deferred<void>();
    const onSuccess = jest.fn();
    mockNavigate.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useUniversalStake(account));
    await result.current({
      ...params,
      stakeType: 'normal',
      onSuccess,
      onSubmitted: () => tracking.promise,
    });
    await mockNavigate.mock.calls[0][0].onSuccess?.(successData('stake-tx'));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    tracking.resolve();
  });

  it('does not notify an earlier stake after a newer stake starts', async () => {
    const recording = deferred<void>();
    const onSuccess = jest.fn();
    mockNavigate.mockResolvedValue(undefined);
    mockTrackOrder.mockReturnValueOnce(recording.promise);
    const { result } = renderHook(() => useUniversalStake(account));
    await result.current({ ...params, stakeType: 'normal', onSuccess });
    const pending = mockNavigate.mock.calls[0][0].onSuccess?.(
      successData('stake-tx'),
    );
    await waitFor(() => expect(mockTrackOrder).toHaveBeenCalledTimes(1));
    await result.current({ ...params, amount: '2', stakeType: 'normal' });
    recording.resolve();
    await pending;
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('reports an accepted late stake fact once even if success arrives afterwards', async () => {
    mockNavigate.mockResolvedValueOnce(undefined);
    const onSubmitted = jest.fn();
    const { result } = renderHook(() => useUniversalStake(account));
    await result.current({ ...params, stakeType: 'normal', onSubmitted });
    const confirmation = mockNavigate.mock.calls[0][0];
    await confirmation.onBeforeSend?.();
    confirmation.onCancel?.();
    await confirmation.onLateBroadcastAccepted?.({
      uuid: 'request',
      ...account,
      txid: 'late-stake-tx',
    });
    await confirmation.onSuccess?.(successData('late-stake-tx'));
    await waitFor(() =>
      expect(onSubmitted).toHaveBeenCalledWith('late-stake-tx'),
    );
    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });

  it('reports a synchronous confirmation failure while navigation still resolves', async () => {
    const failure = new Error('confirmation preparation failed');
    const onFail = jest.fn();
    mockNavigate.mockImplementationOnce(async ({ onFail: fail }) => {
      fail?.(failure);
    });
    const { result } = renderHook(() => useUniversalStake(account));

    const outcome = await result.current({
      amount: '0.5',
      symbol: 'PT-sKAITO',
      provider: 'pendle',
      protocolVault: vault,
      inputTokenAddress: '',
      outputTokenAddress: 'pt-token',
      slippage: 0.5,
      onFail,
    });

    expect(outcome).toBe(true);
    expect(onFail).toHaveBeenCalledWith(failure);
    expect(mockTrackOrder).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'observes confirmation failures with the original onFail contract (onFail present=%s)',
    async (hasOnFail) => {
      mockNavigate.mockResolvedValueOnce(undefined);
      const onFail = jest.fn();
      const error = new Error('confirmation failed');
      const { result } = renderHook(() => useUniversalStake(account));
      await expect(
        result.current({
          amount: '0.5',
          symbol: 'PT-sKAITO',
          provider: 'pendle',
          onFail: hasOnFail ? onFail : undefined,
        }),
      ).resolves.toBe(true);
      const confirmation = mockNavigate.mock.calls[0][0];
      expect(Boolean(confirmation.onFail)).toBe(hasOnFail);
      expect(confirmation.onConfirmationFail).toEqual(expect.any(Function));
      await confirmation.onBeforeSend?.();
      confirmation.onConfirmationFail?.(error);
      if (hasOnFail) expect(onFail).toHaveBeenCalledWith(error);
      else expect(onFail).not.toHaveBeenCalled();
    },
  );

  it('does not navigate when the Pendle scope changes while transaction encoding is pending', async () => {
    const pendingEncoding = deferred<IEncodedTx>();
    mockBuildInternal.mockReturnValueOnce(pendingEncoding.promise);
    const { result, rerender } = renderHook(
      ({ scopeKey }: { scopeKey: string }) =>
        useUniversalStake({ ...account, scopeKey }),
      { initialProps: { scopeKey: 'first' } },
    );
    const operation = result.current({
      amount: '0.5',
      symbol: 'PT-sKAITO',
      provider: 'pendle',
      protocolVault: vault,
      inputTokenAddress: '',
      outputTokenAddress: 'pt-token',
      slippage: 0.5,
    });
    await waitFor(() => expect(mockBuildInternal).toHaveBeenCalledTimes(1));
    rerender({ scopeKey: 'second' });
    pendingEncoding.resolve(depositTx);
    await expect(operation).resolves.toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockTrackOrder).not.toHaveBeenCalled();
  });

  it('builds an ordinary ERC20 deposit directly without a wrap or extra confirmation', async () => {
    const depositInfo: IStakingInfo = {
      protocol: 'Morpho',
      label: EEarnLabels.Stake,
      tags: [EEarnLabels.Stake],
      send: { amount: '2', token: weth },
    };
    const { result } = renderHook(() => useUniversalStake(account));

    await expect(
      result.current({
        amount: '2',
        symbol: 'WETH',
        provider: 'morpho',
        protocolVault: vault,
        inputTokenAddress: weth.address,
        stakingInfo: depositInfo,
      }),
    ).resolves.toBe(true);

    expect(mockPrepareWrap).not.toHaveBeenCalled();
    expect(mockAllowance).not.toHaveBeenCalled();
    expect(mockWaitForFinal).not.toHaveBeenCalled();
    expect(mockBuildStake).toHaveBeenCalledTimes(1);
    expect(mockBuildStake).toHaveBeenCalledWith(
      expect.objectContaining({
        ...account,
        amount: '2',
        symbol: 'WETH',
        provider: 'morpho',
        protocolVault: vault,
        inputTokenAddress: weth.address,
        stakeType: undefined,
      }),
    );
    expect(mockBuildInternal).toHaveBeenCalledTimes(1);
    expect(mockBuildInternal).toHaveBeenCalledWith(
      expect.objectContaining({ ...account, tx: depositTx }),
    );
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        encodedTx: depositTx,
        stakingInfo: expect.objectContaining(depositInfo),
      }),
    );
  });

  it.each(['wrap', 'direct'] as const)(
    'rejects %s confirmation if the account address changed without changing accountId',
    async (mode) => {
      const otherAddress = '0x2222222222222222222222222222222222222222';
      mockGetAccountAddress
        .mockResolvedValueOnce(owner)
        .mockResolvedValueOnce(otherAddress);
      const broadcast = jest.fn();
      mockNavigate.mockImplementation(
        async ({ onBeforeSend, onSuccess, onFail }) => {
          try {
            await onBeforeSend?.();
            broadcast();
            await onSuccess?.(successData('tx'));
          } catch (error) {
            onFail?.(error instanceof Error ? error : new Error(String(error)));
          }
        },
      );
      const { result } = renderHook(() => useUniversalStake(account));
      const directParams =
        mode === 'direct'
          ? {
              stakeType: 'normal' as const,
              inputTokenAddress: weth.address,
              directDepositTask: {
                token: weth,
                spenderAddress: EtherFiLiquidReferContract,
                requiresAllowanceReset: false,
                confirmReset: async () => true,
                prepareDeposit: async () => ({ type: 'confirm' as const }),
              },
            }
          : {};
      await expect(
        result.current({
          ...params,
          ...directParams,
          taskMode: 'deposit',
          onFail: jest.fn(),
        }),
      ).resolves.toBe(false);
      expect(mockGetAccountAddress).toHaveBeenCalledTimes(2);
      expect(broadcast).not.toHaveBeenCalled();
      expect(mockTrackOrder).not.toHaveBeenCalled();
    },
  );

  it('does not create a task when the visible account address is already stale', async () => {
    mockGetAccountAddress.mockResolvedValue(
      '0x2222222222222222222222222222222222222222',
    );
    const onDepositTaskReady = jest.fn();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        taskMode: 'deposit',
        taskAccountAddress: owner,
        onDepositTaskReady,
        onFail: jest.fn(),
      }),
    ).rejects.toThrow();
    expect(onDepositTaskReady).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it.each(['direct'] as const)(
    'does not open %s confirmation when the built transaction belongs to another address',
    async (mode) => {
      mockBuildInternal.mockReset().mockResolvedValue({
        ...depositTx,
        from: '0x2222222222222222222222222222222222222222',
      });
      const { result } = renderHook(() => useUniversalStake(account));
      const directParams =
        mode === 'direct'
          ? {
              stakeType: 'normal' as const,
              inputTokenAddress: weth.address,
              directDepositTask: {
                token: weth,
                spenderAddress: EtherFiLiquidReferContract,
                requiresAllowanceReset: false,
                confirmReset: async () => true,
                prepareDeposit: async () => ({ type: 'confirm' as const }),
              },
            }
          : {};
      await expect(
        result.current({
          ...params,
          ...directParams,
          taskMode: 'deposit',
          onFail: jest.fn(),
        }),
      ).resolves.toBe(false);
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockTrackOrder).not.toHaveBeenCalled();
    },
  );

  it('does not open an approval for an account other than the frozen task owner', async () => {
    mockAllowance.mockResolvedValue(allowance('0'));
    mockGetAccount.mockResolvedValue({
      address: '0x2222222222222222222222222222222222222222',
    });
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        stakeType: 'normal',
        inputTokenAddress: weth.address,
        taskMode: 'deposit',
        directDepositTask: {
          token: weth,
          spenderAddress: EtherFiLiquidReferContract,
          requiresAllowanceReset: false,
          confirmReset: async () => true,
          prepareDeposit: async () => ({ type: 'confirm' }),
        },
        onFail: jest.fn(),
      }),
    ).resolves.toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockTrackOrder).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'continues a pending A task according to whether B commits: %s',
    async (commitSecondScope) => {
      const pendingBuild = deferred<IWrappedInfo>();
      const onTaskReady = jest.fn<void, [IDepositTaskHandle]>();
      const renderSecondScope = jest.fn();
      const suspended = new Promise<void>(() => undefined);
      let running: Promise<boolean> | undefined;
      mockPrepareWrap.mockReturnValueOnce(pendingBuild.promise);
      mockNavigate.mockImplementation(
        async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
          await onBeforeSend?.();
          await onSuccess?.(
            successData(confirmationTxid(encodedTx, approvesInfo)),
          );
        },
      );

      function Form({ scopeKey }: { scopeKey: string }) {
        const stake = useUniversalStake({ ...account, scopeKey });
        if (scopeKey === 'second') {
          renderSecondScope();
          if (!commitSecondScope) throw suspended;
        }
        return (
          <div>
            <span data-testid="scope">{scopeKey}</span>
            <button
              type="button"
              onClick={() => {
                running = stake({
                  ...params,
                  taskMode: 'deposit',
                  onDepositTaskReady: onTaskReady,
                });
              }}
            >
              Start task
            </button>
          </div>
        );
      }

      function Harness() {
        const [scopeKey, setScopeKey] = useState('first');
        return (
          <>
            <button
              type="button"
              onClick={() => startTransition(() => setScopeKey('second'))}
            >
              Switch scope
            </button>
            <button type="button" onClick={() => setScopeKey('first')}>
              Abandon transition
            </button>
            <Suspense fallback={<span>loading</span>}>
              <Form scopeKey={scopeKey} />
            </Suspense>
          </>
        );
      }

      const screen = render(<Harness />);
      fireEvent.click(screen.getByText('Start task'));
      await waitFor(() => expect(mockPrepareWrap).toHaveBeenCalledTimes(1));
      expect(onTaskReady).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByText('Switch scope'));
      await waitFor(() => expect(renderSecondScope).toHaveBeenCalled());
      if (commitSecondScope) {
        await waitFor(() =>
          expect(screen.getByTestId('scope').textContent).toBe('second'),
        );
      } else {
        expect(screen.getByTestId('scope').textContent).toBe('first');
        fireEvent.click(screen.getByText('Abandon transition'));
        expect(screen.getByTestId('scope').textContent).toBe('first');
      }

      await act(async () => {
        pendingBuild.resolve({
          from: owner,
          contract: EthereumWETH,
          amount: '1',
          type: EWrappedType.DEPOSIT,
        });
        await expect(running).resolves.toBe(!commitSecondScope);
      });
      if (commitSecondScope) {
        expect(mockNavigate).not.toHaveBeenCalled();
        expect(mockTrackOrder).not.toHaveBeenCalled();
      } else {
        expect(mockNavigate).toHaveBeenCalledTimes(2);
        expect(mockTrackOrder).toHaveBeenCalledTimes(1);
      }
    },
  );

  it('does not abort a new scope task when the old scope effect cleans up', async () => {
    const pendingBuild = deferred<IWrappedInfo>();
    const onTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    let currentStake: ReturnType<typeof useUniversalStake> | undefined;
    let changeScope: (scope: string) => void = () => undefined;
    let running: Promise<boolean> | undefined;
    mockPrepareWrap.mockReturnValueOnce(pendingBuild.promise);
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        await onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );

    function Owner({ scopeKey }: { scopeKey: string }) {
      const stake = useUniversalStake({ ...account, scopeKey });
      useLayoutEffect(() => {
        currentStake = stake;
      }, [stake]);
      return null;
    }
    function StartOnCommit({ scopeKey }: { scopeKey: string }) {
      useLayoutEffect(() => {
        if (scopeKey === 'second') {
          running = currentStake?.({
            ...params,
            taskMode: 'deposit',
            onDepositTaskReady: onTaskReady,
          });
        }
      }, [scopeKey]);
      return null;
    }
    function Harness() {
      const [scopeKey, setScopeKey] = useState('first');
      useLayoutEffect(() => {
        changeScope = setScopeKey;
      }, []);
      return (
        <>
          <Owner scopeKey={scopeKey} />
          <StartOnCommit scopeKey={scopeKey} />
        </>
      );
    }

    const screen = render(<Harness />);
    const previousActEnvironment = Reflect.get(
      globalThis,
      'IS_REACT_ACT_ENVIRONMENT',
    );
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', false);
    try {
      startTransition(() => changeScope('second'));
      await waitFor(() => expect(onTaskReady).toHaveBeenCalledTimes(1));
      expect(onTaskReady.mock.calls[0][0].getTask().steps[0].status.type).toBe(
        'preparing',
      );
      pendingBuild.resolve({
        from: owner,
        contract: EthereumWETH,
        amount: '1',
        type: EWrappedType.DEPOSIT,
      });
      await expect(running).resolves.toBe(true);
      expect(mockNavigate).toHaveBeenCalledTimes(2);
    } finally {
      screen.unmount();
      Reflect.set(
        globalThis,
        'IS_REACT_ACT_ENVIRONMENT',
        previousActEnvironment,
      );
    }
  });

  it('runs the EtherFi wrap, approval and deposit through the deposit task', async () => {
    mockAllowance
      .mockResolvedValueOnce(allowance('0'))
      .mockResolvedValue(allowance('1'));
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        await onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const onSuccess = jest.fn();
    const onStepChange = jest.fn();
    const onWrapStateChange = jest.fn();
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const beforeDepositTaskSend = jest.fn(
      async (_step: 'wrap' | 'resetApproval' | 'approve' | 'deposit') => true,
    );
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        taskMode: 'deposit',
        onSuccess,
        onStepChange,
        onWrapStateChange,
        onDepositTaskReady,
        beforeDepositTaskSend,
      }),
    ).resolves.toBe(true);
    expect(mockNavigate).toHaveBeenCalledTimes(3);
    expect(mockNavigate.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        encodedTx: undefined,
        wrappedInfo: {
          from: owner,
          amount: '1',
          contract: EthereumWETH,
          type: EWrappedType.DEPOSIT,
        },
      }),
    );
    expect(mockWaitForFinal.mock.calls.map(([input]) => input)).toEqual([
      expect.objectContaining({ txid: 'wrap-tx' }),
      expect.objectContaining({ txid: 'approve-tx' }),
    ]);
    expect(mockBuildStake.mock.calls.map(([input]) => input.stakeType)).toEqual(
      ['normal'],
    );
    expect(
      onDepositTaskReady.mock.calls[0][0]
        .getTask()
        .steps.map((step) => step.status.type),
    ).toEqual(['succeeded', 'succeeded', 'handedOff']);
    expect(onWrapStateChange).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(beforeDepositTaskSend.mock.calls).toEqual([
      ['wrap'],
      ['wrap'],
      ['approve'],
      ['approve'],
      ['deposit'],
      ['deposit'],
    ]);
    expect(onStepChange).not.toHaveBeenCalled();
  });

  it('does not request approval or deposit when the wrapped balance is insufficient', async () => {
    mockWrappedBalance.mockResolvedValue([
      {
        info: weth,
        balance: '900000000000000000',
        balanceParsed: '0.9',
        fiatValue: '0',
        price: 0,
      },
    ]);
    const onFail = jest.fn();
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        taskMode: 'deposit',
        onFail,
        onDepositTaskReady,
      }),
    ).resolves.toBe(false);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockBuildStake.mock.calls.map(([input]) => input.stakeType)).toEqual(
      [],
    );
    expect(onFail).toHaveBeenCalled();
    expect(
      onDepositTaskReady.mock.calls[0][0].getTask().steps[1].status,
    ).toEqual({
      type: 'failed',
      stage: 'beforeSend',
    });
    expect(mockWrappedBalance).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: account.accountId,
        networkId: account.networkId,
        expectedAccountAddress: owner,
        contractList: [EthereumWETH],
      }),
    );
    mockWrappedBalance.mockResolvedValue([
      {
        info: weth,
        balance: '1000000000000000000',
        balanceParsed: '1',
        fiatValue: '0',
        price: 0,
      },
    ]);
    await onDepositTaskReady.mock.calls[0][0].retry();
    expect(mockBuildStake.mock.calls.map(([input]) => input.stakeType)).toEqual(
      ['normal'],
    );
    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });

  it('reapproves without wrapping again when allowance decreases before a rejected deposit build', async () => {
    let currentAllowance = '0';
    let depositBuilds = 0;
    mockAllowance.mockImplementation(async () => allowance(currentAllowance));
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        if (approvesInfo) currentAllowance = '1';
        await onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const rejectedBuild = new Error('Insufficient allowance');
    mockBuildStake.mockImplementation(async ({ stakeType }) => {
      if (stakeType === 'wrap') return { tx: wrapTx };
      depositBuilds += 1;
      if (depositBuilds === 1) currentAllowance = '0';
      if (currentAllowance !== '1') throw rejectedBuild;
      return { tx: depositTx, orderId: 'deposit-order' };
    });
    const prepareWrappedDeposit = jest
      .fn()
      .mockResolvedValue({ type: 'confirm' });
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const onFail = jest.fn();
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalStake(account));

    await expect(
      result.current({
        ...params,
        taskMode: 'deposit',
        prepareWrappedDeposit,
        onDepositTaskReady,
        onFail,
        onSuccess,
      }),
    ).resolves.toBe(false);
    expect(onFail).toHaveBeenCalledWith(rejectedBuild);
    expect(mockWaitForFinal).toHaveBeenCalledTimes(2);
    expect(mockNavigate).toHaveBeenCalledTimes(2);

    await onDepositTaskReady.mock.calls[0][0].retry();

    expect(
      mockNavigate.mock.calls.map(([confirmation]) =>
        confirmationTxid(confirmation.encodedTx, confirmation.approvesInfo),
      ),
    ).toEqual(['wrap-tx', 'approve-tx', 'approve-tx', 'deposit-tx']);
    expect(
      mockBuildStake.mock.calls.map(([request]) => request.stakeType),
    ).toEqual(['normal', 'normal']);
    expect(prepareWrappedDeposit).toHaveBeenCalledTimes(2);
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('blocks a deposit when allowance decreases in confirmation and reapproves on retry', async () => {
    let currentAllowance = '0';
    let depositConfirmations = 0;
    const submitted: string[] = [];
    mockAllowance.mockImplementation(async () => allowance(currentAllowance));
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        const txid = confirmationTxid(encodedTx, approvesInfo);
        if (txid === 'deposit-tx') {
          depositConfirmations += 1;
          if (depositConfirmations === 1) currentAllowance = '0';
        }
        await onBeforeSend?.();
        submitted.push(txid);
        if (approvesInfo) currentAllowance = '1';
        await onSuccess?.(successData(txid));
      },
    );
    const prepareWrappedDeposit = jest
      .fn()
      .mockResolvedValue({ type: 'confirm' });
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const onFail = jest.fn();
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalStake(account));

    await expect(
      result.current({
        ...params,
        taskMode: 'deposit',
        prepareWrappedDeposit,
        onDepositTaskReady,
        onFail,
        onSuccess,
      }),
    ).resolves.toBe(false);
    const task = onDepositTaskReady.mock.calls[0][0];
    expect(task.getTask().steps[task.getTask().currentStepIndex]).toEqual(
      expect.objectContaining({
        kind: 'deposit',
        status: { type: 'failed', stage: 'beforeSend' },
      }),
    );
    expect(onFail).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Token allowance changed before deposit',
      }),
    );
    expect(submitted).toEqual(['wrap-tx', 'approve-tx']);
    expect(onSuccess).not.toHaveBeenCalled();

    await task.retry();

    expect(submitted).toEqual([
      'wrap-tx',
      'approve-tx',
      'approve-tx',
      'deposit-tx',
    ]);
    expect(
      mockBuildStake.mock.calls.map(([request]) => request.stakeType),
    ).toEqual(['normal', 'normal']);
    expect(prepareWrappedDeposit).toHaveBeenCalledTimes(2);
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('does not report approval complete if its task is disposed while allowance is loading', async () => {
    const pending = deferred<IAllowance>();
    mockAllowance
      .mockResolvedValueOnce(allowance('0'))
      .mockImplementationOnce(() => pending.promise);
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        await onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const onStepChange = jest.fn();
    const { result } = renderHook(() => useUniversalStake(account));
    const running = result.current({
      ...params,
      taskMode: 'deposit',
      onDepositTaskReady,
      onStepChange,
    });
    await waitFor(() => expect(mockAllowance).toHaveBeenCalledTimes(2));
    onDepositTaskReady.mock.calls[0][0].dispose();
    pending.resolve(allowance('1'));
    await expect(running).resolves.toBe(false);
    expect(onStepChange.mock.calls.some(([step]) => step === 3)).toBe(false);
    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });

  it.each(['cancelled', 'failed'] as const)(
    're-prepares a WETH deposit after preparation is %s',
    async (firstResult) => {
      mockAllowance
        .mockResolvedValueOnce(allowance('0'))
        .mockResolvedValue(allowance('1'));
      mockNavigate.mockImplementation(
        async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
          await onBeforeSend?.();
          await onSuccess?.(
            successData(confirmationTxid(encodedTx, approvesInfo)),
          );
        },
      );
      const prepareWrappedDeposit = jest
        .fn()
        .mockImplementationOnce(async (signal: AbortSignal) => {
          expect(signal.aborted).toBe(false);
          expect(mockWaitForFinal).toHaveBeenCalledTimes(2);
          if (firstResult === 'failed')
            return Promise.reject(new Error('quote unavailable'));
          return { type: 'cancelled' };
        })
        .mockResolvedValueOnce({ type: 'confirm', effectiveApy: '4.56' });
      const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
      const onFail = jest.fn();
      const { result } = renderHook(() => useUniversalStake(account));

      await expect(
        result.current({
          ...params,
          effectiveApy: 'stale',
          taskMode: 'deposit',
          prepareWrappedDeposit,
          onDepositTaskReady,
          onFail,
        }),
      ).resolves.toBe(false);
      expect(prepareWrappedDeposit).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledTimes(2);
      expect(
        mockBuildStake.mock.calls.map(([input]) => input.stakeType),
      ).toEqual([]);
      expect(onFail).toHaveBeenCalledTimes(firstResult === 'failed' ? 1 : 0);

      await onDepositTaskReady.mock.calls[0][0].retry();
      expect(prepareWrappedDeposit).toHaveBeenCalledTimes(2);
      expect(mockNavigate).toHaveBeenCalledTimes(3);
      expect(mockBuildStake.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          ...account,
          amount: '1',
          provider: 'etherfi',
          protocolVault: vault,
          inputTokenAddress: EthereumWETH,
          stakeType: 'normal',
          effectiveApy: '4.56',
        }),
      );
      expect(mockNavigate.mock.calls[2][0].stakingInfo?.send).toEqual({
        amount: '1',
        token: weth,
      });
      expect(mockTrackOrder).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ['wrap', ['wrap'], []],
    ['approve', ['wrap', 'wrap', 'approve'], ['wrap-tx']],
    [
      'deposit',
      ['wrap', 'wrap', 'approve', 'approve', 'deposit'],
      ['wrap-tx', 'approve-tx'],
    ],
  ] as const)(
    'does not submit %s or start a later step when its pre-send guard rejects it',
    async (blockedStep, checkedSteps, expectedSubmitted) => {
      mockAllowance
        .mockResolvedValueOnce(allowance('0'))
        .mockResolvedValue(allowance('1'));
      const beforeDepositTaskSend = jest.fn(
        async (step: 'wrap' | 'resetApproval' | 'approve' | 'deposit') =>
          step !== blockedStep,
      );
      const submitted: string[] = [];
      mockNavigate.mockImplementation(
        async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
          await onBeforeSend?.();
          const txid = confirmationTxid(encodedTx, approvesInfo);
          submitted.push(txid);
          await onSuccess?.(successData(txid));
        },
      );
      const onSuccess = jest.fn();
      const onFail = jest.fn();
      const { result } = renderHook(() => useUniversalStake(account));

      await expect(
        result.current({
          ...params,
          taskMode: 'deposit',
          beforeDepositTaskSend,
          onSuccess,
          onFail,
        }),
      ).resolves.toBe(false);

      expect(beforeDepositTaskSend.mock.calls.map(([step]) => step)).toEqual(
        checkedSteps,
      );
      expect(submitted).toEqual(expectedSubmitted);
      expect(mockNavigate).toHaveBeenCalledTimes(expectedSubmitted.length);
      expect(onSuccess).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['wrap', []],
    ['approve', ['wrap-tx']],
    ['deposit', ['wrap-tx', 'approve-tx']],
  ] as const)(
    'rechecks %s immediately before sending after its confirmation was opened',
    async (blockedStep, expectedSubmitted) => {
      mockAllowance
        .mockResolvedValueOnce(allowance('0'))
        .mockResolvedValue(allowance('1'));
      let targetChecks = 0;
      const beforeDepositTaskSend = jest.fn(
        async (step: 'wrap' | 'resetApproval' | 'approve' | 'deposit') => {
          if (step !== blockedStep) return true;
          targetChecks += 1;
          return targetChecks === 1;
        },
      );
      const submitted: string[] = [];
      mockNavigate.mockImplementation(
        async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
          await onBeforeSend?.();
          const txid = confirmationTxid(encodedTx, approvesInfo);
          submitted.push(txid);
          await onSuccess?.(successData(txid));
        },
      );
      const { result } = renderHook(() => useUniversalStake(account));
      await expect(
        result.current({
          ...params,
          taskMode: 'deposit',
          beforeDepositTaskSend,
          onFail: jest.fn(),
        }),
      ).resolves.toBe(false);
      expect(targetChecks).toBe(2);
      expect(mockNavigate).toHaveBeenCalledTimes(expectedSubmitted.length + 1);
      expect(submitted).toEqual(expectedSubmitted);
    },
  );

  it.each([false, true])(
    'builds direct deposits with fresh APY and the exact account and token after approval: %s',
    async (needsApproval) => {
      const usdc: IToken = {
        address: '0x2222222222222222222222222222222222222222',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        isNative: false,
      };
      const amount = '0.123456';
      const spenderAddress = '0x3333333333333333333333333333333333333333';
      const directStakingInfo: IStakingInfo = {
        ...stakingInfo,
        send: { amount, token: usdc },
      };
      if (needsApproval) {
        mockAllowance
          .mockResolvedValueOnce(allowance('0'))
          .mockResolvedValue(allowance('1'));
      }
      mockBuildInternal.mockReset().mockResolvedValue(depositTx);
      let cancelledDeposit = false;
      mockNavigate.mockImplementation(
        async ({ approvesInfo, onBeforeSend, onSuccess, onCancel }) => {
          if (!approvesInfo && !cancelledDeposit) {
            cancelledDeposit = true;
            onCancel?.();
            return;
          }
          await onBeforeSend?.();
          await onSuccess?.(
            successData(approvesInfo ? 'approve-tx' : 'deposit-tx'),
          );
        },
      );
      const prepareDeposit = jest
        .fn()
        .mockResolvedValueOnce({ type: 'confirm', effectiveApy: '1.23' })
        .mockResolvedValueOnce({ type: 'confirm', effectiveApy: '4.56' });
      const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
      const beforeDepositTaskSend = jest.fn(async () => true);
      const { result } = renderHook(() => useUniversalStake(account));

      await expect(
        result.current({
          ...params,
          amount,
          symbol: 'USDC',
          stakeType: 'normal',
          inputTokenAddress: usdc.address,
          stakingInfo: directStakingInfo,
          effectiveApy: 'stale',
          taskMode: 'deposit',
          beforeDepositTaskSend,
          onDepositTaskReady,
          directDepositTask: {
            token: usdc,
            spenderAddress,
            requiresAllowanceReset: false,
            confirmReset: async () => true,
            prepareDeposit,
          },
        }),
      ).resolves.toBe(false);

      expect(onDepositTaskReady).toHaveBeenCalledTimes(1);
      await onDepositTaskReady.mock.calls[0][0].retry();
      expect(prepareDeposit).toHaveBeenCalledTimes(2);
      expect(mockBuildStake.mock.calls.map(([request]) => request)).toEqual([
        expect.objectContaining({
          ...account,
          amount,
          symbol: 'USDC',
          provider: 'etherfi',
          protocolVault: vault,
          inputTokenAddress: usdc.address,
          expectedAccountAddress: owner,
          stakeType: 'normal',
          effectiveApy: '1.23',
        }),
        expect.objectContaining({
          ...account,
          amount,
          symbol: 'USDC',
          provider: 'etherfi',
          protocolVault: vault,
          inputTokenAddress: usdc.address,
          expectedAccountAddress: owner,
          stakeType: 'normal',
          effectiveApy: '4.56',
        }),
      ]);
      expect(mockBuildInternal).toHaveBeenCalledTimes(2);
      expect(mockBuildInternal).toHaveBeenCalledWith(
        expect.objectContaining({ ...account, tx: depositTx }),
      );
      const approvals = mockNavigate.mock.calls.filter(
        ([confirmation]) => confirmation.approvesInfo,
      );
      expect(approvals).toHaveLength(needsApproval ? 1 : 0);
      if (needsApproval) {
        expect(approvals[0][0].approvesInfo).toEqual([
          expect.objectContaining({
            owner,
            spender: spenderAddress,
            amount,
            tokenInfo: usdc,
          }),
        ]);
      }
      expect(beforeDepositTaskSend.mock.calls).toEqual(
        needsApproval
          ? [['approve'], ['approve'], ['deposit'], ['deposit'], ['deposit']]
          : [['deposit'], ['deposit'], ['deposit']],
      );
      expect(mockWaitForFinal).toHaveBeenCalledTimes(needsApproval ? 1 : 0);
      expect(mockTrackOrder).toHaveBeenCalledTimes(1);
    },
  );

  it('skips the task approval when the current WETH allowance is sufficient', async () => {
    const onStepChange = jest.fn();
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    mockNavigate.mockImplementation(
      async ({ wrappedInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        void onSuccess?.(successData(wrappedInfo ? 'wrap-tx' : 'deposit-tx'));
      },
    );
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        taskMode: 'deposit',
        onStepChange,
        onDepositTaskReady,
      }),
    ).resolves.toBe(true);
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(
      onDepositTaskReady.mock.calls[0][0]
        .getTask()
        .steps.map((step) => step.status.type),
    ).toEqual(['succeeded', 'skipped', 'handedOff']);
    expect(onStepChange).not.toHaveBeenCalled();
  });

  it.each([EOnChainHistoryTxStatus.Failed, undefined])(
    'stops the task when wrap finality is %s',
    async (status) => {
      mockWaitForFinal.mockResolvedValue(status);
      mockNavigate.mockImplementation(async ({ onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        void onSuccess?.(successData('wrap-tx'));
      });
      const { result } = renderHook(() => useUniversalStake(account));
      await expect(
        result.current({ ...params, taskMode: 'deposit' }),
      ).resolves.toBe(false);
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockAllowance).not.toHaveBeenCalled();
    },
  );

  it('stops the task when the wrap confirmation has no transaction id', async () => {
    mockNavigate.mockImplementation(async ({ onBeforeSend, onSuccess }) => {
      await onBeforeSend?.();
      void onSuccess?.(successData(''));
    });
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({ ...params, taskMode: 'deposit' }),
    ).resolves.toBe(false);
    expect(mockWaitForFinal).not.toHaveBeenCalled();
    expect(mockAllowance).not.toHaveBeenCalled();
  });

  it('does not deposit if the task approval is cancelled', async () => {
    mockAllowance.mockResolvedValueOnce(allowance('0'));
    mockNavigate.mockImplementation(
      async ({ wrappedInfo, onBeforeSend, onSuccess, onCancel }) => {
        if (wrappedInfo) {
          await onBeforeSend?.();
          void onSuccess?.(successData('wrap-tx'));
        } else onCancel?.();
      },
    );
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({ ...params, taskMode: 'deposit', onSuccess }),
    ).resolves.toBe(false);
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockBuildStake).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it.each(['wrap', 'approve', 'deposit'] as const)(
    'allows the %s step to be retried after an explicit device rejection',
    async (rejectedStep) => {
      let rejected = false;
      let currentAllowance = '0';
      mockAllowance.mockImplementation(async () => allowance(currentAllowance));
      mockNavigate.mockImplementation(
        async ({
          wrappedInfo,
          encodedTx,
          approvesInfo,
          onBeforeSend,
          onSuccess,
          onFail,
        }) => {
          await onBeforeSend?.();
          let step: 'approve' | 'wrap' | 'deposit' = 'deposit';
          if (approvesInfo) step = 'approve';
          else if (wrappedInfo) step = 'wrap';
          if (step === rejectedStep && !rejected) {
            rejected = true;
            onFail?.(new UserCancel());
            return;
          }
          if (step === 'approve') currentAllowance = '1';
          await onSuccess?.(
            successData(confirmationTxid(encodedTx, approvesInfo)),
          );
        },
      );
      const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
      const { result } = renderHook(() => useUniversalStake(account));
      await expect(
        result.current({
          ...params,
          taskMode: 'deposit',
          onDepositTaskReady,
          onFail: jest.fn(),
        }),
      ).resolves.toBe(false);
      const handle = onDepositTaskReady.mock.calls[0][0];
      const step = handle.getTask().steps[handle.getTask().currentStepIndex];
      expect(step.kind).toBe(rejectedStep);
      expect(step.status).toEqual({ type: 'failed', stage: 'beforeSend' });
      await handle.retry();
      expect(handle.getTask().steps.at(-1)?.status.type).toBe('handedOff');
      expect(
        mockNavigate.mock.calls.filter(([input]) => input.wrappedInfo),
      ).toHaveLength(rejectedStep === 'wrap' ? 2 : 1);
    },
  );

  it('does not assume a device rejection is pre-broadcast for another provider', async () => {
    mockNavigate.mockImplementation(async ({ onBeforeSend, onFail }) => {
      await onBeforeSend?.();
      onFail?.(new UserCancel());
    });
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        provider: 'native',
        taskMode: 'deposit',
        onDepositTaskReady,
        onFail: jest.fn(),
      }),
    ).resolves.toBe(false);
    expect(
      onDepositTaskReady.mock.calls[0][0].getTask().steps[0].status,
    ).toEqual({
      type: 'unknown',
      chainConfirmed: false,
    });
  });

  it('does not deposit after a confirmed task approval until allowance is sufficient', async () => {
    mockAllowance.mockResolvedValue(allowance('0'));
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        void onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({ ...params, taskMode: 'deposit' }),
    ).resolves.toBe(false);
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockBuildStake).not.toHaveBeenCalled();
  });

  it('does not publish approval progress after the task scope becomes stale during an allowance read', async () => {
    const pending = deferred<IAllowance>();
    let current = true;
    const onStepChange = jest.fn();
    mockAllowance.mockReturnValueOnce(pending.promise);
    mockNavigate.mockImplementation(async ({ onBeforeSend, onSuccess }) => {
      await onBeforeSend?.();
      await onSuccess?.(successData('wrap-tx'));
    });
    const { result } = renderHook(() => useUniversalStake(account));
    const running = result.current({
      ...params,
      taskMode: 'deposit',
      isActionCurrent: () => current,
      onStepChange,
    });
    await waitFor(() => expect(mockAllowance).toHaveBeenCalledTimes(1));
    current = false;
    pending.resolve(allowance('0'));
    await running;
    expect(onStepChange).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('does not run the old page success callback after the deposit scope changes', async () => {
    let current = true;
    const onSuccess = jest.fn();
    mockNavigate.mockImplementation(
      async ({
        wrappedInfo,
        encodedTx,
        onBeforeSend,
        onSuccess: confirmSuccess,
      }) => {
        await onBeforeSend?.();
        void confirmSuccess?.(
          successData(wrappedInfo ? 'wrap-tx' : 'deposit-tx'),
        );
        if (encodedTx === depositTx) current = false;
      },
    );
    const { result } = renderHook(() => useUniversalStake(account));
    await result.current({
      ...params,
      taskMode: 'deposit',
      isActionCurrent: () => current,
      onSuccess,
    });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(mockTrackOrder).toHaveBeenCalledTimes(1);
  });

  it('records a wrapped deposit using its decoded transaction id when the signed id is empty', async () => {
    mockNavigate.mockImplementation(
      async ({ wrappedInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        void onSuccess?.(
          wrappedInfo
            ? successData('wrap-tx')
            : decodedOnlySuccessData('decoded-deposit-tx'),
        );
      },
    );
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({ ...params, taskMode: 'deposit', onSuccess }),
    ).resolves.toBe(true);
    expect(mockTrackOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'deposit-order',
        txId: 'decoded-deposit-tx',
      }),
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(mockTrackOrderOptions).toHaveBeenCalledWith({ remoteSync: 'once' });
  });

  it('records a late direct deposit by decoded transaction id after unmount without navigating', async () => {
    let depositConfirmation: IConfirmParams | undefined;
    mockBuildInternal.mockReset().mockResolvedValue(depositTx);
    mockNavigate.mockImplementation(async (confirmation) => {
      await confirmation.onBeforeSend?.();
      depositConfirmation = confirmation;
    });
    const onSuccess = jest.fn();
    const { result, unmount } = renderHook(() => useUniversalStake(account));
    const running = result.current({
      ...params,
      taskMode: 'deposit',
      stakeType: 'normal',
      inputTokenAddress: weth.address,
      directDepositTask: {
        token: weth,
        spenderAddress: EtherFiLiquidReferContract,
        requiresAllowanceReset: false,
        confirmReset: async () => true,
        prepareDeposit: async () => ({ type: 'confirm' }),
      },
      onSuccess,
    });
    await waitFor(() => expect(depositConfirmation).toBeDefined());
    unmount();
    await running;
    void depositConfirmation?.onSuccess?.(
      decodedOnlySuccessData('late-decoded-deposit-tx'),
    );
    await waitFor(() => expect(mockTrackOrder).toHaveBeenCalledTimes(1));
    expect(mockTrackOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'deposit-order',
        txId: 'late-decoded-deposit-tx',
      }),
    );
    expect(mockTrackOrderOptions).toHaveBeenCalledWith({
      remoteSync: 'once',
      preserveExistingTx: true,
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('does not record or navigate when both deposit transaction ids are empty', async () => {
    mockNavigate.mockImplementation(
      async ({ wrappedInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        void onSuccess?.(
          wrappedInfo ? successData('wrap-tx') : decodedOnlySuccessData(''),
        );
      },
    );
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({ ...params, taskMode: 'deposit', onSuccess }),
    ).resolves.toBe(false);
    expect(mockTrackOrder).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('records a late submitted deposit after unmount without calling the old page', async () => {
    let depositConfirmation: IConfirmParams | undefined;
    const onSuccess = jest.fn();
    mockNavigate.mockImplementation(async (confirmation) => {
      await confirmation.onBeforeSend?.();
      if (confirmation.wrappedInfo)
        void confirmation.onSuccess?.(successData('wrap-tx'));
      else depositConfirmation = confirmation;
    });
    const { result, unmount } = renderHook(() => useUniversalStake(account));
    const running = result.current({
      ...params,
      taskMode: 'deposit',
      onSuccess,
    });
    await waitFor(() => expect(depositConfirmation).toBeDefined());
    unmount();
    await running;
    void depositConfirmation?.onSuccess?.(successData('deposit-tx'));
    await waitFor(() => expect(mockTrackOrder).toHaveBeenCalledTimes(1));
    expect(mockTrackOrder.mock.calls[0][0]).toEqual(
      expect.objectContaining({ orderId: 'deposit-order', txId: 'deposit-tx' }),
    );
    expect(mockTrackOrderOptions).toHaveBeenCalledWith({
      remoteSync: 'once',
      preserveExistingTx: true,
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it.each(['direct', 'wrapped'] as const)(
    'records a verified late %s deposit after cancellation without notifying the old page',
    async (mode) => {
      let depositConfirmation: IConfirmParams | undefined;
      mockNavigate.mockImplementation(async (confirmation) => {
        await confirmation.onBeforeSend?.();
        if (confirmation.wrappedInfo) {
          await confirmation.onSuccess?.(successData('wrap-tx'));
        } else {
          depositConfirmation = confirmation;
        }
      });
      const onSuccess = jest.fn();
      const onSubmitted = jest.fn();
      const { result } = renderHook(() => useUniversalStake(account));
      const running = result.current({
        ...params,
        taskMode: 'deposit',
        ...(mode === 'direct'
          ? {
              stakeType: 'normal' as const,
              inputTokenAddress: weth.address,
              directDepositTask: {
                token: weth,
                spenderAddress: EtherFiLiquidReferContract,
                requiresAllowanceReset: false,
                confirmReset: async () => true,
                prepareDeposit: async () => ({ type: 'confirm' as const }),
              },
            }
          : undefined),
        onSuccess,
        onSubmitted,
      });
      await waitFor(() => expect(depositConfirmation).toBeDefined());
      expect(depositConfirmation?.onLateBroadcastAccepted).toBeDefined();
      depositConfirmation?.onCancel?.();
      await expect(running).resolves.toBe(false);
      const fact = {
        uuid: 'deposit-uuid',
        ...account,
        txid: 'late-deposit-tx',
      };
      await depositConfirmation?.onLateBroadcastAccepted?.(fact);
      await depositConfirmation?.onLateBroadcastAccepted?.(fact);
      await waitFor(() => expect(mockTrackOrder).toHaveBeenCalledTimes(1));
      expect(mockTrackOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'deposit-order',
          txId: 'late-deposit-tx',
          status: EDecodedTxStatus.Pending,
        }),
      );
      expect(mockTrackOrderOptions).toHaveBeenCalledWith({
        remoteSync: 'once',
        preserveExistingTx: true,
      });
      expect(onSuccess).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(onSubmitted).toHaveBeenCalledWith('late-deposit-tx'),
      );
      expect(onSubmitted).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledTimes(mode === 'direct' ? 1 : 2);
    },
  );

  it.each(['wrap', 'approval'] as const)(
    'does not record a deposit order for a verified late %s transaction',
    async (stage) => {
      let target: IConfirmParams | undefined;
      mockAllowance.mockResolvedValue(allowance('0'));
      mockNavigate.mockImplementation(async (confirmation) => {
        await confirmation.onBeforeSend?.();
        if (confirmation.wrappedInfo && stage === 'approval') {
          await confirmation.onSuccess?.(successData('wrap-tx'));
        } else {
          target = confirmation;
        }
      });
      const { result } = renderHook(() => useUniversalStake(account));
      const running = result.current({ ...params, taskMode: 'deposit' });
      await waitFor(() => expect(target).toBeDefined());
      expect(target?.onLateBroadcastAccepted).toBeDefined();
      target?.onCancel?.();
      await expect(running).resolves.toBe(false);
      await target?.onLateBroadcastAccepted?.({
        uuid: `${stage}-uuid`,
        ...account,
        txid: `${stage}-tx`,
      });
      expect(mockTrackOrder).not.toHaveBeenCalled();
      expect(mockBuildStake).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledTimes(stage === 'wrap' ? 1 : 2);
    },
  );

  it.each(['direct', 'wrap'] as const)(
    'does not show a stale %s order recording error after unmount',
    async (mode) => {
      let rejectRecording: (error: Error) => void = () => undefined;
      mockTrackOrder.mockReturnValue(
        new Promise<void>((_resolve, reject) => {
          rejectRecording = reject;
        }),
      );
      const toast = jest
        .spyOn(errorToastUtils, 'showToastOfError')
        .mockImplementation(() => undefined);
      if (mode === 'direct')
        mockBuildInternal.mockReset().mockResolvedValue(depositTx);
      mockNavigate.mockImplementation(
        async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
          await onBeforeSend?.();
          await onSuccess?.(
            successData(confirmationTxid(encodedTx, approvesInfo)),
          );
        },
      );
      const { result, unmount } = renderHook(() => useUniversalStake(account));
      const running = result.current({
        ...params,
        taskMode: 'deposit',
        ...(mode === 'direct'
          ? {
              stakeType: 'normal' as const,
              inputTokenAddress: weth.address,
              directDepositTask: {
                token: weth,
                spenderAddress: EtherFiLiquidReferContract,
                requiresAllowanceReset: false,
                confirmReset: async () => true,
                prepareDeposit: async () => ({ type: 'confirm' as const }),
              },
            }
          : {}),
      });
      await waitFor(() => expect(mockTrackOrder).toHaveBeenCalledTimes(1));
      unmount();
      rejectRecording(new Error('old account recording failed'));
      await running;
      expect(toast).not.toHaveBeenCalled();
      toast.mockRestore();
    },
  );

  it.each(['direct', 'wrap'] as const)(
    'only retries order recording after a submitted %s deposit fails to record',
    async (mode) => {
      const pending = deferred<{
        localStatus: 'saved';
        remoteStatus: 'synced';
      }>();
      mockTrackOrder
        .mockResolvedValueOnce({
          localStatus: 'failed',
          remoteStatus: 'notAttempted',
        })
        .mockReturnValueOnce(pending.promise);
      if (mode === 'direct')
        mockBuildInternal.mockReset().mockResolvedValue(depositTx);
      const onFail = jest.fn();
      const onSuccess = jest.fn();
      const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
      const onDepositTaskSettled = jest.fn();
      mockNavigate.mockImplementation(
        async ({
          wrappedInfo,
          encodedTx,
          onBeforeSend,
          onSuccess: confirmSuccess,
        }) => {
          await onBeforeSend?.();
          void confirmSuccess?.(
            successData(wrappedInfo ? 'wrap-tx' : 'deposit-tx'),
          );
          if (encodedTx === depositTx)
            void confirmSuccess?.(successData('deposit-tx'));
        },
      );
      const { result } = renderHook(() => useUniversalStake(account));
      await expect(
        result.current({
          ...params,
          taskMode: 'deposit',
          onFail,
          onSuccess,
          onDepositTaskReady,
          onDepositTaskSettled,
          ...(mode === 'direct'
            ? {
                stakeType: 'normal' as const,
                inputTokenAddress: weth.address,
                directDepositTask: {
                  token: weth,
                  spenderAddress: EtherFiLiquidReferContract,
                  requiresAllowanceReset: false,
                  confirmReset: async () => true,
                  prepareDeposit: async () => ({ type: 'confirm' as const }),
                },
              }
            : {}),
        }),
      ).resolves.toBe(false);
      const handle = onDepositTaskReady.mock.calls[0][0];
      expect(handle.getTask().recording).toEqual({
        txid: 'deposit-tx',
        status: 'failed',
      });
      expect(mockNavigate).toHaveBeenCalledTimes(mode === 'direct' ? 1 : 2);
      expect(mockTrackOrder).toHaveBeenCalledTimes(1);
      expect(onFail).toHaveBeenCalledTimes(1);
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onDepositTaskSettled).not.toHaveBeenCalled();
      const first = handle.retryRecording?.();
      const second = handle.retryRecording?.();
      expect(handle.getTask().recording?.status).toBe('pending');
      await waitFor(() => expect(mockTrackOrder).toHaveBeenCalledTimes(2));
      pending.resolve({ localStatus: 'saved', remoteStatus: 'synced' });
      await Promise.all([first, second]);
      expect(handle.getTask().recording?.status).toBe('succeeded');
      expect(mockNavigate).toHaveBeenCalledTimes(mode === 'direct' ? 1 : 2);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onDepositTaskSettled).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['direct', 'wrap'] as const)(
    'keeps an in-flight %s recording after disposal without notifying the old task',
    async (mode) => {
      const pending = deferred<void>();
      mockTrackOrder.mockReturnValue(pending.promise);
      if (mode === 'direct')
        mockBuildInternal.mockReset().mockResolvedValue(depositTx);
      mockNavigate.mockImplementation(
        async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
          await onBeforeSend?.();
          await onSuccess?.(
            successData(confirmationTxid(encodedTx, approvesInfo)),
          );
        },
      );
      const onSuccess = jest.fn();
      const onDepositTaskSettled = jest.fn();
      const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
      const { result } = renderHook(() => useUniversalStake(account));
      const running = result.current({
        ...params,
        taskMode: 'deposit',
        onSuccess,
        onDepositTaskReady,
        onDepositTaskSettled,
        ...(mode === 'direct'
          ? {
              stakeType: 'normal' as const,
              inputTokenAddress: weth.address,
              directDepositTask: {
                token: weth,
                spenderAddress: EtherFiLiquidReferContract,
                requiresAllowanceReset: false,
                confirmReset: async () => true,
                prepareDeposit: async () => ({ type: 'confirm' as const }),
              },
            }
          : {}),
      });
      await waitFor(() => expect(mockTrackOrder).toHaveBeenCalledTimes(1));
      onDepositTaskReady.mock.calls[0][0].dispose();
      pending.resolve(undefined);
      await running;
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onDepositTaskSettled).not.toHaveBeenCalled();
    },
  );

  it('does not repeat registration or success notification when the notification fails', async () => {
    const toast = jest
      .spyOn(errorToastUtils, 'showToastOfError')
      .mockImplementation(() => undefined);
    const onSuccess = jest
      .fn()
      .mockRejectedValue(new Error('navigation failed'));
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    mockNavigate.mockImplementation(
      async ({
        encodedTx,
        approvesInfo,
        onBeforeSend,
        onSuccess: confirmSuccess,
      }) => {
        await onBeforeSend?.();
        await confirmSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        taskMode: 'deposit',
        onSuccess,
        onDepositTaskReady,
      }),
    ).resolves.toBe(true);
    const handle = onDepositTaskReady.mock.calls[0][0];
    expect(handle.getTask().recording?.status).toBe('succeeded');
    await handle.retryRecording?.();
    expect(mockTrackOrder).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledTimes(1);
    toast.mockRestore();
  });

  it('retains a recorded task when the owner changes before the success callback', async () => {
    mockTrackOrder.mockImplementationOnce(async () => {
      mockGetAccountAddress.mockResolvedValueOnce(
        '0x2222222222222222222222222222222222222222',
      );
      return { localStatus: 'saved', remoteStatus: 'synced' };
    });
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        await onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const onSuccess = jest.fn();
    const onDepositTaskSettled = jest.fn();
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        taskMode: 'deposit',
        onSuccess,
        onDepositTaskReady,
        onDepositTaskSettled,
      }),
    ).resolves.toBe(true);
    expect(
      onDepositTaskReady.mock.calls[0][0].getTask().recording?.status,
    ).toBe('succeeded');
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onDepositTaskSettled).not.toHaveBeenCalled();
  });

  it('does not resend an order when server synchronization outcome is unknown', async () => {
    mockTrackOrder
      .mockResolvedValueOnce({ localStatus: 'saved', remoteStatus: 'failed' })
      .mockResolvedValueOnce({ localStatus: 'saved', remoteStatus: 'synced' });
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        await onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const onSuccess = jest.fn();
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        taskMode: 'deposit',
        onSuccess,
        onDepositTaskReady,
        onFail: jest.fn(),
      }),
    ).resolves.toBe(false);
    const handle = onDepositTaskReady.mock.calls[0][0];
    expect(handle.getTask().recording?.status).toBe('remoteUnknown');
    expect(onSuccess).not.toHaveBeenCalled();
    await handle.retryRecording?.();
    expect(handle.getTask().recording?.status).toBe('remoteUnknown');
    expect(mockTrackOrder).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('does not retry an order when the background response is lost', async () => {
    mockTrackOrder.mockRejectedValueOnce(new Error('background response lost'));
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        await onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        taskMode: 'deposit',
        onDepositTaskReady,
        onFail: jest.fn(),
      }),
    ).resolves.toBe(false);
    const handle = onDepositTaskReady.mock.calls[0][0];
    expect(handle.getTask().recording?.status).toBe('remoteUnknown');
    await handle.retryRecording?.();
    expect(mockTrackOrder).toHaveBeenCalledTimes(1);
  });

  it('does not treat a missing background result as an untracked order', async () => {
    mockTrackOrder.mockResolvedValueOnce(undefined);
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        await onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        taskMode: 'deposit',
        onDepositTaskReady,
        onFail: jest.fn(),
      }),
    ).resolves.toBe(false);
    const handle = onDepositTaskReady.mock.calls[0][0];
    expect(handle.getTask().recording?.status).toBe('remoteUnknown');
    await handle.retryRecording?.();
    expect(mockTrackOrder).toHaveBeenCalledTimes(1);
  });

  it('marks a successful transaction without an order id as not tracked', async () => {
    mockBuildStake.mockImplementation(async ({ stakeType }) => ({
      tx: stakeType === 'wrap' ? wrapTx : depositTx,
    }));
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        await onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({ ...params, taskMode: 'deposit', onDepositTaskReady }),
    ).resolves.toBe(true);
    expect(
      onDepositTaskReady.mock.calls[0][0].getTask().recording?.status,
    ).toBe('notTracked');
    expect(mockTrackOrder).not.toHaveBeenCalled();
  });

  it.each([
    [
      { localStatus: 'unavailable', remoteStatus: 'notAttempted' },
      'localUnavailable',
      false,
    ],
    [
      { localStatus: 'unavailable', remoteStatus: 'synced' },
      'remoteUnknown',
      false,
    ],
    [
      { localStatus: 'superseded', remoteStatus: 'notAttempted' },
      'remoteUnknown',
      false,
    ],
    [{ localStatus: 'saved', remoteStatus: 'skipped' }, 'remoteUnknown', false],
    [
      { localStatus: 'superseded', remoteStatus: 'skipped' },
      'superseded',
      true,
    ],
  ] as const)(
    'handles order result %o without confusing it with a locally recorded order',
    async (orderResult, status, complete) => {
      mockTrackOrder.mockResolvedValueOnce(orderResult).mockResolvedValueOnce({
        localStatus: 'saved',
        remoteStatus: 'synced',
      });
      mockNavigate.mockImplementation(
        async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
          await onBeforeSend?.();
          await onSuccess?.(
            successData(confirmationTxid(encodedTx, approvesInfo)),
          );
        },
      );
      const onSuccess = jest.fn();
      const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
      const { result } = renderHook(() => useUniversalStake(account));
      await expect(
        result.current({
          ...params,
          taskMode: 'deposit',
          onSuccess,
          onDepositTaskReady,
        }),
      ).resolves.toBe(complete);
      const handle = onDepositTaskReady.mock.calls[0][0];
      expect(handle.getTask().recording?.status).toBe(status);
      expect(onSuccess).not.toHaveBeenCalled();
      await handle.retryRecording?.();
      expect(mockTrackOrder).toHaveBeenCalledTimes(
        status === 'localUnavailable' ? 2 : 1,
      );
      if (status === 'localUnavailable') {
        expect(handle.getTask().recording?.status).toBe('succeeded');
        expect(onSuccess).toHaveBeenCalledTimes(1);
      }
      expect(mockNavigate).toHaveBeenCalledTimes(2);
    },
  );

  it('does not continue the deposit task when the wrap status is unknown', async () => {
    mockWaitForFinal.mockResolvedValue(undefined);
    mockNavigate.mockImplementation(async ({ onBeforeSend, onSuccess }) => {
      await onBeforeSend?.();
      await onSuccess?.(successData('wrap-tx'));
    });
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({ ...params, taskMode: 'deposit' }),
    ).resolves.toBe(false);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockAllowance).not.toHaveBeenCalled();
  });

  it.each([
    [
      'wrong address',
      { address: '0x1111111111111111111111111111111111111111' },
    ],
    ['wrong decimals', { decimals: 6 }],
    ['native token', { isNative: true }],
    ['wrong token network', { networkId: 'evm--137' }],
  ])(
    'refuses a %s before building the wrap transaction',
    async (_label, overrides) => {
      const { result } = renderHook(() => useUniversalStake(account));
      await expect(
        result.current({
          ...params,
          postWrapStakeToken: { ...weth, ...overrides },
        }),
      ).rejects.toThrow('Invalid wrapped stake token');
      expect(mockBuildStake).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'wrong address',
      { address: '0x1111111111111111111111111111111111111111' },
    ],
    ['wrong decimals', { decimals: 6 }],
    ['wrong token network', { networkId: 'evm--137' }],
  ])(
    'rejects Native %s before constructing a wrap',
    async (_label, overrides) => {
      const { result } = renderHook(() => useUniversalStake(account));
      await expect(
        result.current({
          ...params,
          provider: 'native',
          postWrapStakeToken: { ...weth, ...overrides },
        }),
      ).rejects.toThrow('Invalid wrapped stake token');
      expect(mockBuildStake).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    },
  );

  it('continues the Native wrap flow with canonical WETH', async () => {
    const nativeVault = '0x2222222222222222222222222222222222222222';
    const nativeSpender = '0x3333333333333333333333333333333333333333';
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        provider: 'native',
        symbol: 'WETH',
        protocolVault: nativeVault,
        postWrapApproveSpenderAddress: nativeSpender,
        stakingInfo: { ...stakingInfo, protocol: 'Native' },
      }),
    ).resolves.toBe(true);
    expect(mockPrepareWrap).toHaveBeenCalledWith(
      expect.objectContaining({
        inputToken: eth,
        wrappedToken: weth,
        accountAddress: owner,
        amount: '1',
      }),
    );
    expect(mockBuildStake.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        provider: 'native',
        symbol: 'WETH',
        protocolVault: nativeVault,
        stakeType: 'normal',
        inputTokenAddress: EthereumWETH,
        expectedAccountAddress: owner,
      }),
    );
    expect(mockAllowance).toHaveBeenCalledWith(
      expect.objectContaining({
        spenderAddress: nativeSpender,
        tokenAddress: EthereumWETH,
      }),
    );
    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });

  it('runs Native wrap and deposit through a visible task with the original vault and spender', async () => {
    const nativeVault = '0x2222222222222222222222222222222222222222';
    const nativeSpender = '0x3333333333333333333333333333333333333333';
    mockAllowance
      .mockResolvedValueOnce(allowance('0'))
      .mockResolvedValue(allowance('1'));
    mockNavigate.mockImplementation(
      async ({ encodedTx, approvesInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        await onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const onDepositTaskChange = jest.fn();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        provider: 'native',
        symbol: 'WETH',
        protocolVault: nativeVault,
        postWrapApproveSpenderAddress: nativeSpender,
        stakingInfo: { ...stakingInfo, protocol: 'Native' },
        onDepositTaskReady,
        onDepositTaskChange,
      }),
    ).resolves.toBe(true);
    expect(mockPrepareWrap).toHaveBeenCalledTimes(1);
    expect(mockWrappedBalance).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: account.accountId,
        networkId: account.networkId,
        expectedAccountAddress: owner,
        contractList: [EthereumWETH],
      }),
    );
    expect(mockAllowance).toHaveBeenCalledWith(
      expect.objectContaining({
        spenderAddress: nativeSpender,
        tokenAddress: EthereumWETH,
      }),
    );
    expect(mockBuildStake).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'native',
        protocolVault: nativeVault,
        inputTokenAddress: EthereumWETH,
        stakeType: 'normal',
      }),
    );
    expect(onDepositTaskReady).toHaveBeenCalledTimes(1);
    expect(onDepositTaskChange).toHaveBeenCalled();
    expect(
      onDepositTaskReady.mock.calls[0][0]
        .getTask()
        .steps.map((step) => step.status.type),
    ).toEqual(['succeeded', 'succeeded', 'handedOff']);
  });

  it('does not approve or deposit Native WETH that has not arrived after wrapping', async () => {
    mockWrappedBalance.mockResolvedValueOnce([
      {
        info: weth,
        balance: '0',
        balanceParsed: '0',
        fiatValue: '0',
        price: 0,
      },
    ]);
    mockNavigate.mockImplementation(
      async ({ wrappedInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        await onSuccess?.(successData(wrappedInfo ? 'wrap-tx' : 'deposit-tx'));
      },
    );
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        provider: 'native',
        symbol: 'WETH',
        onDepositTaskReady: jest.fn(),
      }),
    ).rejects.toThrow('Insufficient wrapped token balance');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockBuildStake).not.toHaveBeenCalled();
  });

  it('resumes an EtherFi approval after a completed wrap without wrapping again', async () => {
    mockAllowance
      .mockResolvedValueOnce(allowance('0'))
      .mockResolvedValueOnce(allowance('0'))
      .mockResolvedValue(allowance('1'));
    let approvals = 0;
    mockNavigate.mockImplementation(
      async ({
        encodedTx,
        approvesInfo,
        onBeforeSend,
        onSuccess,
        onCancel,
      }) => {
        if (approvesInfo) {
          approvals += 1;
          if (approvals === 1) return onCancel?.();
        }
        await onBeforeSend?.();
        await onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({ ...params, onDepositTaskReady }),
    ).resolves.toBe(false);
    expect(onDepositTaskReady).toHaveBeenCalledTimes(1);
    const handle = onDepositTaskReady.mock.calls[0][0];
    expect(handle.getTask().steps[0].status.type).toBe('succeeded');
    expect(handle.getTask().steps[1].status.type).toBe('cancelled');
    await handle.retry();
    expect(mockPrepareWrap).toHaveBeenCalledTimes(1);
    expect(handle.getTask().steps.at(-1)?.status.type).toBe('handedOff');
  });

  it('does not repeat an EtherFi wrap after a later approval is cancelled without a handle', async () => {
    const ownerKey = getDepositTaskOwnerKey({
      ...account,
      accountAddress: owner,
      provider: 'etherfi',
      vault,
    });
    mockAllowance.mockResolvedValue(allowance('0'));
    mockNavigate.mockImplementation(
      async ({ wrappedInfo, onBeforeSend, onSuccess, onCancel }) => {
        if (!wrappedInfo) return onCancel?.();
        await onBeforeSend?.();
        await onSuccess?.(successData('wrap-tx'));
      },
    );
    const { result } = renderHook(() => useUniversalStake(account));
    try {
      await expect(result.current(params)).resolves.toBe(false);
      expect(
        depositTaskRegistry.find(ownerKey)?.state.getTask().steps[1].status
          .type,
      ).toBe('cancelled');
      await expect(result.current(params)).resolves.toBe(false);
      expect(mockPrepareWrap).toHaveBeenCalledTimes(1);
    } finally {
      const entry = depositTaskRegistry.find(ownerKey);
      if (entry) depositTaskRegistry.release(ownerKey, entry.token);
    }
  });

  it('keeps an EtherFi wrap with unknown broadcast outcome from being resent without a handle', async () => {
    const ownerKey = getDepositTaskOwnerKey({
      ...account,
      accountAddress: owner,
      provider: 'etherfi',
      vault,
    });
    mockNavigate.mockImplementation(async ({ onBeforeSend, onCancel }) => {
      await onBeforeSend?.();
      onCancel?.();
    });
    const { result } = renderHook(() => useUniversalStake(account));
    try {
      await expect(result.current(params)).resolves.toBe(false);
      expect(
        depositTaskRegistry.find(ownerKey)?.state.getTask().steps[0].status
          .type,
      ).toBe('unknown');
      expect(mockToastMessage).toHaveBeenCalledWith({
        title: 'wallet_transaction_maybe_already_submitted_check_activity__msg',
      });
      await expect(result.current(params)).resolves.toBe(false);
      expect(mockPrepareWrap).toHaveBeenCalledTimes(1);
      expect(mockToastMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          message:
            'wallet_transaction_maybe_already_submitted_check_activity__msg',
        }),
      );
    } finally {
      const entry = depositTaskRegistry.find(ownerKey);
      if (entry) depositTaskRegistry.release(ownerKey, entry.token);
    }
  });

  it('releases a never-sent EtherFi wrap without a handle', async () => {
    const ownerKey = getDepositTaskOwnerKey({
      ...account,
      accountAddress: owner,
      provider: 'etherfi',
      vault,
    });
    mockNavigate.mockImplementation(async ({ onCancel }) => onCancel?.());
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(result.current(params)).resolves.toBe(false);
    expect(depositTaskRegistry.find(ownerKey)).toBeUndefined();
    await expect(result.current(params)).resolves.toBe(false);
    expect(mockPrepareWrap).toHaveBeenCalledTimes(2);
  });

  it('does not rewrap an unknown Native attempt when the caller did not retain a handle', async () => {
    const ownerKey = getDepositTaskOwnerKey({
      ...account,
      accountAddress: owner,
      provider: 'native',
      vault,
    });
    mockNavigate.mockImplementation(async ({ onBeforeSend, onCancel }) => {
      await onBeforeSend?.();
      onCancel?.();
    });
    const { result } = renderHook(() => useUniversalStake(account));
    try {
      await expect(
        result.current({ ...params, provider: 'native', symbol: 'WETH' }),
      ).resolves.toBe(false);
      expect(
        depositTaskRegistry.find(ownerKey)?.state.getTask().steps[0].status
          .type,
      ).toBe('unknown');
      await expect(
        result.current({ ...params, provider: 'native', symbol: 'WETH' }),
      ).resolves.toBe(false);
      expect(mockPrepareWrap).toHaveBeenCalledTimes(1);
      expect(mockToastMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            'wallet_transaction_maybe_already_submitted_check_activity__msg',
        }),
      );
    } finally {
      const entry = depositTaskRegistry.find(ownerKey);
      if (entry) depositTaskRegistry.release(ownerKey, entry.token);
    }
  });

  it('resumes a Native approval cancelled before sending without wrapping again', async () => {
    mockAllowance
      .mockResolvedValueOnce(allowance('0'))
      .mockResolvedValueOnce(allowance('0'))
      .mockResolvedValue(allowance('1'));
    let approvals = 0;
    mockNavigate.mockImplementation(
      async ({
        encodedTx,
        approvesInfo,
        onBeforeSend,
        onSuccess,
        onCancel,
      }) => {
        if (approvesInfo && approvals === 0) {
          approvals += 1;
          onCancel?.();
          return;
        }
        if (approvesInfo) approvals += 1;
        await onBeforeSend?.();
        await onSuccess?.(
          successData(confirmationTxid(encodedTx, approvesInfo)),
        );
      },
    );
    const onDepositTaskReady = jest.fn<void, [IDepositTaskHandle]>();
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        provider: 'native',
        symbol: 'WETH',
        onDepositTaskReady,
      }),
    ).resolves.toBe(false);
    const handle = onDepositTaskReady.mock.calls[0][0];
    expect(handle.getTask().steps[1].status.type).toBe('cancelled');
    await handle.retry();
    expect(mockPrepareWrap).toHaveBeenCalledTimes(1);
    expect(approvals).toBe(2);
    expect(mockBuildStake).toHaveBeenCalledTimes(1);
    expect(handle.getTask().steps.at(-1)?.status.type).toBe('handedOff');
  });

  it('releases a Native fallback reservation when wrap is cancelled before sending', async () => {
    const ownerKey = getDepositTaskOwnerKey({
      ...account,
      accountAddress: owner,
      provider: 'native',
      vault,
    });
    mockNavigate.mockImplementation(async ({ onCancel }) => onCancel?.());
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({ ...params, provider: 'native', symbol: 'WETH' }),
    ).resolves.toBe(false);
    expect(depositTaskRegistry.find(ownerKey)).toBeUndefined();
    await expect(
      result.current({ ...params, provider: 'native', symbol: 'WETH' }),
    ).resolves.toBe(false);
    expect(mockPrepareWrap).toHaveBeenCalledTimes(2);
  });

  it('keeps a Native fallback after approval is cancelled and reports the wrapped balance', async () => {
    const ownerKey = getDepositTaskOwnerKey({
      ...account,
      accountAddress: owner,
      provider: 'native',
      vault,
    });
    mockAllowance.mockResolvedValue(allowance('0'));
    mockNavigate.mockImplementation(
      async ({ wrappedInfo, onBeforeSend, onSuccess, onCancel }) => {
        if (!wrappedInfo) return onCancel?.();
        await onBeforeSend?.();
        await onSuccess?.(successData('wrap-tx'));
      },
    );
    const { result } = renderHook(() => useUniversalStake(account));
    try {
      await expect(
        result.current({ ...params, provider: 'native', symbol: 'WETH' }),
      ).resolves.toBe(false);
      expect(
        depositTaskRegistry.find(ownerKey)?.state.getTask().steps[1].status
          .type,
      ).toBe('cancelled');
      expect(mockToastMessage).toHaveBeenCalledWith({
        title: 'feedback.transaction_submitted',
        message: 'global.wallet_balance: WETH',
      });
      await expect(
        result.current({ ...params, provider: 'native', symbol: 'WETH' }),
      ).resolves.toBe(false);
      expect(mockPrepareWrap).toHaveBeenCalledTimes(1);
      expect(mockToastMessage).toHaveBeenLastCalledWith({
        title: 'feedback.transaction_submitted',
        message: 'global.wallet_balance: WETH',
      });
    } finally {
      const entry = depositTaskRegistry.find(ownerKey);
      if (entry) depositTaskRegistry.release(ownerKey, entry.token);
    }
  });

  it('does not bind a Native task to an address resolved after its account scope expires', async () => {
    const address = deferred<string>();
    mockGetAccountAddress.mockReturnValueOnce(address.promise);
    let current = true;
    const { result } = renderHook(() => useUniversalStake(account));
    const operation = result.current({
      ...params,
      provider: 'native',
      symbol: 'WETH',
      taskAccountAddress: undefined,
      isActionCurrent: () => current,
    });
    await waitFor(() => expect(mockGetAccountAddress).toHaveBeenCalledTimes(1));
    current = false;
    address.resolve(owner);
    await expect(operation).resolves.toBe(false);
    expect(mockPrepareWrap).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('binds the current Native account when no address or external task handle was supplied', async () => {
    mockNavigate.mockImplementation(
      async ({ wrappedInfo, onBeforeSend, onSuccess }) => {
        await onBeforeSend?.();
        await onSuccess?.(successData(wrappedInfo ? 'wrap-tx' : 'deposit-tx'));
      },
    );
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        provider: 'native',
        symbol: 'WETH',
        taskAccountAddress: undefined,
      }),
    ).resolves.toBe(true);
    expect(mockPrepareWrap).toHaveBeenCalledWith(
      expect.objectContaining({ accountAddress: owner }),
    );
    expect(mockTrackOrder).toHaveBeenCalledTimes(1);
    const ownerKey = getDepositTaskOwnerKey({
      ...account,
      accountAddress: owner,
      provider: 'native',
      vault,
    });
    expect(depositTaskRegistry.find(ownerKey)).toBeUndefined();
  });

  it('records a late Native deposit after unmount without notifying its old page', async () => {
    const ownerKey = getDepositTaskOwnerKey({
      ...account,
      accountAddress: owner,
      provider: 'native',
      vault,
    });
    let depositConfirmation: IConfirmParams | undefined;
    const onSuccess = jest.fn();
    mockNavigate.mockImplementation(async (confirmation) => {
      await confirmation.onBeforeSend?.();
      if (confirmation.wrappedInfo)
        void confirmation.onSuccess?.(successData('wrap-tx'));
      else depositConfirmation = confirmation;
    });
    const { result, unmount } = renderHook(() => useUniversalStake(account));
    try {
      const running = result.current({
        ...params,
        provider: 'native',
        symbol: 'WETH',
        onSuccess,
      });
      await waitFor(() => expect(depositConfirmation).toBeDefined());
      unmount();
      await running;
      void depositConfirmation?.onSuccess?.(successData('deposit-tx'));
      await waitFor(() => expect(mockTrackOrder).toHaveBeenCalledTimes(1));
      expect(mockTrackOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'deposit-order',
          txId: 'deposit-tx',
        }),
      );
      expect(onSuccess).not.toHaveBeenCalled();
    } finally {
      const entry = depositTaskRegistry.find(ownerKey);
      if (entry) depositTaskRegistry.release(ownerKey, entry.token);
    }
  });

  it('uses the Native spender and waits for approval before depositing WETH', async () => {
    const nativeVault = '0x2222222222222222222222222222222222222222';
    const nativeSpender = '0x3333333333333333333333333333333333333333';
    const approvalFinality = deferred<EOnChainHistoryTxStatus>();
    mockAllowance
      .mockResolvedValueOnce(allowance('0'))
      .mockResolvedValue(allowance('1'));
    mockWaitForFinal
      .mockResolvedValueOnce(EOnChainHistoryTxStatus.Success)
      .mockReturnValueOnce(approvalFinality.promise);
    const { result } = renderHook(() => useUniversalStake(account));
    const submit = result.current({
      ...params,
      provider: 'native',
      symbol: 'WETH',
      protocolVault: nativeVault,
      postWrapApproveSpenderAddress: nativeSpender,
      stakingInfo: { ...stakingInfo, protocol: 'Native' },
    });
    await waitFor(() => expect(mockWaitForFinal).toHaveBeenCalledTimes(2));
    expect(mockNavigate.mock.calls[1][0].approvesInfo).toEqual([
      expect.objectContaining({
        spender: nativeSpender,
        tokenInfo: weth,
        amount: '1',
      }),
    ]);
    expect(mockBuildStake).not.toHaveBeenCalled();
    approvalFinality.resolve(EOnChainHistoryTxStatus.Success);
    await expect(submit).resolves.toBe(true);
    expect(mockBuildStake).toHaveBeenCalledTimes(1);
    expect(mockBuildStake.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        provider: 'native',
        symbol: 'WETH',
        protocolVault: nativeVault,
        inputTokenAddress: EthereumWETH,
        stakeType: 'normal',
      }),
    );
  });

  it('waits for wrap finality and WETH approval before depositing into the original vault', async () => {
    const wrapFinality = deferred<EOnChainHistoryTxStatus>();
    const approvedAllowance = deferred<IAllowance>();
    const onSuccess = jest.fn();
    const onStepChange = jest.fn();
    mockNavigate.mockResolvedValue(undefined);
    mockWaitForFinal
      .mockReturnValueOnce(wrapFinality.promise)
      .mockResolvedValue(EOnChainHistoryTxStatus.Success);
    mockAllowance
      .mockResolvedValueOnce(allowance('0'))
      .mockReturnValueOnce(approvedAllowance.promise);
    const { result } = renderHook(() => useUniversalStake(account));

    const submit = result.current({ ...params, onSuccess, onStepChange });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    expect(mockNavigate.mock.calls[0][0].stakingInfo).toBeUndefined();
    expect(mockWaitForFinal).not.toHaveBeenCalled();
    expect(mockAllowance).not.toHaveBeenCalled();

    await mockNavigate.mock.calls[0][0].onSuccess?.(successData('wrap-tx'));
    await waitFor(() =>
      expect(mockWaitForFinal).toHaveBeenCalledWith(
        expect.objectContaining({
          ...account,
          txid: 'wrap-tx',
        }),
      ),
    );
    expect(mockAllowance).not.toHaveBeenCalled();
    expect(mockBuildStake).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();

    wrapFinality.resolve(EOnChainHistoryTxStatus.Success);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(2));
    expect(mockAllowance).toHaveBeenCalledWith({
      ...account,
      expectedAccountAddress: owner,
      tokenAddress: EthereumWETH,
      spenderAddress: EtherFiLiquidReferContract,
    });
    expect(mockNavigate.mock.calls[1][0].approvesInfo).toEqual([
      {
        owner,
        spender: EtherFiLiquidReferContract,
        amount: '1',
        tokenInfo: weth,
      },
    ]);
    expect(mockBuildStake).not.toHaveBeenCalled();

    await mockNavigate.mock.calls[1][0].onSuccess?.(successData('approve-tx'));
    await waitFor(() => expect(mockAllowance).toHaveBeenCalledTimes(2));
    expect(mockBuildStake).not.toHaveBeenCalled();
    approvedAllowance.resolve(allowance('1'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(3));

    expect(mockBuildStake).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        ...account,
        provider: 'etherfi',
        symbol: 'ETH',
        amount: '1',
        protocolVault: vault,
        stakeType: 'normal',
        inputTokenAddress: EthereumWETH,
        expectedAccountAddress: owner,
      }),
    );
    expect(mockNavigate.mock.calls[2][0].stakingInfo).toEqual({
      ...stakingInfo,
      send: { amount: '1', token: weth },
      orderId: 'deposit-order',
    });
    expect(onStepChange.mock.calls).toEqual([
      [2, { shouldShowPostWrapApproveStep: true }],
      [3],
    ]);
    expect(mockTrackOrder).not.toHaveBeenCalled();
    await mockNavigate.mock.calls[2][0].onSuccess?.(successData('deposit-tx'));
    await expect(submit).resolves.toBe(true);
    expect(mockTrackOrder).toHaveBeenCalledTimes(1);
    expect(mockTrackOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'deposit-order',
        txId: 'deposit-tx',
      }),
    );
    expect(onSuccess).toHaveBeenCalledWith(successData('deposit-tx'));
    expect(stakingInfo.send?.token).toBe(eth);
  });

  it('does not open the next transaction after the originating scope changes', async () => {
    const finality = deferred<EOnChainHistoryTxStatus>();
    mockWaitForFinal.mockReturnValueOnce(finality.promise);
    const { result, rerender } = renderHook(
      ({ scopeKey }: { scopeKey: string }) =>
        useUniversalStake({ ...account, scopeKey }),
      { initialProps: { scopeKey: 'first-vault' } },
    );
    const submit = result.current(params);
    await waitFor(() => expect(mockWaitForFinal).toHaveBeenCalledTimes(1));
    rerender({ scopeKey: 'other-vault' });
    finality.resolve(EOnChainHistoryTxStatus.Success);
    await expect(submit).resolves.toBe(false);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockAllowance).not.toHaveBeenCalled();
  });

  it('does not open a normal stake confirmation after a scope changes and changes back during build', async () => {
    const build = deferred<IStakeTxResponse>();
    mockBuildStake.mockReturnValueOnce(build.promise);
    const { result, rerender } = renderHook(
      ({ scopeKey }: { scopeKey: string }) =>
        useUniversalStake({ ...account, scopeKey }),
      { initialProps: { scopeKey: 'first-vault' } },
    );
    const submit = result.current({ ...params, stakeType: 'normal' });
    await waitFor(() => expect(mockBuildStake).toHaveBeenCalledTimes(1));
    rerender({ scopeKey: 'other-vault' });
    rerender({ scopeKey: 'first-vault' });
    build.resolve({ tx: depositTx });
    await expect(submit).resolves.toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not open a normal stake confirmation when the originating form becomes stale during build', async () => {
    const build = deferred<IStakeTxResponse>();
    mockBuildStake.mockReturnValueOnce(build.promise);
    let current = true;
    const { result } = renderHook(() => useUniversalStake(account));
    const submit = result.current({
      ...params,
      stakeType: 'normal',
      isActionCurrent: () => current,
    });
    await waitFor(() => expect(mockBuildStake).toHaveBeenCalledTimes(1));
    current = false;
    build.resolve({ tx: depositTx });
    await expect(submit).resolves.toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('rejects an old callback invoked after changing accounts', async () => {
    const { result, rerender } = renderHook(
      ({ accountId }: { accountId: string }) =>
        useUniversalStake({ accountId, networkId: account.networkId }),
      { initialProps: { accountId: 'account-1' } },
    );
    const oldCallback = result.current;
    rerender({ accountId: 'account-2' });
    await expect(oldCallback({ ...params, stakeType: 'normal' })).resolves.toBe(
      false,
    );
    expect(mockBuildStake).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('rejects a saved callback invoked after its owning hook unmounts', async () => {
    const { result, unmount } = renderHook(() => useUniversalStake(account));
    const oldCallback = result.current;
    unmount();
    await expect(oldCallback({ ...params, stakeType: 'normal' })).resolves.toBe(
      false,
    );
    expect(mockRiskAccepted).not.toHaveBeenCalled();
    expect(mockBuildStake).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('binds an ordinary stake build to the address displayed by the task', async () => {
    const { result } = renderHook(() => useUniversalStake(account));

    await expect(
      result.current({ ...params, stakeType: 'normal' }),
    ).resolves.toBe(true);

    expect(mockBuildStake).toHaveBeenCalledWith(
      expect.objectContaining({ expectedAccountAddress: owner }),
    );
  });

  it('does not open an ordinary stake confirmation for a different encoded owner', async () => {
    mockBuildInternal.mockResolvedValueOnce({
      ...depositTx,
      from: '0x2222222222222222222222222222222222222222',
    });
    const { result } = renderHook(() => useUniversalStake(account));

    await expect(
      result.current({ ...params, stakeType: 'normal' }),
    ).rejects.toThrow('Task account changed before stake');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('keeps the ordinary stake flow for protocol transactions without a from field', async () => {
    // VaultBase forwards the Lido server shape, whose from field is optional.
    mockBuildInternal.mockResolvedValueOnce({
      to: depositTx.to,
      value: depositTx.value,
      data: depositTx.data,
    } as IEncodedTx);
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({ ...params, stakeType: 'normal' }),
    ).resolves.toBe(true);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('allows a handed-off stake to send after only the form amount is reset', async () => {
    let formCurrent = true;
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        stakeType: 'normal',
        isActionCurrent: () => formCurrent,
      }),
    ).resolves.toBe(true);
    const confirmation = mockNavigate.mock.calls[0][0];
    formCurrent = false;
    await expect(
      Promise.resolve().then(() => confirmation.onBeforeSend?.()),
    ).resolves.toBeUndefined();
  });

  it('blocks a handed-off stake when its owner scope expires', async () => {
    let ownerCurrent = true;
    const { result } = renderHook(() => useUniversalStake(account));
    await expect(
      result.current({
        ...params,
        stakeType: 'normal',
        isSendCurrent: () => ownerCurrent,
      }),
    ).resolves.toBe(true);
    const confirmation = mockNavigate.mock.calls[0][0];
    ownerCurrent = false;
    await expect(
      Promise.resolve().then(() => confirmation.onBeforeSend?.()),
    ).rejects.toThrow('Task account changed before stake');
  });

  it('allows a stake confirmation retry after a transient pre-send account error', async () => {
    mockNavigate.mockResolvedValueOnce(undefined);
    const onSuccess = jest.fn();
    const onSubmitted = jest.fn();
    const { result } = renderHook(() => useUniversalStake(account));
    await result.current({
      ...params,
      stakeType: 'normal',
      onSuccess,
      onSubmitted,
    });
    const confirmation = mockNavigate.mock.calls[0][0];
    const error = new Error('account temporarily unavailable');
    mockGetAccountAddress.mockRejectedValueOnce(error);
    await expect(confirmation.onBeforeSend?.()).rejects.toBe(error);
    confirmation.onSafePreSendFail?.(error);
    await expect(confirmation.onBeforeSend?.()).resolves.toBeUndefined();
    await confirmation.onSuccess?.(successData('retry-stake-tx'));
    await waitFor(() =>
      expect(onSubmitted).toHaveBeenCalledWith('retry-stake-tx'),
    );
    expect(mockTrackOrder).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('allows stake retry after the confirmation precheck fails before any send', async () => {
    mockNavigate.mockResolvedValueOnce(undefined);
    const onSubmitted = jest.fn();
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalStake(account));
    await result.current({
      ...params,
      stakeType: 'normal',
      onSubmitted,
      onSuccess,
    });
    const confirmation = mockNavigate.mock.calls[0][0];
    confirmation.onSafePreSendFail?.(new Error('precheck unavailable'));
    await confirmation.onBeforeSend?.();
    await confirmation.onSuccess?.(successData('stake-tx'));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith('stake-tx'));
    expect(mockTrackOrder).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('freezes the backend stake account when no displayed address is supplied', async () => {
    mockNavigate.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useUniversalStake(account));
    await result.current({
      ...params,
      stakeType: 'normal',
      taskAccountAddress: undefined,
    });
    const confirmation = mockNavigate.mock.calls[0][0];
    mockGetAccountAddress.mockResolvedValueOnce(
      '0x2222222222222222222222222222222222222222',
    );
    await expect(confirmation.onBeforeSend?.()).rejects.toThrow(
      'Task account changed before stake',
    );
  });

  it('blocks an ordinary stake send when the same account ID resolves to another address', async () => {
    mockNavigate.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useUniversalStake(account));
    const submit = result.current({ ...params, stakeType: 'normal' });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    const confirmation = mockNavigate.mock.calls[0][0];
    mockGetAccountAddress.mockResolvedValueOnce(
      '0x2222222222222222222222222222222222222222',
    );
    try {
      await expect(
        Promise.resolve().then(() => confirmation.onBeforeSend?.()),
      ).rejects.toThrow('Task account changed before stake');
    } finally {
      confirmation.onCancel?.();
      await submit;
    }
  });

  it('allows a current action after StrictMode replays effect setup', async () => {
    const { result } = renderHook(() => useUniversalStake(account), {
      wrapper: StrictMode,
    });
    await expect(
      result.current({ ...params, stakeType: 'normal' }),
    ).resolves.toBe(true);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('does not open a normal stake confirmation after the owning hook unmounts during build', async () => {
    const build = deferred<IStakeTxResponse>();
    mockBuildStake.mockReturnValueOnce(build.promise);
    const { result, unmount } = renderHook(() => useUniversalStake(account));
    const submit = result.current({ ...params, stakeType: 'normal' });
    await waitFor(() => expect(mockBuildStake).toHaveBeenCalledTimes(1));
    unmount();
    build.resolve({ tx: depositTx });
    await expect(submit).resolves.toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it.each(['normal', 'wrap'] as const)(
    'cancels a %s confirmation if the scope changes while navigation prepares',
    async (stakeType) => {
      const prepare = deferred<void>();
      const opened = jest.fn();
      mockNavigate.mockImplementation(async ({ isNavigationCurrent }) => {
        await prepare.promise;
        if (isNavigationCurrent?.() ?? true) opened();
      });
      const { result, rerender } = renderHook(
        ({ scopeKey }: { scopeKey: string }) =>
          useUniversalStake({ ...account, scopeKey }),
        { initialProps: { scopeKey: 'first-vault' } },
      );
      const submit = result.current({ ...params, stakeType });
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
      rerender({ scopeKey: 'other-vault' });
      prepare.resolve();
      await expect(submit).resolves.toBe(false);
      expect(opened).not.toHaveBeenCalled();
    },
  );

  it.each(['1', '2'])(
    'skips approval when WETH allowance is %s',
    async (amount) => {
      mockAllowance.mockResolvedValue(allowance(amount));
      const onStepChange = jest.fn();
      const { result } = renderHook(() => useUniversalStake(account));

      await expect(result.current({ ...params, onStepChange })).resolves.toBe(
        true,
      );

      expect(mockNavigate).toHaveBeenCalledTimes(2);
      expect(
        mockNavigate.mock.calls.every(([call]) => !call.approvesInfo),
      ).toBe(true);
      expect(mockGetAccount).not.toHaveBeenCalled();
      expect(mockAllowance).toHaveBeenCalledTimes(1);
      expect(onStepChange).toHaveBeenCalledWith(2, {
        shouldShowPostWrapApproveStep: false,
      });
      expect(mockBuildStake.mock.calls[0][0]).toMatchObject({
        stakeType: 'normal',
        inputTokenAddress: EthereumWETH,
        protocolVault: vault,
      });
    },
  );

  it.each(['wrap', 'approve'] as const)(
    'stops when the user cancels %s',
    async (step) => {
      const onWrapStateChange = jest.fn();
      mockAllowance.mockResolvedValueOnce(allowance('0'));
      if (step === 'wrap') {
        mockNavigate.mockImplementationOnce(async ({ onCancel }) =>
          onCancel?.(),
        );
      } else {
        mockNavigate.mockImplementationOnce(async ({ onSuccess }) => {
          await onSuccess?.(successData('wrap-tx'));
        });
        mockNavigate.mockImplementationOnce(async ({ onCancel }) =>
          onCancel?.(),
        );
      }
      const { result } = renderHook(() => useUniversalStake(account));

      await expect(
        result.current({ ...params, onWrapStateChange }),
      ).resolves.toBe(false);

      expect(mockBuildStake).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledTimes(step === 'wrap' ? 1 : 2);
      expect(mockAllowance).toHaveBeenCalledTimes(step === 'wrap' ? 0 : 1);
      expect(mockTrackOrder).not.toHaveBeenCalled();
      expect(onWrapStateChange.mock.calls).toEqual(
        step === 'wrap' ? [] : [['unknown'], ['submitted']],
      );
    },
  );

  it('treats cancel after sending starts as uncertain and settles only once', async () => {
    const onWrapStateChange = jest.fn();
    mockNavigate.mockImplementationOnce(
      async ({ onBeforeSend, onCancel, onFail }) => {
        await onBeforeSend?.();
        onCancel?.();
        onFail?.(new Error('late failure'));
      },
    );
    const { result } = renderHook(() => useUniversalStake(account));

    await expect(
      result.current({ ...params, onWrapStateChange }),
    ).resolves.toBe(false);
    expect(onWrapStateChange.mock.calls).toEqual([['unknown']]);
    expect(mockAllowance).not.toHaveBeenCalled();
  });

  it('treats an early failure as uncertain and blocks retry on the old confirmation', async () => {
    const onWrapStateChange = jest.fn();
    mockNavigate.mockImplementationOnce(async ({ onFail }) =>
      onFail?.(new Error('preparation failed')),
    );
    const { result } = renderHook(() => useUniversalStake(account));

    await expect(
      result.current({ ...params, onWrapStateChange }),
    ).resolves.toBe(false);
    expect(onWrapStateChange.mock.calls).toEqual([['unknown']]);
    expect(() => mockNavigate.mock.calls[0][0].onBeforeSend?.()).toThrow();
  });

  it('blocks an opened confirmation after its originating scope changes', async () => {
    mockNavigate.mockResolvedValueOnce(undefined);
    const { result, rerender } = renderHook(
      ({ scopeKey }: { scopeKey: string }) =>
        useUniversalStake({ ...account, scopeKey }),
      { initialProps: { scopeKey: 'first' } },
    );
    const submit = result.current(params);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    rerender({ scopeKey: 'second' });
    await expect(submit).resolves.toBe(false);
    expect(() => mockNavigate.mock.calls[0][0].onBeforeSend?.()).toThrow();
  });

  it('blocks retries and ignores late success after a send failure', async () => {
    const onWrapStateChange = jest.fn();
    mockNavigate.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useUniversalStake(account));
    const submit = result.current({ ...params, onWrapStateChange });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    const confirmation = mockNavigate.mock.calls[0][0];
    await confirmation.onBeforeSend?.();
    confirmation.onFail?.(new Error('send failed'));
    await expect(submit).resolves.toBe(false);
    expect(() => confirmation.onBeforeSend?.()).toThrow();
    await confirmation.onSuccess?.(successData('late-tx'));
    expect(onWrapStateChange.mock.calls).toEqual([['unknown']]);
    expect(mockAllowance).not.toHaveBeenCalled();
  });

  it('blocks a retry on an expired post-wrap approval confirmation', async () => {
    mockAllowance.mockResolvedValueOnce(allowance('0'));
    mockNavigate.mockImplementationOnce(async ({ onSuccess }) => {
      await onSuccess?.(successData('wrap-tx'));
    });
    mockNavigate.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useUniversalStake(account));
    const submit = result.current(params);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(2));
    const approval = mockNavigate.mock.calls[1][0];
    await approval.onBeforeSend?.();
    approval.onFail?.(new Error('approval failed'));
    await expect(submit).resolves.toBe(false);
    expect(() => approval.onBeforeSend?.()).toThrow();
    expect(mockBuildStake).not.toHaveBeenCalled();
  });

  it.each(['wrap', 'approve'] as const)(
    'stops and reports a failed %s confirmation',
    async (step) => {
      const error = new Error('Transaction failed');
      const onFail = jest.fn();
      const onWrapStateChange = jest.fn();
      mockAllowance.mockResolvedValueOnce(allowance('0'));
      if (step === 'approve') {
        mockNavigate.mockImplementationOnce(async ({ onSuccess }) => {
          await onSuccess?.(successData('wrap-tx'));
        });
      }
      mockNavigate.mockImplementationOnce(
        async ({ onBeforeSend, onFail: fail }) => {
          await onBeforeSend?.();
          fail?.(error);
        },
      );
      const { result } = renderHook(() => useUniversalStake(account));

      await expect(
        result.current({ ...params, onFail, onWrapStateChange }),
      ).resolves.toBe(false);

      expect(onFail).toHaveBeenCalledWith(error);
      expect(mockBuildStake).not.toHaveBeenCalled();
      expect(mockTrackOrder).not.toHaveBeenCalled();
      expect(onWrapStateChange.mock.calls).toEqual(
        step === 'wrap' ? [['unknown']] : [['unknown'], ['submitted']],
      );
    },
  );

  it.each([EOnChainHistoryTxStatus.Failed, undefined])(
    'does not check allowance after unsuccessful wrap finality %s',
    async (status) => {
      mockWaitForFinal.mockResolvedValue(status);
      const { result } = renderHook(() => useUniversalStake(account));
      const onWrapStateChange = jest.fn();

      await expect(
        result.current({ ...params, onWrapStateChange }),
      ).resolves.toBe(false);
      expect(onWrapStateChange.mock.calls).toEqual(
        status === EOnChainHistoryTxStatus.Failed
          ? [['unknown'], ['failed']]
          : [['unknown']],
      );

      expect(mockAllowance).not.toHaveBeenCalled();
      expect(mockBuildStake).not.toHaveBeenCalled();
      expect(
        status === EOnChainHistoryTxStatus.Failed
          ? mockToastError
          : mockToastMessage,
      ).toHaveBeenCalledTimes(1);
    },
  );

  it('does not deposit when approval never becomes sufficient', async () => {
    mockAllowance.mockResolvedValue(allowance('0'));
    const { result } = renderHook(() => useUniversalStake(account));

    await expect(result.current(params)).resolves.toBe(false);

    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockBuildStake).not.toHaveBeenCalled();
    expect(mockToastMessage).toHaveBeenCalledTimes(1);
  });

  it.each(['invalid', 'NaN', 'Infinity', '-1'])(
    'does not approve or deposit after an invalid WETH allowance %s',
    async (value) => {
      mockAllowance.mockResolvedValue(allowance(value));
      const { result } = renderHook(() => useUniversalStake(account));

      await expect(result.current(params)).rejects.toThrow(
        'Invalid wrapped token allowance',
      );

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockBuildStake).not.toHaveBeenCalled();
      expect(mockTrackOrder).not.toHaveBeenCalled();
    },
  );

  it('does not continue after a failed allowance query', async () => {
    const error = new Error('Allowance RPC unavailable');
    mockAllowance.mockRejectedValue(error);
    const { result } = renderHook(() => useUniversalStake(account));

    await expect(result.current(params)).rejects.toBe(error);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockBuildStake).not.toHaveBeenCalled();
    expect(mockTrackOrder).not.toHaveBeenCalled();
  });

  it('does not submit any transaction when the risk disclaimer is canceled', async () => {
    mockRiskAccepted.mockResolvedValue(false);
    const { result } = renderHook(() => useUniversalStake(account));

    await expect(result.current(params)).resolves.toBe(false);

    expect(mockBuildStake).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('submits an existing WETH balance directly without wrapping', async () => {
    mockBuildInternal.mockReset().mockResolvedValue(depositTx);
    const { result } = renderHook(() => useUniversalStake(account));

    await expect(
      result.current({
        ...params,
        symbol: 'WETH',
        stakeType: 'normal',
        inputTokenAddress: EthereumWETH,
        stakingInfo: { ...stakingInfo, send: { amount: '1', token: weth } },
      }),
    ).resolves.toBe(true);

    expect(mockBuildStake).toHaveBeenCalledTimes(1);
    expect(mockBuildStake).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'WETH',
        stakeType: 'normal',
        inputTokenAddress: EthereumWETH,
        protocolVault: vault,
      }),
    );
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockWaitForFinal).not.toHaveBeenCalled();
    expect(mockAllowance).not.toHaveBeenCalled();
  });
});
