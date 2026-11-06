/** A capability binds one confirmation attempt to one planned external action. */
export type IEarnSignContinuationBinding = Readonly<{
  taskId: string;
  signStepId: string;
  signAttemptId: string;
  externalStepId: string;
  accountId: string;
  networkId: string;
  provider: string;
  requestId?: string;
}>;

export type IEarnSignContinuationState = Readonly<{
  status: 'created' | 'dispatched' | 'claimed' | 'closed';
}>;

export type IEarnSignContinuationEvent = {
  taskId: string;
  signStepId: string;
  signAttemptId: string;
  externalStepId: string;
  accountId: string;
  networkId: string;
  provider: string;
  requestId?: string;
  token: symbol;
} & (
  | { type: 'dispatch' | 'cancel' | 'deny' }
  | { type: 'signed'; hasPayload: boolean; eligible: boolean }
);

/** The token belongs to the caller's private runtime and is not task data. */
export function createEarnSignContinuationToken(): symbol {
  return Symbol('earn-sign-continuation');
}

export function createEarnSignContinuation(): IEarnSignContinuationState {
  return { status: 'created' };
}

/**
 * Atomically authorize at most one external step for one signed result.
 * The caller keeps the token private and derives eligibility from the bound intent.
 */
export function reduceEarnSignContinuation(
  state: IEarnSignContinuationState,
  event: IEarnSignContinuationEvent,
  expected: { binding: IEarnSignContinuationBinding; token: symbol },
): IEarnSignContinuationState {
  const { binding, token } = expected;
  if (
    event.token !== token ||
    event.taskId !== binding.taskId ||
    event.signStepId !== binding.signStepId ||
    event.signAttemptId !== binding.signAttemptId ||
    event.externalStepId !== binding.externalStepId ||
    event.accountId !== binding.accountId ||
    event.networkId !== binding.networkId ||
    event.provider !== binding.provider ||
    event.requestId !== binding.requestId
  )
    return state;
  if (event.type === 'dispatch' && state.status === 'created')
    return { ...state, status: 'dispatched' };
  if (
    (event.type === 'cancel' || event.type === 'deny') &&
    (state.status === 'created' || state.status === 'dispatched')
  )
    return { ...state, status: 'closed' };
  if (event.type === 'signed' && state.status === 'dispatched')
    return {
      ...state,
      status: event.hasPayload && event.eligible ? 'claimed' : 'closed',
    };
  return state;
}
