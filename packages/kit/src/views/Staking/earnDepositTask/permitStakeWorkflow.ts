import { normalizeTaskAccountAddress } from '@onekeyhq/kit/src/views/Earn/tasks/taskAddress';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createEarnTaskAdapterRegistration } from '../../Earn/tasks/earnTaskAdapterRegistration';
import { createEarnWorkflowTaskController } from '../../Earn/tasks/earnWorkflowTaskController';
import { createEarnWorkflowTask } from '../../Earn/tasks/earnWorkflowTaskState';

import type { buildEarnStakeConfirmation } from './transactionBuilder';
import type {
  IStakeWorkflowConfirmation,
  IStakeWorkflowHandoff,
  IStakeWorkflowIdentity,
} from './types';
import type { IEarnTaskScope } from '../../Earn/tasks/earnTaskPlan';

type IContext<TSigned> = {
  signed?: TSigned;
  confirmation?: IStakeWorkflowConfirmation;
};
type IPermitRecovery = {
  stepId: string;
  txid: string;
  status: 'confirmed' | 'failed';
};

/** Owns a permit signature and the subsequent deposit confirmation. */
export function createPermitStakeWorkflow<TSigned>({
  taskId,
  identity,
  sign,
  submit,
  isCurrent,
  isResultCurrent,
  onSubmitted,
  onAsyncError,
}: {
  taskId: string;
  identity: IStakeWorkflowIdentity & { accountAddress: string };
  sign: (signal: AbortSignal) => Promise<TSigned | undefined>;
  submit: (signed: TSigned, handoff: IStakeWorkflowHandoff) => Promise<void>;
  isCurrent: () => boolean;
  isResultCurrent: () => boolean;
  onSubmitted: (signed: TSigned) => void;
  onAsyncError: (error: unknown) => void;
}) {
  const registration =
    createEarnTaskAdapterRegistration<IStakeWorkflowConfirmation>();
  let registrationSignal: AbortSignal | undefined;
  let registrationOpen = false;
  let signedForAttempt: TSigned | undefined;
  const handoff: IStakeWorkflowHandoff = {
    get signal() {
      return registrationSignal;
    },
    accountAddress: identity.accountAddress,
    isResultCurrent,
    onSubmitted: () => {
      if (signedForAttempt !== undefined) {
        onSubmitted(signedForAttempt);
        signedForAttempt = undefined;
      }
    },
    register: async (nextIdentity, confirmation) => {
      if (
        !registrationOpen ||
        !isCurrent() ||
        !registrationSignal ||
        registrationSignal.aborted ||
        nextIdentity.accountId !== identity.accountId ||
        nextIdentity.networkId !== identity.networkId ||
        nextIdentity.provider.toLowerCase() !==
          identity.provider.toLowerCase() ||
        nextIdentity.intent.amount !== identity.intent.amount ||
        nextIdentity.intent.symbol !== identity.intent.symbol ||
        normalizeTaskAccountAddress(
          identity.networkId,
          nextIdentity.intent.inputTokenAddress,
        ) !==
          normalizeTaskAccountAddress(
            identity.networkId,
            identity.intent.inputTokenAddress,
          ) ||
        normalizeTaskAccountAddress(
          identity.networkId,
          nextIdentity.intent.protocolVault,
        ) !==
          normalizeTaskAccountAddress(
            identity.networkId,
            identity.intent.protocolVault,
          ) ||
        normalizeTaskAccountAddress(
          identity.networkId,
          nextIdentity.intent.spenderAddress,
        ) !==
          normalizeTaskAccountAddress(
            identity.networkId,
            identity.intent.spenderAddress,
          ) ||
        !nextIdentity.accountAddress ||
        normalizeTaskAccountAddress(
          identity.networkId,
          identity.accountAddress,
        ) !==
          normalizeTaskAccountAddress(
            identity.networkId,
            nextIdentity.accountAddress,
          ) ||
        !registration.register(confirmation)
      )
        return false;
      const signal = registrationSignal;
      let abort: () => void = () => undefined;
      const aborted = new Promise<false>((resolve) => {
        abort = () => resolve(false);
        if (signal.aborted) resolve(false);
        else signal.addEventListener('abort', abort, { once: true });
      });
      try {
        const result = await Promise.race([
          confirmation.navigation.then((value) => value === 'finished'),
          aborted,
        ]);
        return result && isCurrent();
      } finally {
        signal.removeEventListener('abort', abort);
      }
    },
  };
  const task = createEarnWorkflowTask({
    taskId,
    identity,
    steps: [
      { id: 'permit', kind: 'sign' },
      { id: 'prepareDeposit', kind: 'wait' },
      { id: 'deposit', kind: 'deposit', lateSubmitted: 'confirming' },
    ],
  });
  const controller = createEarnWorkflowTaskController<
    IEarnTaskScope,
    IContext<TSigned>,
    Awaited<ReturnType<typeof buildEarnStakeConfirmation>>,
    { recovery?: IPermitRecovery },
    IPermitRecovery
  >({
    task,
    initialContext: {},
    facts: { initial: {}, reduce: (_previous, fact) => ({ recovery: fact }) },
    isCurrent,
    expiredMessage: 'Stake confirmation expired',
    onAsyncError,
    getAdapter: (step, context) => {
      if (step.id === 'permit')
        return {
          kind: 'sign',
          run: async ({ signal }) => {
            const signed = await new Promise<TSigned | undefined>(
              (resolve, reject) => {
                const onAbort = () => resolve(undefined);
                if (signal.aborted) {
                  resolve(undefined);
                  return;
                }
                signal.addEventListener('abort', onAbort, { once: true });
                void Promise.resolve()
                  .then(() => sign(signal))
                  .then(
                    (value) => {
                      signal.removeEventListener('abort', onAbort);
                      resolve(value);
                    },
                    (error: unknown) => {
                      signal.removeEventListener('abort', onAbort);
                      reject(error);
                    },
                  );
              },
            );
            if (signed === undefined || signal.aborted)
              return { type: 'cancelled' };
            signedForAttempt = signed;
            return { type: 'completed', context: { signed } };
          },
        };
      const signed = context.signed;
      if (step.id === 'prepareDeposit' && signed !== undefined)
        return {
          kind: 'wait',
          run: async ({ signal }) => {
            registrationOpen = true;
            registrationSignal = signal;
            const operation = submit(signed, handoff);
            void operation.then(
              () => registration.cancel(),
              (error: unknown) => registration.fail(error),
            );
            try {
              const confirmation = await registration.wait(signal);
              return confirmation
                ? { type: 'completed', context: { confirmation } }
                : { type: 'cancelled' };
            } finally {
              registrationOpen = false;
            }
          },
        };
      if (step.id === 'deposit' && context.confirmation)
        return {
          kind: 'transaction',
          handoffOnSubmit: true,
          adapter: context.confirmation.adapter,
        };
      throw new OneKeyLocalError('Invalid stake workflow step');
    },
  });
  return {
    ...controller,
    recordRecovery: ({
      stepId,
      attemptId,
      txid,
      status,
    }: IPermitRecovery & { attemptId: string }) => {
      const snapshot = controller.getTask();
      const step = snapshot.steps[snapshot.currentStepIndex];
      if (
        step?.id !== stepId ||
        step.attemptId !== attemptId ||
        step.kind !== 'deposit' ||
        step.status.type !== 'unknown' ||
        step.status.txid !== txid ||
        step.status.txidConflict
      )
        return false;
      return controller.recordFact({
        stepId,
        attemptId,
        fact: { stepId, txid, status },
      });
    },
  };
}
