import { depositTaskRegistry } from './registry';
import { isTaskAccountCurrent } from './taskAccount';

import type { IDepositTask } from './state';

export function canDiscardDetachedSetup(task: IDepositTask) {
  const deposit = task.steps.at(-1);
  const setup = task.steps.slice(0, -1);
  // A cancelled step did not pass the send fence; cancellation after sending
  // becomes unknown and must keep its reservation for late broadcast recovery.
  return Boolean(
    !task.recording &&
    deposit?.kind === 'deposit' &&
    (deposit.status.type === 'waiting' ||
      deposit.status.type === 'ready' ||
      deposit.status.type === 'cancelled') &&
    setup.some((step) => step.status.type === 'succeeded') &&
    setup.every((step) =>
      ['waiting', 'ready', 'succeeded', 'skipped', 'cancelled'].includes(
        step.status.type,
      ),
    ),
  );
}

export async function discardDetachedSetup({
  ownerKey,
  task,
  canDiscard,
}: {
  ownerKey: string;
  task: IDepositTask;
  canDiscard: () => boolean;
}) {
  const entry = depositTaskRegistry.find(ownerKey);
  if (
    !entry ||
    !entry.detached ||
    entry.state.getTask() !== task ||
    !canDiscard() ||
    !canDiscardDetachedSetup(task)
  )
    return false;
  let accountMatches = false;
  try {
    accountMatches = await isTaskAccountCurrent(task.identity);
  } catch {
    return false;
  }
  if (
    !accountMatches ||
    !canDiscard() ||
    depositTaskRegistry.find(ownerKey) !== entry ||
    !entry.detached ||
    entry.state.getTask() !== task ||
    !canDiscardDetachedSetup(task)
  )
    return false;
  return depositTaskRegistry.release(ownerKey, entry.token);
}

export function hasRecording(task: IDepositTask | undefined) {
  const deposit = task?.steps.at(-1);
  return Boolean(
    task?.recording?.txid &&
    deposit?.kind === 'deposit' &&
    deposit.status.type === 'handedOff' &&
    deposit.status.txid === task.recording.txid,
  );
}

export function canFinishRecording(
  status: string,
  allowRemoteUnknown: boolean,
) {
  return (
    ['succeeded', 'superseded', 'notTracked'].includes(status) ||
    (allowRemoteUnknown && status === 'remoteUnknown')
  );
}

export async function finishRetainedRecording({
  ownerKey,
  taskId,
  txid,
  canFinish,
  allowRemoteUnknown = false,
  verifyRemoteUnknown,
}: {
  ownerKey: string;
  taskId: string;
  txid: string;
  canFinish: () => boolean;
  allowRemoteUnknown?: boolean;
  verifyRemoteUnknown?: (task: IDepositTask) => Promise<boolean>;
}) {
  const entry = depositTaskRegistry.find(ownerKey);
  const current = entry?.state.getTask();
  const deposit = current?.steps.at(-1);
  if (
    !entry ||
    !current ||
    !canFinish() ||
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
  if (!accountMatches) return false;
  if (
    current.recording.status === 'remoteUnknown' &&
    (!verifyRemoteUnknown || !(await verifyRemoteUnknown(current)))
  )
    return false;
  const latest = entry.state.getTask();
  if (
    !canFinish() ||
    depositTaskRegistry.find(ownerKey) !== entry ||
    latest.taskId !== taskId ||
    latest.steps.at(-1)?.attemptId !== deposit.attemptId ||
    latest.recording?.txid !== txid ||
    !hasRecording(latest) ||
    !canFinishRecording(latest.recording.status, allowRemoteUnknown)
  )
    return false;
  return depositTaskRegistry.release(ownerKey, entry.token);
}
