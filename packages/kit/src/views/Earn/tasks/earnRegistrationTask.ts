import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { createEarnWorkflowTaskController } from './earnWorkflowTaskController';
import { createEarnWorkflowTask } from './earnWorkflowTaskState';

import type { IEarnTaskScope } from './earnTaskPlan';

export type IEarnRegistrationIdentity = IEarnTaskScope & {
  accountAddress: string;
  action: 'register';
  intent: { symbol: string; mode: 'signed' | 'activation' };
};

type ISignedRegistration = { message: string; signature: string };
type IContext = { signed?: ISignedRegistration };

/** Models the signature and remote registration as separate workflow steps. */
export function createEarnRegistrationTask<
  TResult extends { result: boolean },
>({
  identity,
  sign,
  verify,
  ensureAccount,
  isCurrent,
}: {
  identity: IEarnRegistrationIdentity;
  sign?: (signal: AbortSignal) => Promise<ISignedRegistration>;
  verify: (signed?: ISignedRegistration) => Promise<TResult>;
  ensureAccount: () => Promise<void>;
  isCurrent: () => boolean;
}) {
  if (identity.intent.mode === 'signed' && !sign)
    throw new OneKeyLocalError('Registration signature is required');
  const task = createEarnWorkflowTask({
    taskId: generateUUID(),
    identity,
    steps: [
      ...(identity.intent.mode === 'signed'
        ? [{ id: 'sign', kind: 'sign' as const }]
        : []),
      { id: 'register', kind: 'external' },
    ],
  });
  let response: TResult | undefined;
  let cancelled = false;
  const controller = createEarnWorkflowTaskController<
    IEarnRegistrationIdentity,
    IContext
  >({
    task,
    initialContext: {},
    isCurrent,
    expiredMessage: 'Earn registration expired',
    onAsyncError: () => {
      console.error('Unable to update Earn registration task');
    },
    getAdapter: (step, context) => {
      if (step.id === 'sign' && sign)
        return {
          kind: 'sign',
          run: async ({ signal }) => {
            await ensureAccount();
            if (signal.aborted || !isCurrent()) return { type: 'cancelled' };
            const signed = await sign(signal);
            if (signal.aborted || !isCurrent()) return { type: 'cancelled' };
            return { type: 'completed', context: { signed } };
          },
        };
      if (step.id === 'register')
        return {
          kind: 'external',
          prepare: async () => {
            await ensureAccount();
            if (identity.intent.mode === 'signed' && !context.signed)
              throw new OneKeyLocalError('Registration signature is missing');
            return context;
          },
          execute: async ({ context: prepared }) => {
            response = await verify(prepared.signed);
            return { type: 'completed', context: prepared };
          },
        };
      throw new OneKeyLocalError('Invalid Earn registration step');
    },
  });
  return {
    ...controller,
    cancel() {
      cancelled = true;
      controller.cancel();
    },
    async runRegistration() {
      try {
        await controller.run();
      } catch (error) {
        if (cancelled || !isCurrent()) return undefined;
        throw error;
      }
      if (cancelled || !isCurrent()) return undefined;
      if (response === undefined)
        throw new OneKeyLocalError('Earn registration did not complete');
      return response;
    },
  };
}
