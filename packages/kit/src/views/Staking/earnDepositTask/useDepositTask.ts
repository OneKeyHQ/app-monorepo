import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { isTaskAccountCurrent } from '@onekeyhq/kit/src/views/Earn/tasks/taskAccount';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { depositTaskRegistry } from './registry';
import { waitForDepositTaskTxStatus } from './waitForDepositTaskTxStatus';

import type { IRecoverableDepositTaskHandle } from './runDepositTask';
import type { IDepositTask } from './state';
import type { IDepositTaskHandle } from './types';
import type { IRetainedDepositTask } from './useRetainedDepositTask';

type ITrackedTask = {
  handle: IDepositTaskHandle;
  task: IDepositTask;
  unsubscribe?: () => void;
  reservation?: { ownerKey: string; token: symbol };
};

function supportsRecovery(
  handle: IDepositTaskHandle,
): handle is IRecoverableDepositTaskHandle {
  return (
    'subscribeRecovery' in handle &&
    typeof handle.subscribeRecovery === 'function' &&
    'retryDetachedRecording' in handle &&
    typeof handle.retryDetachedRecording === 'function'
  );
}

function hasRecording(task: IDepositTask | undefined) {
  const deposit = task?.steps.at(-1);
  return Boolean(
    task?.recording?.txid &&
    deposit?.kind === 'deposit' &&
    deposit.status.type === 'handedOff' &&
    deposit.status.txid === task.recording.txid,
  );
}

function canFinishRecording(status: string, allowRemoteUnknown: boolean) {
  return (
    ['succeeded', 'superseded', 'notTracked'].includes(status) ||
    (allowRemoteUnknown && status === 'remoteUnknown')
  );
}

async function isRecordingFinal(
  task: IDepositTask,
  allowRemoteUnknown: boolean,
) {
  if (task.recording?.status !== 'remoteUnknown') return true;
  if (!allowRemoteUnknown || !task.recording.txid) return false;
  const status = await waitForDepositTaskTxStatus({
    identity: task.identity,
    txid: task.recording.txid,
    signal: new AbortController().signal,
    maxAttempts: 1,
  });
  return (
    (status === 'success' || status === 'failed') &&
    (await isTaskAccountCurrent(task.identity))
  );
}

function hasUnresolvedTask(task: IDepositTask | undefined) {
  return Boolean(
    hasRecording(task) ||
    (task?.steps.some(
      (step) =>
        step.kind !== 'deposit' &&
        (step.status.type === 'succeeded' ||
          step.status.type === 'allowanceSatisfied'),
    ) &&
      task.steps.at(-1)?.status.type !== 'handedOff') ||
    task?.steps.some((step) =>
      ['sending', 'confirming', 'verifying', 'unknown', 'handedOff'].includes(
        step.status.type,
      ),
    ),
  );
}

export function useDepositTask(
  scopeKey: string,
  ownerKey = scopeKey,
  externalRecovery?: IRetainedDepositTask | null,
) {
  const [task, setTask] = useState<IDepositTask | undefined>();
  const [restored, setRestored] = useState<
    { ownerKey: string; task: IDepositTask } | undefined
  >();
  const [, setRecoveryRevision] = useState(0);
  const taskSnapshotRef = useRef<IDepositTask | undefined>(undefined);
  const handleRef = useRef<IDepositTaskHandle | undefined>(undefined);
  const detachedBlockersRef = useRef(new Map<string, ITrackedTask>());
  const trackedTasksRef = useRef(new Map<IDepositTaskHandle, ITrackedTask>());
  const [scope, setScope] = useState(() => ({ scopeKey }));
  if (scope.scopeKey !== scopeKey) {
    setScope({ scopeKey });
  }
  const [owner, setOwner] = useState(() => ({ ownerKey }));
  if (owner.ownerKey !== ownerKey) setOwner({ ownerKey });
  const finishFlightRef = useRef<
    | {
        owner: typeof owner;
        handle: IDepositTaskHandle;
        taskId: string;
        txid: string;
        allowManual: boolean;
        allowRemoteUnknown: boolean;
        promise: Promise<boolean>;
      }
    | undefined
  >(undefined);
  const committedScopeRef = useRef(scope);
  const committedOwnerRef = useRef<typeof owner | undefined>(owner);
  const handleScopeRef = useRef<typeof scope | undefined>(undefined);
  const handleOwnerRef = useRef<typeof owner | undefined>(undefined);
  const eventsActiveRef = useRef(false);

  useEffect(() => {
    if (externalRecovery !== undefined) return undefined;
    let active = true;
    let revision = 0;
    let validatedEntry: ReturnType<typeof depositTaskRegistry.find>;
    let pendingEntry: ReturnType<typeof depositTaskRegistry.find>;
    const refresh = () => {
      const entry = depositTaskRegistry.find(ownerKey);
      if (!entry) {
        revision += 1;
        validatedEntry = undefined;
        pendingEntry = undefined;
        setRestored((previous) =>
          previous?.ownerKey === ownerKey ? undefined : previous,
        );
        return;
      }
      if (entry === validatedEntry) {
        setRestored({ ownerKey, task: entry.state.getTask() });
        return;
      }
      if (entry === pendingEntry) return;
      revision += 1;
      const currentRevision = revision;
      pendingEntry = entry;
      void isTaskAccountCurrent(entry.state.getTask().identity)
        .then((matches) => {
          if (
            !active ||
            revision !== currentRevision ||
            committedOwnerRef.current !== owner ||
            depositTaskRegistry.find(ownerKey) !== entry
          )
            return;
          pendingEntry = undefined;
          validatedEntry = matches ? entry : undefined;
          setRestored(
            matches ? { ownerKey, task: entry.state.getTask() } : undefined,
          );
        })
        .catch(() => {
          if (active && revision === currentRevision) {
            pendingEntry = undefined;
            setRestored(undefined);
          }
        });
    };
    const unsubscribe = depositTaskRegistry.subscribe(refresh);
    refresh();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [owner, ownerKey, externalRecovery]);

  const getRetainedTaskState = useCallback(() => {
    const entry = depositTaskRegistry.find(owner.ownerKey);
    const snapshot =
      externalRecovery === undefined ? restored?.task : externalRecovery?.task;
    if (
      owner !== committedOwnerRef.current ||
      !entry ||
      !snapshot ||
      entry.state.getTask().taskId !== snapshot.taskId ||
      (externalRecovery &&
        (externalRecovery.state !== entry.state ||
          externalRecovery.token !== entry.token)) ||
      (externalRecovery === undefined && restored?.ownerKey !== owner.ownerKey)
    )
      return undefined;
    return entry.state;
  }, [externalRecovery, owner, restored]);

  useLayoutEffect(() => {
    committedScopeRef.current = scope;
  }, [scope]);
  useLayoutEffect(() => {
    const activeHandleRef = handleRef;
    const detachedBlockers = detachedBlockersRef.current;
    const trackedTasks = trackedTasksRef.current;
    committedOwnerRef.current = owner;
    const current = handleRef.current?.getTask();
    if (handleOwnerRef.current === owner && hasUnresolvedTask(current)) {
      detachedBlockers.delete(owner.ownerKey);
      taskSnapshotRef.current = current;
      setTask(current);
    } else {
      const detached = detachedBlockers.get(owner.ownerKey);
      if (detached) {
        setTask(detached.task);
        setRecoveryRevision((revision) => revision + 1);
      }
    }
    return () => {
      const latest = activeHandleRef.current?.getTask();
      if (
        handleOwnerRef.current === owner &&
        latest &&
        hasUnresolvedTask(latest)
      ) {
        const handle = activeHandleRef.current;
        const tracked = handle && trackedTasks.get(handle);
        if (tracked) {
          tracked.task = latest;
          detachedBlockers.set(owner.ownerKey, tracked);
        }
      }
      if (committedOwnerRef.current === owner)
        committedOwnerRef.current = undefined;
    };
  }, [owner]);

  const getCurrentHandle = useCallback(() => {
    if (
      scope !== committedScopeRef.current ||
      handleScopeRef.current !== scope ||
      owner !== committedOwnerRef.current ||
      handleOwnerRef.current !== owner ||
      !(handleRef.current?.isExecutionCurrent?.() ?? true)
    )
      return undefined;
    return handleRef.current;
  }, [owner, scope]);

  const getRecordingHandle = useCallback(() => {
    const detached = detachedBlockersRef.current.get(owner.ownerKey);
    const retained = depositTaskRegistry.find(owner.ownerKey);
    const retainedHandle =
      !detached && !handleRef.current ? retained?.recordingHandle : undefined;
    const handle = detached?.handle ?? handleRef.current ?? retainedHandle;
    const current = handle?.getTask();
    const deposit = current?.steps.at(-1);
    if (
      owner !== committedOwnerRef.current ||
      (!detached && !retainedHandle && handleOwnerRef.current !== owner) ||
      (retainedHandle &&
        (!retained ||
          (externalRecovery &&
            (externalRecovery.state !== retained.state ||
              externalRecovery.token !== retained.token)))) ||
      !handle ||
      (detached && !supportsRecovery(handle)) ||
      !current ||
      !hasRecording(current) ||
      !deposit?.attemptId ||
      !current.recording?.txid
    )
      return undefined;
    const { taskId } = current;
    const { attemptId } = deposit;
    const { txid } = current.recording;
    return {
      retryRecording: async () => {
        let accountMatches = false;
        try {
          accountMatches = await isTaskAccountCurrent(current.identity);
        } catch {
          return false;
        }
        const latest = handle.getTask();
        const latestDeposit = latest?.steps.at(-1);
        let handleIsCurrent = false;
        if (retainedHandle) {
          handleIsCurrent =
            depositTaskRegistry.find(owner.ownerKey) === retained;
        } else if (detached) {
          handleIsCurrent =
            detachedBlockersRef.current.get(owner.ownerKey) === detached;
        } else {
          handleIsCurrent =
            handleOwnerRef.current === owner && handleRef.current === handle;
        }
        if (
          !accountMatches ||
          owner !== committedOwnerRef.current ||
          !handleIsCurrent ||
          latest?.taskId !== taskId ||
          latestDeposit?.attemptId !== attemptId ||
          latest.recording?.txid !== txid ||
          !hasRecording(latest)
        )
          return false;
        if ((detached || retainedHandle) && supportsRecovery(handle)) {
          await handle.retryDetachedRecording(
            () =>
              owner === committedOwnerRef.current &&
              (retainedHandle
                ? depositTaskRegistry.find(owner.ownerKey) === retained
                : detachedBlockersRef.current.get(owner.ownerKey) ===
                  detached) &&
              handle.getTask().taskId === taskId &&
              handle.getTask().steps.at(-1)?.attemptId === attemptId &&
              handle.getTask().recording?.txid === txid,
          );
        } else if (!detached) {
          await handle.retryRecording?.();
        }
        return true;
      },
    };
  }, [externalRecovery, owner]);

  const onTaskReady = useCallback(
    (handle: IDepositTaskHandle) => {
      if (
        !eventsActiveRef.current ||
        scope !== committedScopeRef.current ||
        owner !== committedOwnerRef.current
      ) {
        handle.dispose();
        return false;
      }
      if (handleRef.current === handle) return true;
      const detached = detachedBlockersRef.current.get(owner.ownerKey);
      const reattachingDetached = Boolean(
        handle.taskState && detached?.handle.taskState === handle.taskState,
      );
      if (detached && !reattachingDetached) {
        handle.dispose();
        return false;
      }
      if (detached && reattachingDetached) {
        detachedBlockersRef.current.delete(owner.ownerKey);
        if (detached.handle !== handleRef.current) {
          detached.unsubscribe?.();
          trackedTasksRef.current.delete(detached.handle);
          detached.handle.dispose();
        }
      }
      if (
        handleOwnerRef.current === owner &&
        owner === committedOwnerRef.current &&
        hasUnresolvedTask(handleRef.current?.getTask()) &&
        (!handle.taskState || handle.taskState !== handleRef.current?.taskState)
      ) {
        handle.dispose();
        return false;
      }
      const previous = handleRef.current;
      if (
        previous &&
        ![...detachedBlockersRef.current.values()].some(
          (entry) => entry.handle === previous,
        )
      ) {
        const previousTracked = trackedTasksRef.current.get(previous);
        previousTracked?.unsubscribe?.();
        trackedTasksRef.current.delete(previous);
        previous.dispose();
        handleRef.current = undefined;
        handleScopeRef.current = undefined;
        handleOwnerRef.current = undefined;
        if (
          previousTracked?.reservation &&
          !hasUnresolvedTask(previous.getTask())
        ) {
          depositTaskRegistry.release(
            previousTracked.reservation.ownerKey,
            previousTracked.reservation.token,
          );
        }
      }
      const token = handle.taskState
        ? depositTaskRegistry.reserve(owner.ownerKey, handle.taskState)
        : undefined;
      if (handle.taskState && !token) {
        handle.dispose();
        throw new OneKeyLocalError('Another deposit task is still pending');
      }
      if (token && supportsRecovery(handle)) {
        depositTaskRegistry.retainRecordingHandle(
          owner.ownerKey,
          token,
          handle,
        );
      }
      handleRef.current = handle;
      handleScopeRef.current = scope;
      handleOwnerRef.current = owner;
      const tracked: ITrackedTask = {
        handle,
        task: handle.getTask(),
        reservation: token ? { ownerKey: owner.ownerKey, token } : undefined,
      };
      trackedTasksRef.current.set(handle, tracked);
      if (supportsRecovery(handle)) {
        tracked.unsubscribe = handle.subscribeRecovery(() => {
          tracked.task = handle.getTask();
          if (
            eventsActiveRef.current &&
            committedOwnerRef.current?.ownerKey === owner.ownerKey &&
            detachedBlockersRef.current.get(owner.ownerKey) === tracked
          ) {
            setTask(tracked.task);
          }
        });
      }
      taskSnapshotRef.current = handle.getTask();
      if (eventsActiveRef.current) setTask(taskSnapshotRef.current);
      return true;
    },
    [owner, scope],
  );

  const onTaskChange = useCallback(
    (next: IDepositTask) => {
      if (
        eventsActiveRef.current &&
        owner === committedOwnerRef.current &&
        handleOwnerRef.current === owner &&
        ((scope === committedScopeRef.current &&
          handleScopeRef.current === scope) ||
          hasUnresolvedTask(next) ||
          hasUnresolvedTask(taskSnapshotRef.current)) &&
        handleRef.current?.getTask().taskId === next.taskId
      ) {
        taskSnapshotRef.current = next;
        setTask(next);
      }
    },
    [owner, scope],
  );

  const clearTask = useCallback(() => {
    const handle = getCurrentHandle();
    if (!handle) return;
    handleRef.current = undefined;
    taskSnapshotRef.current = undefined;
    const tracked = trackedTasksRef.current.get(handle);
    tracked?.unsubscribe?.();
    trackedTasksRef.current.delete(handle);
    handle.dispose();
    if (tracked?.reservation && !hasUnresolvedTask(handle.getTask())) {
      depositTaskRegistry.release(
        tracked.reservation.ownerKey,
        tracked.reservation.token,
      );
    }
    if (eventsActiveRef.current) setTask(undefined);
  }, [getCurrentHandle]);

  const clearRecordingTask = useCallback(
    (taskId: string, txid: string) => {
      const detached = detachedBlockersRef.current.get(owner.ownerKey);
      const handle = detached?.handle ?? handleRef.current;
      const current = handle?.getTask();
      if (
        owner !== committedOwnerRef.current ||
        (!detached && handleOwnerRef.current !== owner) ||
        !handle ||
        current?.taskId !== taskId ||
        current.recording?.txid !== txid ||
        !hasRecording(current)
      )
        return false;
      if (detached) detachedBlockersRef.current.delete(owner.ownerKey);
      if (handleRef.current === handle) handleRef.current = undefined;
      const tracked = trackedTasksRef.current.get(handle);
      tracked?.unsubscribe?.();
      trackedTasksRef.current.delete(handle);
      taskSnapshotRef.current = undefined;
      handle.dispose();
      if (tracked?.reservation) {
        depositTaskRegistry.release(
          tracked.reservation.ownerKey,
          tracked.reservation.token,
        );
      }
      if (eventsActiveRef.current) setTask(undefined);
      return true;
    },
    [owner],
  );

  const finishRecordingTask = useCallback(
    (
      taskId: string,
      txid: string,
      canFinish?: () => boolean,
      allowRemoteUnknown = false,
    ): Promise<boolean> => {
      const detached = detachedBlockersRef.current.get(owner.ownerKey);
      const handle = detached?.handle ?? handleRef.current;
      if (!handle) {
        return (async () => {
          const entry = depositTaskRegistry.find(owner.ownerKey);
          const current = entry?.state.getTask();
          const deposit = current?.steps.at(-1);
          if (
            !entry ||
            !current ||
            owner !== committedOwnerRef.current ||
            (canFinish && !canFinish()) ||
            current.taskId !== taskId ||
            current.recording?.txid !== txid ||
            !hasRecording(current) ||
            !deposit?.attemptId ||
            !canFinishRecording(current.recording.status, allowRemoteUnknown)
          )
            return false;
          let accountMatches = false;
          try {
            accountMatches = await isTaskAccountCurrent(current.identity);
          } catch {
            return false;
          }
          if (
            !accountMatches ||
            !(await isRecordingFinal(current, allowRemoteUnknown))
          )
            return false;
          const latest = entry.state.getTask();
          if (
            !accountMatches ||
            owner !== committedOwnerRef.current ||
            (canFinish && !canFinish()) ||
            depositTaskRegistry.find(owner.ownerKey) !== entry ||
            latest.taskId !== taskId ||
            latest.steps.at(-1)?.attemptId !== deposit.attemptId ||
            latest.recording?.txid !== txid ||
            !hasRecording(latest) ||
            !canFinishRecording(latest.recording.status, allowRemoteUnknown)
          )
            return false;
          return depositTaskRegistry.release(owner.ownerKey, entry.token);
        })();
      }
      const existing = finishFlightRef.current;
      if (
        existing &&
        existing.owner === owner &&
        existing.handle === handle &&
        existing.taskId === taskId &&
        existing.txid === txid &&
        existing.allowRemoteUnknown === allowRemoteUnknown
      ) {
        if (!canFinish) existing.allowManual = true;
        return existing.promise;
      }
      const flight = {
        owner,
        handle,
        taskId,
        txid,
        allowManual: !canFinish,
        allowRemoteUnknown,
        promise: Promise.resolve(false),
      };
      flight.promise = (async () => {
        const current = handle?.getTask();
        const deposit = current?.steps.at(-1);
        if (
          owner !== committedOwnerRef.current ||
          (!flight.allowManual && canFinish && !canFinish()) ||
          (!detached && handleOwnerRef.current !== owner) ||
          !handle ||
          !current ||
          current.taskId !== taskId ||
          current.recording?.txid !== txid ||
          !hasRecording(current) ||
          !deposit?.attemptId ||
          !canFinishRecording(current.recording.status, allowRemoteUnknown)
        )
          return false;
        let accountMatches = false;
        try {
          accountMatches = await isTaskAccountCurrent(current.identity);
        } catch {
          return false;
        }
        if (
          !accountMatches ||
          !(await isRecordingFinal(current, allowRemoteUnknown))
        )
          return false;
        const latest = handle.getTask();
        if (
          !accountMatches ||
          owner !== committedOwnerRef.current ||
          (!flight.allowManual && canFinish && !canFinish()) ||
          (detached
            ? detachedBlockersRef.current.get(owner.ownerKey) !== detached
            : handleOwnerRef.current !== owner ||
              handleRef.current !== handle) ||
          latest.taskId !== taskId ||
          latest.steps.at(-1)?.attemptId !== deposit.attemptId ||
          latest.recording?.txid !== txid ||
          !canFinishRecording(latest.recording.status, allowRemoteUnknown)
        )
          return false;
        return clearRecordingTask(taskId, txid);
      })();
      finishFlightRef.current = flight;
      void flight.promise.then(
        () => {
          if (finishFlightRef.current === flight)
            finishFlightRef.current = undefined;
        },
        () => {
          if (finishFlightRef.current === flight)
            finishFlightRef.current = undefined;
        },
      );
      return flight.promise;
    },
    [clearRecordingTask, owner],
  );

  const clearTaskBeforeAnySend = useCallback(() => {
    const handle = getCurrentHandle();
    const currentTask = handle?.getTask();
    const current = currentTask?.steps[currentTask.currentStepIndex];
    const safeToEdit =
      (current?.status.type === 'cancelled' ||
        (current?.status.type === 'failed' &&
          current.status.stage === 'beforeSend')) &&
      currentTask?.steps.every(
        (step) =>
          step.status.type === 'waiting' ||
          step.status.type === 'ready' ||
          step.status.type === 'skipped' ||
          step.status.type === 'cancelled' ||
          (step.status.type === 'failed' && step.status.stage === 'beforeSend'),
      );
    if (!handle || !safeToEdit) return false;
    clearTask();
    return true;
  }, [clearTask, getCurrentHandle]);

  useEffect(() => {
    const trackedTasks = trackedTasksRef.current;
    eventsActiveRef.current = true;
    return () => {
      eventsActiveRef.current = false;
      trackedTasks.forEach(({ handle, unsubscribe, reservation }) => {
        unsubscribe?.();
        handle.dispose();
        if (reservation && !hasUnresolvedTask(handle.getTask())) {
          depositTaskRegistry.release(reservation.ownerKey, reservation.token);
        }
      });
      trackedTasks.clear();
    };
  }, []);

  const currentTask = handleRef.current?.getTask();
  const detachedTask = detachedBlockersRef.current.get(owner.ownerKey)?.task;
  let retainedSnapshot = externalRecovery?.task;
  if (externalRecovery === undefined && restored?.ownerKey === ownerKey) {
    retainedSnapshot = restored.task;
  }
  let visibleTask = detachedTask ?? retainedSnapshot;
  if (
    currentTask &&
    handleOwnerRef.current === owner &&
    (handleScopeRef.current === scope || hasUnresolvedTask(currentTask))
  ) {
    visibleTask = handleScopeRef.current === scope ? task : currentTask;
  }
  return {
    task: visibleTask,
    getRetainedTaskState,
    canFinishRestoredRecording: Boolean(
      retainedSnapshot &&
      hasRecording(retainedSnapshot) &&
      ['succeeded', 'superseded', 'notTracked', 'remoteUnknown'].includes(
        retainedSnapshot.recording?.status ?? '',
      ),
    ),
    getCurrentHandle,
    getRecordingHandle,
    onTaskReady,
    onTaskChange,
    clearTask,
    clearRecordingTask,
    finishRecordingTask,
    clearTaskBeforeAnySend,
  };
}
