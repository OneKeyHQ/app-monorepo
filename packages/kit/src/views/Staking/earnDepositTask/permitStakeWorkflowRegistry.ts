import { normalizeTaskAccountAddress } from '@onekeyhq/kit/src/views/Earn/tasks/taskAddress';

import { createEarnTaskReservationRegistry } from '../../Earn/tasks/earnTaskReservationRegistry';

import type { createPermitStakeWorkflow } from './permitStakeWorkflow';

type IController = Pick<
  ReturnType<typeof createPermitStakeWorkflow>,
  'getTask' | 'recordRecovery'
>;
type IEntry = { ownerAccountId: string; controller: IController };

export function getPermitStakeWorkflowKey({
  networkId,
  accountAddress,
  provider,
  vault,
}: {
  networkId: string;
  accountAddress: string;
  provider: string;
  vault?: string;
}) {
  return JSON.stringify([
    networkId,
    normalizeTaskAccountAddress(networkId, accountAddress),
    provider.toLowerCase(),
    normalizeTaskAccountAddress(networkId, vault ?? ''),
  ]);
}

export function createPermitStakeWorkflowRegistry() {
  const entries = createEarnTaskReservationRegistry<string, IEntry>();
  const owned = (key: string, ownerAccountId: string, token: symbol) => {
    const entry = entries.find(key);
    return Boolean(
      entry &&
      entry.token === token &&
      entry.controller.ownerAccountId === ownerAccountId,
    );
  };
  return {
    find: (key: string, ownerAccountId: string) => {
      const entry = entries.find(key);
      if (!entry) return undefined;
      if (entry.controller.ownerAccountId !== ownerAccountId)
        return { kind: 'conflict' as const };
      return {
        kind: 'owned' as const,
        controller: entry.controller.controller,
        token: entry.token,
      };
    },
    reserve: (key: string, ownerAccountId: string, controller: IController) =>
      entries.reserve(key, { ownerAccountId, controller }),
    release: (key: string, ownerAccountId: string, token: symbol) =>
      owned(key, ownerAccountId, token) && entries.release(key, token),
    acquireRecovery: (key: string, ownerAccountId: string, token: symbol) =>
      owned(key, ownerAccountId, token)
        ? entries.acquireRecovery(key, token)
        : undefined,
    releaseRecovery: (
      key: string,
      ownerAccountId: string,
      token: symbol,
      lease: symbol,
    ) =>
      owned(key, ownerAccountId, token) &&
      entries.releaseRecovery(key, token, lease),
  };
}

export const permitStakeWorkflowRegistry = createPermitStakeWorkflowRegistry();
