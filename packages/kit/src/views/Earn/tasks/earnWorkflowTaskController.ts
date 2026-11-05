import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { createEarnTaskStore } from './createEarnTaskStore';
import {
  createEarnSignContinuation,
  createEarnSignContinuationToken,
  reduceEarnSignContinuation,
} from './earnSignContinuation';
import { reduceEarnWorkflowTask } from './earnWorkflowTaskState';
import { createEarnTransactionTaskController } from './transactionTaskController';

import type {
  IEarnSignContinuationBinding,
  IEarnSignContinuationEvent,
  IEarnSignContinuationState,
} from './earnSignContinuation';
import type { IEarnTaskScope } from './earnTaskPlan';
import type {
  IEarnWorkflowPlanChange,
  IEarnWorkflowTask,
  IEarnWorkflowTaskEvent,
  IEarnWorkflowTaskStep,
} from './earnWorkflowTaskState';
import type { IEarnTransactionStepAction } from './transactionStep';
import type {
  IEarnTransactionTaskAdapter,
  IEarnTransactionTaskPreparation,
} from './transactionTaskController';

type ITransactionStep = Exclude<
  IEarnWorkflowTaskStep,
  { kind: 'sign' | 'external' | 'wait' }
>;
type IResult<TContext> =
  | { type: 'completed'; context: TContext }
  | { type: 'cancelled' }
  | { type: 'unknown' };
type IContext<TIdentity, TContext> = {
  identity: TIdentity;
  context: TContext;
  signal: AbortSignal;
  taskId: string;
  stepId: string;
  attemptId: string;
};
type ISignContinuation<TContext> = {
  claim: (params: {
    context: TContext;
    hasPayload: boolean;
    eligible: boolean;
  }) => boolean;
  close: () => void;
  completion: Promise<void>;
};
type ISignContext<TIdentity, TContext> = IContext<TIdentity, TContext> & {
  createContinuation: (params: {
    externalStepId: string;
    requestId?: string;
  }) => ISignContinuation<TContext>;
};
type ITransactionAdapter<TIdentity, TContext, TPrepared> = {
  kind: 'transaction';
  adapter: IEarnTransactionTaskAdapter<
    TIdentity,
    ITransactionStep,
    TPrepared,
    IEarnTransactionTaskPreparation<TPrepared, IEarnWorkflowPlanChange>
  >;
  handoffOnSubmit: boolean;
  allowanceCheckAfterMissingTxid?: string;
  submittedContext?: (context: TContext, txid: string) => TContext;
};
type IAdapter<TIdentity, TContext, TPrepared, TFactEvent> =
  | ITransactionAdapter<TIdentity, TContext, TPrepared>
  | {
      kind: 'sign';
      run: (
        context: ISignContext<TIdentity, TContext>,
      ) => Promise<
        | IResult<TContext>
        | { type: 'continued' }
        | { type: 'skipped'; context: TContext }
      >;
    }
  | {
      kind: 'wait';
      run: (
        context: IContext<TIdentity, TContext>,
      ) => Promise<
        | IResult<TContext>
        | { type: 'pending'; context: TContext; fact: TFactEvent }
      >;
    }
  | {
      kind: 'external';
      prepare: (context: IContext<TIdentity, TContext>) => Promise<TContext>;
      execute: (
        context: IContext<TIdentity, TContext>,
      ) => Promise<IResult<TContext>>;
    };

/** Owns one in-memory task and lease. Execution context is never published. */
export function createEarnWorkflowTaskController<
  TIdentity extends IEarnTaskScope,
  TContext,
  TPrepared = unknown,
  TFacts = undefined,
  TFactEvent = never,
>({
  task,
  initialContext,
  getAdapter,
  isCurrent,
  expiredMessage,
  onAsyncError,
  onStaleTransactionError,
  continuationHandlesError,
  retained = false,
  facts,
}: {
  task: IEarnWorkflowTask<TIdentity>;
  initialContext: TContext;
  getAdapter: (
    step: IEarnWorkflowTaskStep,
    context: TContext,
  ) => IAdapter<TIdentity, TContext, TPrepared, TFactEvent>;
  isCurrent: () => boolean;
  expiredMessage: string;
  onAsyncError: (error: unknown) => void;
  onStaleTransactionError?: (error: unknown) => void;
  continuationHandlesError?: () => boolean;
  retained?: boolean;
  facts?: {
    initial: TFacts;
    reduce: (facts: TFacts, event: TFactEvent) => TFacts;
  };
}) {
  type IState = IEarnWorkflowTask<TIdentity> & {
    facts: TFacts | undefined;
    signContinuation?: IEarnSignContinuationState;
  };
  type IEvent =
    | { kind: 'workflow'; event: IEarnWorkflowTaskEvent }
    | { kind: 'continuation'; event: IEarnSignContinuationEvent }
    | { kind: 'fact'; stepId: string; attemptId: string; fact: TFactEvent };
  let activeContinuation:
    | {
        binding: IEarnSignContinuationBinding;
        token: symbol;
        externalAttemptId?: string;
        restoreContext?: () => void;
        resolve: () => void;
        reject: (error: unknown) => void;
      }
    | undefined;
  const store = createEarnTaskStore<IState, IEvent>({
    initialState: { ...task, facts: facts?.initial },
    reduce: (state, action) => {
      if (action.kind === 'workflow') {
        const next = reduceEarnWorkflowTask(state, action.event);
        return next === state ? state : { ...next, facts: state.facts };
      }
      if (action.kind === 'continuation') {
        if (!state.signContinuation || !activeContinuation) return state;
        const next = reduceEarnSignContinuation(
          state.signContinuation,
          action.event,
          activeContinuation,
        );
        return next === state.signContinuation
          ? state
          : { ...state, signContinuation: next };
      }
      const step = state.steps.find((item) => item.id === action.stepId);
      if (
        !facts ||
        !step ||
        !action.attemptId ||
        step.attemptId !== action.attemptId ||
        state.facts === undefined
      )
        return state;
      const nextFacts = facts.reduce(state.facts, action.fact);
      return nextFacts === state.facts ? state : { ...state, facts: nextFacts };
    },
  });
  const owner = Symbol('earn-workflow');
  let context = initialContext;
  let running = false;
  let cancelled = false;
  let signal = new AbortController();
  let cancelTransaction: (() => void) | undefined;
  let resumeTransaction: (() => Promise<void>) | undefined;
  let resumeRequested = false;
  let resumeScheduled = false;
  let attachedOwner: { token: symbol; isCurrent: () => boolean } | undefined;
  const event = (
    stepId: string,
    attemptId: string,
    payload: IEarnWorkflowTaskEvent['payload'],
  ): IEarnWorkflowTaskEvent => ({
    taskId: task.taskId,
    stepId,
    attemptId,
    payload,
  });
  const apply = (
    stepId: string,
    attemptId: string,
    payload: IEarnWorkflowTaskEvent['payload'],
  ) =>
    store.dispatch({
      kind: 'workflow',
      event: event(stepId, attemptId, payload),
    });
  const recordFact = ({
    stepId,
    attemptId,
    fact,
  }: {
    stepId: string;
    attemptId: string;
    fact: TFactEvent;
  }) => store.dispatch({ kind: 'fact', stepId, attemptId, fact });
  const stopAttempt = () => {
    signal.abort();
    if (cancelTransaction) {
      cancelTransaction();
      return;
    }
    const step = store.getState().steps[store.getState().currentStepIndex];
    if (!step?.attemptId) return;
    if (
      step.kind === 'sign' ||
      step.kind === 'external' ||
      step.kind === 'wait'
    ) {
      apply(step.id, step.attemptId, { kind: step.kind, action: 'cancel' });
    }
  };
  const cancel = () => {
    cancelled = true;
    stopAttempt();
  };
  const hasRetainedSignContinuation = () => {
    const state = store.getState();
    const step = state.steps[state.currentStepIndex];
    return Boolean(
      activeContinuation &&
      ((state.signContinuation?.status === 'dispatched' &&
        step?.id === activeContinuation.binding.signStepId &&
        step.attemptId === activeContinuation.binding.signAttemptId &&
        step.status.type === 'running') ||
        (state.signContinuation?.status === 'claimed' &&
          step?.id === activeContinuation.binding.externalStepId &&
          step.attemptId === activeContinuation.externalAttemptId &&
          (step.status.type === 'preparing' ||
            step.status.type === 'executing'))),
    );
  };
  const ownerCurrent = (token?: symbol) =>
    retained
      ? Boolean(
          token && attachedOwner?.token === token && attachedOwner.isCurrent(),
        )
      : isCurrent();
  const attachOwner = (check: () => boolean) => {
    if (!retained || cancelled || attachedOwner)
      throw new OneKeyLocalError('Earn workflow owner unavailable');
    const token = Symbol('earn-workflow-owner');
    attachedOwner = { token, isCurrent: check };
    return token;
  };
  const detachOwner = (token: symbol) => {
    if (!retained || attachedOwner?.token !== token) return false;
    attachedOwner = undefined;
    if (!hasRetainedSignContinuation()) stopAttempt();
    return true;
  };
  const scheduleResume = (runOwner?: symbol) => {
    resumeRequested = true;
    if (resumeScheduled) return;
    resumeScheduled = true;
    queueMicrotask(() => {
      resumeScheduled = false;
      if (!resumeRequested || cancelled) return;
      if (!ownerCurrent(runOwner)) {
        resumeRequested = false;
        if (!retained) cancel();
        return;
      }
      if (running || store.owns(owner)) return;
      resumeRequested = false;
      void run(false, runOwner).catch(onAsyncError);
    });
  };
  const wrapConfirm =
    (
      adapter: ITransactionAdapter<TIdentity, TContext, TPrepared>,
      runCurrent: () => boolean,
      runOwner?: symbol,
    ): ITransactionAdapter<
      TIdentity,
      TContext,
      TPrepared
    >['adapter']['confirm'] =>
    (params) => {
      let submitted = false;
      let submittedWithoutTxid = false;
      let settled = false;
      return adapter.adapter.confirm({
        ...params,
        onSubmitted: (txid) => {
          if (adapter.adapter.confirmationLifecycle === 'detached')
            apply(params.step.id, params.attemptId, {
              kind: 'confirmationCallbackPending',
            });
          const previous = context;
          const snapshot = store.getState();
          const active = snapshot.steps[snapshot.currentStepIndex];
          const canSet =
            !cancelled &&
            (runCurrent() || retained) &&
            active?.id === params.step.id &&
            active.attemptId === params.attemptId &&
            !!txid.trim();
          if (canSet && adapter.submittedContext)
            context = adapter.submittedContext(context, txid.trim());
          const accepted = params.onSubmitted(txid);
          if (!accepted) context = previous;
          submitted = submitted || accepted;
          const after = store.getState();
          const current = after.steps[after.currentStepIndex];
          if (
            !txid.trim() &&
            !cancelled &&
            runCurrent() &&
            current?.id === params.step.id &&
            current.attemptId === params.attemptId &&
            current.kind === 'approve' &&
            current.status.type === 'unknown' &&
            !current.status.txid &&
            !current.status.chainConfirmed &&
            !current.status.txidConflict &&
            current.confirmationCallback === 'pending'
          )
            submittedWithoutTxid = true;
          return accepted;
        },
        onConfirmationSettled: (result) => {
          if (settled) return;
          settled = true;
          if (result === 'failed') {
            apply(params.step.id, params.attemptId, {
              kind: 'confirmationCallbackFailed',
            });
            return;
          }
          if (cancelled || !runCurrent()) {
            apply(params.step.id, params.attemptId, {
              kind: 'confirmationCallbackSucceeded',
              handoff: false,
            });
            if (!retained) cancel();
            return;
          }
          const snapshot = store.getState();
          const current = snapshot.steps[snapshot.currentStepIndex];
          const allowanceCheckStepId =
            submittedWithoutTxid &&
            !submitted &&
            current?.id === params.step.id &&
            current.attemptId === params.attemptId &&
            current.kind === 'approve' &&
            current.status.type === 'unknown' &&
            !current.status.txid &&
            !current.status.chainConfirmed &&
            !current.status.txidConflict
              ? adapter.allowanceCheckAfterMissingTxid
              : undefined;
          if (
            !apply(params.step.id, params.attemptId, {
              kind: 'confirmationCallbackSucceeded',
              handoff: submitted && adapter.handoffOnSubmit,
              ...(allowanceCheckStepId ? { allowanceCheckStepId } : undefined),
            })
          )
            return;
          if (!submitted && !allowanceCheckStepId) return;
          scheduleResume(runOwner);
        },
      });
    };
  async function run(
    retryWait = false,
    runOwner?: symbol,
    retryTransaction = false,
    retrySign = false,
  ) {
    let retryingWait = retryWait;
    let retryingTransaction = retryTransaction;
    let retryingSign = retrySign;
    const runCurrent = () => ownerCurrent(runOwner);
    const valid = () =>
      (runCurrent() ||
        (retained &&
          hasRetainedSignContinuation() &&
          store.getState().signContinuation?.status === 'claimed')) &&
      !signal.signal.aborted &&
      store.owns(owner);
    if (retryWait) {
      const current = store.getState();
      const step = current.steps[current.currentStepIndex];
      if (
        step?.kind !== 'wait' ||
        (step.status.type !== 'unknown' &&
          !(
            retained &&
            (step.status.type === 'cancelled' || step.status.type === 'failed')
          ))
      )
        return;
    }
    if (retryingTransaction) {
      const current = store.getState().steps[store.getState().currentStepIndex];
      if (
        !retained ||
        !current ||
        current.kind === 'wait' ||
        current.kind === 'sign' ||
        current.kind === 'external' ||
        (current.status.type !== 'cancelled' &&
          current.status.type !== 'failed')
      )
        return;
    }
    if (retryingSign) {
      const step = store.getState().steps[store.getState().currentStepIndex];
      if (
        !retained ||
        step?.kind !== 'sign' ||
        (step.status.type !== 'cancelled' && step.status.type !== 'failed')
      )
        return;
    }
    if (
      cancelled ||
      running ||
      !runCurrent() ||
      store.owns(owner) ||
      !store.acquire(owner)
    )
      return;
    running = true;
    signal = new AbortController();
    const createTransaction = (
      adapter: ITransactionAdapter<TIdentity, TContext, TPrepared>,
    ) => {
      const isTransaction = (
        item: IEarnWorkflowTaskStep,
      ): item is ITransactionStep =>
        item.kind !== 'sign' &&
        item.kind !== 'external' &&
        item.kind !== 'wait';
      const getTransactionView = () => {
        const snapshot = store.getState();
        const steps = snapshot.steps.filter(isTransaction);
        const active = snapshot.steps[snapshot.currentStepIndex];
        return {
          ...snapshot,
          steps,
          currentStepIndex: steps.findIndex((item) => item.id === active?.id),
        };
      };
      const bind = (
        stepId: string,
        attemptId: string,
        action: IEarnTransactionStepAction,
      ) => event(stepId, attemptId, { kind: 'transaction', action });
      return createEarnTransactionTaskController({
        state: {
          getTask: getTransactionView,
          acquire: store.acquire,
          owns: store.owns,
          release: store.release,
          dispatch: (stepId, attemptId, action) =>
            store.dispatch({
              kind: 'workflow',
              event: bind(stepId, attemptId, action),
            }),
          dispatchBatch: (stepId, attemptId, actions) =>
            store.dispatchBatch(
              actions.map((action) => ({
                kind: 'workflow',
                event: bind(stepId, attemptId, action),
              })),
            ),
          applyPlanChange: (
            stepId,
            attemptId,
            change: IEarnWorkflowPlanChange,
          ) =>
            store.dispatch({
              kind: 'workflow',
              event: event(stepId, attemptId, { kind: 'planChange', change }),
            }),
        },
        adapter: {
          ...adapter.adapter,
          confirm: wrapConfirm(adapter, runCurrent, runOwner),
        },
        normalizePreparation: (value) => value,
        shouldHandoffOnSubmit: () =>
          adapter.handoffOnSubmit &&
          adapter.adapter.confirmationLifecycle !== 'detached',
        isCurrent: runCurrent,
        onChange: () => {},
        onError: (error) => {
          throw error;
        },
        onStaleError: onStaleTransactionError,
        expiredMessage,
        leaseOwner: owner,
      });
    };
    const createSignContinuation = (
      signStepId: string,
      signAttemptId: string,
      {
        externalStepId,
        requestId,
      }: { externalStepId: string; requestId?: string },
    ): ISignContinuation<TContext> => {
      const snapshot = store.getState();
      const signStep = snapshot.steps[snapshot.currentStepIndex];
      const nextStep = snapshot.steps[snapshot.currentStepIndex + 1];
      if (
        !retained ||
        !valid() ||
        signStep?.kind !== 'sign' ||
        signStep.id !== signStepId ||
        signStep.attemptId !== signAttemptId ||
        signStep.status.type !== 'running' ||
        nextStep?.kind !== 'external' ||
        nextStep.id !== externalStepId ||
        nextStep.status.type !== 'waiting' ||
        (snapshot.signContinuation &&
          snapshot.signContinuation.status !== 'closed' &&
          snapshot.signContinuation.status !== 'claimed')
      )
        throw new OneKeyLocalError('Invalid Earn sign continuation');
      const binding: IEarnSignContinuationBinding = {
        taskId: snapshot.taskId,
        signStepId,
        signAttemptId,
        externalStepId,
        accountId: snapshot.identity.accountId,
        networkId: snapshot.identity.networkId,
        provider: snapshot.identity.provider,
        requestId,
      };
      const token = createEarnSignContinuationToken();
      let resolve: () => void = () => undefined;
      let reject: (error: unknown) => void = () => undefined;
      const completion = new Promise<void>((done, fail) => {
        resolve = done;
        reject = fail;
      });
      const active = {
        binding,
        token,
        resolve,
        reject,
        externalAttemptId: undefined as string | undefined,
        restoreContext: undefined as (() => void) | undefined,
      };
      activeContinuation = active;
      store.update((current) => ({
        state: { ...current, signContinuation: createEarnSignContinuation() },
        result: undefined,
      }));
      store.dispatch({
        kind: 'continuation',
        event: { ...binding, token, type: 'dispatch' },
      });
      return {
        completion,
        close: () => {
          store.dispatch({
            kind: 'continuation',
            event: { ...binding, token, type: 'cancel' },
          });
        },
        claim: ({ context: nextContext, hasPayload, eligible }) => {
          if (
            activeContinuation !== active ||
            store.getState().signContinuation?.status !== 'dispatched'
          )
            return false;
          const signed: IEarnSignContinuationEvent = {
            ...binding,
            token,
            type: 'signed',
            hasPayload,
            eligible,
          };
          if (!hasPayload || !eligible) {
            store.dispatch({ kind: 'continuation', event: signed });
            return false;
          }
          const previous = context;
          active.restoreContext = () => {
            context = previous;
          };
          const externalAttemptId = generateUUID();
          active.externalAttemptId = externalAttemptId;
          context = nextContext;
          const committed = store.dispatchBatch([
            { kind: 'continuation', event: signed },
            {
              kind: 'workflow',
              event: event(signStepId, signAttemptId, {
                kind: 'sign',
                action: 'complete',
              }),
            },
            {
              kind: 'workflow',
              event: event(externalStepId, externalAttemptId, {
                kind: 'external',
                action: 'start',
              }),
            },
          ]);
          if (!committed) {
            active.externalAttemptId = undefined;
            active.restoreContext = undefined;
            context = previous;
          }
          return committed;
        },
      };
    };
    const failContinuation = (
      stepId: string,
      attemptId: string,
      error: unknown,
    ) => {
      if (
        stepId !== activeContinuation?.binding.externalStepId ||
        attemptId !== activeContinuation.externalAttemptId
      )
        return false;
      activeContinuation.restoreContext?.();
      activeContinuation.restoreContext = undefined;
      activeContinuation.reject(error);
      return true;
    };
    const finishContinuation = (stepId: string, attemptId: string) => {
      if (
        stepId !== activeContinuation?.binding.externalStepId ||
        attemptId !== activeContinuation.externalAttemptId
      )
        return;
      activeContinuation.restoreContext = undefined;
      activeContinuation.resolve();
    };
    try {
      while (valid()) {
        let currentTask = store.getState();
        let step = currentTask.steps[currentTask.currentStepIndex];
        if (
          resumeTransaction &&
          step &&
          step.kind !== 'sign' &&
          step.kind !== 'external' &&
          step.kind !== 'wait' &&
          !step.confirmationCallback &&
          (step.status.type === 'confirming' ||
            step.status.type === 'verifying' ||
            (step.status.type === 'unknown' && step.status.txid))
        ) {
          if (retained) {
            const currentAdapter = getAdapter(step, context);
            if (currentAdapter.kind !== 'transaction')
              throw new OneKeyLocalError('Incorrect Earn workflow adapter');
            const transaction = createTransaction(currentAdapter);
            cancelTransaction = transaction.cancel;
            resumeTransaction = transaction.retryStatusUnderLease;
          }
          await resumeTransaction();
          if (!valid()) return;
          const resumed = store.getState();
          if (resumed.currentStepIndex === currentTask.currentStepIndex) return;
          currentTask = resumed;
          step = currentTask.steps[currentTask.currentStepIndex];
        }
        const continuationAttemptId =
          step?.kind === 'external' &&
          step.status.type === 'preparing' &&
          currentTask.signContinuation?.status === 'claimed' &&
          step.id === activeContinuation?.binding.externalStepId &&
          step.attemptId === activeContinuation.externalAttemptId
            ? activeContinuation.externalAttemptId
            : undefined;
        if (
          !step ||
          (step.status.type !== 'ready' &&
            !continuationAttemptId &&
            !(
              retryingSign &&
              step.kind === 'sign' &&
              (step.status.type === 'cancelled' ||
                step.status.type === 'failed')
            ) &&
            !(
              retryingTransaction &&
              (step.status.type === 'cancelled' ||
                step.status.type === 'failed')
            ) &&
            !(
              retryingWait &&
              step.kind === 'wait' &&
              (step.status.type === 'unknown' ||
                (retained &&
                  (step.status.type === 'cancelled' ||
                    step.status.type === 'failed')))
            ))
        )
          return;
        const adapter = getAdapter(step, context);
        if (adapter.kind === 'transaction') {
          if (
            step.kind === 'sign' ||
            step.kind === 'external' ||
            step.kind === 'wait'
          )
            throw new OneKeyLocalError('Incorrect Earn workflow adapter');
          const transaction = createTransaction(adapter);
          cancelTransaction = transaction.cancel;
          resumeTransaction = transaction.retryStatusUnderLease;
          if (retryingTransaction) {
            retryingTransaction = false;
            await transaction.retryStepUnderLease();
          } else {
            await transaction.runStepUnderLease();
          }
          const after = store
            .getState()
            .steps.find((item) => item.id === step.id);
          if (
            after?.status.type !== 'awaitingUser' &&
            after?.status.type !== 'sending'
          )
            cancelTransaction = undefined;
          if (
            !valid() ||
            (store.getState().currentStepIndex ===
              currentTask.currentStepIndex &&
              store.getState().steps[currentTask.currentStepIndex]?.id ===
                step.id)
          )
            return;
        } else {
          cancelTransaction = undefined;
          resumeTransaction = undefined;
          if (step.kind !== adapter.kind)
            throw new OneKeyLocalError('Incorrect Earn workflow adapter');
          const attemptId = continuationAttemptId ?? generateUUID();
          if (!continuationAttemptId) {
            let waitAction: 'start' | 'retry' | 'retryFailed' = 'start';
            if (retryingWait)
              waitAction =
                step.status.type === 'failed' ? 'retryFailed' : 'retry';
            const started =
              adapter.kind === 'wait'
                ? apply(step.id, attemptId, {
                    kind: 'wait',
                    action: waitAction,
                  })
                : apply(step.id, attemptId, {
                    kind: adapter.kind,
                    action:
                      adapter.kind === 'sign' && retryingSign
                        ? 'retry'
                        : 'start',
                  });
            if (!started) return;
          }
          retryingWait = false;
          retryingSign = false;
          if (!valid()) {
            if (retained) stopAttempt();
            else cancel();
            return;
          }
          const parameters = {
            identity: currentTask.identity,
            context,
            signal: signal.signal,
            taskId: currentTask.taskId,
            stepId: step.id,
            attemptId,
          };
          try {
            let result:
              | IResult<TContext>
              | { type: 'continued' }
              | { type: 'skipped'; context: TContext }
              | { type: 'pending'; context: TContext; fact: TFactEvent };
            if (adapter.kind === 'external') {
              const prepared = await adapter.prepare(parameters);
              if (!valid()) {
                if (retained) stopAttempt();
                else cancel();
                failContinuation(
                  step.id,
                  attemptId,
                  new OneKeyLocalError(expiredMessage),
                );
                return;
              }
              if (
                !apply(step.id, attemptId, {
                  kind: 'external',
                  action: 'invoke',
                })
              )
                return;
              if (!valid()) {
                if (retained) stopAttempt();
                else cancel();
                failContinuation(
                  step.id,
                  attemptId,
                  new OneKeyLocalError(expiredMessage),
                );
                return;
              }
              result = await adapter.execute({
                ...parameters,
                context: prepared,
              });
            } else if (adapter.kind === 'sign')
              result = await adapter.run({
                ...parameters,
                createContinuation: (args) =>
                  createSignContinuation(step.id, attemptId, args),
              });
            else result = await adapter.run(parameters);
            if (!valid()) {
              if (retained) stopAttempt();
              else cancel();
              if (adapter.kind === 'external' && result.type === 'completed') {
                apply(step.id, attemptId, {
                  kind: 'external',
                  action: 'acceptedAfterInvalidation',
                });
                if (
                  step.id === activeContinuation?.binding.externalStepId &&
                  attemptId === activeContinuation.externalAttemptId
                )
                  activeContinuation.restoreContext?.();
                finishContinuation(step.id, attemptId);
              }
              return;
            }
            if (result.type === 'continued') {
              if (
                adapter.kind !== 'sign' ||
                !hasRetainedSignContinuation() ||
                store.getState().signContinuation?.status !== 'claimed'
              )
                throw new OneKeyLocalError(
                  'Invalid Earn sign continuation result',
                );
            } else if (result.type === 'pending') {
              if (adapter.kind !== 'wait' || !facts)
                throw new OneKeyLocalError(
                  'Invalid pending Earn workflow result',
                );
              const previousContext = context;
              context = result.context;
              let committed = false;
              try {
                committed = store.dispatchBatch([
                  {
                    kind: 'fact',
                    stepId: step.id,
                    attemptId,
                    fact: result.fact,
                  },
                  {
                    kind: 'workflow',
                    event: event(step.id, attemptId, {
                      kind: 'wait',
                      action: 'continuePending',
                    }),
                  },
                ]);
              } catch (error) {
                context = previousContext;
                throw error;
              }
              if (!committed) {
                context = previousContext;
                throw new OneKeyLocalError(
                  'Unable to retain pending Earn workflow',
                );
              }
            } else if (result.type === 'skipped') {
              if (adapter.kind !== 'sign')
                throw new OneKeyLocalError(
                  'Invalid skipped Earn workflow result',
                );
              context = result.context;
              apply(step.id, attemptId, { kind: 'sign', action: 'skip' });
            } else if (result.type === 'completed') {
              context = result.context;
              if (adapter.kind === 'external')
                apply(step.id, attemptId, {
                  kind: 'external',
                  action: 'accepted',
                });
              else if (adapter.kind === 'wait')
                apply(step.id, attemptId, { kind: 'wait', action: 'complete' });
              else
                apply(step.id, attemptId, { kind: 'sign', action: 'complete' });
              if (adapter.kind === 'external')
                finishContinuation(step.id, attemptId);
            } else {
              const action =
                result.type === 'unknown' && adapter.kind !== 'sign'
                  ? 'unknown'
                  : 'cancel';
              if (adapter.kind === 'external') {
                apply(step.id, attemptId, {
                  kind: 'external',
                  action: 'cancel',
                });
                failContinuation(
                  step.id,
                  attemptId,
                  new OneKeyLocalError('Earn external result is unavailable'),
                );
              } else if (adapter.kind === 'wait') {
                apply(step.id, attemptId, { kind: 'wait', action });
              } else {
                apply(step.id, attemptId, { kind: 'sign', action: 'cancel' });
              }
              return;
            }
          } catch (error) {
            if (!valid()) {
              if (retained) stopAttempt();
              else cancel();
            } else if (store.owns(owner))
              apply(step.id, attemptId, { kind: adapter.kind, action: 'fail' });
            if (
              adapter.kind === 'external' &&
              failContinuation(step.id, attemptId, error) &&
              continuationHandlesError?.()
            )
              return;
            throw error;
          }
        }
      }
    } finally {
      running = false;
      store.release(owner);
      if (resumeRequested && !cancelled) scheduleResume(runOwner);
    }
  }
  const tryExecute = async (
    token: symbol,
    mode: 'run' | 'retryWait' | 'retryTransaction' | 'retrySign',
  ): Promise<'started' | 'busy' | 'notCurrent' | 'unavailable'> => {
    if (!retained || cancelled || !ownerCurrent(token)) return 'notCurrent';
    if (running || store.owns(owner)) return 'busy';
    const state = store.getState();
    const step = state.steps[state.currentStepIndex];
    if (!step) return 'unavailable';
    const isTransaction =
      step.kind !== 'sign' && step.kind !== 'wait' && step.kind !== 'external';
    const canRun =
      step.status.type === 'ready' ||
      (isTransaction &&
        Boolean(resumeTransaction) &&
        (step.status.type === 'confirming' ||
          step.status.type === 'verifying' ||
          (step.status.type === 'unknown' &&
            'txid' in step.status &&
            Boolean(step.status.txid))));
    const canRetryWait =
      step.kind === 'wait' &&
      (step.status.type === 'unknown' ||
        step.status.type === 'cancelled' ||
        step.status.type === 'failed');
    const canRetryTransaction =
      isTransaction &&
      (step.status.type === 'cancelled' || step.status.type === 'failed');
    const canRetrySign =
      step.kind === 'sign' &&
      (step.status.type === 'cancelled' || step.status.type === 'failed');
    if (
      (mode === 'run' && !canRun) ||
      (mode === 'retryWait' && !canRetryWait) ||
      (mode === 'retryTransaction' && !canRetryTransaction) ||
      (mode === 'retrySign' && !canRetrySign)
    )
      return 'unavailable';
    await run(
      mode === 'retryWait',
      token,
      mode === 'retryTransaction',
      mode === 'retrySign',
    );
    return 'started';
  };
  return {
    getTask: store.getState,
    subscribe: (listener: () => void) =>
      store.subscribe(() => {
        try {
          listener();
        } catch (error) {
          // A committed transition must not be interrupted by its observer.
          queueMicrotask(() => {
            try {
              onAsyncError(error);
            } catch {
              console.error('Unable to report Earn task observer error');
            }
          });
        }
      }),
    attachOwner,
    detachOwner,
    recordFact,
    run: (token?: symbol) => run(false, token),
    retryWait: (token?: symbol) => run(true, token),
    retryTransaction: (token?: symbol) => run(false, token, true),
    retrySign: (token?: symbol) => run(false, token, false, true),
    tryRun: (token: symbol) => tryExecute(token, 'run'),
    tryRetryWait: (token: symbol) => tryExecute(token, 'retryWait'),
    tryRetryTransaction: (token: symbol) =>
      tryExecute(token, 'retryTransaction'),
    tryRetrySign: (token: symbol) => tryExecute(token, 'retrySign'),
    cancel,
  };
}
