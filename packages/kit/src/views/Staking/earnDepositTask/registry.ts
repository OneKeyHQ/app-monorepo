import { normalizeTaskAccountAddress } from '@onekeyhq/kit/src/views/Earn/tasks/taskAddress';

import type { IRecoverableDepositTaskHandle } from './runDepositTask';
import type { IDepositTask, IDepositTaskState } from './state';

type IEntry = {
  ownerKey: string;
  state: IDepositTaskState;
  token: symbol;
  unsubscribe: () => void;
  recordingHandle?: IRecoverableDepositTaskHandle;
};

export function getDepositTaskOwnerKey({
  accountId,
  accountAddress,
  networkId,
  provider,
  vault,
}: {
  accountId: string;
  accountAddress?: string;
  networkId: string;
  provider?: string;
  vault?: string;
}) {
  return JSON.stringify([
    accountId,
    normalizeTaskAccountAddress(networkId, accountAddress),
    networkId,
    provider?.toLowerCase(),
    normalizeTaskAccountAddress(networkId, vault),
  ]);
}

function conflicts(a: IDepositTask, b: IDepositTask) {
  const left = a.identity;
  const right = b.identity;
  if (left.networkId !== right.networkId) return false;
  const sameAccount =
    left.accountId === right.accountId ||
    Boolean(
      left.accountAddress &&
      right.accountAddress &&
      normalizeTaskAccountAddress(left.networkId, left.accountAddress) ===
        normalizeTaskAccountAddress(right.networkId, right.accountAddress),
    );
  if (!sameAccount) return false;
  const sameVault =
    (!left.provider ||
      !right.provider ||
      left.provider.toLowerCase() === right.provider.toLowerCase()) &&
    (!left.vault ||
      !right.vault ||
      normalizeTaskAccountAddress(left.networkId, left.vault) ===
        normalizeTaskAccountAddress(right.networkId, right.vault));
  const bothWrap =
    a.steps.some((step) => step.kind === 'wrap') &&
    b.steps.some((step) => step.kind === 'wrap');
  // A planned approval can be inserted again after a later allowance check.
  const sameAllowance =
    a.steps.some(
      (step) => step.kind === 'approve' || step.kind === 'resetApproval',
    ) &&
    b.steps.some(
      (step) => step.kind === 'approve' || step.kind === 'resetApproval',
    ) &&
    Boolean(
      left.depositTokenAddress &&
      right.depositTokenAddress &&
      left.spenderAddress &&
      right.spenderAddress,
    ) &&
    normalizeTaskAccountAddress(left.networkId, left.depositTokenAddress) ===
      normalizeTaskAccountAddress(right.networkId, right.depositTokenAddress) &&
    normalizeTaskAccountAddress(left.networkId, left.spenderAddress) ===
      normalizeTaskAccountAddress(right.networkId, right.spenderAddress);
  return sameVault || bothWrap || sameAllowance;
}

export function createDepositTaskRegistry() {
  const entries = new Map<string, IEntry>();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    find: (ownerKey: string) => entries.get(ownerKey),
    reserve: (ownerKey: string, state: IDepositTaskState) => {
      const existing = entries.get(ownerKey);
      if (existing?.state === state) return existing.token;
      if (
        existing ||
        [...entries.values()].some((entry) =>
          conflicts(entry.state.getTask(), state.getTask()),
        )
      )
        return undefined;
      const token = Symbol('deposit-task-reservation');
      const unsubscribe = state.subscribe(notify);
      entries.set(ownerKey, { ownerKey, state, token, unsubscribe });
      notify();
      return token;
    },
    retainRecordingHandle: (
      ownerKey: string,
      token: symbol,
      handle: IRecoverableDepositTaskHandle,
    ) => {
      const entry = entries.get(ownerKey);
      if (!entry || entry.token !== token || entry.state !== handle.taskState)
        return false;
      entry.recordingHandle = handle;
      return true;
    },
    release: (ownerKey: string, token: symbol) => {
      const entry = entries.get(ownerKey);
      if (!entry || entry.token !== token) return false;
      entries.delete(ownerKey);
      entry.unsubscribe();
      notify();
      return true;
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const depositTaskRegistry = createDepositTaskRegistry();
