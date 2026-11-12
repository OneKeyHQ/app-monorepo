/** @jest-environment jsdom */

import { waitFor } from '@testing-library/react';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { createEarnWithdrawApprovalTask } from '../../tasks/earnWithdrawApprovalTask';
import { createEarnWorkflowTaskController } from '../../tasks/earnWorkflowTaskController';
import { createEarnWorkflowTask } from '../../tasks/earnWorkflowTaskState';
import { createLateEarnOrderRecorder } from '../../tasks/lateEarnOrderRecorder';

import { getEthenaWithdrawSteps } from './withdrawPlan';
import {
  createEthenaWithdrawAdapters,
  createEthenaWithdrawFragment,
  runEthenaWithdrawTask,
} from './withdrawTask';

jest.mock('../../tasks/lateEarnOrderRecorder', () => ({
  createLateEarnOrderRecorder: jest.fn(() => jest.fn(async () => 'synced')),
}));

describe('Ethena withdrawal workflow plan', () => {
  const identity = {
    accountId: 'account',
    accountAddress: '0xowner',
    networkId: 'evm--1',
    provider: 'pendle',
    action: 'withdraw' as const,
  };

  it('composes approval and the existing swap, settlement, and withdrawal as one task', () => {
    const task = createEarnWorkflowTask({
      taskId: 'withdraw-task',
      identity,
      steps: [
        { id: 'approve', kind: 'approve', lateSubmitted: 'unknown' },
        { id: 'allowance', kind: 'wait' },
        ...getEthenaWithdrawSteps(false),
      ],
    });
    expect(task.taskId).toBe('withdraw-task');
    expect(task.steps.map(({ id, kind }) => ({ id, kind }))).toEqual([
      { id: 'approve', kind: 'approve' },
      { id: 'allowance', kind: 'wait' },
      { id: 'swap', kind: 'swap' },
      { id: 'settlement', kind: 'wait' },
      { id: 'unstake', kind: 'protocol' },
    ]);
    expect(task.steps[0].status.type).toBe('ready');
    expect(
      task.steps.slice(1).every(({ status }) => status.type === 'waiting'),
    ).toBe(true);
  });

  it.each(['swap-tx', ''])(
    'runs approval, swap, settlement and withdrawal with swap txid %p',
    async (swapTxid) => {
      type INavigateParams = Parameters<
        ReturnType<typeof useSignatureConfirm>['navigationToTxConfirm']
      >[0];
      const confirmations: INavigateParams[] = [];
      const prepare = jest.fn(async () => ({
        encodedTx: {
          from: '0xowner',
          to: '0xtarget',
          value: '0x0',
          data: '0x',
        },
      }));
      const submitted = jest.fn(
        async (_stage: 'swap' | 'unstake') => undefined,
      );
      const waitForSwap = jest.fn(async () => true);
      const fragment = createEthenaWithdrawFragment({
        identity,
        resumeUnstake: false,
        prepare,
        navigate: async (params) => {
          confirmations.push(params);
        },
        onSubmitted: submitted,
        waitForSwap,
        onUnknownSwap: jest.fn(),
        onSwapSend: jest.fn(),
        onObserverError: jest.fn(),
      });
      const task = createEarnWorkflowTask({
        taskId: 'shared-withdraw',
        identity,
        steps: [
          { id: 'approve', kind: 'approve', lateSubmitted: 'unknown' },
          { id: 'allowance', kind: 'wait' },
          ...fragment.steps,
        ],
      });
      const controller = createEarnWorkflowTaskController<
        typeof identity,
        { swapTxid?: string },
        { encodedTx: IEncodedTx; stakeInfo?: IStakingInfo }
      >({
        task,
        initialContext: {},
        isCurrent: () => true,
        expiredMessage: 'expired',
        onAsyncError: jest.fn(),
        getAdapter: (step, context) => {
          if (step.id === 'approve')
            return {
              kind: 'transaction',
              handoffOnSubmit: false,
              adapter: {
                prepare: async () => ({
                  type: 'confirm',
                  prepared: {
                    encodedTx: {
                      from: '0xowner',
                      to: '0xspender',
                      value: '0x0',
                      data: '0x',
                    },
                  },
                }),
                confirm: async ({ onBeforeSend, onSubmitted }) => {
                  onBeforeSend();
                  onSubmitted('approval-tx');
                  return { type: 'submitted' };
                },
                waitForFinalStatus: async () => 'success',
                verify: async () => true,
              },
            };
          if (step.id === 'allowance')
            return {
              kind: 'wait',
              run: async () => ({ type: 'completed', context }),
            };
          return fragment.getAdapter(step, context);
        },
      });
      const submittedTx = (txid: string): ISendTxOnSuccessData[] => [
        {
          signedTx: { txid, rawTx: '0x', encodedTx: null },
          decodedTx: {
            accountId: identity.accountId,
            networkId: identity.networkId,
            txid,
            status: EDecodedTxStatus.Pending,
            owner: identity.accountAddress,
            signer: identity.accountAddress,
            nonce: 0,
            actions: [],
            extraInfo: null,
          },
        },
      ];
      await controller.run();
      await waitFor(() => expect(confirmations).toHaveLength(1));
      await confirmations[0].onBeforeSend?.();
      await Promise.resolve(
        confirmations[0].onSuccess?.(submittedTx(swapTxid)),
      );
      await waitFor(() => expect(confirmations).toHaveLength(2));
      expect(waitForSwap).toHaveBeenCalledWith(swapTxid || undefined);
      await confirmations[1].onBeforeSend?.();
      await Promise.resolve(
        confirmations[1].onSuccess?.(submittedTx('unstake-tx')),
      );
      await expect(fragment.result).resolves.toBe(true);
      expect(submitted.mock.calls.map(([stage]) => stage)).toEqual([
        'swap',
        'unstake',
      ]);
      expect(controller.getTask().taskId).toBe('shared-withdraw');
      expect(controller.getTask().steps.map(({ id }) => id)).toEqual([
        'approve',
        'allowance',
        'swap',
        'settlement',
        'unstake',
      ]);
    },
  );

  it('does not continue an empty-txid swap after cancellation', async () => {
    type INavigateParams = Parameters<
      ReturnType<typeof useSignatureConfirm>['navigationToTxConfirm']
    >[0];
    const confirmations: INavigateParams[] = [];
    let finishSubmitted: () => void = () => undefined;
    const submitted = new Promise<void>((resolve) => {
      finishSubmitted = resolve;
    });
    const abort = new AbortController();
    const waitForSwap = jest.fn(async () => true);
    const result = runEthenaWithdrawTask({
      taskId: 'cancelled-withdraw',
      identity,
      resumeUnstake: false,
      signal: abort.signal,
      prepare: async () => ({
        encodedTx: {
          from: '0xowner',
          to: '0xtarget',
          value: '0x0',
          data: '0x',
        },
      }),
      navigate: async (params) => {
        confirmations.push(params);
      },
      onSubmitted: async () => submitted,
      waitForSwap,
      onUnknownSwap: jest.fn(),
      onSwapSend: jest.fn(),
      onObserverError: jest.fn(),
    });
    await waitFor(() => expect(confirmations).toHaveLength(1));
    await confirmations[0].onBeforeSend?.();
    const callback = confirmations[0].onSuccess?.([]);
    abort.abort();
    finishSubmitted();
    await Promise.resolve(callback);
    await expect(result).resolves.toBe(false);
    expect(waitForSwap).not.toHaveBeenCalled();
    expect(confirmations).toHaveLength(1);
  });

  it('retries a safe pre-send failure and completes the real approval workflow', async () => {
    type INavigateParams = Parameters<
      ReturnType<typeof useSignatureConfirm>['navigationToTxConfirm']
    >[0];
    const confirmations: INavigateParams[] = [];
    const verifyBeforeSend = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('temporary account lookup failure'))
      .mockResolvedValue(undefined);
    const onFail = jest.fn();
    const fragment = createEthenaWithdrawFragment({
      identity,
      resumeUnstake: false,
      prepare: async () => ({
        encodedTx: {
          from: '0xowner',
          to: '0xtarget',
          value: '0x0',
          data: '0x',
        },
      }),
      navigate: async (params) => {
        confirmations.push(params);
      },
      verifyBeforeSend,
      onFail,
      onSubmitted: async () => undefined,
      waitForSwap: async () => true,
      onUnknownSwap: jest.fn(),
      onSwapSend: jest.fn(),
      onObserverError: jest.fn(),
    });
    const task = createEarnWithdrawApprovalTask<
      string,
      { encodedTx: IEncodedTx; stakeInfo?: IStakingInfo },
      { swapTxid?: string }
    >({
      taskId: 'ethena-approval-task',
      identity,
      protocolSteps: fragment.steps,
      initialContext: {},
      approval: {
        handoffOnSubmit: false,
        adapter: {
          prepare: async () => ({ type: 'confirm', prepared: 'approval' }),
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
      prepareBusiness: async (handoff) => {
        await handoff.register({
          identity,
          steps: fragment.steps,
          getAdapter: fragment.getAdapter,
          result: fragment.result,
          cancel: fragment.cancel,
        });
      },
      isCurrent: () => true,
      onAsyncError: jest.fn(),
    });
    const submittedTx = (txid: string): ISendTxOnSuccessData[] => [
      {
        signedTx: { txid, rawTx: '0x', encodedTx: null },
        decodedTx: {
          accountId: identity.accountId,
          networkId: identity.networkId,
          txid,
          status: EDecodedTxStatus.Pending,
          owner: identity.accountAddress,
          signer: identity.accountAddress,
          nonce: 0,
          actions: [],
          extraInfo: null,
        },
      },
    ];
    const result = task.run();
    await waitFor(() => expect(confirmations).toHaveLength(1));
    const failure = await Promise.resolve()
      .then(() => confirmations[0].onBeforeSend?.())
      .catch((error: unknown) => error);
    expect(failure).toEqual(new Error('temporary account lookup failure'));
    if (!(failure instanceof Error))
      throw new OneKeyLocalError('Expected send failure');
    (
      confirmations[0].onSafePreSendFail ??
      confirmations[0].onConfirmationFail ??
      confirmations[0].onFail
    )?.(failure);
    expect(onFail).toHaveBeenCalledWith(failure);
    expect(
      task.getTask().steps.find(({ id }) => id === 'swap')?.status.type,
    ).toBe('awaitingUser');
    await confirmations[0].onBeforeSend?.();
    await Promise.resolve(confirmations[0].onSuccess?.(submittedTx('swap-tx')));
    await waitFor(() => expect(confirmations).toHaveLength(2));
    await confirmations[1].onBeforeSend?.();
    await Promise.resolve(
      confirmations[1].onSuccess?.(submittedTx('unstake-tx')),
    );
    await expect(result).resolves.toBe(true);
    expect(task.getTask().taskId).toBe('ethena-approval-task');
    expect(task.getTask().steps.map(({ id }) => id)).toEqual([
      'approve',
      'allowance',
      'prepareBusiness',
      'swap',
      'settlement',
      'unstake',
    ]);
  });

  it.each([false, true])(
    'preserves terminal failure handling after an unsafe pre-send failure (handoff=%s)',
    async (handoff) => {
      type INavigateParams = Parameters<
        ReturnType<typeof useSignatureConfirm>['navigationToTxConfirm']
      >[0];
      let confirmation: INavigateParams | undefined;
      const onFail = jest.fn();
      const operation = runEthenaWithdrawTask({
        taskId: 'unsafe-failure',
        identity,
        resumeUnstake: false,
        prepare: async () => ({
          encodedTx: {
            from: '0xowner',
            to: '0xtarget',
            value: '0x0',
            data: '0x',
          },
        }),
        navigate: async (params) => {
          confirmation = params;
        },
        verifyBeforeSend: handoff ? async () => undefined : undefined,
        onSubmitted: jest.fn(),
        waitForSwap: jest.fn(async () => true),
        onUnknownSwap: jest.fn(),
        onSwapSend: jest.fn(),
        onObserverError: jest.fn(),
        onFail,
      });
      await waitFor(() => expect(confirmation).toBeDefined());
      expect(confirmation?.onSafePreSendFail).toEqual(expect.any(Function));
      const failure = new Error('pre-send action may have had side effects');
      confirmation?.onConfirmationFail?.(failure);
      await expect(operation).resolves.toBe(false);
      expect(onFail).toHaveBeenCalledWith(failure);
    },
  );

  it('records a late swap after cancellation without starting the next step', async () => {
    type INavigateParams = Parameters<
      ReturnType<typeof useSignatureConfirm>['navigationToTxConfirm']
    >[0];
    const confirmations: INavigateParams[] = [];
    const onUnknownSwap = jest.fn();
    const getProtocolAdapter = createEthenaWithdrawAdapters({
      identity,
      prepare: async () => ({
        encodedTx: {
          from: '0xowner',
          to: '0xtarget',
          value: '0x0',
          data: '0x',
        },
      }),
      navigate: async (params) => {
        confirmations.push(params);
      },
      onSubmitted: jest.fn(),
      waitForSwap: jest.fn(async () => true),
      onUnknownSwap,
      onSwapSend: jest.fn(),
      onObserverError: jest.fn(),
      resolveResult: jest.fn(),
      rejectResult: jest.fn(),
    });
    const task = createEarnWorkflowTask({
      taskId: 'late-withdraw',
      identity,
      steps: [
        { id: 'approve', kind: 'approve', lateSubmitted: 'unknown' },
        { id: 'allowance', kind: 'wait' },
        ...getEthenaWithdrawSteps(false),
      ],
    });
    const controller = createEarnWorkflowTaskController<
      typeof identity,
      { swapTxid?: string },
      { encodedTx: IEncodedTx; stakeInfo?: IStakingInfo }
    >({
      task,
      initialContext: {},
      isCurrent: () => true,
      expiredMessage: 'expired',
      onAsyncError: jest.fn(),
      getAdapter: (step, context) => {
        if (step.id === 'approve')
          return {
            kind: 'transaction',
            handoffOnSubmit: false,
            adapter: {
              prepare: async () => ({
                type: 'confirm',
                prepared: {
                  encodedTx: {
                    from: '0xowner',
                    to: '0xspender',
                    value: '0x0',
                    data: '0x',
                  },
                },
              }),
              confirm: async ({ onBeforeSend, onSubmitted }) => {
                onBeforeSend();
                onSubmitted('approval-tx');
                return { type: 'submitted' };
              },
              waitForFinalStatus: async () => 'success',
              verify: async () => true,
            },
          };
        if (step.id === 'allowance')
          return {
            kind: 'wait',
            run: async () => ({ type: 'completed', context }),
          };
        return getProtocolAdapter(step, context);
      },
    });
    await controller.run();
    await waitFor(() => expect(confirmations).toHaveLength(1));
    await confirmations[0].onBeforeSend?.();
    confirmations[0].onCancel?.();
    await confirmations[0].onLateBroadcastAccepted?.({
      uuid: 'swap-request',
      accountId: identity.accountId,
      networkId: identity.networkId,
      txid: 'late-swap',
    });
    const recordLateOrder = jest
      .mocked(createLateEarnOrderRecorder)
      .mock.results.at(-1)?.value;
    expect(recordLateOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        fact: expect.objectContaining({ txid: 'late-swap' }),
      }),
    );
    expect(onUnknownSwap).toHaveBeenCalled();
    expect(confirmations).toHaveLength(1);
  });

  it('does not treat approval or its wait as an Ethena protocol step', () => {
    const getAdapter = createEthenaWithdrawAdapters({
      identity,
      prepare: async () => {
        throw new OneKeyLocalError('not invoked');
      },
      navigate: async () => undefined,
      onSubmitted: async () => undefined,
      waitForSwap: async () => true,
      onUnknownSwap: jest.fn(),
      onSwapSend: jest.fn(),
      onObserverError: jest.fn(),
      resolveResult: jest.fn(),
      rejectResult: jest.fn(),
    });
    expect(() =>
      getAdapter(
        {
          id: 'approve',
          kind: 'approve',
          lateSubmitted: 'unknown',
          status: { type: 'ready' },
        },
        {},
      ),
    ).toThrow('Invalid Ethena withdrawal step');
    expect(() =>
      getAdapter(
        { id: 'allowance', kind: 'wait', status: { type: 'ready' } },
        {},
      ),
    ).toThrow('Invalid Ethena withdrawal step');
  });

  it('resumes only the withdrawal step after the previous swap has settled', () => {
    expect(getEthenaWithdrawSteps(true)).toEqual([
      { id: 'unstake', kind: 'protocol', lateSubmitted: 'unknown' },
    ]);
  });
});
