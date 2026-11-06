/** @jest-environment jsdom */

import { Suspense, startTransition, useEffect, useState } from 'react';

import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from '@testing-library/react';

import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';

import { depositTaskRegistry } from './registry';
import { createDepositRecording, runDepositTask } from './runDepositTask';
import {
  createDepositTask,
  createDepositTaskState,
  reduceDepositTask,
} from './state';
import { useDepositTask } from './useDepositTask';

import type { IDepositTaskHandle } from './types';

const mockRecoveryAddress = jest.fn<Promise<string>, []>();
const mockFinalStatus = jest.fn<
  Promise<EOnChainHistoryTxStatus | undefined>,
  [unknown]
>();
jest.mock('@onekeyhq/kit/src/utils/waitForTxFinalStatus', () => ({
  waitForTxFinalStatus: (input: unknown) => mockFinalStatus(input),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: { getAccountAddressForApi: () => mockRecoveryAddress() },
  },
}));

function makeTask(id: string) {
  return createDepositTask({
    taskId: id,
    identity: {
      accountId: 'account',
      accountAddress: 'owner',
      networkId: 'network',
      provider: 'provider',
      vault: 'vault',
      inputTokenAddress: 'token',
      depositTokenAddress: 'token',
      amount: '1',
      spenderAddress: 'spender',
    },
    steps: [{ id: 'deposit', kind: 'deposit' }],
  });
}

function makeHandle(task: ReturnType<typeof makeTask>): IDepositTaskHandle {
  return {
    getTask: () => task,
    run: jest.fn(),
    retry: jest.fn(),
    retryStatus: jest.fn(),
    cancel: jest.fn(),
    dispose: jest.fn(),
  };
}

describe('useDepositTask', () => {
  beforeEach(() => {
    mockRecoveryAddress.mockReset().mockResolvedValue('owner');
    mockFinalStatus.mockReset().mockResolvedValue(undefined);
  });

  it('only dismisses an uncertain remote recording after explicit action and a final transaction status', async () => {
    let task = makeTask('remote-unknown');
    const event = {
      taskId: task.taskId,
      stepId: 'deposit',
      attemptId: 'attempt',
    };
    task = reduceDepositTask(task, { ...event, type: 'start' });
    task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
    task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
    task = reduceDepositTask(task, { ...event, type: 'submitted', txid: 'tx' });
    task = reduceDepositTask(task, { ...event, type: 'handoff' });
    task = { ...task, recording: { txid: 'tx', status: 'remoteUnknown' } };
    const handle = {
      ...makeHandle(task),
      taskState: createDepositTaskState(task),
    };
    const { result, unmount } = renderHook(() =>
      useDepositTask('remote-unknown-scope', 'remote-unknown-owner'),
    );
    act(() => {
      result.current.onTaskReady(handle);
    });
    await act(async () => {
      expect(await result.current.finishRecordingTask(task.taskId, 'tx')).toBe(
        false,
      );
      expect(
        await result.current.finishRecordingTask(
          task.taskId,
          'tx',
          undefined,
          true,
        ),
      ).toBe(false);
    });
    expect(depositTaskRegistry.find('remote-unknown-owner')).toBeDefined();
    mockFinalStatus.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    await act(async () => {
      expect(
        await result.current.finishRecordingTask(
          task.taskId,
          'tx',
          undefined,
          true,
        ),
      ).toBe(true);
    });
    expect(mockFinalStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'account',
        networkId: 'network',
        txid: 'tx',
        maxAttempts: 1,
      }),
    );
    expect(depositTaskRegistry.find('remote-unknown-owner')).toBeUndefined();
    unmount();
  });

  it('keeps an uncertain recording when the account changes during the final status query', async () => {
    let task = makeTask('remote-unknown-switch');
    const event = {
      taskId: task.taskId,
      stepId: 'deposit',
      attemptId: 'attempt',
    };
    task = reduceDepositTask(task, { ...event, type: 'start' });
    task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
    task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
    task = reduceDepositTask(task, { ...event, type: 'submitted', txid: 'tx' });
    task = reduceDepositTask(task, { ...event, type: 'handoff' });
    task = { ...task, recording: { txid: 'tx', status: 'remoteUnknown' } };
    const handle = {
      ...makeHandle(task),
      taskState: createDepositTaskState(task),
    };
    const ownerKey = 'remote-unknown-switch-owner';
    const { result, unmount } = renderHook(() =>
      useDepositTask('scope', ownerKey),
    );
    act(() => {
      result.current.onTaskReady(handle);
    });
    let resolveStatus: (status: EOnChainHistoryTxStatus) => void = () =>
      undefined;
    mockFinalStatus.mockReturnValue(
      new Promise((resolve) => {
        resolveStatus = resolve;
      }),
    );
    let finished: Promise<boolean> = Promise.resolve(true);
    await act(async () => {
      finished = result.current.finishRecordingTask(
        task.taskId,
        'tx',
        undefined,
        true,
      );
      await Promise.resolve();
    });
    mockRecoveryAddress.mockResolvedValue('other-owner');
    await act(async () => {
      resolveStatus(EOnChainHistoryTxStatus.Success);
      expect(await finished).toBe(false);
    });
    expect(depositTaskRegistry.find(ownerKey)).toBeDefined();
    unmount();
    const entry = depositTaskRegistry.find(ownerKey);
    if (entry) depositTaskRegistry.release(ownerKey, entry.token);
  });

  it('preserves a wrapped task across unmount without running the old handle', async () => {
    let task = createDepositTask({
      taskId: 'remount-wrap',
      identity: makeTask('identity').identity,
      steps: [
        { id: 'wrap', kind: 'wrap' },
        { id: 'approve', kind: 'approve' },
        { id: 'deposit', kind: 'deposit' },
      ],
    });
    const event = { taskId: task.taskId, stepId: 'wrap', attemptId: 'wrap-1' };
    task = reduceDepositTask(task, { ...event, type: 'start' });
    task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
    task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
    task = reduceDepositTask(task, {
      ...event,
      type: 'submitted',
      txid: 'wrap-tx',
    });
    task = reduceDepositTask(task, { ...event, type: 'confirmed' });
    task = reduceDepositTask(task, { ...event, type: 'verified' });
    const taskState = createDepositTaskState(task);
    const handle = { ...makeHandle(task), taskState };
    const first = renderHook(() =>
      useDepositTask('scope-remount', 'owner-remount'),
    );
    act(() => {
      first.result.current.onTaskReady(handle);
    });
    expect(first.result.current.task?.taskId).toBe(task.taskId);
    first.unmount();
    const second = renderHook(() =>
      useDepositTask('scope-remount', 'owner-remount'),
    );
    await waitFor(() =>
      expect(second.result.current.task?.taskId).toBe(task.taskId),
    );
    expect(second.result.current.task?.steps[0].status).toEqual({
      type: 'succeeded',
      txid: 'wrap-tx',
    });
    expect(handle.dispose).toHaveBeenCalledTimes(1);
    expect(handle.run).not.toHaveBeenCalled();
    expect(handle.retry).not.toHaveBeenCalled();
    second.unmount();
    const reservation = depositTaskRegistry.find('owner-remount');
    if (reservation) {
      depositTaskRegistry.release('owner-remount', reservation.token);
    }
  });

  it('preserves an approved direct deposit across unmount', async () => {
    const task = createDepositTask({
      taskId: 'remount-approved',
      identity: makeTask('identity').identity,
      steps: [
        { id: 'approve', kind: 'approve' },
        { id: 'deposit', kind: 'deposit' },
      ],
    });
    const taskState = createDepositTaskState(task);
    const event = {
      taskId: task.taskId,
      stepId: 'approve',
      attemptId: 'approval-1',
    };
    taskState.dispatch({ ...event, type: 'start' });
    taskState.dispatch({ ...event, type: 'confirmationOpened' });
    taskState.dispatch({ ...event, type: 'sendStarted' });
    taskState.dispatch({ ...event, type: 'submitted', txid: 'approval-tx' });
    taskState.dispatch({ ...event, type: 'confirmed' });
    taskState.dispatch({ ...event, type: 'verified' });
    const handle = { ...makeHandle(taskState.getTask()), taskState };
    const first = renderHook(() =>
      useDepositTask('scope-approved', 'owner-approved'),
    );
    act(() => {
      first.result.current.onTaskReady(handle);
    });
    first.unmount();
    const second = renderHook(() =>
      useDepositTask('scope-approved', 'owner-approved'),
    );
    await waitFor(() =>
      expect(second.result.current.task?.taskId).toBe(task.taskId),
    );
    expect(second.result.current.task?.steps[0].status).toEqual({
      type: 'succeeded',
      txid: 'approval-tx',
    });
    second.unmount();
    const reservation = depositTaskRegistry.find('owner-approved');
    if (reservation)
      depositTaskRegistry.release('owner-approved', reservation.token);
  });

  it('reports a conflicting reservation instead of silently ignoring a new task', () => {
    const firstState = createDepositTaskState(makeTask('first-reservation'));
    const secondState = createDepositTaskState(makeTask('second-reservation'));
    const firstHandle = {
      ...makeHandle(firstState.getTask()),
      taskState: firstState,
    };
    const secondHandle = {
      ...makeHandle(secondState.getTask()),
      taskState: secondState,
    };
    const first = renderHook(() =>
      useDepositTask('scope-conflict-1', 'owner-conflict-1'),
    );
    const second = renderHook(() =>
      useDepositTask('scope-conflict-2', 'owner-conflict-2'),
    );
    act(() => {
      first.result.current.onTaskReady(firstHandle);
    });
    expect(() =>
      act(() => second.result.current.onTaskReady(secondHandle)),
    ).toThrow('Another deposit task is still pending');
    expect(secondHandle.dispose).toHaveBeenCalled();
    first.unmount();
    second.unmount();
  });

  it('rebinds the same retained state after a scope change', () => {
    let task = createDepositTask({
      taskId: 'reattach-scope',
      identity: makeTask('identity').identity,
      steps: [
        { id: 'wrap', kind: 'wrap' },
        { id: 'deposit', kind: 'deposit' },
      ],
    });
    const event = { taskId: task.taskId, stepId: 'wrap', attemptId: 'wrap-1' };
    task = reduceDepositTask(task, { ...event, type: 'start' });
    task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
    task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
    task = reduceDepositTask(task, {
      ...event,
      type: 'submitted',
      txid: 'wrap-tx',
    });
    task = reduceDepositTask(task, { ...event, type: 'confirmed' });
    task = reduceDepositTask(task, { ...event, type: 'verified' });
    const taskState = createDepositTaskState(task);
    const oldHandle = { ...makeHandle(task), taskState };
    const newHandle = { ...makeHandle(task), taskState };
    const view = renderHook(
      ({ scope }) => useDepositTask(scope, 'owner-reattach'),
      {
        initialProps: { scope: 'before' },
      },
    );
    act(() => {
      view.result.current.onTaskReady(oldHandle);
    });
    view.rerender({ scope: 'after' });
    expect(view.result.current.getCurrentHandle()).toBeUndefined();
    act(() => {
      expect(view.result.current.onTaskReady(newHandle)).toBe(true);
    });
    expect(oldHandle.dispose).toHaveBeenCalledTimes(1);
    expect(view.result.current.getCurrentHandle()).toBe(newHandle);
    view.unmount();
    const reservation = depositTaskRegistry.find('owner-reattach');
    if (reservation)
      depositTaskRegistry.release('owner-reattach', reservation.token);
  });

  it('retains a hash reported after the original page unmounts', async () => {
    const task = createDepositTask({
      taskId: 'late-after-unmount',
      identity: makeTask('identity').identity,
      steps: [
        { id: 'wrap', kind: 'wrap' },
        { id: 'deposit', kind: 'deposit' },
      ],
    });
    const state = createDepositTaskState(task);
    const event = { taskId: task.taskId, stepId: 'wrap', attemptId: 'wrap-1' };
    state.dispatch({ ...event, type: 'start' });
    state.dispatch({ ...event, type: 'confirmationOpened' });
    state.dispatch({ ...event, type: 'sendStarted' });
    const handle = {
      ...makeHandle(task),
      taskState: state,
      getTask: state.getTask,
      dispose: jest.fn(() => {
        state.dispatch({ ...event, type: 'cancel' });
      }),
    };
    const first = renderHook(() => useDepositTask('late-scope', 'late-owner'));
    act(() => {
      first.result.current.onTaskReady(handle);
    });
    first.unmount();
    state.dispatch({ ...event, type: 'submitted', txid: 'late-wrap-tx' });
    const second = renderHook(() => useDepositTask('late-scope', 'late-owner'));
    await waitFor(() =>
      expect(second.result.current.task?.steps[0].status).toEqual({
        type: 'unknown',
        txid: 'late-wrap-tx',
        chainConfirmed: false,
      }),
    );
    expect(handle.run).not.toHaveBeenCalled();
    second.unmount();
    const reservation = depositTaskRegistry.find('late-owner');
    if (reservation)
      depositTaskRegistry.release('late-owner', reservation.token);
  });

  it('finishes an already recorded deposit after unmount and rechecks its account', async () => {
    let task = makeTask('remount-recorded');
    const event = {
      taskId: task.taskId,
      stepId: 'deposit',
      attemptId: 'deposit-1',
    };
    task = reduceDepositTask(task, { ...event, type: 'start' });
    task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
    task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
    task = reduceDepositTask(task, {
      ...event,
      type: 'submitted',
      txid: 'deposit-tx',
    });
    task = reduceDepositTask(task, { ...event, type: 'handoff' });
    task = { ...task, recording: { txid: 'deposit-tx', status: 'succeeded' } };
    const taskState = createDepositTaskState(task);
    const handle = { ...makeHandle(task), taskState };
    const first = renderHook(() =>
      useDepositTask('scope-recorded', 'owner-recorded'),
    );
    act(() => {
      first.result.current.onTaskReady(handle);
    });
    first.unmount();
    const second = renderHook(() =>
      useDepositTask('scope-recorded', 'owner-recorded'),
    );
    await waitFor(() =>
      expect(second.result.current.task?.taskId).toBe(task.taskId),
    );
    mockRecoveryAddress.mockResolvedValueOnce('other-owner');
    let finished = false;
    await act(async () => {
      finished = await second.result.current.finishRecordingTask(
        task.taskId,
        'deposit-tx',
      );
    });
    expect(finished).toBe(false);
    await act(async () => {
      finished = await second.result.current.finishRecordingTask(
        task.taskId,
        'deposit-tx',
      );
    });
    expect(finished).toBe(true);
    expect(depositTaskRegistry.find('owner-recorded')).toBeUndefined();
    second.unmount();
  });

  it('retries a failed order recording after the page unmounts and remounts', async () => {
    const task = makeTask('remount-failed-recording');
    const taskState = createDepositTaskState(task);
    const save = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('Local order storage failed'))
      .mockRejectedValueOnce(new Error('Local order storage still unavailable'))
      .mockResolvedValueOnce(undefined);
    const recording = createDepositRecording({
      isCurrent: () => true,
      onError: jest.fn(),
    });
    const first = renderHook(() =>
      useDepositTask('scope-failed-recording', 'owner-failed-recording'),
    );
    await act(async () => {
      await runDepositTask({
        task,
        taskState,
        recording,
        adapter: {
          prepare: async () => ({ type: 'confirm', prepared: undefined }),
          confirm: async ({
            taskId,
            step,
            attemptId,
            onBeforeSend,
            onSubmitted,
          }) => {
            onBeforeSend();
            if (onSubmitted('deposit-tx')) {
              await recording.start('deposit-tx', save, () => undefined, {
                taskId,
                stepId: step.id,
                attemptId,
              });
            }
            return { type: 'submitted' };
          },
          waitForFinalStatus: async () => 'unknown',
          verify: async () => false,
        },
        signal: new AbortController().signal,
        isCurrent: () => true,
        onTaskReady: first.result.current.onTaskReady,
        onTaskChange: first.result.current.onTaskChange,
        formatMessage: (id) => id,
      });
    });
    expect(taskState.getTask().recording?.status).toBe('failed');
    first.unmount();
    const second = renderHook(() =>
      useDepositTask('scope-failed-recording', 'owner-failed-recording'),
    );
    await waitFor(() =>
      expect(second.result.current.task?.recording?.status).toBe('failed'),
    );
    const handle = second.result.current.getRecordingHandle();
    expect(handle).toBeDefined();
    mockRecoveryAddress.mockResolvedValueOnce('other-owner');
    await act(async () => {
      expect(await handle?.retryRecording()).toBe(false);
    });
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => {
      await expect(handle?.retryRecording()).rejects.toThrow(
        'Local order storage still unavailable',
      );
    });
    expect(taskState.getTask().recording?.status).toBe('failed');
    await act(async () => {
      await handle?.retryRecording();
    });
    expect(save).toHaveBeenCalledTimes(3);
    expect(taskState.getTask().recording?.status).toBe('succeeded');
    await act(async () => {
      expect(
        await second.result.current.finishRecordingTask(
          task.taskId,
          'deposit-tx',
        ),
      ).toBe(true);
    });
    expect(depositTaskRegistry.find('owner-failed-recording')).toBeUndefined();
    second.unmount();
    const reservation = depositTaskRegistry.find('owner-failed-recording');
    if (reservation)
      depositTaskRegistry.release('owner-failed-recording', reservation.token);
  });

  it('does not retry recording after the actual account address changes', async () => {
    let task = makeTask('address-check');
    const event = {
      taskId: task.taskId,
      stepId: 'deposit',
      attemptId: 'attempt',
    };
    task = reduceDepositTask(task, { ...event, type: 'start' });
    task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
    task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
    task = reduceDepositTask(task, { ...event, type: 'submitted', txid: 'tx' });
    task = reduceDepositTask(task, { ...event, type: 'handoff' });
    task = { ...task, recording: { txid: 'tx', status: 'failed' } };
    const handle = makeHandle(task);
    handle.retryRecording = jest.fn();
    const { result } = renderHook(() => useDepositTask('scope', 'owner'));
    act(() => {
      result.current.onTaskReady(handle);
    });
    mockRecoveryAddress.mockResolvedValue('other-owner');
    let retried: boolean | undefined;
    await act(async () => {
      retried = await result.current.getRecordingHandle()?.retryRecording();
    });
    expect(retried).toBe(false);
    expect(handle.retryRecording).not.toHaveBeenCalled();
  });

  it('does not finish a recording after the actual account address changes', async () => {
    let task = makeTask('finish-address-check');
    const event = {
      taskId: task.taskId,
      stepId: 'deposit',
      attemptId: 'attempt',
    };
    task = reduceDepositTask(task, { ...event, type: 'start' });
    task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
    task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
    task = reduceDepositTask(task, { ...event, type: 'submitted', txid: 'tx' });
    task = reduceDepositTask(task, { ...event, type: 'handoff' });
    task = { ...task, recording: { txid: 'tx', status: 'succeeded' } };
    const handle = makeHandle(task);
    const { result } = renderHook(() => useDepositTask('scope', 'owner'));
    act(() => {
      result.current.onTaskReady(handle);
    });
    mockRecoveryAddress.mockResolvedValue('other-owner');
    let finished: boolean | undefined;
    await act(async () => {
      finished = await result.current.finishRecordingTask(task.taskId, 'tx');
    });
    expect(finished).toBe(false);
    expect(handle.dispose).not.toHaveBeenCalled();
    expect(result.current.task?.taskId).toBe(task.taskId);
    mockRecoveryAddress.mockResolvedValue('owner');
    await act(async () => {
      finished = await result.current.finishRecordingTask(task.taskId, 'tx');
    });
    expect(finished).toBe(true);
    expect(handle.dispose).toHaveBeenCalledTimes(1);
  });

  it('shares one completion when automatic and manual finish overlap', async () => {
    let task = makeTask('finish-single-flight');
    const event = {
      taskId: task.taskId,
      stepId: 'deposit',
      attemptId: 'attempt',
    };
    task = reduceDepositTask(task, { ...event, type: 'start' });
    task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
    task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
    task = reduceDepositTask(task, { ...event, type: 'submitted', txid: 'tx' });
    task = reduceDepositTask(task, { ...event, type: 'handoff' });
    task = { ...task, recording: { txid: 'tx', status: 'succeeded' } };
    const handle = makeHandle(task);
    let resolveAddress: (value: string) => void = () => undefined;
    mockRecoveryAddress.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveAddress = resolve;
      }),
    );
    const { result } = renderHook(() => useDepositTask('scope', 'owner'));
    act(() => {
      result.current.onTaskReady(handle);
    });
    let first: Promise<boolean> | undefined;
    let second: Promise<boolean> | undefined;
    let actionCurrent = true;
    act(() => {
      first = result.current.finishRecordingTask(
        task.taskId,
        'tx',
        () => actionCurrent,
      );
      actionCurrent = false;
      second = result.current.finishRecordingTask(task.taskId, 'tx');
    });
    expect(mockRecoveryAddress).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveAddress('owner');
      await Promise.all([first, second]);
    });
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(handle.dispose).toHaveBeenCalledTimes(1);
  });

  it('retains the recording if an automatic completion loses its action lease', async () => {
    let task = makeTask('finish-expired');
    const event = {
      taskId: task.taskId,
      stepId: 'deposit',
      attemptId: 'attempt',
    };
    task = reduceDepositTask(task, { ...event, type: 'start' });
    task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
    task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
    task = reduceDepositTask(task, { ...event, type: 'submitted', txid: 'tx' });
    task = reduceDepositTask(task, { ...event, type: 'handoff' });
    task = { ...task, recording: { txid: 'tx', status: 'succeeded' } };
    const handle = makeHandle(task);
    let resolveAddress: (value: string) => void = () => undefined;
    mockRecoveryAddress.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveAddress = resolve;
      }),
    );
    const { result } = renderHook(() => useDepositTask('scope', 'owner'));
    act(() => {
      result.current.onTaskReady(handle);
    });
    let current = true;
    const automatic = result.current.finishRecordingTask(
      task.taskId,
      'tx',
      () => current,
    );
    current = false;
    resolveAddress('owner');
    await expect(automatic).resolves.toBe(false);
    expect(handle.dispose).not.toHaveBeenCalled();
    expect(result.current.task?.taskId).toBe(task.taskId);
  });

  it('does not retry when the owner scope changes while the address is being resolved', async () => {
    let task = makeTask('address-race');
    const event = {
      taskId: task.taskId,
      stepId: 'deposit',
      attemptId: 'attempt',
    };
    task = reduceDepositTask(task, { ...event, type: 'start' });
    task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
    task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
    task = reduceDepositTask(task, { ...event, type: 'submitted', txid: 'tx' });
    task = reduceDepositTask(task, { ...event, type: 'handoff' });
    task = { ...task, recording: { txid: 'tx', status: 'failed' } };
    const handle = makeHandle(task);
    handle.retryRecording = jest.fn();
    let resolveAddress: (value: string) => void = () => undefined;
    mockRecoveryAddress.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveAddress = resolve;
      }),
    );
    const { result, rerender } = renderHook(
      ({ owner }) => useDepositTask('scope', owner),
      {
        initialProps: { owner: 'account-a' },
      },
    );
    act(() => {
      result.current.onTaskReady(handle);
    });
    const recovery = result.current.getRecordingHandle();
    const retry = recovery?.retryRecording();
    rerender({ owner: 'account-b' });
    resolveAddress('owner');
    await expect(retry).resolves.toBe(false);
    expect(handle.retryRecording).not.toHaveBeenCalled();
  });
  it('keeps a completed wrap visible and blocks replacement after the execution scope changes', () => {
    let task = createDepositTask({
      taskId: 'wrapped',
      identity: makeTask('identity').identity,
      steps: [
        { id: 'wrap', kind: 'wrap' },
        { id: 'approve', kind: 'approve' },
        { id: 'deposit', kind: 'deposit' },
      ],
    });
    const wrap = { taskId: task.taskId, stepId: 'wrap', attemptId: 'wrap-1' };
    task = reduceDepositTask(task, { ...wrap, type: 'start' });
    task = reduceDepositTask(task, { ...wrap, type: 'confirmationOpened' });
    task = reduceDepositTask(task, { ...wrap, type: 'sendStarted' });
    task = reduceDepositTask(task, {
      ...wrap,
      type: 'submitted',
      txid: 'wrap-tx',
    });
    task = reduceDepositTask(task, { ...wrap, type: 'confirmed' });
    task = reduceDepositTask(task, { ...wrap, type: 'verified' });
    const approval = {
      taskId: task.taskId,
      stepId: 'approve',
      attemptId: 'approval-1',
    };
    task = reduceDepositTask(task, { ...approval, type: 'start' });
    task = reduceDepositTask(task, { ...approval, type: 'cancel' });
    const handle = makeHandle(task);
    const { result, rerender } = renderHook(
      ({ scope, owner }) => useDepositTask(scope, owner),
      { initialProps: { scope: 'original', owner: 'account-a' } },
    );
    act(() => {
      result.current.onTaskReady(handle);
    });
    rerender({ scope: 'changed', owner: 'account-a' });
    expect(result.current.task?.taskId).toBe('wrapped');
    expect(result.current.getCurrentHandle()).toBeUndefined();
    const competing = makeHandle(makeTask('competing'));
    act(() => {
      result.current.onTaskReady(competing);
    });
    expect(competing.dispose).toHaveBeenCalledTimes(1);
    rerender({ scope: 'changed', owner: 'account-b' });
    expect(result.current.task).toBeUndefined();
    rerender({ scope: 'changed', owner: 'account-a' });
    expect(result.current.task?.taskId).toBe('wrapped');
  });

  it('keeps a handed-off deposit blocked until its recording has been resolved', () => {
    let task = createDepositTask({
      taskId: 'wrapped',
      identity: makeTask('identity').identity,
      steps: [
        { id: 'wrap', kind: 'wrap' },
        { id: 'deposit', kind: 'deposit' },
      ],
    });
    const wrap = { taskId: task.taskId, stepId: 'wrap', attemptId: 'wrap-1' };
    task = reduceDepositTask(task, { ...wrap, type: 'start' });
    task = reduceDepositTask(task, { ...wrap, type: 'confirmationOpened' });
    task = reduceDepositTask(task, { ...wrap, type: 'sendStarted' });
    task = reduceDepositTask(task, {
      ...wrap,
      type: 'submitted',
      txid: 'wrap-tx',
    });
    task = reduceDepositTask(task, { ...wrap, type: 'confirmed' });
    task = reduceDepositTask(task, { ...wrap, type: 'verified' });
    const deposit = {
      taskId: task.taskId,
      stepId: 'deposit',
      attemptId: 'deposit-1',
    };
    task = reduceDepositTask(task, { ...deposit, type: 'start' });
    task = reduceDepositTask(task, { ...deposit, type: 'confirmationOpened' });
    task = reduceDepositTask(task, { ...deposit, type: 'sendStarted' });
    task = reduceDepositTask(task, {
      ...deposit,
      type: 'submitted',
      txid: 'deposit-tx',
    });
    task = reduceDepositTask(task, { ...deposit, type: 'handoff' });
    const handle = makeHandle(task);
    const { result, rerender } = renderHook(
      ({ scope }) => useDepositTask(scope, 'account-a'),
      { initialProps: { scope: 'original' } },
    );
    act(() => {
      result.current.onTaskReady(handle);
    });
    rerender({ scope: 'changed' });
    expect(result.current.task?.taskId).toBe('wrapped');
    const next = makeHandle(makeTask('next'));
    act(() => {
      result.current.onTaskReady(next);
    });
    expect(next.dispose).toHaveBeenCalledTimes(1);
  });

  it('refreshes recovery availability after every committed return to the same owner', async () => {
    let task = makeTask('first');
    const event = { taskId: 'first', stepId: 'deposit', attemptId: 'attempt' };
    task = reduceDepositTask(task, { ...event, type: 'start' });
    task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
    task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
    task = reduceDepositTask(task, { ...event, type: 'submitted', txid: 'tx' });
    task = reduceDepositTask(task, { ...event, type: 'handoff' });
    task = { ...task, recording: { txid: 'tx', status: 'failed' } };
    const handle = {
      ...makeHandle(task),
      subscribeRecovery: () => () => undefined,
      retryDetachedRecording: jest.fn(async () => undefined),
    };
    const { result, rerender } = renderHook(
      ({ owner }) => {
        const state = useDepositTask(owner, owner);
        return { ...state, canRecover: Boolean(state.getRecordingHandle()) };
      },
      { initialProps: { owner: 'account-a' } },
    );
    act(() => {
      result.current.onTaskReady(handle);
    });
    expect(result.current.canRecover).toBe(true);
    const oldRecovery = result.current.getRecordingHandle();
    rerender({ owner: 'account-b' });
    expect(result.current.canRecover).toBe(false);
    rerender({ owner: 'account-a' });
    expect(result.current.canRecover).toBe(true);
    const firstReturnRecovery = result.current.getRecordingHandle();
    await act(async () => oldRecovery?.retryRecording());
    expect(handle.retryDetachedRecording).not.toHaveBeenCalled();
    rerender({ owner: 'account-b' });
    rerender({ owner: 'account-a' });
    expect(result.current.canRecover).toBe(true);
    await act(async () => firstReturnRecovery?.retryRecording());
    expect(handle.retryDetachedRecording).not.toHaveBeenCalled();
    await act(async () =>
      result.current.getRecordingHandle()?.retryRecording(),
    );
    expect(handle.retryDetachedRecording).toHaveBeenCalledTimes(1);
  });

  it.each(['succeeded', 'failed'] as const)(
    'keeps detached recording %s in sync across owner switches',
    async (status) => {
      let task = makeTask('first');
      const event = {
        taskId: 'first',
        stepId: 'deposit',
        attemptId: 'attempt',
      };
      task = reduceDepositTask(task, { ...event, type: 'start' });
      task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
      task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
      task = reduceDepositTask(task, {
        ...event,
        type: 'submitted',
        txid: 'tx',
      });
      task = reduceDepositTask(task, { ...event, type: 'handoff' });
      task = { ...task, recording: { txid: 'tx', status: 'pending' } };
      const listeners = new Set<() => void>();
      const retryDetachedRecording = jest.fn(
        async (isCurrent: () => boolean) => {
          if (isCurrent())
            task = { ...task, recording: { txid: 'tx', status: 'pending' } };
        },
      );
      const handle = {
        ...makeHandle(task),
        getTask: () => task,
        subscribeRecovery: (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        retryDetachedRecording,
      };
      const { result, rerender, unmount } = renderHook(
        ({ owner }) => useDepositTask(owner, owner),
        { initialProps: { owner: 'account-a' } },
      );
      act(() => {
        result.current.onTaskReady(handle);
      });
      rerender({ owner: 'account-b' });
      const other = makeHandle(makeTask('second'));
      act(() => {
        result.current.onTaskReady(other);
      });
      expect(handle.dispose).not.toHaveBeenCalled();
      act(() => {
        task = { ...task, recording: { txid: 'tx', status } };
        listeners.forEach((listener) => listener());
      });
      expect(result.current.task?.taskId).toBe('second');
      rerender({ owner: 'account-a' });
      expect(result.current.task?.recording?.status).toBe(status);
      expect(result.current.getCurrentHandle()).toBeUndefined();
      const recovery = result.current.getRecordingHandle();
      expect(recovery).toBeDefined();
      expect(recovery).not.toHaveProperty('run');
      if (status === 'failed') {
        await act(async () => recovery?.retryRecording());
        expect(retryDetachedRecording).toHaveBeenCalledTimes(1);
      } else {
        expect(result.current.clearRecordingTask('first', 'tx')).toBe(true);
      }
      rerender({ owner: 'account-b' });
      await act(async () => recovery?.retryRecording());
      expect(retryDetachedRecording).toHaveBeenCalledTimes(
        status === 'failed' ? 1 : 0,
      );
      unmount();
    },
  );

  it('updates a detached task when its transaction id arrives after leaving the owner', () => {
    let task = makeTask('first');
    const event = { taskId: 'first', stepId: 'deposit', attemptId: 'attempt' };
    task = reduceDepositTask(task, { ...event, type: 'start' });
    task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
    task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
    const listeners = new Set<() => void>();
    const handle = {
      ...makeHandle(task),
      getTask: () => task,
      subscribeRecovery: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      retryDetachedRecording: jest.fn(async () => undefined),
    };
    const { result, rerender } = renderHook(
      ({ owner }) => useDepositTask(owner, owner),
      { initialProps: { owner: 'account-a' } },
    );
    act(() => {
      result.current.onTaskReady(handle);
    });
    rerender({ owner: 'account-b' });
    act(() => {
      task = reduceDepositTask(task, {
        ...event,
        type: 'submitted',
        txid: 'tx',
      });
      task = reduceDepositTask(task, { ...event, type: 'handoff' });
      task = { ...task, recording: { txid: 'tx', status: 'pending' } };
      listeners.forEach((listener) => listener());
    });
    expect(result.current.task).toBeUndefined();
    rerender({ owner: 'account-a' });
    expect(result.current.task?.recording?.status).toBe('pending');
    act(() => {
      task = { ...task, recording: { txid: 'tx', status: 'succeeded' } };
      listeners.forEach((listener) => listener());
    });
    expect(result.current.task?.recording?.status).toBe('succeeded');
    expect(result.current.getCurrentHandle()).toBeUndefined();
  });

  it('keeps only recording recovery available when the execution scope changes within the same owner', async () => {
    let task = makeTask('first');
    const event = { taskId: 'first', stepId: 'deposit', attemptId: 'attempt' };
    task = reduceDepositTask(task, { ...event, type: 'start' });
    task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
    task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
    task = reduceDepositTask(task, { ...event, type: 'submitted', txid: 'tx' });
    task = reduceDepositTask(task, { ...event, type: 'handoff' });
    task = { ...task, recording: { txid: 'tx', status: 'failed' } };
    const handle = makeHandle(task);
    handle.retryRecording = jest.fn();
    const { result, rerender } = renderHook(
      ({ scope, owner }) => useDepositTask(scope, owner),
      { initialProps: { scope: 'spender-a', owner: 'account-a' } },
    );
    act(() => {
      result.current.onTaskReady(handle);
    });
    rerender({ scope: 'spender-loading', owner: 'account-a' });
    expect(result.current.task?.recording?.status).toBe('failed');
    expect(result.current.getCurrentHandle()).toBeUndefined();
    const recovery = result.current.getRecordingHandle();
    expect(recovery).toBeDefined();
    expect(recovery).not.toHaveProperty('run');
    expect(recovery).not.toHaveProperty('retry');
    expect(recovery).not.toHaveProperty('retryStatus');
    await act(async () => recovery?.retryRecording());
    expect(handle.retryRecording).toHaveBeenCalledTimes(1);
    const competing = makeHandle(makeTask('competing'));
    act(() => {
      result.current.onTaskReady(competing);
    });
    expect(competing.dispose).toHaveBeenCalledTimes(1);
    expect(result.current.task?.taskId).toBe('first');
    rerender({ scope: 'spender-a', owner: 'account-a' });
    expect(result.current.task?.taskId).toBe('first');
    rerender({ scope: 'spender-a', owner: 'account-b' });
    await act(async () => recovery?.retryRecording());
    expect(handle.retryRecording).toHaveBeenCalledTimes(1);
    expect(result.current.task).toBeUndefined();
    expect(result.current.getRecordingHandle()).toBeUndefined();
    rerender({ scope: 'spender-a', owner: 'account-a' });
    expect(result.current.task?.taskId).toBe('first');
    expect(result.current.getRecordingHandle()).toBeUndefined();
    const competingAfterOwnerReturn = makeHandle(makeTask('third'));
    act(() => {
      result.current.onTaskReady(competingAfterOwnerReturn);
    });
    expect(competingAfterOwnerReturn.dispose).toHaveBeenCalledTimes(1);
  });

  it('never exposes a task after an owner-only scope change', () => {
    const handle = makeHandle(makeTask('first'));
    const { result, rerender } = renderHook(
      ({ owner }) => useDepositTask('same-action', owner),
      { initialProps: { owner: 'account-a' } },
    );
    act(() => {
      result.current.onTaskReady(handle);
    });
    expect(result.current.getCurrentHandle()).toBe(handle);
    rerender({ owner: 'account-b' });
    expect(result.current.task).toBeUndefined();
    expect(result.current.getCurrentHandle()).toBeUndefined();
  });

  it('does not expose the execution handle once its own lease is invalid', () => {
    const handle = makeHandle(makeTask('first'));
    let current = true;
    handle.isExecutionCurrent = () => current;
    const { result, rerender } = renderHook(() =>
      useDepositTask('scope', 'owner'),
    );
    act(() => {
      result.current.onTaskReady(handle);
    });
    expect(result.current.getCurrentHandle()).toBe(handle);
    current = false;
    rerender();
    expect(result.current.getCurrentHandle()).toBeUndefined();
  });

  it('retains an uncertain transaction as a read-only blocker after execution scope changes', () => {
    let task = makeTask('first');
    const event = { taskId: 'first', stepId: 'deposit', attemptId: 'attempt' };
    task = reduceDepositTask(task, { ...event, type: 'start' });
    task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
    task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
    task = reduceDepositTask(task, { ...event, type: 'cancel' });
    const handle = makeHandle(task);
    const { result, rerender } = renderHook(
      ({ scope }) => useDepositTask(scope, 'owner'),
      { initialProps: { scope: 'first' } },
    );
    act(() => {
      result.current.onTaskReady(handle);
    });
    rerender({ scope: 'changed' });
    expect(result.current.task?.steps[0].status.type).toBe('unknown');
    expect(result.current.getCurrentHandle()).toBeUndefined();
    expect(result.current.getRecordingHandle()).toBeUndefined();
    const competing = makeHandle(makeTask('second'));
    act(() => {
      result.current.onTaskReady(competing);
    });
    expect(competing.dispose).toHaveBeenCalledTimes(1);
    expect(handle.dispose).not.toHaveBeenCalled();
    rerender({ scope: 'first' });
    expect(result.current.task?.taskId).toBe('first');
    expect(result.current.getCurrentHandle()).toBeUndefined();
  });
  it('keeps the current task when a concurrent scope render is abandoned', async () => {
    let task = makeTask('first');
    const event = { taskId: 'first', stepId: 'deposit', attemptId: 'attempt' };
    task = reduceDepositTask(task, { ...event, type: 'start' });
    task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
    task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
    const handle = makeHandle(task);
    const startSecondTask = jest.fn();
    const observeCurrentHandle = jest.fn();
    const renderSecondScope = jest.fn();
    const suspended = new Promise<void>(() => undefined);

    function Form({ scope }: { scope: string }) {
      const {
        onTaskReady,
        task: currentTask,
        getCurrentHandle,
      } = useDepositTask(scope);
      useEffect(() => {
        onTaskReady(handle);
      }, [onTaskReady]);
      if (scope === 'second') {
        renderSecondScope();
        throw suspended;
      }
      return (
        <div>
          <span data-testid="task">{currentTask?.taskId ?? 'none'}</span>
          <button
            type="button"
            onClick={() => {
              const currentHandle = getCurrentHandle();
              observeCurrentHandle(currentHandle);
              if (!currentHandle) startSecondTask();
            }}
          >
            Start another task
          </button>
        </div>
      );
    }

    function Harness() {
      const [scope, setScope] = useState('first');
      const [, setRevision] = useState(0);
      return (
        <>
          <button
            type="button"
            onClick={() => startTransition(() => setScope('second'))}
          >
            Start transition
          </button>
          <button type="button" onClick={() => setScope('first')}>
            Abandon transition
          </button>
          <button
            type="button"
            onClick={() => setRevision((value) => value + 1)}
          >
            Rerender form
          </button>
          <Suspense fallback={<span>loading</span>}>
            <Form scope={scope} />
          </Suspense>
        </>
      );
    }

    const screen = render(<Harness />);
    expect(screen.getByTestId('task').textContent).toBe('first');
    fireEvent.click(screen.getByText('Start another task'));
    expect(observeCurrentHandle).toHaveBeenLastCalledWith(handle);
    expect(startSecondTask).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Start transition'));
    await waitFor(() => expect(renderSecondScope).toHaveBeenCalled());
    expect(screen.getByTestId('task').textContent).toBe('first');
    fireEvent.click(screen.getByText('Abandon transition'));
    expect(screen.getByTestId('task').textContent).toBe('first');
    fireEvent.click(screen.getByText('Start another task'));
    expect(observeCurrentHandle).toHaveBeenLastCalledWith(handle);
    expect(startSecondTask).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Rerender form'));
    expect(screen.getByTestId('task').textContent).toBe('first');
    expect(handle.dispose).not.toHaveBeenCalled();
  });

  it('does not reactivate an old task after switching away and back', () => {
    const task = makeTask('first');
    const handle = makeHandle(task);
    const { result, rerender, unmount } = renderHook(
      ({ scope }) => useDepositTask(scope),
      { initialProps: { scope: 'first' } },
    );
    act(() => {
      result.current.onTaskReady(handle);
    });
    expect(result.current.task).toBe(task);
    rerender({ scope: 'second' });
    expect(result.current.getCurrentHandle()).toBeUndefined();
    rerender({ scope: 'first' });
    expect(result.current.task).toBeUndefined();
    expect(result.current.getCurrentHandle()).toBeUndefined();
    unmount();
    expect(handle.dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes a late task from the previous scope without replacing the current task', () => {
    const staleHandle = makeHandle(makeTask('old'));
    const currentTask = makeTask('new');
    const currentHandle = makeHandle(currentTask);
    const { result, rerender } = renderHook(
      ({ scope }) => useDepositTask(scope),
      { initialProps: { scope: 'first' } },
    );
    const onOldTaskReady = result.current.onTaskReady;
    rerender({ scope: 'second' });
    act(() => {
      result.current.onTaskReady(currentHandle);
    });
    expect(result.current.getCurrentHandle()).toBe(currentHandle);

    act(() => {
      onOldTaskReady(staleHandle);
    });
    expect(result.current.getCurrentHandle()).toBe(currentHandle);
    expect(result.current.task).toBe(currentTask);
    expect(currentHandle.dispose).not.toHaveBeenCalled();
    expect(staleHandle.dispose).toHaveBeenCalledTimes(1);
  });

  it('keeps the task handle through a same-scope rerender', () => {
    const task = makeTask('first');
    const handle = makeHandle(task);
    const { result, rerender } = renderHook(
      ({ scope }) => useDepositTask(scope),
      { initialProps: { scope: 'first' } },
    );
    act(() => {
      result.current.onTaskReady(handle);
    });
    rerender({ scope: 'first' });
    expect(result.current.getCurrentHandle()).toBe(handle);
    expect(result.current.task).toBe(task);
    expect(handle.dispose).not.toHaveBeenCalled();
  });

  it('disposes a task registered after unmount', () => {
    const handle = makeHandle(makeTask('late'));
    const { result, unmount } = renderHook(() => useDepositTask('scope'));
    const onTaskReady = result.current.onTaskReady;
    unmount();
    act(() => {
      onTaskReady(handle);
    });
    expect(handle.dispose).toHaveBeenCalledTimes(1);
  });

  it('ignores late updates after replacing a task', () => {
    const oldTask = makeTask('old');
    const oldHandle = makeHandle(oldTask);
    const newTask = makeTask('new');
    const newHandle = makeHandle(newTask);
    const { result } = renderHook(() => useDepositTask('scope'));
    act(() => {
      result.current.onTaskReady(oldHandle);
    });
    act(() => {
      result.current.onTaskReady(newHandle);
    });
    act(() => result.current.onTaskChange(oldTask));
    expect(oldHandle.dispose).toHaveBeenCalledTimes(1);
    expect(result.current.task).toBe(newTask);
  });

  it('does not discard an uncertain broadcast as an unsent task', () => {
    let task = makeTask('task');
    const event = { taskId: 'task', stepId: 'deposit', attemptId: 'attempt' };
    task = reduceDepositTask(task, { ...event, type: 'start' });
    task = reduceDepositTask(task, { ...event, type: 'confirmationOpened' });
    task = reduceDepositTask(task, { ...event, type: 'sendStarted' });
    task = reduceDepositTask(task, { ...event, type: 'cancel' });
    const handle = makeHandle(task);
    const { result } = renderHook(() => useDepositTask('scope'));
    act(() => {
      result.current.onTaskReady(handle);
    });
    expect(result.current.clearTaskBeforeAnySend()).toBe(false);
    expect(result.current.getCurrentHandle()).toBe(handle);
    expect(handle.dispose).not.toHaveBeenCalled();
  });
});
