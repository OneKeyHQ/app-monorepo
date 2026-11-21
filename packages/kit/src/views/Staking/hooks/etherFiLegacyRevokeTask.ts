import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { createEarnSingleTransactionTaskState } from '../../Earn/tasks/singleTransactionTaskState';

/** One approval confirmation may contain several device-rejected attempts. */
export function createEtherFiLegacyRevokeTask({
  accountId,
  accountAddress,
  networkId,
  vault,
  tokenAddress,
  spenderAddress,
}: {
  accountId: string;
  accountAddress?: string;
  networkId: string;
  vault?: string;
  tokenAddress: string;
  spenderAddress: string;
}) {
  const stepId = 'revoke-legacy-approval';
  let attemptId = generateUUID();
  let sendStarted = false;
  let submitted = false;
  const state = createEarnSingleTransactionTaskState({
    taskId: generateUUID(),
    identity: {
      accountId,
      accountAddress,
      networkId,
      provider: 'etherfi',
      action: 'revokeLegacyApproval',
      intent: { vault, tokenAddress, spenderAddress, amount: '0' },
    },
    step: { id: stepId, kind: 'approve' as const },
    lateSubmitted: 'unknown',
  });
  const dispatch = (
    type:
      | 'start'
      | 'retry'
      | 'confirmationOpened'
      | 'sendStarted'
      | 'sendBlocked'
      | 'outcomeUnknown'
      | 'fail'
      | 'cancel'
      | 'skip'
      | 'handoff',
  ) => state.dispatch(stepId, attemptId, { type });
  const status = () => state.getTask().steps[0]?.status.type;
  return {
    getTask: state.getTask,
    subscribe: state.subscribe,
    run: async <TPrepared>({
      prepare,
      navigate,
    }: {
      prepare: () => Promise<
        { type: 'skip' | 'cancel' } | { type: 'confirm'; prepared: TPrepared }
      >;
      navigate: (prepared: TPrepared) => Promise<void>;
    }) => {
      if (!dispatch('start')) return;
      try {
        const preparation = await prepare();
        if (preparation.type !== 'confirm') {
          dispatch(preparation.type);
          return;
        }
        if (!dispatch('confirmationOpened'))
          throw new OneKeyLocalError('Unable to prepare legacy approval');
        await navigate(preparation.prepared);
      } catch (error) {
        if (status() === 'sending') dispatch('outcomeUnknown');
        else if (status() === 'awaitingUser' || status() === 'preparing')
          dispatch('fail');
        throw error;
      }
    },
    beginSend: () => {
      const current = state.getTask().steps[0]?.status;
      if (current?.type === 'failed' && current.stage === 'beforeSend') {
        attemptId = generateUUID();
        if (!dispatch('retry') || !dispatch('confirmationOpened'))
          throw new OneKeyLocalError('Unable to retry legacy approval');
      }
      dispatch('sendStarted');
      sendStarted = true;
      return { taskId: state.getTask().taskId, attemptId };
    },
    fail: (rejectedBeforeBroadcast: boolean) => {
      if (submitted) return;
      if (status() === 'sending' && rejectedBeforeBroadcast)
        dispatch('sendBlocked');
      else if (status() === 'sending') dispatch('outcomeUnknown');
      else if (status() === 'awaitingUser' || status() === 'preparing')
        dispatch('fail');
    },
    cancel: () => {
      if (status() === 'sending') dispatch('outcomeUnknown');
      else if (status() === 'awaitingUser' || status() === 'preparing')
        dispatch('cancel');
    },
    submit: (txid: string) => {
      if (submitted) return false;
      if (
        !state.dispatch(stepId, attemptId, { type: 'submitted', txid }) &&
        !state.dispatch(stepId, attemptId, {
          type: 'lateBroadcastAccepted',
          txid,
        })
      )
        return false;
      submitted = true;
      if (txid.trim()) dispatch('handoff');
      return true;
    },
    acceptLateBroadcast: (txid: string) => {
      if (
        !state.dispatch(stepId, attemptId, {
          type: 'lateBroadcastAccepted',
          txid,
        })
      )
        return false;
      submitted = true;
      return true;
    },
    didStartSend: () => sendStarted,
    didSubmit: () => submitted,
    hasUncertainOutcome: () => status() === 'unknown',
  };
}
