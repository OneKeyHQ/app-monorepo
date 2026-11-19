import { useEffect, useSyncExternalStore } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type {
  IEarnFundingChange,
  IEarnFundingReceipt,
  IEarnFundingState,
} from '@onekeyhq/shared/types/earn/funding';

type IEarnFunding = IEarnFundingState | { status: 'preparing' };

const active = new Map<string, { id: string; claimed: boolean }>();
const saved = new Map<string, IEarnFundingState>();
const reads = new Map<string, Promise<IEarnFunding | undefined>>();
const listeners = new Set<() => void>();
const preparing = { status: 'preparing' } as const;
let revision = 0;

function notifyFundingChange() {
  revision += 1;
  listeners.forEach((listener) => listener());
}

export function subscribeEarnFunding(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getEarnFundingRevision = () => revision;

export function getEarnFunding(scope: string): IEarnFunding | undefined {
  const attempt = active.get(scope);
  return (
    saved.get(scope) ?? (attempt && !attempt.claimed ? preparing : undefined)
  );
}

function publishFunding(scope: string, state: IEarnFundingState | null) {
  if (state) saved.set(scope, state);
  else saved.delete(scope);
  notifyFundingChange();
}

export function refreshEarnFunding(scope: string) {
  const pending = reads.get(scope);
  if (pending) return pending;
  const request = backgroundApiProxy.serviceStaking.getEarnFunding(scope).then(
    (state) => {
      if (reads.get(scope) === request) {
        reads.delete(scope);
        publishFunding(scope, state);
      }
      return getEarnFunding(scope);
    },
    (error: unknown) => {
      if (reads.get(scope) === request) reads.delete(scope);
      throw error;
    },
  );
  reads.set(scope, request);
  return request;
}

export function useEarnFunding(scope?: string) {
  useSyncExternalStore(subscribeEarnFunding, getEarnFundingRevision);
  useEffect(() => {
    if (!scope) return;
    const refresh = () => {
      void refreshEarnFunding(scope).catch(() => {
        // The submit path rechecks storage before any transaction is sent.
      });
    };
    const onChange = (event: { scope: string }) => {
      if (event.scope !== scope) return;
      reads.delete(scope);
      refresh();
    };
    appEventBus.on(EAppEventBusNames.EarnFundingChanged, onChange);
    refresh();
    return () => {
      appEventBus.off(EAppEventBusNames.EarnFundingChanged, onChange);
    };
  }, [scope]);
  return scope ? getEarnFunding(scope) : undefined;
}

async function changeFunding(scope: string, change: IEarnFundingChange) {
  const result = await backgroundApiProxy.serviceStaking.changeEarnFunding(
    scope,
    change,
  );
  reads.delete(scope);
  publishFunding(scope, result.funding);
  return result;
}

export async function releaseEarnFunding(
  scope: string,
  expectedTxId?: string,
  expectedStatus: 'submitted' | 'funded' = expectedTxId
    ? 'submitted'
    : 'funded',
) {
  const state = getEarnFunding(scope);
  const txId =
    expectedTxId ?? (state?.status === 'funded' ? state.txId : undefined);
  if (!txId) return;
  const { applied } = await changeFunding(scope, {
    type: 'clear',
    status: expectedStatus,
    txId,
  });
  if (applied) {
    active.delete(scope);
    notifyFundingChange();
  }
}

export async function settleEarnFunding(
  scope: string,
  txId: string,
  receivedAmount: string,
) {
  await changeFunding(scope, { type: 'settled', txId, receivedAmount });
}

export async function completeEarnFunding(
  scope: string,
  txId: string,
  { keepDestination }: { keepDestination?: true } = {},
) {
  const result = await changeFunding(scope, {
    type: 'complete',
    txId,
    keepDestination,
  });
  if (!result.applied || !result.consumedScope) return false;
  active.delete(scope);
  active.delete(result.consumedScope);
  reads.delete(result.consumedScope);
  publishFunding(result.consumedScope, null);
  return true;
}

export function reserveEarnFunding(
  scope: string,
  {
    amount,
    group,
    positionBefore,
    source,
    startsGroup,
  }: {
    amount?: string;
    group?: string;
    positionBefore?: string;
    source?: IEarnFundingReceipt;
    startsGroup?: true;
  } = {},
) {
  if (!scope || getEarnFunding(scope)) return undefined;
  const attempt = { id: generateUUID(), claimed: false };
  const attemptId = attempt.id;
  active.set(scope, attempt);
  notifyFundingChange();
  return {
    markUnknown: async () => {
      if (active.get(scope) !== attempt) {
        throw new OneKeyLocalError('Earn funding ownership changed');
      }
      if (attempt.claimed) return;
      const { applied } = await changeFunding(scope, {
        type: 'claim',
        attemptId,
        group,
        intentAmount: amount,
        positionBefore,
        source,
        startsGroup,
      });
      if (!applied)
        throw new OneKeyLocalError(
          'Earn funding is already pending or unavailable',
        );
      if (active.get(scope) !== attempt) {
        await changeFunding(scope, { type: 'cancelled', attemptId });
        throw new OneKeyLocalError('Earn funding ownership changed');
      }
      attempt.claimed = true;
    },
    markSubmitted: async (txId: string) => {
      if (!attempt.claimed || active.get(scope) !== attempt) return;
      const { funding } = await changeFunding(scope, {
        type: 'submitted',
        attemptId,
        txId,
      });
      if (!funding || !('txId' in funding) || funding.txId !== txId) {
        throw new OneKeyLocalError(
          'Unable to associate the Earn funding transaction',
        );
      }
    },
    markFunded: async (receivedAmount: string) => {
      const phase = getEarnFunding(scope);
      if (active.get(scope) === attempt && phase?.status === 'submitted') {
        await settleEarnFunding(scope, phase.txId, receivedAmount);
      }
    },
    release: async () => {
      if (active.get(scope) !== attempt) return;
      try {
        await changeFunding(scope, { type: 'cancelled', attemptId });
      } finally {
        if (active.get(scope) === attempt) {
          active.delete(scope);
          notifyFundingChange();
        }
      }
    },
  };
}
