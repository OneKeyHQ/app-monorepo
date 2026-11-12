/** @jest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import {
  EEarnLabels,
  EInternalDappEnum,
  EInternalStakingAction,
  type IStakeTxResponse,
  type IStakingInfo,
  type IWithdrawBaseParams,
} from '@onekeyhq/shared/types/staking';
import {
  EDecodedTxStatus,
  type IBroadcastAcceptedFact,
  type ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';

import { createEarnWithdrawApprovalTask } from '../../Earn/tasks/earnWithdrawApprovalTask';
import { getUniversalWithdrawProtocolPlan } from '../earnWithdrawTask/types';

import { useUniversalClaim, useUniversalWithdraw } from './useUniversalHooks';

import type {
  IUniversalWithdrawContext,
  IUniversalWithdrawPrepared,
} from '../../Earn/protocols/withdrawProtocolRuntime';

const mockNavigate = jest.fn<
  Promise<void>,
  [
    {
      encodedTx?: IEncodedTx;
      stakingInfo?: IStakingInfo;
      signOnly?: boolean;
      useFeeInTx?: boolean;
      feeInfoEditable?: boolean;
      onSuccess?: (data: ISendTxOnSuccessData[]) => void | Promise<void>;
      onLateBroadcastAccepted?: (
        fact: IBroadcastAcceptedFact,
      ) => void | Promise<void>;
      onFail?: (error: Error) => void;
      onConfirmationFail?: (error: Error) => void;
      onSafePreSendFail?: (error: Error) => void;
      onBeforeSend?: () => void | Promise<void>;
      isNavigationCurrent?: () => boolean;
      onCancel?: () => void;
    },
  ]
>();
const mockGetConfig = jest.fn<
  Promise<{ unstakeWithSignMessage?: boolean; withdrawSignOnly?: boolean }>,
  [unknown]
>();
const mockBuildUnstake = jest.fn<
  Promise<IStakeTxResponse>,
  [IWithdrawBaseParams]
>();
const mockBuildClaim = jest.fn<
  Promise<IStakeTxResponse & { claimOwnerPublicKey?: string }>,
  [unknown]
>();
const mockBuildInternal = jest.fn<Promise<IEncodedTx>, [unknown]>();
const mockGetAccount = jest.fn<Promise<{ address: string }>, [unknown]>();
const mockBuildPermit = jest.fn<
  Promise<{ message: string; deadline: number }>,
  [unknown]
>();
const mockSignMessage = jest.fn<Promise<string>, [unknown]>();
const mockStakefishSign = jest.fn<
  Promise<{ signature: string; message: string }>,
  [{ isCurrent?: () => boolean }]
>();
const mockUnstakePush = jest.fn<Promise<void>, [unknown]>();
const mockAddEarnOrder = jest.fn<
  Promise<void | { localStatus: 'saved'; remoteStatus: 'synced' }>,
  [unknown, { remoteSync: 'once'; preserveExistingTx?: true }?]
>();
const mockRiskAccepted = jest.fn<Promise<boolean>, [unknown]>();
const mockToastSuccess = jest.fn<void, [unknown]>();
const mockToastError = jest.fn<void, [unknown]>();
const mockShowError = jest.fn<void, [unknown]>();
const mockWaitFinality = jest.fn<
  Promise<EOnChainHistoryTxStatus | undefined>,
  [unknown]
>();
const mockEstimateFee = jest.fn<
  Promise<{ token?: { price?: string }; feeFiatValue: string }>,
  [unknown]
>();
const mockShowClaimAlert = jest.fn<
  void,
  [
    {
      claimTokenFiatValue: string;
      estFiatValue: string;
      onConfirm: () => Promise<void>;
    },
  ]
>();

jest.mock('@onekeyhq/components', () => ({
  Toast: {
    success: (params: unknown) => mockToastSuccess(params),
    message: jest.fn(),
    error: (params: unknown) => mockToastError(params),
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({ navigationToTxConfirm: mockNavigate }),
}));
jest.mock('./useEarnSignMessageWithoutVerify', () => ({
  useEarnSignMessageWithoutVerify: () => mockStakefishSign,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccount: (params: unknown) => mockGetAccount(params),
      getAccountAddressForApi: async (params: unknown) =>
        (await mockGetAccount(params)).address,
    },
    serviceDApp: {
      openSignMessageModal: (params: unknown) => mockSignMessage(params),
    },
    serviceStaking: {
      getStakingConfigs: (params: unknown) => mockGetConfig(params),
      buildLidoEthPermitMessageData: (params: unknown) =>
        mockBuildPermit(params),
      buildUnstakeTransaction: (params: IWithdrawBaseParams) =>
        mockBuildUnstake(params),
      buildClaimTransaction: (params: unknown) => mockBuildClaim(params),
      buildInternalDappTx: (params: unknown) => mockBuildInternal(params),
      unstakePush: (params: unknown) => mockUnstakePush(params),
      addEarnOrder: (
        params: unknown,
        options?: { remoteSync: 'once'; preserveExistingTx?: true },
      ) =>
        options ? mockAddEarnOrder(params, options) : mockAddEarnOrder(params),
      estimateFee: (params: unknown) => mockEstimateFee(params),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: { showToastOfError: (error: unknown) => mockShowError(error) },
}));
jest.mock('../components/EarnRiskWarningDialog', () => ({
  useEarnRiskWarningGate: () => mockRiskAccepted,
}));
jest.mock('../components/EstimateNetworkFee', () => ({
  useShowClaimEstimateGasAlert: () => mockShowClaimAlert,
}));
jest.mock('@onekeyhq/kit/src/utils/waitForTxFinalStatus', () => ({
  waitForTxFinalStatus: (params: unknown) => mockWaitFinality(params),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

const account = { accountId: 'account-1', networkId: 'evm--1' };
const owner = '0x1111111111111111111111111111111111111111';
const tx = {
  from: owner,
  to: '0x2222222222222222222222222222222222222222',
  value: '0x0',
  data: '0x1234',
};
const params = {
  amount: '1.25',
  symbol: 'ETH',
  provider: 'lido',
  protocolVault: 'vault',
  inputTokenAddress: 'input',
  outputTokenAddress: 'output',
  withdrawAll: false,
  slippage: 0.5,
  effectiveApy: '2',
  stakingInfo: { label: EEarnLabels.Withdraw, protocol: 'Lido', tags: ['tag'] },
};

function submittedData(
  finalizedPsbtHex?: string,
  transactionAccount = account,
): ISendTxOnSuccessData[] {
  return [
    {
      signedTx: {
        txid: 'withdraw-tx',
        rawTx: '0x',
        encodedTx: null,
        finalizedPsbtHex,
      },
      decodedTx: {
        ...transactionAccount,
        txid: 'withdraw-tx',
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

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('useUniversalWithdraw existing transaction behavior', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockRiskAccepted.mockResolvedValue(true);
    mockGetConfig.mockResolvedValue({});
    mockGetAccount.mockResolvedValue({ address: owner });
    mockBuildPermit.mockResolvedValue({
      message: 'typed-message',
      deadline: 123,
    });
    mockSignMessage.mockResolvedValue('signature');
    mockStakefishSign.mockResolvedValue({
      signature: 'signed',
      message: 'message',
    });
    mockBuildUnstake.mockResolvedValue({ tx, orderId: 'order-1' });
    mockBuildInternal.mockResolvedValue(tx);
    mockNavigate.mockResolvedValue(undefined);
    mockUnstakePush.mockResolvedValue(undefined);
    mockAddEarnOrder.mockResolvedValue(undefined);
    mockWaitFinality.mockResolvedValue(EOnChainHistoryTxStatus.Success);
  });

  function createEthenaApprovalTestTask(
    resumeUnstake = false,
    signal?: AbortSignal,
    guards?: { isActionCurrent?: () => boolean; isSendCurrent?: () => boolean },
  ) {
    const hook = renderHook(() => useUniversalWithdraw(account));
    const provider = 'pendle';
    const identity = {
      ...account,
      accountAddress: owner,
      provider,
      action: 'withdraw' as const,
    };
    const plan = getUniversalWithdrawProtocolPlan({
      provider,
      config: { enabled: true, tokenAddress: '', displayProfit: true },
      useEthenaCooldown: true,
      resumeEthenaCooldownUnstake: resumeUnstake,
    });
    const onAsyncError = jest.fn();
    const task = createEarnWithdrawApprovalTask<
      string,
      IUniversalWithdrawPrepared,
      IUniversalWithdrawContext
    >({
      taskId: 'ethena-account-guard',
      identity,
      protocolSteps: plan.steps,
      initialContext: plan.initialContext,
      approval: {
        handoffOnSubmit: false,
        adapter: {
          prepare: async () => ({ type: 'confirm', prepared: 'approve' }),
          confirm: async ({ onBeforeSend, onSubmitted }) => {
            onBeforeSend();
            onSubmitted('approval-tx');
            return { type: 'submitted' };
          },
          waitForFinalStatus: async () => 'success',
          verify: async () => true,
        },
      },
      allowanceCheck: async () => true,
      prepareBusiness: async (workflowHandoff) => {
        await hook.result.current({
          ...params,
          provider,
          taskAccountAddress: owner,
          useEthenaCooldown: true,
          resumeEthenaCooldownUnstake: resumeUnstake,
          workflowHandoff,
          signal,
          ...guards,
        });
      },
      isCurrent: () => true,
      onAsyncError,
    });
    return { task, hook, onAsyncError };
  }

  it.each([false, true])(
    'binds the cooldown build to its captured account (resume=%s)',
    async (resume) => {
      const { task } = createEthenaApprovalTestTask(resume);
      const operation = task.run();
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
      expect(mockBuildUnstake).toHaveBeenCalledWith(
        expect.objectContaining({ expectedAccountAddress: owner }),
      );
      task.cancel();
      await expect(operation).resolves.toBe(false);
    },
  );

  it.each([false, true])(
    'rejects an account change while cooldown is building (resume=%s)',
    async (resume) => {
      const pending = deferred<IStakeTxResponse>();
      mockBuildUnstake.mockReturnValueOnce(pending.promise);
      const { task } = createEthenaApprovalTestTask(resume);
      const operation = task.run();
      void operation.catch(() => undefined);
      await waitFor(() => expect(mockBuildUnstake).toHaveBeenCalledTimes(1));
      mockGetAccount.mockResolvedValue({
        address: '0x3333333333333333333333333333333333333333',
      });
      pending.resolve({ tx, orderId: 'order-1' });
      await expect(operation).rejects.toThrow(
        'Task account changed before withdrawal',
      );
      expect(mockBuildInternal).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    'rejects cooldown encoding for a different owner (resume=%s)',
    async (resume) => {
      mockBuildInternal.mockResolvedValueOnce({
        ...tx,
        from: '0x3333333333333333333333333333333333333333',
      });
      const { task } = createEthenaApprovalTestTask(resume);
      await expect(task.run()).rejects.toThrow(
        'Task account changed before withdrawal',
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    },
  );

  it('checks the cooldown account before send without marking a blocked swap as submitted', async () => {
    const { task, hook } = createEthenaApprovalTestTask();
    const operation = task.run();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    const confirmation = mockNavigate.mock.calls[0][0];
    mockGetAccount.mockResolvedValue({
      address: '0x3333333333333333333333333333333333333333',
    });
    await expect(
      Promise.resolve().then(() => confirmation.onBeforeSend?.()),
    ).rejects.toThrow('Task account changed before withdrawal');
    confirmation.onCancel?.();
    await expect(operation).resolves.toBe(false);
    mockGetAccount.mockResolvedValue({ address: owner });
    mockNavigate.mockImplementationOnce(async ({ onCancel }) => onCancel?.());
    await expect(
      hook.result.current({
        ...params,
        provider: 'pendle',
        useEthenaCooldown: true,
      }),
    ).resolves.toBe(false);
    expect(mockBuildUnstake).toHaveBeenCalledTimes(2);
  });

  it('does not encode cooldown transactions after the captured action expires during build', async () => {
    const pending = deferred<IStakeTxResponse>();
    mockBuildUnstake.mockReturnValueOnce(pending.promise);
    let current = true;
    const { task, onAsyncError } = createEthenaApprovalTestTask(
      false,
      undefined,
      {
        isActionCurrent: () => current,
      },
    );
    const operation = task.run();
    await waitFor(() => expect(mockBuildUnstake).toHaveBeenCalledTimes(1));
    current = false;
    pending.resolve({ tx, orderId: 'order-1' });
    const outcome = await Promise.race([
      operation,
      new Promise<'pending'>((resolve) =>
        setTimeout(() => resolve('pending'), 200),
      ),
    ]);
    expect(outcome).toBe(false);
    expect(mockBuildInternal).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(onAsyncError).not.toHaveBeenCalled();
  });

  it('blocks cooldown send when its action expires during the account recheck', async () => {
    const pending = deferred<{ address: string }>();
    const recheckStarted = deferred<void>();
    let current = true;
    const { task } = createEthenaApprovalTestTask(false, undefined, {
      isSendCurrent: () => current,
    });
    const operation = task.run();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    const confirmation = mockNavigate.mock.calls[0][0];
    mockGetAccount.mockImplementationOnce(() => {
      recheckStarted.resolve();
      return pending.promise;
    });
    const send = Promise.resolve().then(() => confirmation.onBeforeSend?.());
    await recheckStarted.promise;
    current = false;
    pending.resolve({ address: owner });
    await expect(send).rejects.toThrow('Earn withdrawal expired');
    confirmation.onCancel?.();
    await expect(operation).resolves.toBe(false);
  });

  it('settles an Ethena handoff when the page signal aborts and retains its late order', async () => {
    mockAddEarnOrder.mockResolvedValue({
      localStatus: 'saved',
      remoteStatus: 'synced',
    });
    const abort = new AbortController();
    const { task } = createEthenaApprovalTestTask(false, abort.signal);
    const operation = task.run();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    const confirmation = mockNavigate.mock.calls[0][0];
    await confirmation.onBeforeSend?.();
    abort.abort();
    const outcome = await Promise.race([
      operation,
      new Promise<'pending'>((resolve) =>
        setTimeout(() => resolve('pending'), 200),
      ),
    ]);
    expect(outcome).toBe(false);
    await confirmation.onLateBroadcastAccepted?.({
      uuid: 'page-late',
      ...account,
      txid: 'late-swap',
    });
    expect(mockAddEarnOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', txId: 'late-swap' }),
      expect.objectContaining({ remoteSync: 'once', preserveExistingTx: true }),
    );
  });

  it('removes the Ethena page abort listener when the composed flow finishes', async () => {
    const abort = new AbortController();
    const add = jest.spyOn(abort.signal, 'addEventListener');
    const remove = jest.spyOn(abort.signal, 'removeEventListener');
    mockNavigate.mockImplementation(async ({ onSuccess }) => {
      await onSuccess?.(submittedData());
    });
    const { task } = createEthenaApprovalTestTask(false, abort.signal);
    await expect(task.run()).resolves.toBe(true);
    const listeners = add.mock.calls
      .filter(([type]) => type === 'abort')
      .map(([, listener]) => listener);
    expect(listeners).toHaveLength(1);
    expect(remove).toHaveBeenCalledWith('abort', listeners[0]);
  });

  it('reports a late Stakefish encoding error after its approval task aborts', async () => {
    const pending = deferred<IEncodedTx>();
    mockBuildInternal.mockReturnValueOnce(pending.promise);
    const hook = renderHook(() => useUniversalWithdraw(account));
    const provider = 'stakefish';
    const identity = {
      ...account,
      accountAddress: owner,
      provider,
      action: 'withdraw' as const,
    };
    const plan = getUniversalWithdrawProtocolPlan({
      provider,
      config: { enabled: true, tokenAddress: '', displayProfit: true },
    });
    const abort = new AbortController();
    const onAsyncError = jest.fn();
    const task = createEarnWithdrawApprovalTask<
      string,
      IUniversalWithdrawPrepared,
      IUniversalWithdrawContext
    >({
      taskId: 'stakefish-late-encode',
      identity,
      protocolSteps: plan.steps,
      initialContext: plan.initialContext,
      approval: {
        handoffOnSubmit: false,
        adapter: {
          prepare: async () => ({ type: 'confirm', prepared: 'approve' }),
          confirm: async ({ onBeforeSend, onSubmitted }) => {
            onBeforeSend();
            onSubmitted('approval-tx');
            return { type: 'submitted' };
          },
          waitForFinalStatus: async () => 'success',
          verify: async () => true,
        },
      },
      allowanceCheck: async () => true,
      prepareBusiness: async (workflowHandoff) => {
        await hook.result.current({
          ...params,
          provider,
          taskAccountAddress: owner,
          workflowHandoff,
          signal: abort.signal,
        });
      },
      isCurrent: () => !abort.signal.aborted,
      signal: abort.signal,
      onAsyncError,
    });
    const operation = task.run();
    await waitFor(() => expect(mockBuildInternal).toHaveBeenCalledTimes(1));
    abort.abort();
    await expect(operation).resolves.toBe(false);
    const failure = new OneKeyLocalError('late Stakefish encoding failure');
    pending.reject(failure);
    await waitFor(() => expect(onAsyncError).toHaveBeenCalledWith(failure));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'single', provider: 'pendle', lido: false, ethena: false },
    { name: 'lido', provider: 'lido', lido: true, ethena: false },
    { name: 'stakefish', provider: 'stakefish', lido: false, ethena: false },
    { name: 'pendle cooldown', provider: 'pendle', lido: false, ethena: true },
  ])(
    'registers the real $name hook steps in the approval task',
    async ({ provider, lido, ethena }) => {
      mockGetConfig.mockResolvedValue({ unstakeWithSignMessage: lido });
      if (ethena) {
        mockNavigate.mockImplementation(async ({ onSuccess }) => {
          await onSuccess?.(submittedData());
        });
      }
      const { result } = renderHook(() => useUniversalWithdraw(account));
      const identity = {
        ...account,
        accountAddress: owner,
        provider,
        action: 'withdraw' as const,
      };
      const plan = getUniversalWithdrawProtocolPlan({
        provider,
        config: {
          enabled: true,
          tokenAddress: '',
          displayProfit: true,
          unstakeWithSignMessage: lido,
        },
        useEthenaCooldown: ethena,
      });
      const task = createEarnWithdrawApprovalTask<
        string,
        IUniversalWithdrawPrepared,
        IUniversalWithdrawContext
      >({
        taskId: `hook-${provider}-${String(ethena)}`,
        identity,
        protocolSteps: plan.steps,
        initialContext: plan.initialContext,
        approval: {
          handoffOnSubmit: false,
          adapter: {
            prepare: async () => ({ type: 'confirm', prepared: 'approve' }),
            confirm: async ({ onBeforeSend, onSubmitted }) => {
              onBeforeSend();
              onSubmitted('approval-tx');
              return { type: 'submitted' };
            },
            waitForFinalStatus: async () => 'success',
            verify: async () => true,
          },
        },
        allowanceCheck: async () => true,
        prepareBusiness: async (workflowHandoff) => {
          await result.current({
            ...params,
            provider,
            taskAccountAddress: owner,
            useEthenaCooldown: ethena,
            workflowHandoff,
          });
        },
        isCurrent: () => true,
        onAsyncError: jest.fn(),
      });
      await expect(task.run()).resolves.toBe(true);
      expect(task.getTask().steps.map(({ id }) => id)).toEqual([
        'approve',
        'allowance',
        'prepareBusiness',
        ...plan.steps.map(({ id }) => id),
      ]);
      expect(mockNavigate).toHaveBeenCalledTimes(ethena ? 2 : 1);
      expect(mockSignMessage).toHaveBeenCalledTimes(lido ? 1 : 0);
    },
  );

  it('settles when a single withdrawal is cancelled before protocol preparation starts', async () => {
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const provider = 'pendle';
    const identity = {
      ...account,
      accountAddress: owner,
      provider,
      action: 'withdraw' as const,
    };
    const plan = getUniversalWithdrawProtocolPlan({
      provider,
      config: { enabled: true, tokenAddress: '', displayProfit: true },
    });
    const task = createEarnWithdrawApprovalTask<
      string,
      IUniversalWithdrawPrepared,
      IUniversalWithdrawContext
    >({
      taskId: 'cancel-before-single',
      identity,
      protocolSteps: plan.steps,
      initialContext: plan.initialContext,
      approval: {
        handoffOnSubmit: false,
        adapter: {
          prepare: async () => ({ type: 'confirm', prepared: 'approve' }),
          confirm: async ({ onBeforeSend, onSubmitted }) => {
            onBeforeSend();
            onSubmitted('approval-tx');
            return { type: 'submitted' };
          },
          waitForFinalStatus: async () => 'success',
          verify: async () => true,
        },
      },
      allowanceCheck: async () => true,
      prepareBusiness: async (workflowHandoff) => {
        await result.current({
          ...params,
          provider,
          taskAccountAddress: owner,
          workflowHandoff,
        });
      },
      isCurrent: () => true,
      onAsyncError: jest.fn(),
    });
    const unsubscribe = task.subscribe(() => {
      const state = task.getTask();
      const step = state.steps[state.currentStepIndex];
      if (step?.id === 'withdraw' && step.status.type === 'ready')
        task.cancel();
    });
    const outcome = await Promise.race([
      task.run(),
      new Promise<'pending'>((resolve) =>
        setTimeout(() => resolve('pending'), 200),
      ),
    ]);
    unsubscribe();
    expect(outcome).toBe(false);
    expect(mockBuildUnstake).not.toHaveBeenCalled();
  });

  it('records a verified late single-withdrawal broadcast in the original approval task', async () => {
    mockAddEarnOrder.mockResolvedValue({
      localStatus: 'saved',
      remoteStatus: 'synced',
    });
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const provider = 'pendle';
    const identity = {
      ...account,
      accountAddress: owner,
      provider,
      action: 'withdraw' as const,
    };
    const plan = getUniversalWithdrawProtocolPlan({
      provider,
      config: { enabled: true, tokenAddress: '', displayProfit: true },
    });
    const task = createEarnWithdrawApprovalTask<
      string,
      IUniversalWithdrawPrepared,
      IUniversalWithdrawContext
    >({
      taskId: 'late-single',
      identity,
      protocolSteps: plan.steps,
      initialContext: plan.initialContext,
      approval: {
        handoffOnSubmit: false,
        adapter: {
          prepare: async () => ({ type: 'confirm', prepared: 'approve' }),
          confirm: async ({ onBeforeSend, onSubmitted }) => {
            onBeforeSend();
            onSubmitted('approval-tx');
            return { type: 'submitted' };
          },
          waitForFinalStatus: async () => 'success',
          verify: async () => true,
        },
      },
      allowanceCheck: async () => true,
      prepareBusiness: async (workflowHandoff) => {
        await result.current({
          ...params,
          provider,
          taskAccountAddress: owner,
          workflowHandoff,
        });
      },
      isCurrent: () => true,
      onAsyncError: jest.fn(),
    });
    await expect(task.run()).resolves.toBe(true);
    const confirmation = mockNavigate.mock.calls[0][0];
    await confirmation.onBeforeSend?.();
    confirmation.onCancel?.();
    task.cancel();
    await confirmation.onLateBroadcastAccepted?.({
      uuid: 'late-request',
      ...account,
      txid: 'late-tx',
    });
    expect(mockAddEarnOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', txId: 'late-tx' }),
      expect.objectContaining({ remoteSync: 'once', preserveExistingTx: true }),
    );
  });

  it('propagates a pending single withdrawal build error after the approval task aborts', async () => {
    const pending = deferred<IStakeTxResponse>();
    const started = deferred<void>();
    mockBuildUnstake.mockImplementationOnce(async () => {
      started.resolve();
      return pending.promise;
    });
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const provider = 'pendle';
    const identity = {
      ...account,
      accountAddress: owner,
      provider,
      action: 'withdraw' as const,
    };
    const plan = getUniversalWithdrawProtocolPlan({
      provider,
      config: { enabled: true, tokenAddress: '', displayProfit: true },
    });
    const abort = new AbortController();
    const task = createEarnWithdrawApprovalTask<
      string,
      IUniversalWithdrawPrepared,
      IUniversalWithdrawContext
    >({
      taskId: 'abort-pending-single',
      identity,
      protocolSteps: plan.steps,
      initialContext: plan.initialContext,
      approval: {
        handoffOnSubmit: false,
        adapter: {
          prepare: async () => ({ type: 'confirm', prepared: 'approve' }),
          confirm: async ({ onBeforeSend, onSubmitted }) => {
            onBeforeSend();
            onSubmitted('approval-tx');
            return { type: 'submitted' };
          },
          waitForFinalStatus: async () => 'success',
          verify: async () => true,
        },
      },
      allowanceCheck: async () => true,
      prepareBusiness: async (workflowHandoff) => {
        await result.current({
          ...params,
          provider,
          taskAccountAddress: owner,
          workflowHandoff,
          signal: abort.signal,
        });
      },
      isCurrent: () => !abort.signal.aborted,
      signal: abort.signal,
      onAsyncError: jest.fn(),
    });
    const outcome = task.run();
    const failure = new OneKeyLocalError('late single build failed');
    void outcome.catch(() => undefined);
    await started.promise;
    abort.abort();
    pending.reject(failure);
    await expect(outcome).rejects.toBe(failure);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  function createSinglePageApprovalTask(
    pageSignal: AbortSignal,
    provider: 'pendle' | 'lido' | 'stakefish' = 'pendle',
    onFail?: (error: Error) => void,
    fullWithdrawal = false,
  ) {
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const lido = provider === 'lido';
    if (lido) mockGetConfig.mockResolvedValue({ unstakeWithSignMessage: true });
    const identity = {
      ...account,
      accountAddress: owner,
      provider,
      action: 'withdraw' as const,
    };
    const plan = getUniversalWithdrawProtocolPlan({
      provider,
      config: {
        enabled: true,
        tokenAddress: '',
        displayProfit: true,
        unstakeWithSignMessage: lido,
      },
    });
    const task = createEarnWithdrawApprovalTask<
      string,
      IUniversalWithdrawPrepared,
      IUniversalWithdrawContext
    >({
      taskId: 'single-page-approval',
      identity,
      protocolSteps: plan.steps,
      initialContext: plan.initialContext,
      approval: {
        handoffOnSubmit: false,
        adapter: {
          prepare: async () => ({ type: 'confirm', prepared: 'approve' }),
          confirm: async ({ onBeforeSend, onSubmitted }) => {
            onBeforeSend();
            onSubmitted('approval-tx');
            return { type: 'submitted' };
          },
          waitForFinalStatus: async () => 'success',
          verify: async () => true,
        },
      },
      allowanceCheck: async () => true,
      prepareBusiness: async (workflowHandoff) => {
        await result.current({
          ...params,
          provider,
          withdrawAll: fullWithdrawal,
          taskAccountAddress: owner,
          workflowHandoff,
          signal: pageSignal,
          onFail,
        });
      },
      isCurrent: () => true,
      onAsyncError: jest.fn(),
    });
    return { task };
  }

  it('composes Stakefish approval and full-withdrawal signing in the same task', async () => {
    const { task } = createSinglePageApprovalTask(
      new AbortController().signal,
      'stakefish',
      undefined,
      true,
    );
    await expect(task.run()).resolves.toBe(true);
    expect(mockStakefishSign).toHaveBeenCalledWith(
      expect.objectContaining({ expectedAccountAddress: owner }),
    );
    expect(mockBuildUnstake).toHaveBeenCalledWith(
      expect.objectContaining({ signature: 'signed', message: 'message' }),
    );
    expect(task.getTask().steps.map(({ id }) => id)).toEqual([
      'approve',
      'allowance',
      'prepareBusiness',
      'signWithdrawal',
      'build',
      'withdraw',
    ]);
  });

  it('does not build a Stakefish withdrawal when its post-sign risk gate is rejected', async () => {
    mockRiskAccepted.mockResolvedValue(false);
    const { task } = createSinglePageApprovalTask(
      new AbortController().signal,
      'stakefish',
      undefined,
      true,
    );
    await expect(task.run()).resolves.toBe(false);
    expect(mockStakefishSign).toHaveBeenCalledTimes(1);
    expect(mockBuildUnstake).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('invalidates the signing guard when the page aborts during the challenge', async () => {
    const challenge = deferred<void>();
    const guardValue = jest.fn();
    mockStakefishSign.mockImplementation(async ({ isCurrent }) => {
      await challenge.promise;
      guardValue(isCurrent?.());
      return { signature: 'signed', message: 'message' };
    });
    const page = new AbortController();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const operation = result.current({
      ...params,
      provider: 'stakefish',
      withdrawAll: true,
      signal: page.signal,
    });
    await waitFor(() => expect(mockStakefishSign).toHaveBeenCalledTimes(1));
    page.abort();
    challenge.resolve();
    await expect(operation).resolves.toBe(false);
    expect(guardValue).toHaveBeenCalledWith(false);
    expect(mockRiskAccepted).not.toHaveBeenCalled();
    expect(mockBuildUnstake).not.toHaveBeenCalled();
  });

  it('does not open the risk gate after a page abort during the post-sign account check', async () => {
    const accountCheck = deferred<{ address: string }>();
    mockGetAccount
      .mockResolvedValueOnce({ address: owner })
      .mockReturnValueOnce(accountCheck.promise);
    const page = new AbortController();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const operation = result.current({
      ...params,
      provider: 'stakefish',
      withdrawAll: true,
      signal: page.signal,
    });
    await waitFor(() => expect(mockGetAccount).toHaveBeenCalledTimes(2));
    page.abort();
    accountCheck.resolve({ address: owner });
    await expect(operation).resolves.toBe(false);
    expect(mockRiskAccepted).not.toHaveBeenCalled();
    expect(mockBuildUnstake).not.toHaveBeenCalled();
  });

  it('treats a late account-check error as cancellation after the page aborts', async () => {
    const accountCheck = deferred<{ address: string }>();
    mockGetAccount
      .mockResolvedValueOnce({ address: owner })
      .mockReturnValueOnce(accountCheck.promise);
    const page = new AbortController();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const operation = result.current({
      ...params,
      provider: 'stakefish',
      withdrawAll: true,
      signal: page.signal,
    });
    await waitFor(() => expect(mockGetAccount).toHaveBeenCalledTimes(2));
    page.abort();
    accountCheck.reject(new OneKeyLocalError('account lookup failed'));
    await expect(operation).resolves.toBe(false);
    expect(mockRiskAccepted).not.toHaveBeenCalled();
    expect(mockBuildUnstake).not.toHaveBeenCalled();
  });

  it('propagates the account-check error for a current Stakefish withdrawal', async () => {
    const error = new OneKeyLocalError('account lookup failed');
    mockGetAccount
      .mockResolvedValueOnce({ address: owner })
      .mockRejectedValueOnce(error);
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({ ...params, provider: 'stakefish', withdrawAll: true }),
    ).rejects.toBe(error);
    expect(mockRiskAccepted).not.toHaveBeenCalled();
    expect(mockBuildUnstake).not.toHaveBeenCalled();
  });

  it('treats a late risk-check error as cancellation after the page aborts', async () => {
    const risk = deferred<boolean>();
    mockRiskAccepted.mockReturnValue(risk.promise);
    const page = new AbortController();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const operation = result.current({
      ...params,
      provider: 'stakefish',
      withdrawAll: true,
      signal: page.signal,
    });
    await waitFor(() => expect(mockRiskAccepted).toHaveBeenCalledTimes(1));
    page.abort();
    risk.reject(new OneKeyLocalError('risk check failed'));
    await expect(operation).resolves.toBe(false);
    expect(mockBuildUnstake).not.toHaveBeenCalled();
  });

  it('does not hand off a single withdrawal when its page aborts during the pending build', async () => {
    const pending = deferred<IStakeTxResponse>();
    const buildStarted = deferred<void>();
    mockBuildUnstake.mockImplementationOnce(async () => {
      buildStarted.resolve();
      return pending.promise;
    });
    const pageAbort = new AbortController();
    const { task } = createSinglePageApprovalTask(pageAbort.signal);
    const outcome = task.run();
    await buildStarted.promise;
    pageAbort.abort();
    pending.resolve({ tx, orderId: 'order-1' });
    await expect(outcome).resolves.toBe(false);
    expect(mockBuildInternal).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not start a single build when the page aborts before preparation', async () => {
    const pageAbort = new AbortController();
    const { task } = createSinglePageApprovalTask(pageAbort.signal);
    const unsubscribe = task.subscribe(() => {
      const state = task.getTask();
      const step = state.steps[state.currentStepIndex];
      if (step?.id === 'withdraw' && step.status.type === 'ready')
        pageAbort.abort();
    });
    await expect(task.run()).resolves.toBe(false);
    unsubscribe();
    expect(mockBuildUnstake).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not open confirmation when the page aborts while single withdrawal encoding is pending', async () => {
    const pending = deferred<IEncodedTx>();
    const encodingStarted = deferred<void>();
    mockBuildInternal.mockImplementationOnce(async () => {
      encodingStarted.resolve();
      return pending.promise;
    });
    const pageAbort = new AbortController();
    const { task } = createSinglePageApprovalTask(pageAbort.signal);
    const outcome = task.run();
    await encodingStarted.promise;
    pageAbort.abort();
    pending.resolve(tx);
    await expect(outcome).resolves.toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('preserves a late single build error after only its page aborts', async () => {
    const pending = deferred<IStakeTxResponse>();
    const buildStarted = deferred<void>();
    mockBuildUnstake.mockImplementationOnce(async () => {
      buildStarted.resolve();
      return pending.promise;
    });
    const pageAbort = new AbortController();
    const { task } = createSinglePageApprovalTask(pageAbort.signal);
    const outcome = task.run();
    void outcome.catch(() => undefined);
    await buildStarted.promise;
    pageAbort.abort();
    const error = new OneKeyLocalError('late page build failure');
    pending.reject(error);
    await expect(outcome).rejects.toBe(error);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('settles a pending single confirmation navigation when only its page aborts', async () => {
    const navigation = deferred<void>();
    mockNavigate.mockReturnValueOnce(navigation.promise);
    const pageAbort = new AbortController();
    const add = jest.spyOn(pageAbort.signal, 'addEventListener');
    const remove = jest.spyOn(pageAbort.signal, 'removeEventListener');
    const { task } = createSinglePageApprovalTask(pageAbort.signal);
    const outcome = task.run();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    const confirmation = mockNavigate.mock.calls[0][0];
    pageAbort.abort();
    await expect(outcome).resolves.toBe(false);
    await expect(
      Promise.resolve().then(() => confirmation.onBeforeSend?.()),
    ).rejects.toThrow();
    const abortListener = add.mock.calls.find(
      ([type]) => type === 'abort',
    )?.[1];
    expect(remove).toHaveBeenCalledWith('abort', abortListener);
    navigation.resolve();
  });

  it('removes the page abort listener after single handoff and retains a late broadcast', async () => {
    mockAddEarnOrder.mockResolvedValue({
      localStatus: 'saved',
      remoteStatus: 'synced',
    });
    const pageAbort = new AbortController();
    const add = jest.spyOn(pageAbort.signal, 'addEventListener');
    const remove = jest.spyOn(pageAbort.signal, 'removeEventListener');
    const { task } = createSinglePageApprovalTask(pageAbort.signal);
    await expect(task.run()).resolves.toBe(true);
    const confirmation = mockNavigate.mock.calls[0][0];
    const abortListener = add.mock.calls.find(
      ([type]) => type === 'abort',
    )?.[1];
    expect(remove).toHaveBeenCalledWith('abort', abortListener);
    await confirmation.onBeforeSend?.();
    confirmation.onCancel?.();
    pageAbort.abort();
    await confirmation.onLateBroadcastAccepted?.({
      uuid: 'single-page-late',
      ...account,
      txid: 'single-page-late-tx',
    });
    expect(mockAddEarnOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        txId: 'single-page-late-tx',
      }),
      expect.objectContaining({ remoteSync: 'once', preserveExistingTx: true }),
    );
  });

  it('rejects an encoded Lido transaction for another owner in the approval workflow', async () => {
    mockBuildInternal.mockResolvedValueOnce({ ...tx, from: '0xother' });
    const pageAbort = new AbortController();
    const { task } = createSinglePageApprovalTask(pageAbort.signal, 'lido');
    await expect(task.run()).rejects.toThrow(
      'Task account changed before withdrawal',
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('keeps the Lido approval workflow retryable after a safe pre-send account failure', async () => {
    const page = new AbortController();
    const onFail = jest.fn();
    const { task } = createSinglePageApprovalTask(page.signal, 'lido', onFail);
    await expect(task.run()).resolves.toBe(true);
    const confirmation = mockNavigate.mock.calls[0][0];
    const statusBefore = task
      .getTask()
      .steps.find((step) => step.id === 'unstake')?.status;
    const error = new OneKeyLocalError('account temporarily unavailable');
    mockGetAccount.mockRejectedValueOnce(error);
    await expect(confirmation.onBeforeSend?.()).rejects.toBe(error);
    (
      confirmation.onSafePreSendFail ??
      confirmation.onConfirmationFail ??
      confirmation.onFail
    )?.(error);
    expect(onFail).toHaveBeenCalledWith(error);
    expect(
      task.getTask().steps.find((step) => step.id === 'unstake')?.status,
    ).toEqual(statusBefore);
    await expect(confirmation.onBeforeSend?.()).resolves.toBeUndefined();
    await confirmation.onSuccess?.(submittedData());
    await waitFor(() => expect(mockAddEarnOrder).toHaveBeenCalledTimes(1));
    expect(
      task.getTask().steps.find((step) => step.id === 'unstake')?.status,
    ).toEqual(expect.objectContaining({ txid: 'withdraw-tx' }));
  });

  it('keeps encoded Lido transaction strings in the approval workflow', async () => {
    mockBuildInternal.mockResolvedValueOnce('encoded-transaction');
    const pageAbort = new AbortController();
    const { task } = createSinglePageApprovalTask(pageAbort.signal, 'lido');
    await expect(task.run()).resolves.toBe(true);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it.each(['lido', 'stakefish'] as const)(
    'settles %s confirmation navigation when only the page aborts',
    async (provider) => {
      const navigation = deferred<void>();
      mockNavigate.mockReturnValueOnce(navigation.promise);
      const pageAbort = new AbortController();
      const add = jest.spyOn(pageAbort.signal, 'addEventListener');
      const remove = jest.spyOn(pageAbort.signal, 'removeEventListener');
      const { task } = createSinglePageApprovalTask(pageAbort.signal, provider);
      const outcome = task.run();
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
      pageAbort.abort();
      await expect(
        Promise.race([
          outcome,
          new Promise<'pending'>((resolve) =>
            setTimeout(() => resolve('pending'), 300),
          ),
        ]),
      ).resolves.toBe(false);
      const abortListener = add.mock.calls.find(
        ([type]) => type === 'abort',
      )?.[1];
      expect(remove).toHaveBeenCalledWith('abort', abortListener);
      navigation.resolve();
    },
  );

  it('does not encode a Stakefish withdrawal after only the page aborts during build', async () => {
    const pending = deferred<IStakeTxResponse>();
    const buildStarted = deferred<void>();
    mockBuildUnstake.mockImplementationOnce(async () => {
      buildStarted.resolve();
      return pending.promise;
    });
    const pageAbort = new AbortController();
    const { task } = createSinglePageApprovalTask(
      pageAbort.signal,
      'stakefish',
    );
    const outcome = task.run();
    await buildStarted.promise;
    pageAbort.abort();
    pending.resolve({ tx, orderId: 'order-1' });
    await expect(outcome).resolves.toBe(false);
    expect(mockBuildInternal).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('keeps a late Stakefish build error after only the page aborts', async () => {
    const pending = deferred<IStakeTxResponse>();
    const buildStarted = deferred<void>();
    mockBuildUnstake.mockImplementationOnce(async () => {
      buildStarted.resolve();
      return pending.promise;
    });
    const pageAbort = new AbortController();
    const { task } = createSinglePageApprovalTask(
      pageAbort.signal,
      'stakefish',
    );
    const outcome = task.run();
    void outcome.catch(() => undefined);
    await buildStarted.promise;
    pageAbort.abort();
    const error = new OneKeyLocalError('late Stakefish page build failure');
    pending.reject(error);
    await expect(outcome).rejects.toBe(error);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not build a Lido withdrawal after only the page aborts during signing', async () => {
    const signature = deferred<string>();
    mockSignMessage.mockReturnValueOnce(signature.promise);
    const pageAbort = new AbortController();
    const { task } = createSinglePageApprovalTask(pageAbort.signal, 'lido');
    const outcome = task.run();
    await waitFor(() => expect(mockSignMessage).toHaveBeenCalledTimes(1));
    pageAbort.abort();
    signature.resolve('signature');
    await expect(outcome).resolves.toBe(false);
    expect(mockBuildUnstake).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it.each(['lido', 'stakefish'] as const)(
    'cleans up the %s page listener after handoff while retaining late order recording',
    async (provider) => {
      mockAddEarnOrder.mockResolvedValue({
        localStatus: 'saved',
        remoteStatus: 'synced',
      });
      const pageAbort = new AbortController();
      const add = jest.spyOn(pageAbort.signal, 'addEventListener');
      const remove = jest.spyOn(pageAbort.signal, 'removeEventListener');
      const { task } = createSinglePageApprovalTask(pageAbort.signal, provider);
      await expect(task.run()).resolves.toBe(true);
      const confirmation = mockNavigate.mock.calls[0][0];
      const abortListener = add.mock.calls.find(
        ([type]) => type === 'abort',
      )?.[1];
      expect(remove).toHaveBeenCalledWith('abort', abortListener);
      await confirmation.onBeforeSend?.();
      confirmation.onCancel?.();
      pageAbort.abort();
      await confirmation.onLateBroadcastAccepted?.({
        uuid: `${provider}-late`,
        ...account,
        txid: `${provider}-late-tx`,
      });
      expect(mockAddEarnOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-1',
          txId: `${provider}-late-tx`,
        }),
        expect.objectContaining({
          remoteSync: 'once',
          preserveExistingTx: true,
        }),
      );
    },
  );

  it('does not register Pendle cooldown after its owner aborts while resolving the account', async () => {
    const pending = deferred<{ address: string }>();
    mockGetAccount.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const workflowHandoff = { register: jest.fn(async () => true) };
    const abort = new AbortController();
    const operation = result.current({
      ...params,
      provider: 'pendle',
      taskAccountAddress: owner,
      useEthenaCooldown: true,
      workflowHandoff,
      signal: abort.signal,
    });
    await waitFor(() => expect(mockGetAccount).toHaveBeenCalledTimes(1));
    abort.abort();
    pending.resolve({ address: owner });
    await expect(operation).resolves.toBe(false);
    expect(workflowHandoff.register).not.toHaveBeenCalled();
    expect(mockBuildUnstake).not.toHaveBeenCalled();
  });

  it('fails closed before a Babylon approval workflow can create another task', async () => {
    mockGetConfig.mockResolvedValue({ withdrawSignOnly: true });
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const workflowHandoff = { register: jest.fn(async () => true) };
    await expect(
      result.current({
        ...params,
        provider: 'babylon',
        taskAccountAddress: owner,
        workflowHandoff,
      }),
    ).rejects.toThrow('Unsupported withdrawal approval workflow');
    expect(workflowHandoff.register).not.toHaveBeenCalled();
    expect(mockBuildUnstake).not.toHaveBeenCalled();
  });

  it('binds a single withdrawal build to the displayed account address', async () => {
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({ ...params, taskAccountAddress: owner }),
    ).resolves.toBe(true);
    expect(mockBuildUnstake).toHaveBeenCalledWith(
      expect.objectContaining({ expectedAccountAddress: owner }),
    );
  });

  it('rejects a single withdrawal transaction encoded for another owner', async () => {
    mockBuildInternal.mockResolvedValueOnce({
      ...tx,
      from: '0x3333333333333333333333333333333333333333',
    });
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({ ...params, taskAccountAddress: owner }),
    ).rejects.toThrow('Task account changed before withdrawal');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('keeps single withdrawal transactions without a from field', async () => {
    // VaultBase forwards the Lido server shape, whose from field is optional.
    mockBuildInternal.mockResolvedValueOnce({
      to: tx.to,
      value: tx.value,
      data: tx.data,
    } as IEncodedTx);
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({ ...params, taskAccountAddress: owner }),
    ).resolves.toBe(true);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('rejects a single withdrawal send after the account address changes', async () => {
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({ ...params, taskAccountAddress: owner }),
    ).resolves.toBe(true);
    const confirmation = mockNavigate.mock.calls[0][0];
    mockGetAccount.mockResolvedValueOnce({
      address: '0x3333333333333333333333333333333333333333',
    });
    await expect(
      Promise.resolve().then(() => confirmation.onBeforeSend?.()),
    ).rejects.toThrow('Task account changed before withdrawal');
  });

  it('freezes the backend withdrawal account when no displayed address is supplied', async () => {
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(result.current(params)).resolves.toBe(true);
    mockGetAccount.mockResolvedValueOnce({ address: '0xother' });
    await expect(
      mockNavigate.mock.calls[0][0].onBeforeSend?.(),
    ).rejects.toThrow('Task account changed before withdrawal');
  });

  it('records a single withdrawal without notifying a changed account address', async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await result.current({ ...params, onSuccess });
    mockGetAccount.mockResolvedValue({ address: '0xother' });
    await mockNavigate.mock.calls[0][0].onSuccess?.(submittedData());
    expect(mockAddEarnOrder).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('does not start withdrawal after the risk gate is rejected', async () => {
    mockRiskAccepted.mockResolvedValue(false);
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(result.current(params)).resolves.toBe(false);
    expect(mockGetConfig).not.toHaveBeenCalled();
    expect(mockBuildUnstake).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('continues the Ethena unstake without waiting when the swap has no transaction id', async () => {
    const data = submittedData();
    data[0].signedTx.txid = '';
    data[0].decodedTx.txid = '';
    mockNavigate.mockImplementationOnce(async ({ onSuccess }) => {
      await onSuccess?.(data);
    });
    mockNavigate.mockImplementationOnce(async ({ onCancel }) => {
      onCancel?.();
    });
    const onEthenaCooldownUnstakeReady = jest.fn();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const ethena = {
      ...params,
      provider: 'pendle',
      useEthenaCooldown: true,
      onEthenaCooldownUnstakeReady,
    };
    await expect(result.current(ethena)).resolves.toBe(true);
    expect(mockBuildUnstake).toHaveBeenCalledTimes(2);
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockWaitFinality).not.toHaveBeenCalled();
    expect(onEthenaCooldownUnstakeReady).toHaveBeenCalledTimes(1);
  });

  it('scopes the in-memory unknown lock to the withdrawal identity and tokens', async () => {
    const data = submittedData();
    mockWaitFinality.mockResolvedValueOnce(undefined);
    mockNavigate.mockImplementationOnce(async ({ onSuccess }) => {
      await onSuccess?.(data);
    });
    mockNavigate.mockImplementationOnce(async ({ onCancel }) => {
      onCancel?.();
    });
    mockNavigate.mockImplementationOnce(async ({ onCancel }) => {
      onCancel?.();
    });
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const ethena = {
      ...params,
      provider: 'pendle',
      identity: 'request-a',
      useEthenaCooldown: true,
    };
    await expect(result.current(ethena)).resolves.toBe(false);
    await expect(
      result.current({ ...ethena, identity: 'request-b' }),
    ).resolves.toBe(false);
    expect(mockBuildUnstake).toHaveBeenCalledTimes(2);
    await expect(result.current({ ...ethena, amount: '3' })).resolves.toBe(
      false,
    );
    expect(mockBuildUnstake).toHaveBeenCalledTimes(2);
    await expect(
      result.current({
        ...ethena,
        protocolVault: 'VAULT',
        inputTokenAddress: 'INPUT',
      }),
    ).resolves.toBe(false);
    expect(mockBuildUnstake).toHaveBeenCalledTimes(2);
    await expect(
      result.current({ ...ethena, outputTokenAddress: 'other-output' }),
    ).resolves.toBe(false);
    expect(mockBuildUnstake).toHaveBeenCalledTimes(3);
  });

  it('keeps unknown Ethena swaps scoped to their account and does not restore the latch on remount', async () => {
    const data = submittedData();
    mockWaitFinality.mockResolvedValueOnce(undefined);
    mockNavigate.mockImplementationOnce(async ({ onSuccess }) => {
      await onSuccess?.(data);
    });
    mockNavigate.mockImplementationOnce(async ({ onCancel }) => {
      onCancel?.();
    });
    mockNavigate.mockImplementationOnce(async ({ onCancel }) => {
      onCancel?.();
    });
    const ethena = { ...params, provider: 'pendle', useEthenaCooldown: true };
    const { result, rerender, unmount } = renderHook(
      ({ accountId }: { accountId: string }) =>
        useUniversalWithdraw({ accountId, networkId: account.networkId }),
      { initialProps: { accountId: account.accountId } },
    );
    await expect(result.current(ethena)).resolves.toBe(false);
    rerender({ accountId: 'account-2' });
    await expect(result.current(ethena)).resolves.toBe(false);
    expect(mockBuildUnstake).toHaveBeenCalledTimes(2);
    rerender({ accountId: account.accountId });
    await expect(result.current({ ...ethena, amount: '2.5' })).resolves.toBe(
      false,
    );
    expect(mockBuildUnstake).toHaveBeenCalledTimes(2);
    unmount();
    const remounted = renderHook(() => useUniversalWithdraw(account));
    await expect(remounted.result.current(ethena)).resolves.toBe(false);
    expect(mockBuildUnstake).toHaveBeenCalledTimes(3);
  });

  it('waits for the decoded transaction id if the signed id is empty', async () => {
    const data = submittedData();
    data[0].signedTx.txid = '';
    mockNavigate.mockImplementationOnce(async ({ onSuccess }) => {
      await onSuccess?.(data);
    });
    mockNavigate.mockImplementationOnce(async ({ onCancel }) => {
      onCancel?.();
    });
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({
        ...params,
        provider: 'pendle',
        useEthenaCooldown: true,
      }),
    ).resolves.toBe(true);
    expect(mockWaitFinality).toHaveBeenCalledWith(
      expect.objectContaining({ txid: 'withdraw-tx' }),
    );
    expect(mockAddEarnOrder).toHaveBeenCalledTimes(1);
  });

  it('records the Ethena swap and keeps the flow started when the second confirmation is cancelled', async () => {
    mockNavigate.mockImplementationOnce(async ({ onSuccess }) => {
      await onSuccess?.(submittedData());
    });
    mockNavigate.mockImplementationOnce(async ({ onCancel }) => {
      onCancel?.();
    });
    const onEthenaCooldownUnstakeReady = jest.fn();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({
        ...params,
        provider: 'pendle',
        useEthenaCooldown: true,
        onEthenaCooldownUnstakeReady,
      }),
    ).resolves.toBe(true);
    expect(mockAddEarnOrder).toHaveBeenCalledTimes(1);
    expect(mockWaitFinality).toHaveBeenCalledTimes(1);
    expect(onEthenaCooldownUnstakeReady).toHaveBeenCalledTimes(1);
    expect(mockBuildUnstake).toHaveBeenCalledTimes(2);
    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });

  it('records both Ethena transactions and completes the second handoff', async () => {
    mockNavigate.mockImplementation(async ({ onSuccess }) => {
      await onSuccess?.(submittedData());
    });
    const onStepChange = jest.fn<void, [number]>();
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({
        ...params,
        provider: 'pendle',
        useEthenaCooldown: true,
        onStepChange,
        onSuccess,
      }),
    ).resolves.toBe(true);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onStepChange.mock.calls.map(([step]) => step)).toEqual([2, 3]);
    expect(mockAddEarnOrder).toHaveBeenCalledTimes(2);
  });

  it('does not build the second Ethena transaction before the first settles', async () => {
    const finality = deferred<EOnChainHistoryTxStatus | undefined>();
    mockWaitFinality.mockReturnValue(finality.promise);
    mockNavigate.mockImplementationOnce(async ({ onSuccess }) => {
      await onSuccess?.(submittedData());
    });
    mockNavigate.mockImplementationOnce(async ({ onCancel }) => onCancel?.());
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const operation = result.current({
      ...params,
      provider: 'pendle',
      useEthenaCooldown: true,
    });
    await waitFor(() => expect(mockWaitFinality).toHaveBeenCalledTimes(1));
    expect(mockBuildUnstake).toHaveBeenCalledTimes(1);
    finality.resolve(EOnChainHistoryTxStatus.Success);
    await expect(operation).resolves.toBe(true);
    expect(mockBuildUnstake).toHaveBeenCalledTimes(2);
  });

  it('does not continue the Ethena task when its owner aborts during settlement', async () => {
    const finality = deferred<EOnChainHistoryTxStatus | undefined>();
    mockWaitFinality.mockReturnValue(finality.promise);
    mockNavigate.mockImplementationOnce(async ({ onSuccess }) => {
      await onSuccess?.(submittedData());
    });
    const abort = new AbortController();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const operation = result.current({
      ...params,
      provider: 'pendle',
      useEthenaCooldown: true,
      signal: abort.signal,
    });
    await waitFor(() => expect(mockWaitFinality).toHaveBeenCalledTimes(1));
    abort.abort();
    finality.resolve(EOnChainHistoryTxStatus.Success);
    await expect(operation).resolves.toBe(false);
    expect(mockBuildUnstake).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockAddEarnOrder).toHaveBeenCalledTimes(1);
  });

  it.each([EOnChainHistoryTxStatus.Success, EOnChainHistoryTxStatus.Failed])(
    'does not update an expired Ethena page after finality returns %s',
    async (status) => {
      let current = true;
      const finality = deferred<EOnChainHistoryTxStatus | undefined>();
      mockWaitFinality.mockReturnValue(finality.promise);
      mockNavigate.mockImplementationOnce(async ({ onSuccess }) => {
        await onSuccess?.(submittedData());
      });
      const onReady = jest.fn();
      const { result } = renderHook(() => useUniversalWithdraw(account));
      const operation = result.current({
        ...params,
        provider: 'pendle',
        useEthenaCooldown: true,
        isActionCurrent: () => current,
        onEthenaCooldownUnstakeReady: onReady,
      });
      await waitFor(() => expect(mockWaitFinality).toHaveBeenCalledTimes(1));
      current = false;
      finality.resolve(status);
      await expect(operation).resolves.toBe(false);
      expect(onReady).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
      expect(mockBuildUnstake).toHaveBeenCalledTimes(1);
    },
  );

  it('does not navigate when the Ethena action expires during construction', async () => {
    let current = true;
    const building = deferred<IStakeTxResponse>();
    mockBuildUnstake.mockReturnValueOnce(building.promise);
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const operation = result.current({
      ...params,
      provider: 'pendle',
      useEthenaCooldown: true,
      isActionCurrent: () => current,
    });
    await waitFor(() => expect(mockBuildUnstake).toHaveBeenCalledTimes(1));
    current = false;
    building.resolve({ tx, orderId: 'order-1' });
    await expect(operation).resolves.toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('blocks an expired Ethena send and does not replay an uncertain submitted swap', async () => {
    let current = true;
    mockNavigate.mockImplementationOnce(async ({ onBeforeSend, onCancel }) => {
      await onBeforeSend?.();
      current = false;
      expect(() => onBeforeSend?.()).toThrow();
      onCancel?.();
    });
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const ethena = {
      ...params,
      provider: 'pendle',
      useEthenaCooldown: true,
      isSendCurrent: () => current,
    };
    await expect(result.current(ethena)).resolves.toBe(false);
    current = true;
    await expect(result.current(ethena)).resolves.toBe(false);
    expect(mockBuildUnstake).toHaveBeenCalledTimes(1);
  });

  it('allows Ethena to retry after signing is cancelled before broadcasting', async () => {
    mockNavigate.mockImplementationOnce(
      async ({ onBeforeSend, onSafePreSendFail }) => {
        await onBeforeSend?.();
        onSafePreSendFail?.(new Error('local signing cancelled'));
      },
    );
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const ethena = { ...params, provider: 'pendle', useEthenaCooldown: true };
    await expect(result.current(ethena)).resolves.toBe(false);
    mockNavigate.mockImplementationOnce(async ({ onCancel }) => onCancel?.());
    await expect(result.current(ethena)).resolves.toBe(false);
    expect(mockBuildUnstake).toHaveBeenCalledTimes(2);
    expect(mockWaitFinality).not.toHaveBeenCalled();
  });

  it('does not replay an Ethena swap with an unknown final status', async () => {
    mockWaitFinality.mockResolvedValueOnce(undefined);
    mockNavigate.mockImplementationOnce(async ({ onSuccess }) => {
      await onSuccess?.(submittedData());
    });
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const ethena = { ...params, provider: 'pendle', useEthenaCooldown: true };
    await expect(result.current(ethena)).resolves.toBe(false);
    await expect(result.current(ethena)).resolves.toBe(false);
    expect(mockBuildUnstake).toHaveBeenCalledTimes(1);
  });

  it('propagates a failing Ethena error callback without leaving the task pending', async () => {
    mockNavigate.mockImplementationOnce(async ({ onFail }) => {
      onFail?.(new Error('confirmation failed'));
    });
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({
        ...params,
        provider: 'pendle',
        useEthenaCooldown: true,
        onFail: () => {
          throw new OneKeyLocalError('callback failed');
        },
      }),
    ).rejects.toThrow('callback failed');
  });

  it('allows only one concurrent Ethena confirmation to begin sending', async () => {
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const ethena = { ...params, provider: 'pendle', useEthenaCooldown: true };
    const first = result.current(ethena);
    const second = result.current(ethena);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(2));
    const firstConfirm = mockNavigate.mock.calls[0][0];
    const secondConfirm = mockNavigate.mock.calls[1][0];
    expect(() => firstConfirm.onBeforeSend?.()).not.toThrow();
    expect(() => secondConfirm.onBeforeSend?.()).toThrow();
    firstConfirm.onCancel?.();
    secondConfirm.onCancel?.();
    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(false);
  });

  it('records a verified late Ethena swap without starting the second transaction', async () => {
    mockAddEarnOrder.mockResolvedValueOnce({
      localStatus: 'saved',
      remoteStatus: 'synced',
    });
    mockNavigate.mockImplementationOnce(async ({ onBeforeSend, onCancel }) => {
      await onBeforeSend?.();
      onCancel?.();
    });
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const ethena = {
      ...params,
      provider: 'pendle',
      useEthenaCooldown: true,
      onSuccess,
    };
    await expect(result.current(ethena)).resolves.toBe(false);
    await mockNavigate.mock.calls[0][0].onLateBroadcastAccepted?.({
      uuid: 'swap-request',
      ...account,
      txid: 'late-swap',
    });
    expect(mockAddEarnOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', txId: 'late-swap' }),
      { remoteSync: 'once', preserveExistingTx: true },
    );
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    await expect(result.current(ethena)).resolves.toBe(false);
  });

  it('records a late Ethena unstake without updating the expired page', async () => {
    let current = true;
    const onSuccess = jest.fn();
    const onStepChange = jest.fn();
    mockNavigate.mockImplementationOnce(async ({ onSuccess: submitted }) => {
      current = false;
      await submitted?.(submittedData());
    });
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({
        ...params,
        provider: 'pendle',
        useEthenaCooldown: true,
        resumeEthenaCooldownUnstake: true,
        isResultCurrent: () => current,
        onSuccess,
        onStepChange,
      }),
    ).resolves.toBe(true);
    expect(mockAddEarnOrder).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onStepChange).not.toHaveBeenCalled();
  });

  it('hands off a direct withdrawal and records its order only after submission', async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(result.current({ ...params, onSuccess })).resolves.toBe(true);
    expect(mockBuildUnstake).toHaveBeenCalledWith(
      expect.objectContaining({
        ...account,
        amount: params.amount,
        symbol: params.symbol,
        provider: params.provider,
        protocolVault: params.protocolVault,
        inputTokenAddress: params.inputTokenAddress,
        outputTokenAddress: params.outputTokenAddress,
        withdrawAll: false,
        slippage: params.slippage,
        effectiveApy: params.effectiveApy,
      }),
    );
    expect(mockBuildInternal).toHaveBeenCalledWith({
      ...account,
      tx,
      internalDappType: EInternalDappEnum.Staking,
      stakingAction: EInternalStakingAction.Withdraw,
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        encodedTx: tx,
        stakingInfo: { ...params.stakingInfo, orderId: 'order-1' },
      }),
    );
    expect(mockAddEarnOrder).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    const data = submittedData();
    await mockNavigate.mock.calls[0][0].onSuccess?.(data);
    expect(mockAddEarnOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        networkId: account.networkId,
        txId: 'withdraw-tx',
        status: EDecodedTxStatus.Pending,
      }),
    );
    expect(onSuccess).toHaveBeenCalledWith(data);
    expect(mockAddEarnOrder.mock.invocationCallOrder[0]).toBeLessThan(
      onSuccess.mock.invocationCallOrder[0],
    );
  });

  it('records a direct withdrawal once when confirmation success repeats during order recording', async () => {
    const recording = deferred<void>();
    mockAddEarnOrder.mockReturnValueOnce(recording.promise);
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(result.current({ ...params, onSuccess })).resolves.toBe(true);
    const confirmation = mockNavigate.mock.calls[0][0];
    const first = confirmation.onSuccess?.(submittedData());
    const duplicate = confirmation.onSuccess?.(submittedData());
    expect(mockAddEarnOrder).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    recording.resolve();
    await first;
    await duplicate;
    expect(mockAddEarnOrder).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('does not encode or open a direct withdrawal after its task is aborted while building', async () => {
    const pending = deferred<IStakeTxResponse>();
    const abort = new AbortController();
    mockBuildUnstake.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const operation = result.current({ ...params, signal: abort.signal });
    await waitFor(() => expect(mockBuildUnstake).toHaveBeenCalledTimes(1));
    abort.abort();
    pending.resolve({ tx, orderId: 'order-1' });
    await expect(operation).resolves.toBe(false);
    expect(mockBuildInternal).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('retains the original direct build failure after the action becomes stale', async () => {
    const pending = deferred<IStakeTxResponse>();
    const error = new Error('withdrawal build failed');
    let current = true;
    mockBuildUnstake.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const operation = result.current({
      ...params,
      isActionCurrent: () => current,
    });
    await waitFor(() => expect(mockBuildUnstake).toHaveBeenCalledTimes(1));
    current = false;
    pending.reject(error);
    await expect(operation).rejects.toBe(error);
    expect(mockBuildInternal).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not encode a direct withdrawal when its action becomes stale during build', async () => {
    const pending = deferred<IStakeTxResponse>();
    let current = true;
    mockBuildUnstake.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const operation = result.current({
      ...params,
      isActionCurrent: () => current,
    });
    await waitFor(() => expect(mockBuildUnstake).toHaveBeenCalledTimes(1));
    current = false;
    pending.resolve({ tx, orderId: 'order-1' });
    await expect(operation).resolves.toBe(false);
    expect(mockBuildInternal).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('checks the original direct withdrawal scope before sending', async () => {
    let sendCurrent = true;
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({ ...params, isSendCurrent: () => sendCurrent }),
    ).resolves.toBe(true);
    const confirmation = mockNavigate.mock.calls[0][0];
    await expect(confirmation.onBeforeSend?.()).resolves.toBeUndefined();
    sendCurrent = false;
    await expect(confirmation.onBeforeSend?.()).rejects.toThrow();
    expect(mockAddEarnOrder).not.toHaveBeenCalled();
  });

  it('records a direct withdrawal for its original order after the UI expires', async () => {
    let current = true;
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({
        ...params,
        onSuccess,
        isResultCurrent: () => current,
      }),
    ).resolves.toBe(true);
    current = false;
    await mockNavigate.mock.calls[0][0].onSuccess?.(submittedData());
    expect(mockAddEarnOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', txId: 'withdraw-tx' }),
      { remoteSync: 'once', preserveExistingTx: true },
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('records an accepted direct withdrawal after cancellation without a success callback', async () => {
    mockAddEarnOrder.mockResolvedValueOnce({
      localStatus: 'saved',
      remoteStatus: 'synced',
    });
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(result.current({ ...params, onSuccess })).resolves.toBe(true);
    const confirmation = mockNavigate.mock.calls[0][0];
    confirmation.onCancel?.();
    await confirmation.onLateBroadcastAccepted?.({
      uuid: 'request',
      ...account,
      txid: 'late-tx',
    });
    expect(mockAddEarnOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', txId: 'late-tx' }),
      { remoteSync: 'once', preserveExistingTx: true },
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it.each(['lido', 'stakefish'])(
    'records a late %s withdrawal without updating an expired action owner',
    async (provider) => {
      let current = true;
      const onSuccess = jest.fn();
      const { result } = renderHook(() => useUniversalWithdraw(account));
      await expect(
        result.current({
          ...params,
          provider,
          isActionCurrent: () => current,
          onSuccess,
        }),
      ).resolves.toBe(true);
      current = false;
      await mockNavigate.mock.calls[0][0].onSuccess?.(submittedData());
      expect(mockAddEarnOrder).toHaveBeenCalledTimes(1);
      expect(onSuccess).not.toHaveBeenCalled();
    },
  );

  it('records a late signed Lido withdrawal without updating an expired action owner', async () => {
    mockGetConfig.mockResolvedValue({ unstakeWithSignMessage: true });
    let current = true;
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({
        ...params,
        isActionCurrent: () => current,
        onSuccess,
      }),
    ).resolves.toBe(true);
    current = false;
    await mockNavigate.mock.calls[0][0].onSuccess?.(submittedData());
    expect(mockAddEarnOrder).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('waits for the Lido typed-data signature before building the withdrawal', async () => {
    const signature = deferred<string>();
    mockGetConfig.mockResolvedValue({ unstakeWithSignMessage: true });
    mockSignMessage.mockReturnValue(signature.promise);
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const operation = result.current(params);
    await waitFor(() => expect(mockSignMessage).toHaveBeenCalledTimes(1));
    expect(mockBuildPermit).toHaveBeenCalledWith({
      ...account,
      amount: params.amount,
      expectedAccountAddress: owner,
    });
    expect(mockSignMessage).toHaveBeenCalledWith({
      ...account,
      request: { origin: 'https://lido.fi/', scope: 'ethereum' },
      unsignedMessage: {
        type: EMessageTypesEth.TYPED_DATA_V4,
        message: 'typed-message',
        payload: [owner, 'typed-message'],
      },
      walletInternalSign: true,
    });
    expect(mockBuildUnstake).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    signature.resolve('signature');
    await expect(operation).resolves.toBe(true);
    expect(mockBuildUnstake).toHaveBeenCalledWith(
      expect.objectContaining({
        ...account,
        amount: params.amount,
        symbol: params.symbol,
        provider: params.provider,
        expectedAccountAddress: owner,
        inputTokenAddress: params.inputTokenAddress,
        outputTokenAddress: params.outputTokenAddress,
        signature: 'signature',
        deadline: 123,
      }),
    );
    expect(mockBuildUnstake.mock.invocationCallOrder[0]).toBeGreaterThan(
      mockSignMessage.mock.invocationCallOrder[0],
    );
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('rejects a Lido withdrawal if the backend account already differs from the form owner', async () => {
    mockGetConfig.mockResolvedValue({ unstakeWithSignMessage: true });
    mockGetAccount.mockResolvedValue({ address: '0xother' });
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({ ...params, taskAccountAddress: owner }),
    ).rejects.toThrow('Task account address changed');
    expect(mockBuildPermit).not.toHaveBeenCalled();
    expect(mockSignMessage).not.toHaveBeenCalled();
    expect(mockBuildUnstake).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not build a Lido withdrawal when typed-data signing fails', async () => {
    mockGetConfig.mockResolvedValue({ unstakeWithSignMessage: true });
    mockSignMessage.mockRejectedValue(new OneKeyLocalError('signing rejected'));
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(result.current(params)).rejects.toThrow('signing rejected');
    expect(mockBuildUnstake).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not build a Lido withdrawal when the action expires while signing', async () => {
    const signature = deferred<string>();
    mockGetConfig.mockResolvedValue({ unstakeWithSignMessage: true });
    mockSignMessage.mockReturnValue(signature.promise);
    let current = true;
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const operation = result.current({
      ...params,
      isActionCurrent: () => current,
    });
    await waitFor(() => expect(mockSignMessage).toHaveBeenCalledTimes(1));
    current = false;
    signature.resolve('signature');
    await expect(operation).resolves.toBe(false);
    expect(mockBuildUnstake).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not build a Lido withdrawal when its signal aborts while signing', async () => {
    const signature = deferred<string>();
    const abort = new AbortController();
    mockGetConfig.mockResolvedValue({ unstakeWithSignMessage: true });
    mockSignMessage.mockReturnValue(signature.promise);
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const operation = result.current({ ...params, signal: abort.signal });
    await waitFor(() => expect(mockSignMessage).toHaveBeenCalledTimes(1));
    abort.abort();
    signature.resolve('signature');
    await expect(operation).resolves.toBe(false);
    expect(mockBuildUnstake).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not start Lido signing when its signal was already aborted', async () => {
    const abort = new AbortController();
    abort.abort();
    mockGetConfig.mockResolvedValue({ unstakeWithSignMessage: true });
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({ ...params, signal: abort.signal }),
    ).resolves.toBe(false);
    expect(mockGetAccount).not.toHaveBeenCalled();
    expect(mockSignMessage).not.toHaveBeenCalled();
  });

  it('removes the Lido abort listener when signing rejects', async () => {
    const abort = new AbortController();
    const addListener = jest.spyOn(abort.signal, 'addEventListener');
    const removeListener = jest.spyOn(abort.signal, 'removeEventListener');
    const failure = new OneKeyLocalError('signing rejected');
    mockGetConfig.mockResolvedValue({ unstakeWithSignMessage: true });
    mockSignMessage.mockRejectedValue(failure);
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({ ...params, signal: abort.signal }),
    ).rejects.toBe(failure);
    const listener = addListener.mock.calls.find(
      ([name]) => name === 'abort',
    )?.[1];
    expect(listener).toBeDefined();
    expect(removeListener).toHaveBeenCalledWith('abort', listener);
  });

  it('does not encode a Lido withdrawal when its signal aborts while building', async () => {
    const pending = deferred<IStakeTxResponse>();
    const abort = new AbortController();
    mockGetConfig.mockResolvedValue({ unstakeWithSignMessage: true });
    mockBuildUnstake.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const operation = result.current({ ...params, signal: abort.signal });
    await waitFor(() => expect(mockBuildUnstake).toHaveBeenCalledTimes(1));
    abort.abort();
    pending.resolve({ tx, orderId: 'order-1' });
    await expect(operation).resolves.toBe(false);
    expect(mockBuildInternal).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not open Lido confirmation when abort occurs during navigation preparation', async () => {
    const pending = deferred<void>();
    const abort = new AbortController();
    let opened = false;
    mockGetConfig.mockResolvedValue({ unstakeWithSignMessage: true });
    mockNavigate.mockImplementation(async ({ isNavigationCurrent }) => {
      await pending.promise;
      if (isNavigationCurrent?.() ?? true) opened = true;
    });
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const operation = result.current({ ...params, signal: abort.signal });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    abort.abort();
    pending.resolve();
    await expect(operation).resolves.toBe(false);
    expect(opened).toBe(false);
  });

  it('removes the Lido abort listener after handoff and records a later confirmation', async () => {
    const abort = new AbortController();
    const removeListener = jest.spyOn(abort.signal, 'removeEventListener');
    mockGetConfig.mockResolvedValue({ unstakeWithSignMessage: true });
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({ ...params, signal: abort.signal }),
    ).resolves.toBe(true);
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
    abort.abort();
    await mockNavigate.mock.calls[0][0].onSuccess?.(submittedData());
    expect(mockAddEarnOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', txId: 'withdraw-tx' }),
    );
  });

  it('does not request a Lido permit when the action expires while resolving the account', async () => {
    const pending = deferred<{ address: string }>();
    mockGetConfig.mockResolvedValue({ unstakeWithSignMessage: true });
    mockGetAccount.mockReturnValue(pending.promise);
    let current = true;
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const operation = result.current({
      ...params,
      isActionCurrent: () => current,
    });
    await waitFor(() => expect(mockGetAccount).toHaveBeenCalledTimes(1));
    current = false;
    pending.resolve({ address: owner });
    await expect(operation).resolves.toBe(false);
    expect(mockBuildPermit).not.toHaveBeenCalled();
    expect(mockSignMessage).not.toHaveBeenCalled();
  });

  it('does not open Lido signing when the action expires while preparing the permit', async () => {
    const pending = deferred<{ message: string; deadline: number }>();
    mockGetConfig.mockResolvedValue({ unstakeWithSignMessage: true });
    mockBuildPermit.mockReturnValue(pending.promise);
    let current = true;
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const operation = result.current({
      ...params,
      isActionCurrent: () => current,
    });
    await waitFor(() => expect(mockBuildPermit).toHaveBeenCalledTimes(1));
    current = false;
    pending.resolve({ message: 'typed-message', deadline: 123 });
    await expect(operation).resolves.toBe(false);
    expect(mockSignMessage).not.toHaveBeenCalled();
    expect(mockBuildUnstake).not.toHaveBeenCalled();
  });

  it('records a late Lido transaction for the original account without updating a stale page', async () => {
    mockGetConfig.mockResolvedValue({ unstakeWithSignMessage: true });
    let current = true;
    const onSuccess = jest.fn();
    const { result, rerender } = renderHook(
      ({ accountId }) =>
        useUniversalWithdraw({ accountId, networkId: account.networkId }),
      { initialProps: { accountId: account.accountId } },
    );
    await expect(
      result.current({
        ...params,
        isActionCurrent: () => current,
        isSendCurrent: () => current,
        isResultCurrent: () => current,
        onSuccess,
      }),
    ).resolves.toBe(true);
    const confirmation = mockNavigate.mock.calls[0][0];
    current = false;
    rerender({ accountId: 'account-2' });
    await confirmation.onSuccess?.(submittedData());
    expect(mockAddEarnOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        networkId: account.networkId,
        txId: 'withdraw-tx',
      }),
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('retains the Lido send guard independently of the form scope', async () => {
    mockGetConfig.mockResolvedValue({ unstakeWithSignMessage: true });
    let formCurrent = true;
    let sendCurrent = true;
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({
        ...params,
        isActionCurrent: () => formCurrent,
        isSendCurrent: () => sendCurrent,
      }),
    ).resolves.toBe(true);
    const confirmation = mockNavigate.mock.calls[0][0];
    formCurrent = false;
    await expect(confirmation.onBeforeSend?.()).resolves.toBeUndefined();
    sendCurrent = false;
    await expect(confirmation.onBeforeSend?.()).rejects.toThrow();
  });

  it('checks the frozen Lido account even when no send scope is supplied', async () => {
    mockGetConfig.mockResolvedValue({ unstakeWithSignMessage: true });
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(result.current(params)).resolves.toBe(true);
    const confirmation = mockNavigate.mock.calls[0][0];
    await expect(confirmation.onBeforeSend?.()).resolves.toBeUndefined();
    mockGetAccount.mockResolvedValue({ address: '0xother' });
    await expect(confirmation.onBeforeSend?.()).rejects.toThrow();
  });

  it('preserves Lido order-recording rejection when no result guard is supplied', async () => {
    mockGetConfig.mockResolvedValue({ unstakeWithSignMessage: true });
    const failure = new OneKeyLocalError('order recording failed');
    mockAddEarnOrder.mockRejectedValue(failure);
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(result.current({ ...params, onSuccess })).resolves.toBe(true);
    await expect(
      mockNavigate.mock.calls[0][0].onSuccess?.(submittedData()),
    ).rejects.toBe(failure);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('rechecks the Lido result guard after recording the original order', async () => {
    mockGetConfig.mockResolvedValue({ unstakeWithSignMessage: true });
    const pending = deferred<void>();
    mockAddEarnOrder.mockReturnValue(pending.promise);
    let resultCurrent = true;
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({
        ...params,
        isResultCurrent: () => resultCurrent,
        onSuccess,
      }),
    ).resolves.toBe(true);
    const confirmation =
      mockNavigate.mock.calls[0][0].onSuccess?.(submittedData());
    await waitFor(() => expect(mockAddEarnOrder).toHaveBeenCalledTimes(1));
    resultCurrent = false;
    pending.resolve();
    await confirmation;
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('propagates Lido build errors even when its action scope expires during the request', async () => {
    mockGetConfig.mockResolvedValue({ unstakeWithSignMessage: true });
    const pending = deferred<IStakeTxResponse>();
    mockBuildUnstake.mockReturnValue(pending.promise);
    let current = true;
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const operation = result.current({
      ...params,
      isActionCurrent: () => current,
    });
    await waitFor(() => expect(mockBuildUnstake).toHaveBeenCalledTimes(1));
    current = false;
    const error = new OneKeyLocalError('Lido build failed');
    pending.reject(error);
    await expect(operation).rejects.toBe(error);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'preserves Lido confirmation preparation failure with onFail=%s',
    async (hasOnFail) => {
      mockGetConfig.mockResolvedValue({ unstakeWithSignMessage: true });
      const failure = new OneKeyLocalError('confirmation failed');
      const onFail = jest.fn();
      mockNavigate.mockImplementation(async ({ onFail: callback }) => {
        if (callback) callback(failure);
        else throw failure;
      });
      const { result } = renderHook(() => useUniversalWithdraw(account));
      const operation = result.current({
        ...params,
        onFail: hasOnFail ? onFail : undefined,
      });
      if (hasOnFail) {
        await expect(operation).resolves.toBe(true);
        expect(onFail).toHaveBeenCalledWith(failure);
      } else await expect(operation).rejects.toBe(failure);
    },
  );

  it('routes to sign-only when both configuration flags are set', async () => {
    mockGetConfig.mockResolvedValue({
      unstakeWithSignMessage: true,
      withdrawSignOnly: true,
    });
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({ ...params, identity: 'request-1' }),
    ).resolves.toBe(true);
    const confirmation = mockNavigate.mock.calls[0][0];
    expect(confirmation.signOnly).toBe(true);
    await confirmation.onSuccess?.(submittedData('signed-psbt'));
    expect(mockUnstakePush).toHaveBeenCalledWith(
      expect.objectContaining({
        txId: 'request-1',
        unstakeTxHex: 'signed-psbt',
      }),
    );
  });

  it('rejects a Stakefish external exit if the displayed account has changed', async () => {
    mockGetAccount.mockResolvedValue({ address: '0xother' });
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({
        ...params,
        provider: 'stakefish',
        withdrawAll: true,
        identity: 'validator',
        taskAccountAddress: owner,
      }),
    ).rejects.toThrow('Task account changed before withdrawal');
    expect(mockBuildUnstake).not.toHaveBeenCalled();
  });

  it.each(['cancel', 'fail'] as const)(
    'records a Stakefish withdrawal after %s without notifying the closed page',
    async (outcome) => {
      const onSuccess = jest.fn();
      const { result } = renderHook(() => useUniversalWithdraw(account));
      await result.current({ ...params, provider: 'stakefish', onSuccess });
      const confirmation = mockNavigate.mock.calls[0][0];
      await confirmation.onBeforeSend?.();
      if (outcome === 'cancel') confirmation.onCancel?.();
      else confirmation.onConfirmationFail?.(new Error('uncertain'));
      await confirmation.onSuccess?.(submittedData());
      expect(mockAddEarnOrder).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'order-1', txId: 'withdraw-tx' }),
        { remoteSync: 'once', preserveExistingTx: true },
      );
      expect(onSuccess).not.toHaveBeenCalled();
    },
  );

  it('reports a Stakefish exit broadcast without building or opening a local transaction', async () => {
    mockBuildUnstake.mockResolvedValue({
      tx: { exitBroadcasted: true, validators: [] },
    });
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({ ...params, provider: 'stakefish', onSuccess }),
    ).resolves.toBe(true);
    expect(mockBuildUnstake).toHaveBeenCalledTimes(1);
    expect(mockBuildInternal).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockAddEarnOrder).not.toHaveBeenCalled();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith([]));
    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
  });

  it('does not report a Stakefish result after its action expires', async () => {
    const pending = deferred<IStakeTxResponse>();
    mockBuildUnstake.mockReturnValue(pending.promise);
    const onSuccess = jest.fn();
    let current = true;
    const { result } = renderHook(() => useUniversalWithdraw(account));
    const operation = result.current({
      ...params,
      provider: 'stakefish',
      identity: 'validator-stale',
      withdrawAll: true,
      isActionCurrent: () => current,
      onSuccess,
    });
    await waitFor(() => expect(mockBuildUnstake).toHaveBeenCalledTimes(1));
    current = false;
    pending.resolve({ tx: { exitBroadcasted: true, validators: [] } });
    await expect(operation).resolves.toBe(false);
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockBuildUnstake).toHaveBeenCalledTimes(1);
  });

  it('propagates an uncertain Stakefish request failure without an automatic retry', async () => {
    const error = new OneKeyLocalError('response lost');
    mockBuildUnstake.mockRejectedValueOnce(error);
    const { result } = renderHook(() => useUniversalWithdraw(account));
    await expect(
      result.current({
        ...params,
        provider: 'stakefish',
        identity: 'validator-transport',
        withdrawAll: true,
      }),
    ).rejects.toBe(error);
    expect(mockBuildUnstake).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('pushes a signed Babylon PSBT only after sign-only confirmation', async () => {
    mockGetConfig.mockResolvedValue({ withdrawSignOnly: true });
    const btcAccount = { accountId: 'btc-account', networkId: 'btc--0' };
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalWithdraw(btcAccount));
    await expect(
      result.current({
        ...params,
        symbol: 'BTC',
        provider: 'babylon',
        identity: 'request-1',
        onSuccess,
      }),
    ).resolves.toBe(true);
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ signOnly: true }),
    );
    expect(mockUnstakePush).not.toHaveBeenCalled();
    const data = submittedData('signed-psbt', btcAccount);
    await mockNavigate.mock.calls[0][0].onSuccess?.(data);
    expect(mockUnstakePush).toHaveBeenCalledWith({
      ...btcAccount,
      txId: 'request-1',
      symbol: 'BTC',
      provider: 'babylon',
      unstakeTxHex: 'signed-psbt',
      expectedAccountAddress: owner,
    });
    expect(mockAddEarnOrder).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(data);
    expect(mockUnstakePush.mock.invocationCallOrder[0]).toBeLessThan(
      onSuccess.mock.invocationCallOrder[0],
    );
  });

  it('reports a Babylon push failure even when confirmation does not await its callback', async () => {
    mockGetConfig.mockResolvedValue({ withdrawSignOnly: true });
    const btcAccount = { accountId: 'btc-account', networkId: 'btc--0' };
    const failure = new OneKeyLocalError('Task account address changed');
    mockUnstakePush.mockRejectedValueOnce(failure);
    const { result } = renderHook(() => useUniversalWithdraw(btcAccount));
    await expect(
      result.current({
        ...params,
        symbol: 'BTC',
        provider: 'babylon',
        identity: 'request-1',
      }),
    ).resolves.toBe(true);
    void mockNavigate.mock.calls[0][0].onSuccess?.(
      submittedData('signed-psbt', btcAccount),
    );
    await waitFor(() => expect(mockShowError).toHaveBeenCalledWith(failure));
    expect(mockUnstakePush).toHaveBeenCalledTimes(1);
  });

  it('pushes a late Babylon signature once after the original page aborts without updating it', async () => {
    mockGetConfig.mockResolvedValue({ withdrawSignOnly: true });
    const btcAccount = { accountId: 'btc-account', networkId: 'btc--0' };
    const abort = new AbortController();
    const onSuccess = jest.fn();
    const pending = deferred<void>();
    mockUnstakePush.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useUniversalWithdraw(btcAccount));
    await expect(
      result.current({
        ...params,
        symbol: 'BTC',
        provider: 'babylon',
        identity: 'request-1',
        signal: abort.signal,
        onSuccess,
      }),
    ).resolves.toBe(true);
    const confirmation = mockNavigate.mock.calls[0][0];
    abort.abort();
    const data = submittedData('signed-psbt', btcAccount);
    const first = confirmation.onSuccess?.(data);
    const duplicate = confirmation.onSuccess?.(data);
    await waitFor(() => expect(mockUnstakePush).toHaveBeenCalledTimes(1));
    pending.resolve();
    await Promise.all([first, duplicate]);
    expect(mockUnstakePush).toHaveBeenCalledWith(
      expect.objectContaining({
        ...btcAccount,
        txId: 'request-1',
        unstakeTxHex: 'signed-psbt',
      }),
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('does not push Babylon PSBT from a different account', async () => {
    mockGetConfig.mockResolvedValue({ withdrawSignOnly: true });
    const btcAccount = { accountId: 'btc-account', networkId: 'btc--0' };
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalWithdraw(btcAccount));
    await expect(
      result.current({
        ...params,
        symbol: 'BTC',
        provider: 'babylon',
        identity: 'request-1',
        onSuccess,
      }),
    ).resolves.toBe(true);
    const data = submittedData('signed-psbt', {
      ...btcAccount,
      accountId: 'different-account',
    });
    await mockNavigate.mock.calls[0][0].onSuccess?.(data);
    expect(mockUnstakePush).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('does not update an expired Babylon action when only the action guard is supplied', async () => {
    mockGetConfig.mockResolvedValue({ withdrawSignOnly: true });
    const btcAccount = { accountId: 'btc-account', networkId: 'btc--0' };
    const abort = new AbortController();
    let current = true;
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalWithdraw(btcAccount));
    await expect(
      result.current({
        ...params,
        symbol: 'BTC',
        provider: 'babylon',
        identity: 'request-1',
        signal: abort.signal,
        isActionCurrent: () => current,
        onSuccess,
      }),
    ).resolves.toBe(true);
    current = false;
    await mockNavigate.mock.calls[0][0].onSuccess?.(
      submittedData('signed-psbt', btcAccount),
    );
    expect(mockUnstakePush).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('keeps non-Babylon sign-only withdrawals on the existing path', async () => {
    mockGetConfig.mockResolvedValue({ withdrawSignOnly: true });
    const btcAccount = { accountId: 'btc-account', networkId: 'btc--0' };
    const { result } = renderHook(() => useUniversalWithdraw(btcAccount));
    await expect(
      result.current({
        ...params,
        symbol: 'BTC',
        provider: 'other',
        identity: 'request-1',
      }),
    ).resolves.toBe(true);
    expect(mockNavigate.mock.calls[0][0].signOnly).toBe(true);
    await mockNavigate.mock.calls[0][0].onSuccess?.(
      submittedData('signed-psbt', btcAccount),
    );
    expect(mockUnstakePush).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'other',
        txId: 'request-1',
        unstakeTxHex: 'signed-psbt',
      }),
    );
  });

  it.each([
    { identity: '', finalizedPsbtHex: 'signed-psbt' },
    { identity: 'request-1', finalizedPsbtHex: undefined },
  ])(
    'does not push without both a Babylon request and signed PSBT: %p',
    async ({ identity, finalizedPsbtHex }) => {
      mockGetConfig.mockResolvedValue({ withdrawSignOnly: true });
      const btcAccount = { accountId: 'btc-account', networkId: 'btc--0' };
      const onSuccess = jest.fn();
      const { result } = renderHook(() => useUniversalWithdraw(btcAccount));
      await expect(
        result.current({
          ...params,
          symbol: 'BTC',
          provider: 'babylon',
          identity,
          onSuccess,
        }),
      ).resolves.toBe(true);
      await mockNavigate.mock.calls[0][0].onSuccess?.(
        submittedData(finalizedPsbtHex, btcAccount),
      );
      expect(mockUnstakePush).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    },
  );
});

describe('useUniversalClaim existing transaction behavior', () => {
  const claim = {
    amount: '0',
    symbol: 'ETH',
    provider: 'lido',
    vault: 'claim-vault',
    identity: 'request-1',
    claimTokenAddress: 'reward-token',
    stakingInfo: params.stakingInfo,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    mockRiskAccepted.mockResolvedValue(true);
    mockBuildClaim.mockResolvedValue({ tx, orderId: 'claim-order' });
    mockBuildInternal.mockResolvedValue(tx);
    mockNavigate.mockResolvedValue(undefined);
    mockAddEarnOrder.mockResolvedValue(undefined);
    mockGetAccount.mockResolvedValue({ address: owner });
    mockEstimateFee.mockResolvedValue({
      token: { price: '1' },
      feeFiatValue: '3',
    });
  });

  it('rejects a claim when the backend account differs from the displayed address', async () => {
    mockGetAccount.mockResolvedValue({ address: '0xother' });
    const { result } = renderHook(() => useUniversalClaim(account));
    await expect(
      result.current({ ...claim, taskAccountAddress: owner }),
    ).rejects.toThrow('Claim account changed');
    expect(mockBuildClaim).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('rechecks the claim account before sending after confirmation opens', async () => {
    const { result } = renderHook(() => useUniversalClaim(account));
    await expect(
      result.current({ ...claim, taskAccountAddress: owner }),
    ).resolves.toBe(true);
    expect(mockBuildClaim).toHaveBeenCalledWith(
      expect.objectContaining({ expectedAccountAddress: owner }),
    );
    mockGetAccount.mockResolvedValue({ address: '0xother' });
    await expect(
      Promise.resolve().then(() =>
        mockNavigate.mock.calls[0][0].onBeforeSend?.(),
      ),
    ).rejects.toThrow('Claim account changed');
  });

  it('allows a claim confirmation retry after a transient pre-send account error', async () => {
    const onSuccess = jest.fn();
    const onSubmitted = jest.fn();
    const { result } = renderHook(() => useUniversalClaim(account));
    await result.current({ ...claim, onSuccess, onSubmitted });
    const confirmation = mockNavigate.mock.calls[0][0];
    const error = new Error('account temporarily unavailable');
    mockGetAccount.mockRejectedValueOnce(error);
    await expect(confirmation.onBeforeSend?.()).rejects.toBe(error);
    confirmation.onSafePreSendFail?.(error);
    await expect(confirmation.onBeforeSend?.()).resolves.toBeUndefined();
    await confirmation.onSuccess?.(submittedData());
    await waitFor(() =>
      expect(onSubmitted).toHaveBeenCalledWith('withdraw-tx', owner),
    );
    expect(mockAddEarnOrder).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('allows claim retry after the confirmation precheck fails before any send', async () => {
    const onSubmitted = jest.fn();
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalClaim(account));
    await result.current({ ...claim, onSubmitted, onSuccess });
    const confirmation = mockNavigate.mock.calls[0][0];
    confirmation.onSafePreSendFail?.(new Error('precheck unavailable'));
    await confirmation.onBeforeSend?.();
    await confirmation.onSuccess?.(submittedData());
    await waitFor(() =>
      expect(onSubmitted).toHaveBeenCalledWith('withdraw-tx', owner),
    );
    expect(mockAddEarnOrder).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('does not start a claim when the risk gate is rejected', async () => {
    mockRiskAccepted.mockResolvedValue(false);
    const { result } = renderHook(() => useUniversalClaim(account));
    await expect(result.current(claim)).resolves.toBe(false);
    expect(mockBuildClaim).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('keeps zero-amount claims and records the order after navigation returns', async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalClaim(account));
    await expect(result.current({ ...claim, onSuccess })).resolves.toBe(true);
    expect(mockBuildClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        ...account,
        amount: '0',
        provider: claim.provider,
        symbol: claim.symbol,
        identity: claim.identity,
        claimTokenAddress: claim.claimTokenAddress,
        vault: claim.vault,
      }),
    );
    expect(mockAddEarnOrder).not.toHaveBeenCalled();
    await mockNavigate.mock.calls[0][0].onSuccess?.(submittedData());
    expect(mockAddEarnOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'claim-order', txId: 'withdraw-tx' }),
    );
    expect(onSuccess).toHaveBeenCalledWith(submittedData());
    expect(mockAddEarnOrder.mock.invocationCallOrder[0]).toBeLessThan(
      onSuccess.mock.invocationCallOrder[0],
    );
  });

  it('hands off high-fee confirmation and builds only after the user confirms', async () => {
    const { result } = renderHook(() => useUniversalClaim(account));
    await expect(result.current({ ...claim, amount: '1.25' })).resolves.toBe(
      true,
    );
    expect(mockEstimateFee).toHaveBeenCalledWith(
      expect.objectContaining({
        networkId: account.networkId,
        provider: claim.provider,
        symbol: claim.symbol,
        action: 'claim',
        amount: '1.25',
        identity: claim.identity,
        accountAddress: owner,
      }),
    );
    expect(mockShowClaimAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        claimTokenFiatValue: '1.25',
        estFiatValue: '3',
      }),
    );
    expect(mockBuildClaim).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    await expect(
      mockShowClaimAlert.mock.calls[0][0].onConfirm(),
    ).resolves.toBeUndefined();
    expect(mockBuildClaim).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('keeps the displayed claim account bound while the high-fee dialog is open', async () => {
    let backendAddress = owner;
    mockBuildClaim.mockImplementation(async (request) => {
      if (
        request &&
        typeof request === 'object' &&
        'expectedAccountAddress' in request &&
        request.expectedAccountAddress !== backendAddress
      )
        throw new OneKeyLocalError('Claim account changed');
      return { tx, orderId: 'claim-order' };
    });
    const { result } = renderHook(() => useUniversalClaim(account));
    await expect(
      result.current({ ...claim, amount: '1.25', taskAccountAddress: owner }),
    ).resolves.toBe(true);
    backendAddress = '0xother';
    await expect(
      mockShowClaimAlert.mock.calls[0][0].onConfirm(),
    ).rejects.toThrow('Claim account changed');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not build a high-fee claim when the alert is dismissed', async () => {
    const { result } = renderHook(() => useUniversalClaim(account));
    await expect(result.current({ ...claim, amount: '1.25' })).resolves.toBe(
      true,
    );
    expect(mockShowClaimAlert).toHaveBeenCalledTimes(1);
    expect(mockBuildClaim).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not start a high-fee claim from an alert after its owner unmounts', async () => {
    const { result, unmount } = renderHook(() => useUniversalClaim(account));
    await expect(result.current({ ...claim, amount: '1.25' })).resolves.toBe(
      true,
    );
    const confirm = mockShowClaimAlert.mock.calls[0][0].onConfirm;
    unmount();
    await confirm();
    expect(mockBuildClaim).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not start a high-fee claim after its account changes', async () => {
    const { result, rerender } = renderHook(
      ({ accountId }: { accountId: string }) =>
        useUniversalClaim({ accountId, networkId: account.networkId }),
      { initialProps: { accountId: account.accountId } },
    );
    await expect(result.current({ ...claim, amount: '1.25' })).resolves.toBe(
      true,
    );
    const confirm = mockShowClaimAlert.mock.calls[0][0].onConfirm;
    rerender({ accountId: 'account-2' });
    await confirm();
    expect(mockBuildClaim).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not encode or open a claim if the account changes while the claim is building', async () => {
    const pending = deferred<IStakeTxResponse>();
    mockBuildClaim.mockReturnValueOnce(pending.promise);
    const { result, rerender } = renderHook(
      ({ accountId }: { accountId: string }) =>
        useUniversalClaim({ accountId, networkId: account.networkId }),
      { initialProps: { accountId: account.accountId } },
    );
    const operation = result.current(claim);
    await waitFor(() => expect(mockBuildClaim).toHaveBeenCalledTimes(1));
    rerender({ accountId: 'account-2' });
    pending.resolve({ tx, orderId: 'claim-order' });
    await expect(operation).resolves.toBe(false);
    expect(mockBuildInternal).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not surface a stale claim build failure after the account changes', async () => {
    const pending = deferred<IStakeTxResponse>();
    mockBuildClaim.mockReturnValueOnce(pending.promise);
    const { result, rerender } = renderHook(
      ({ accountId }: { accountId: string }) =>
        useUniversalClaim({ accountId, networkId: account.networkId }),
      { initialProps: { accountId: account.accountId } },
    );
    const operation = result.current(claim);
    await waitFor(() => expect(mockBuildClaim).toHaveBeenCalledTimes(1));
    rerender({ accountId: 'account-2' });
    pending.reject(new Error('old account failed'));
    await expect(operation).resolves.toBe(false);
    expect(mockBuildInternal).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'reject'] as const)(
    'silently cancels a stale internal claim transaction when it later %ss',
    async (outcome) => {
      const pending = deferred<IEncodedTx>();
      mockBuildInternal.mockReturnValueOnce(pending.promise);
      const { result, rerender } = renderHook(
        ({ accountId }: { accountId: string }) =>
          useUniversalClaim({ accountId, networkId: account.networkId }),
        { initialProps: { accountId: account.accountId } },
      );
      const operation = result.current(claim);
      await waitFor(() => expect(mockBuildInternal).toHaveBeenCalledTimes(1));
      rerender({ accountId: 'account-2' });
      if (outcome === 'resolve') pending.resolve(tx);
      else pending.reject(new Error('old account encoding failed'));
      await expect(operation).resolves.toBe(false);
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
    },
  );

  it('propagates a current internal claim transaction build failure', async () => {
    const error = new Error('claim encoding failed');
    mockBuildInternal.mockRejectedValueOnce(error);
    const { result } = renderHook(() => useUniversalClaim(account));
    await expect(result.current(claim)).rejects.toBe(error);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('propagates claim build errors before opening confirmation', async () => {
    const error = new Error('claim build failed');
    mockBuildClaim.mockRejectedValueOnce(error);
    const { result } = renderHook(() => useUniversalClaim(account));
    await expect(result.current(claim)).rejects.toBe(error);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('propagates a high-fee claim build error from the later alert confirmation', async () => {
    const error = new Error('late claim build failed');
    mockBuildClaim.mockRejectedValueOnce(error);
    const { result } = renderHook(() => useUniversalClaim(account));
    await expect(result.current({ ...claim, amount: '1.25' })).resolves.toBe(
      true,
    );
    await expect(mockShowClaimAlert.mock.calls[0][0].onConfirm()).rejects.toBe(
      error,
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('propagates navigation preparation errors without a failure callback', async () => {
    const error = new Error('unsigned preparation failed');
    mockNavigate.mockRejectedValueOnce(error);
    const { result } = renderHook(() => useUniversalClaim(account));
    await expect(result.current(claim)).rejects.toBe(error);
  });

  it('keeps the original callback and return when navigation reports an error', async () => {
    const error = new Error('unsigned preparation failed');
    const onFail = jest.fn();
    mockNavigate.mockImplementationOnce(async ({ onFail: fail }) =>
      fail?.(error),
    );
    const { result } = renderHook(() => useUniversalClaim(account));
    await expect(result.current({ ...claim, onFail })).resolves.toBe(true);
    expect(onFail).toHaveBeenCalledWith(error);
  });

  it('keeps each Babylon confirmation bound to its own public key snapshot', async () => {
    mockBuildClaim
      .mockResolvedValueOnce({
        tx,
        orderId: 'first',
        claimOwnerPublicKey: '02first',
      })
      .mockResolvedValueOnce({
        tx,
        orderId: 'second',
        claimOwnerPublicKey: '02second',
      });
    const onSubmitted = jest.fn();
    const { result } = renderHook(() => useUniversalClaim(account));
    await result.current({
      ...claim,
      amount: '1',
      provider: 'babylon',
      onSubmitted,
    });
    const confirm = mockShowClaimAlert.mock.calls[0][0].onConfirm;
    await confirm();
    await confirm();
    expect(mockNavigate).toHaveBeenCalledTimes(2);
    await mockNavigate.mock.calls[0][0].onSuccess?.(submittedData());
    await waitFor(() =>
      expect(onSubmitted).toHaveBeenCalledWith('withdraw-tx', owner, '02first'),
    );
  });

  it('retains the Babylon public key from construction for a late submitted fact', async () => {
    mockBuildClaim.mockResolvedValueOnce({
      tx,
      orderId: 'claim-order',
      claimOwnerPublicKey: '02abcd',
    });
    const onSubmitted = jest.fn();
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalClaim(account));
    await result.current({
      ...claim,
      provider: 'babylon',
      onSubmitted,
      onSuccess,
    });
    const confirmation = mockNavigate.mock.calls[0][0];
    await confirmation.onBeforeSend?.();
    confirmation.onCancel?.();
    await confirmation.onSuccess?.(submittedData());
    await waitFor(() =>
      expect(onSubmitted).toHaveBeenCalledWith('withdraw-tx', owner, '02abcd'),
    );
    expect(onSubmitted).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('uses the frozen Babylon key once for a verified late broadcast', async () => {
    mockBuildClaim.mockResolvedValueOnce({
      tx,
      orderId: 'claim-order',
      claimOwnerPublicKey: '02abcd',
    });
    const onSubmitted = jest.fn();
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalClaim(account));
    await result.current({
      ...claim,
      provider: 'babylon',
      onSubmitted,
      onSuccess,
    });
    const confirmation = mockNavigate.mock.calls[0][0];
    await confirmation.onBeforeSend?.();
    confirmation.onCancel?.();
    await confirmation.onLateBroadcastAccepted?.({
      uuid: 'request',
      ...account,
      txid: 'late-claim',
    });
    await confirmation.onLateBroadcastAccepted?.({
      uuid: 'request',
      ...account,
      txid: 'late-claim',
    });
    await waitFor(() =>
      expect(onSubmitted).toHaveBeenCalledWith('late-claim', owner, '02abcd'),
    );
    expect(onSubmitted).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('records a late claim fact without updating an unmounted owner', async () => {
    const onSuccess = jest.fn();
    const onSubmitted = jest.fn();
    const { result, unmount } = renderHook(() => useUniversalClaim(account));
    await expect(
      result.current({ ...claim, onSuccess, onSubmitted }),
    ).resolves.toBe(true);
    const confirmation = mockNavigate.mock.calls[0][0];
    unmount();
    await confirmation.onSuccess?.(submittedData());
    expect(mockAddEarnOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'claim-order', txId: 'withdraw-tx' }),
      { remoteSync: 'once', preserveExistingTx: true },
    );
    await waitFor(() =>
      expect(onSubmitted).toHaveBeenCalledWith('withdraw-tx', owner),
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it.each(['cancel', 'fail'] as const)(
    'records a claim after %s without notifying the old confirmation',
    async (outcome) => {
      const onSubmitted = jest.fn();
      const onSuccess = jest.fn();
      const { result } = renderHook(() => useUniversalClaim(account));
      await result.current({ ...claim, onSubmitted, onSuccess });
      const confirmation = mockNavigate.mock.calls[0][0];
      await confirmation.onBeforeSend?.();
      if (outcome === 'cancel') confirmation.onCancel?.();
      else confirmation.onConfirmationFail?.(new Error('uncertain'));
      await confirmation.onSuccess?.(submittedData());
      await waitFor(() =>
        expect(onSubmitted).toHaveBeenCalledWith('withdraw-tx', owner),
      );
      expect(mockAddEarnOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'claim-order',
          txId: 'withdraw-tx',
        }),
        { remoteSync: 'once', preserveExistingTx: true },
      );
      expect(onSuccess).not.toHaveBeenCalled();
    },
  );

  it('records the submitted claim before a delayed account recheck resolves', async () => {
    const onSuccess = jest.fn();
    const address = deferred<{ address: string }>();
    const { result } = renderHook(() => useUniversalClaim(account));
    await result.current({ ...claim, onSuccess });
    mockGetAccount.mockReturnValueOnce(address.promise);
    const pending = mockNavigate.mock.calls[0][0].onSuccess?.(submittedData());
    await waitFor(() => expect(mockAddEarnOrder).toHaveBeenCalledTimes(1));
    expect(onSuccess).not.toHaveBeenCalled();
    address.resolve({ address: owner });
    await pending;
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('waits for claim submission tracking before notifying the current page', async () => {
    const tracking = deferred<void>();
    const onSuccess = jest.fn();
    const onSubmitted = jest.fn(() => tracking.promise);
    const { result } = renderHook(() => useUniversalClaim(account));
    await result.current({ ...claim, onSuccess, onSubmitted });
    const pending = mockNavigate.mock.calls[0][0].onSuccess?.(submittedData());
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(onSuccess).not.toHaveBeenCalled();
    tracking.resolve();
    await pending;
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('does not notify a claim owner whose address changes while tracking is pending', async () => {
    const tracking = deferred<void>();
    const onSuccess = jest.fn();
    const onSubmitted = jest.fn(() => tracking.promise);
    const { result } = renderHook(() => useUniversalClaim(account));
    await result.current({ ...claim, onSuccess, onSubmitted });
    const before = mockGetAccount.mock.calls.length;
    const pending = mockNavigate.mock.calls[0][0].onSuccess?.(submittedData());
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mockGetAccount.mock.calls.length).toBeGreaterThanOrEqual(
        before + 2,
      ),
    );
    mockGetAccount.mockResolvedValue({ address: '0xother' });
    tracking.resolve();
    await pending;
    expect(onSuccess).not.toHaveBeenCalled();
    expect(mockAddEarnOrder).toHaveBeenCalledTimes(1);
  });

  it('does not notify an earlier claim after a newer claim starts', async () => {
    const tracking = deferred<void>();
    const oldSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalClaim(account));
    await result.current({
      ...claim,
      onSuccess: oldSuccess,
      onSubmitted: () => tracking.promise,
    });
    const pending = mockNavigate.mock.calls[0][0].onSuccess?.(submittedData());
    await waitFor(() => expect(mockAddEarnOrder).toHaveBeenCalledTimes(1));
    await result.current({ ...claim, identity: 'new-request' });
    tracking.resolve();
    await pending;
    expect(oldSuccess).not.toHaveBeenCalled();
  });

  it('preserves the fixed fee parameters of a BTC claim', async () => {
    mockBuildInternal.mockResolvedValueOnce({
      ...tx,
      fee: '100',
    } as IEncodedTx);
    const { result } = renderHook(() =>
      useUniversalClaim({ ...account, networkId: getNetworkIdsMap().btc }),
    );
    await expect(result.current({ ...claim, symbol: 'BTC' })).resolves.toBe(
      true,
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        useFeeInTx: true,
        feeInfoEditable: false,
      }),
    );
  });

  it.each([false, true])(
    'preserves claim failure handling (onFail present=%s)',
    async (hasOnFail) => {
      const onFail = jest.fn();
      const error = new Error('confirmation failed');
      const { result } = renderHook(() => useUniversalClaim(account));
      await expect(
        result.current({ ...claim, onFail: hasOnFail ? onFail : undefined }),
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
});
