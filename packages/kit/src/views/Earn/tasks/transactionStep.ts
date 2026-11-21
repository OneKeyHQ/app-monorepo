export type IEarnTransactionStepStatus =
  | { type: 'waiting' }
  | { type: 'ready' }
  | { type: 'preparing' }
  | { type: 'awaitingUser' }
  | { type: 'sending' }
  | { type: 'confirming'; txid: string }
  | { type: 'verifying'; txid: string }
  | { type: 'succeeded'; txid: string }
  | { type: 'allowanceSatisfied'; txid: string }
  | { type: 'handedOff'; txid: string }
  | { type: 'skipped' }
  | { type: 'cancelled' }
  | { type: 'failed'; stage: 'beforeSend' }
  | { type: 'failed'; stage: 'onChain'; txid: string }
  | {
      type: 'unknown';
      txid?: string;
      chainConfirmed: boolean;
      txidConflict?: readonly string[];
    };

export type IEarnTransactionStepAction =
  | { type: 'start' }
  | { type: 'retry' }
  | { type: 'confirmationOpened' }
  | { type: 'sendStarted' }
  | { type: 'sendBlocked' }
  | { type: 'submitted'; txid: string }
  | { type: 'lateBroadcastAccepted'; txid: string }
  | { type: 'txidConflict'; txid: string }
  | { type: 'confirmed' }
  | { type: 'handoff' }
  | { type: 'verified' }
  | { type: 'allowanceSatisfied' }
  | { type: 'chainFailed' }
  | { type: 'fail' }
  | { type: 'cancel' }
  | { type: 'outcomeUnknown' }
  | { type: 'retryStatus' }
  | { type: 'skip' };

export type IEarnTransactionStepState = {
  attemptId?: string;
  status: IEarnTransactionStepStatus;
};

export function reduceEarnTransactionStep(
  step: IEarnTransactionStepState,
  event: IEarnTransactionStepAction & { attemptId: string },
  { lateSubmitted }: { lateSubmitted: 'unknown' | 'confirming' },
): (IEarnTransactionStepState & { advance: boolean }) | undefined {
  if (
    event.type !== 'start' &&
    event.type !== 'retry' &&
    event.attemptId !== step.attemptId
  )
    return undefined;

  let status: IEarnTransactionStepStatus;
  let attemptId = step.attemptId;
  let advance = false;
  switch (event.type) {
    case 'start':
      if (step.status.type !== 'ready' || !event.attemptId) return undefined;
      attemptId = event.attemptId;
      status = { type: 'preparing' };
      break;
    case 'retry':
      if (
        (step.status.type !== 'failed' && step.status.type !== 'cancelled') ||
        !event.attemptId ||
        event.attemptId === step.attemptId
      )
        return undefined;
      attemptId = event.attemptId;
      status = { type: 'preparing' };
      break;
    case 'confirmationOpened':
      if (step.status.type !== 'preparing') return undefined;
      status = { type: 'awaitingUser' };
      break;
    case 'sendStarted':
      if (step.status.type !== 'awaitingUser') return undefined;
      status = { type: 'sending' };
      break;
    case 'sendBlocked':
      if (
        step.status.type !== 'sending' &&
        !(
          step.status.type === 'unknown' &&
          !step.status.txid &&
          !step.status.chainConfirmed &&
          !step.status.txidConflict
        )
      )
        return undefined;
      status = { type: 'failed', stage: 'beforeSend' };
      break;
    case 'submitted':
      if (
        step.status.type !== 'sending' &&
        step.status.type !== 'awaitingUser' &&
        !(
          step.status.type === 'unknown' &&
          !step.status.txid &&
          !step.status.chainConfirmed &&
          !step.status.txidConflict
        )
      )
        return undefined;
      if (!event.txid.trim()) {
        status = { type: 'unknown', chainConfirmed: false };
      } else if (
        step.status.type === 'unknown' &&
        lateSubmitted === 'unknown'
      ) {
        status = {
          type: 'unknown',
          txid: event.txid.trim(),
          chainConfirmed: false,
        };
      } else {
        status = { type: 'confirming', txid: event.txid.trim() };
      }
      break;
    case 'lateBroadcastAccepted':
      if (
        !event.txid.trim() ||
        !['awaitingUser', 'sending', 'cancelled', 'failed', 'unknown'].includes(
          step.status.type,
        ) ||
        (step.status.type === 'failed' && step.status.stage !== 'beforeSend') ||
        (step.status.type === 'unknown' &&
          (step.status.txid || step.status.txidConflict))
      )
        return undefined;
      status = {
        type: 'unknown',
        txid: event.txid.trim(),
        chainConfirmed: false,
      };
      break;
    case 'txidConflict': {
      const first =
        step.status.type === 'confirming' ||
        step.status.type === 'verifying' ||
        step.status.type === 'unknown'
          ? step.status.txid
          : undefined;
      if (!first || !event.txid || first === event.txid) return undefined;
      status = {
        type: 'unknown',
        chainConfirmed: false,
        txidConflict: [first, event.txid],
      };
      break;
    }
    case 'confirmed':
      if (step.status.type !== 'confirming') return undefined;
      status = { type: 'verifying', txid: step.status.txid };
      break;
    case 'handoff':
      if (step.status.type !== 'confirming') return undefined;
      status = { type: 'handedOff', txid: step.status.txid };
      advance = true;
      break;
    case 'verified':
      if (step.status.type !== 'verifying') return undefined;
      status = { type: 'succeeded', txid: step.status.txid };
      advance = true;
      break;
    case 'allowanceSatisfied':
      if (step.status.type !== 'confirming') return undefined;
      status = { type: 'allowanceSatisfied', txid: step.status.txid };
      advance = true;
      break;
    case 'chainFailed':
      if (step.status.type !== 'confirming') return undefined;
      status = { type: 'failed', stage: 'onChain', txid: step.status.txid };
      break;
    case 'outcomeUnknown':
      if (step.status.type !== 'awaitingUser' && step.status.type !== 'sending')
        return undefined;
      status = { type: 'unknown', chainConfirmed: false };
      break;
    case 'fail':
    case 'cancel':
      switch (step.status.type) {
        case 'preparing':
        case 'awaitingUser':
          status =
            event.type === 'cancel'
              ? { type: 'cancelled' }
              : { type: 'failed', stage: 'beforeSend' };
          break;
        case 'sending':
          status = { type: 'unknown', chainConfirmed: false };
          break;
        case 'confirming':
        case 'verifying':
          status = {
            type: 'unknown',
            txid: step.status.txid,
            chainConfirmed: step.status.type === 'verifying',
          };
          break;
        default:
          return undefined;
      }
      break;
    case 'retryStatus':
      if (step.status.type !== 'unknown' || !step.status.txid) return undefined;
      status = {
        type: step.status.chainConfirmed ? 'verifying' : 'confirming',
        txid: step.status.txid,
      };
      break;
    case 'skip':
      if (step.status.type !== 'preparing') return undefined;
      status = { type: 'skipped' };
      advance = true;
      break;
    default:
      return undefined;
  }
  return { status, attemptId, advance };
}
