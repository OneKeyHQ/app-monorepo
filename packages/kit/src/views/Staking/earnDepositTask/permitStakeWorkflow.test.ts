import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { createEarnConfirmationTaskAdapter } from '../../Earn/tasks/confirmationTaskAdapter';

import { createPermitStakeWorkflow } from './permitStakeWorkflow';

import type { buildEarnStakeConfirmation } from './transactionBuilder';
import type {
  IStakeWorkflowConfirmation,
  IStakeWorkflowIdentity,
  IStakeWorkflowStep,
} from './types';
import type { IEarnTaskScope } from '../../Earn/tasks/earnTaskPlan';

const identity: IStakeWorkflowIdentity & { accountAddress: string } = {
  accountId: 'account',
  networkId: 'evm--1',
  accountAddress: '0xowner',
  provider: 'morpho',
  action: 'stake',
  intent: {
    amount: '1',
    symbol: 'USDC',
    inputTokenAddress: '0xtoken',
    protocolVault: '0xvault',
    spenderAddress: '0xspender',
  },
};

test('signs and hands off the registered deposit in one workflow without publishing the signature', async () => {
  const build = jest.fn();
  const confirmation: IStakeWorkflowConfirmation =
    createEarnConfirmationTaskAdapter<
      IEarnTaskScope,
      IStakeWorkflowStep,
      Awaited<ReturnType<typeof buildEarnStakeConfirmation>>,
      ISendTxOnSuccessData[],
      Error
    >({
      prepare: async () => {
        build();
        return {
          encodedTx: 'tx',
          stakeInfoWithOrderId: undefined,
          useFeeInTx: undefined,
          feeInfoEditable: undefined,
        };
      },
      navigate: async (_prepared, callbacks) => {
        callbacks.onSendObserved();
      },
      onObserverError: jest.fn(),
      getTxid: () => undefined,
      failureCertainty: () => 'unknown',
      cancellationCertainty: () => 'unknown',
    });
  const submit = jest.fn(
    async (
      _signed: string,
      handoff: {
        register: (
          scope: IStakeWorkflowIdentity,
          c: IStakeWorkflowConfirmation,
        ) => Promise<boolean>;
      },
    ) => {
      await handoff.register(identity, confirmation);
    },
  );
  const workflow = createPermitStakeWorkflow({
    taskId: 'permit-task',
    identity,
    sign: async () => 'private-permit',
    submit,
    isCurrent: () => true,
    isResultCurrent: () => true,
    onSubmitted: jest.fn(),
    onAsyncError: jest.fn(),
  });
  const snapshots: string[] = [];
  workflow.subscribe(() => snapshots.push(JSON.stringify(workflow.getTask())));
  await workflow.run();
  expect(build).toHaveBeenCalledTimes(1);
  expect(workflow.getTask().steps.map((step) => step.id)).toEqual([
    'permit',
    'prepareDeposit',
    'deposit',
  ]);
  expect(snapshots.join()).not.toContain('private-permit');
});

test('ends a cancelled preflight without opening the deposit', async () => {
  const workflow = createPermitStakeWorkflow({
    taskId: 'cancelled',
    identity,
    sign: async () => 'private',
    submit: async () => undefined,
    isCurrent: () => true,
    isResultCurrent: () => true,
    onSubmitted: jest.fn(),
    onAsyncError: jest.fn(),
  });
  await workflow.run();
  expect(workflow.getTask().steps[1].status.type).toBe('cancelled');
  expect(workflow.getTask().steps[2].status.type).toBe('waiting');
});

test('cancellation releases a pending signature and ignores its later result', async () => {
  let finish: (value: string) => void = () => undefined;
  const signature = new Promise<string>((resolve) => {
    finish = resolve;
  });
  const submit = jest.fn(async () => undefined);
  const workflow = createPermitStakeWorkflow({
    taskId: 'cancel-sign',
    identity,
    sign: async () => signature,
    submit,
    isCurrent: () => true,
    isResultCurrent: () => true,
    onSubmitted: jest.fn(),
    onAsyncError: jest.fn(),
  });
  const running = workflow.run();
  await Promise.resolve();
  workflow.cancel();
  await running;
  finish('late-signature');
  await Promise.resolve();
  expect(submit).not.toHaveBeenCalled();
  expect(JSON.stringify(workflow.getTask())).not.toContain('late-signature');
});

test.each([
  'amount',
  'inputTokenAddress',
  'protocolVault',
  'spenderAddress',
] as const)('rejects a deposit adapter with a different %s', async (field) => {
  const confirmation: IStakeWorkflowConfirmation =
    createEarnConfirmationTaskAdapter<
      IEarnTaskScope,
      IStakeWorkflowStep,
      Awaited<ReturnType<typeof buildEarnStakeConfirmation>>,
      ISendTxOnSuccessData[],
      Error
    >({
      prepare: async () => ({
        encodedTx: 'tx',
        stakeInfoWithOrderId: undefined,
        useFeeInTx: undefined,
        feeInfoEditable: undefined,
      }),
      navigate: async () => undefined,
      onObserverError: jest.fn(),
      getTxid: () => undefined,
      failureCertainty: () => 'unknown',
      cancellationCertainty: () => 'unknown',
    });
  let accepted: boolean | undefined;
  const workflow = createPermitStakeWorkflow({
    taskId: 'different-intent',
    identity,
    sign: async () => 'signed',
    submit: async (_signed, handoff) => {
      accepted = await handoff.register(
        { ...identity, intent: { ...identity.intent, [field]: 'different' } },
        confirmation,
      );
    },
    isCurrent: () => true,
    isResultCurrent: () => true,
    onSubmitted: jest.fn(),
    onAsyncError: jest.fn(),
  });
  await workflow.run();
  expect(accepted).toBe(false);
  expect(workflow.getTask().steps[1].status.type).toBe('cancelled');
  expect(workflow.getTask().steps[2].status.type).toBe('waiting');
});
