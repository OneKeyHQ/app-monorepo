import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type { IRepayWithCollateralQuote } from '@onekeyhq/shared/types/staking';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { createEarnWorkflowTaskController } from '../../Earn/tasks/earnWorkflowTaskController';
import { createEarnWorkflowTask } from '../../Earn/tasks/earnWorkflowTaskState';

import type { IEarnWorkflowTaskStep } from '../../Earn/tasks/earnWorkflowTaskState';

type IIdentity<TIntent> = {
  accountId: string;
  accountAddress: string;
  networkId: string;
  provider: string;
  action: 'repayWithCollateral';
  intent: TIntent;
};
type IBuilt = {
  tx: string;
  orderId?: string;
  quote?: IRepayWithCollateralQuote;
};
type IRecording =
  | 'notStarted'
  | 'pending'
  | 'saved'
  | 'localFailed'
  | 'remoteUnknown'
  | 'notTracked';
type IFacts = {
  orderId?: string;
  recording: IRecording;
  finality: 'notQueried' | 'pending' | 'confirmed' | 'failed';
  setupStatus?: EDecodedTxStatus;
  repayCallback: 'notStarted' | 'pending' | 'completed' | 'failed';
};
type IFact =
  | { type: 'built'; orderId?: string }
  | { type: 'recording'; value: IRecording; setupStatus?: EDecodedTxStatus }
  | { type: 'repayCallback'; value: IFacts['repayCallback'] }
  | { type: 'finality'; value: IFacts['finality'] };
type IContext = {
  setup?: IBuilt;
  setupTxid?: string;
  quote?: IRepayWithCollateralQuote;
};
type ISetupSource = {
  getTask: () => { facts: IFacts | undefined; steps: IEarnWorkflowTaskStep[] };
  getSetupTask: () => {
    facts: IFacts | undefined;
    steps: IEarnWorkflowTaskStep[];
  };
  refreshSetupFinality: (
    reader: IFinalityReader,
  ) => Promise<'confirmed' | 'failed' | 'pending' | 'unavailable'>;
};
type IFinalityReader = {
  isCurrent: () => boolean;
  verify: () => Promise<void>;
  finality: (txid: string) => Promise<'finalized' | 'failed' | 'timeout'>;
};
type IConfirmArgs = {
  built: IBuilt;
  signal: AbortSignal;
  onBeforeSend: () => Promise<void>;
  onConfirmed: (
    txid: string,
    status?: EDecodedTxStatus,
    wasSettled?: boolean,
  ) => Promise<void>;
  onLateBroadcastAccepted: (txid: string) => Promise<boolean>;
  onCancelled: () => void;
  onFailed: () => void;
  onCompleted: () => void;
  onCallbackFailed: () => void;
};
export type IBorrowCollateralRepayTaskOwner<TIntent> = {
  isCurrent: () => boolean;
  verify: () => Promise<void>;
  buildSetup: (intent: TIntent, signal: AbortSignal) => Promise<IBuilt>;
  confirmSetup: (args: IConfirmArgs) => Promise<boolean>;
  recordSetup: (params: {
    txid: string;
    orderId?: string;
    status: EDecodedTxStatus;
    preserveExistingTx?: boolean;
  }) => Promise<Exclude<IRecording, 'notStarted' | 'pending'>>;
  finality: (txid: string) => Promise<'finalized' | 'failed' | 'timeout'>;
  propagate: () => Promise<void>;
  quote: (intent: TIntent) => Promise<IRepayWithCollateralQuote>;
  buildRepay: (
    intent: TIntent,
    quote: IRepayWithCollateralQuote | undefined,
    signal: AbortSignal,
  ) => Promise<IBuilt>;
  confirmRepay: (args: IConfirmArgs) => Promise<boolean>;
};

export function createBorrowCollateralRepayTask<TIntent>({
  identity,
  onAsyncError,
  failedMessage = 'Borrow transaction failed',
  preparation = 'setup',
  predecessor,
}: {
  identity: IIdentity<TIntent>;
  onAsyncError: (error: unknown) => void;
  failedMessage?: string;
  preparation?: 'setup' | 'freshQuote' | 'direct';
  predecessor?: ISetupSource;
}) {
  if (preparation === 'freshQuote' && !predecessor)
    throw new OneKeyLocalError('Missing Borrow setup task');
  let bound:
    | { token: symbol; owner: IBorrowCollateralRepayTaskOwner<TIntent> }
    | undefined;
  let writeFact: (
    stepId: string,
    attemptId: string,
    fact: IFact,
  ) => boolean = () => false;
  let readFacts: () => IFacts | undefined = () => undefined;
  let recordingFlight: Promise<void> | undefined;
  const recordSetup = (
    owner: IBorrowCollateralRepayTaskOwner<TIntent>,
    stepId: string,
    attemptId: string,
    txid: string,
    status: EDecodedTxStatus,
    orderId?: string,
    preserveExistingTx?: boolean,
  ) => {
    if (recordingFlight) return recordingFlight;
    if (
      !writeFact(stepId, attemptId, {
        type: 'recording',
        value: 'pending',
        setupStatus: status,
      })
    )
      return Promise.resolve();
    const flight = Promise.resolve()
      .then(() =>
        owner.recordSetup({
          txid,
          orderId,
          status,
          ...(preserveExistingTx ? { preserveExistingTx: true } : {}),
        }),
      )
      .then((value) => {
        writeFact(stepId, attemptId, { type: 'recording', value });
      })
      .catch(() => {
        writeFact(stepId, attemptId, {
          type: 'recording',
          value: 'remoteUnknown',
        });
      })
      .finally(() => {
        if (recordingFlight === flight) recordingFlight = undefined;
      });
    recordingFlight = flight;
    return flight;
  };
  const task = createEarnWorkflowTask({
    taskId: generateUUID(),
    identity,
    steps: [
      ...(preparation === 'setup'
        ? ([
            { id: 'setupBuilder', kind: 'external' },
            { id: 'setup', kind: 'protocol', lateSubmitted: 'confirming' },
            { id: 'finality', kind: 'wait' },
            { id: 'propagation', kind: 'wait' },
          ] as const)
        : []),
      ...(preparation === 'freshQuote'
        ? ([{ id: 'setupPrerequisite', kind: 'wait' }] as const)
        : []),
      ...(preparation !== 'direct'
        ? ([{ id: 'quote', kind: 'wait' }] as const)
        : []),
      { id: 'repay', kind: 'protocol', lateSubmitted: 'confirming' },
    ],
  });
  const controller = createEarnWorkflowTaskController<
    IIdentity<TIntent>,
    IContext,
    IBuilt,
    IFacts,
    IFact
  >({
    task,
    initialContext: {},
    retained: true,
    isCurrent: () => true,
    expiredMessage: 'Borrow transaction confirmation expired',
    onAsyncError,
    facts: {
      initial: {
        recording: 'notStarted',
        finality: 'notQueried',
        repayCallback: 'notStarted',
      },
      reduce: (state, event) => {
        if (event.type === 'built') return { ...state, orderId: event.orderId };
        if (event.type === 'recording') {
          if (
            state.recording === 'saved' ||
            state.recording === 'remoteUnknown' ||
            state.recording === 'notTracked'
          )
            return state;
          return {
            ...state,
            recording: event.value,
            setupStatus: event.setupStatus ?? state.setupStatus,
          };
        }
        if (event.type === 'repayCallback') {
          if (state.repayCallback === 'completed') return state;
          return { ...state, repayCallback: event.value };
        }
        if (state.finality === 'confirmed' || state.finality === 'failed')
          return state;
        return { ...state, finality: event.value };
      },
    },
    getAdapter: (step, context) => {
      const owner = bound?.owner;
      if (!owner) throw new OneKeyLocalError('Borrow task owner unavailable');
      if (step.id === 'setupBuilder')
        return {
          kind: 'external',
          prepare: async ({ context: current }) => current,
          execute: async ({ context: current, signal, stepId, attemptId }) => {
            const setup = await owner.buildSetup(identity.intent, signal);
            writeFact(stepId, attemptId, {
              type: 'built',
              orderId: setup.orderId,
            });
            return { type: 'completed', context: { ...current, setup } };
          },
        };
      if (step.id === 'setup' || step.id === 'repay')
        return {
          kind: 'transaction',
          handoffOnSubmit: true,
          submittedContext: (previous, txid) =>
            step.id === 'setup' ? { ...previous, setupTxid: txid } : previous,
          adapter: {
            prepare: async ({ signal }) => {
              await owner.verify();
              const built =
                step.id === 'setup'
                  ? context.setup
                  : {
                      ...(await owner.buildRepay(
                        identity.intent,
                        context.quote,
                        signal,
                      )),
                      quote: context.quote,
                    };
              if (!built?.tx)
                throw new OneKeyLocalError('Missing Borrow transaction');
              return { type: 'confirm', prepared: built };
            },
            confirm: async ({
              prepared,
              signal,
              onBeforeSend,
              onSubmitted,
              onConfirmationCancelled,
              onConfirmationFailed,
              onLateBroadcastAccepted,
              attemptId,
            }) => {
              let sendObserved = false;
              let recorded = false;
              const args: IConfirmArgs = {
                built: prepared,
                signal,
                onBeforeSend: async () => {
                  await owner.verify();
                  if (!sendObserved) {
                    onBeforeSend();
                    sendObserved = true;
                  }
                },
                onCancelled: () =>
                  onConfirmationCancelled(
                    sendObserved ? 'unknown' : 'beforeSend',
                  ),
                onFailed: () =>
                  onConfirmationFailed(sendObserved ? 'unknown' : 'beforeSend'),
                onCompleted: () => {
                  if (step.id === 'repay')
                    writeFact(step.id, attemptId, {
                      type: 'repayCallback',
                      value: 'completed',
                    });
                },
                onCallbackFailed: () => {
                  if (step.id === 'repay')
                    writeFact(step.id, attemptId, {
                      type: 'repayCallback',
                      value: 'failed',
                    });
                },
                onConfirmed: async (txid, status, wasSettled) => {
                  const accepted = onSubmitted(txid);
                  if (step.id === 'repay' && txid && accepted)
                    writeFact(step.id, attemptId, {
                      type: 'repayCallback',
                      value: 'pending',
                    });
                  if (step.id !== 'setup' || recorded || !txid) return;
                  recorded = true;
                  await recordSetup(
                    owner,
                    step.id,
                    attemptId,
                    txid,
                    status ?? EDecodedTxStatus.Pending,
                    prepared.orderId,
                    wasSettled,
                  );
                },
                onLateBroadcastAccepted: async (txid) => {
                  const accepted = onLateBroadcastAccepted(txid);
                  if (accepted && step.id === 'setup' && !recorded) {
                    recorded = true;
                    await recordSetup(
                      owner,
                      step.id,
                      attemptId,
                      txid,
                      EDecodedTxStatus.Pending,
                      prepared.orderId,
                      true,
                    );
                  }
                  return accepted;
                },
              };
              let success: boolean;
              try {
                success =
                  step.id === 'setup'
                    ? await owner.confirmSetup(args)
                    : await owner.confirmRepay(args);
              } catch (error) {
                if (step.id === 'repay')
                  writeFact(step.id, attemptId, {
                    type: 'repayCallback',
                    value: 'failed',
                  });
                throw error;
              }
              if (step.id === 'repay' && success)
                writeFact(step.id, attemptId, {
                  type: 'repayCallback',
                  value: 'completed',
                });
              return { type: success ? 'submitted' : 'cancelled' };
            },
            waitForFinalStatus: async () => 'unknown',
            verify: async () => false,
          },
        };
      if (step.id === 'finality')
        return {
          kind: 'wait',
          run: async ({ context: current, stepId, attemptId }) => {
            const recording = readFacts()?.recording;
            if (
              recording === 'pending' ||
              recording === 'localFailed' ||
              recording === 'notStarted'
            )
              return { type: 'unknown' };
            if (!current.setupTxid) return { type: 'unknown' };
            const result = await owner.finality(current.setupTxid);
            if (result === 'timeout')
              return {
                type: 'pending',
                context: current,
                fact: { type: 'finality', value: 'pending' },
              };
            writeFact(stepId, attemptId, {
              type: 'finality',
              value: result === 'finalized' ? 'confirmed' : 'failed',
            });
            if (result === 'failed') throw new OneKeyLocalError(failedMessage);
            return { type: 'completed', context: current };
          },
        };
      if (step.id === 'setupPrerequisite')
        return {
          kind: 'wait',
          run: async ({ context: current }) => {
            const previous = predecessor?.getSetupTask();
            const priorRepay = predecessor
              ?.getTask()
              .steps.find((item) => item.id === 'repay');
            const setup = previous?.steps.find((item) => item.id === 'setup');
            const propagation = previous?.steps.find(
              (item) => item.id === 'propagation',
            );
            const recording = previous?.facts?.recording;
            const finality = previous?.facts?.finality;
            if (
              !setup ||
              setup.status.type !== 'handedOff' ||
              propagation?.status.type !== 'completed' ||
              (priorRepay &&
                [
                  'awaitingUser',
                  'sending',
                  'confirming',
                  'verifying',
                  'unknown',
                ].includes(priorRepay.status.type)) ||
              (priorRepay?.status.type === 'handedOff' &&
                predecessor?.getTask().facts?.repayCallback !== 'completed') ||
              (recording !== 'saved' &&
                recording !== 'remoteUnknown' &&
                recording !== 'notTracked') ||
              (finality !== 'pending' && finality !== 'confirmed')
            )
              return { type: 'unknown' };
            return { type: 'completed', context: current };
          },
        };
      if (step.id === 'propagation')
        return {
          kind: 'wait',
          run: async ({ context: current }) => {
            await owner.propagate();
            return { type: 'completed', context: current };
          },
        };
      if (step.id === 'quote')
        return {
          kind: 'wait',
          run: async ({ context: current }) => {
            await owner.verify();
            const quote = await owner.quote(identity.intent);
            return { type: 'completed', context: { ...current, quote } };
          },
        };
      throw new OneKeyLocalError('Invalid Borrow collateral repay step');
    },
  });
  writeFact = (stepId, attemptId, fact) =>
    controller.recordFact({ stepId, attemptId, fact });
  readFacts = () => controller.getTask().facts;
  return {
    getTask: controller.getTask,
    getSetupTask: () => predecessor?.getSetupTask() ?? controller.getTask(),
    refreshSetupFinality: async (
      reader: IFinalityReader,
    ): Promise<'confirmed' | 'failed' | 'pending' | 'unavailable'> => {
      if (predecessor) return predecessor.refreshSetupFinality(reader);
      const snapshot = controller.getTask();
      if (
        snapshot.facts?.finality === 'confirmed' ||
        snapshot.facts?.finality === 'failed'
      )
        return snapshot.facts.finality;
      const setup = snapshot.steps.find((step) => step.id === 'setup');
      const wait = snapshot.steps.find((step) => step.id === 'finality');
      if (
        !reader.isCurrent() ||
        !setup ||
        !('txid' in setup.status) ||
        !setup.status.txid ||
        !wait?.attemptId
      )
        return 'unavailable';
      await reader.verify();
      if (!reader.isCurrent()) return 'unavailable';
      const result = await reader.finality(setup.status.txid);
      if (result === 'timeout') {
        const latest = controller.getTask().facts?.finality;
        return latest === 'confirmed' || latest === 'failed'
          ? latest
          : 'pending';
      }
      const next = result === 'finalized' ? 'confirmed' : 'failed';
      writeFact(wait.id, wait.attemptId, { type: 'finality', value: next });
      const finality = controller.getTask().facts?.finality;
      return finality === 'confirmed' ||
        finality === 'failed' ||
        finality === 'pending'
        ? finality
        : 'unavailable';
    },
    subscribe: controller.subscribe,
    attachOwner: (owner: IBorrowCollateralRepayTaskOwner<TIntent>) => {
      const token = controller.attachOwner(owner.isCurrent);
      bound = { token, owner };
      return token;
    },
    detachOwner: (token: symbol) => {
      const detached = controller.detachOwner(token);
      if (detached && bound?.token === token) bound = undefined;
      return detached;
    },
    run: controller.run,
    tryRun: controller.tryRun,
    tryRetryWait: controller.tryRetryWait,
    tryRetryTransaction: controller.tryRetryTransaction,
    retryRecording: async (token: symbol) => {
      const binding = bound;
      if (!binding || binding.token !== token || !binding.owner.isCurrent())
        return false;
      const snapshot = controller.getTask();
      const setup = snapshot.steps.find((step) => step.id === 'setup');
      if (
        !setup ||
        !setup.attemptId ||
        !('txid' in setup.status) ||
        !setup.status.txid ||
        snapshot.facts?.recording !== 'localFailed'
      )
        return false;
      await binding.owner.verify();
      if (bound !== binding || !binding.owner.isCurrent()) return false;
      await recordSetup(
        binding.owner,
        setup.id,
        setup.attemptId,
        setup.status.txid,
        snapshot.facts.setupStatus ?? EDecodedTxStatus.Pending,
        snapshot.facts.orderId,
      );
      return true;
    },
  };
}
