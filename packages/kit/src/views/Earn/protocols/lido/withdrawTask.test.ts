import { isTaskEncodedTxOwner } from '@onekeyhq/kit/src/views/Earn/tasks/taskAccount';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import {
  EEarnLabels,
  EInternalDappEnum,
  EInternalStakingAction,
} from '@onekeyhq/shared/types/staking';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { createEarnWithdrawApprovalTask } from '../../tasks/earnWithdrawApprovalTask';
import { createEarnWorkflowTaskController } from '../../tasks/earnWorkflowTaskController';
import { createEarnWorkflowTask } from '../../tasks/earnWorkflowTaskState';

import { getLidoWithdrawSteps } from './withdrawPlan';
import {
  createLidoWithdrawFragment,
  createLidoWithdrawTask,
} from './withdrawTask';

import type {
  ILidoWithdrawContext,
  ILidoWithdrawPermit,
  ILidoWithdrawPrepared,
} from './withdrawTask';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

const mockRecordLateOrder = jest.fn(
  async (_params: unknown) => 'synced' as const,
);
jest.mock('../../tasks/lateEarnOrderRecorder', () => ({
  createLateEarnOrderRecorder: () => mockRecordLateOrder,
}));

type IParams = Parameters<typeof createLidoWithdrawTask>[0];
function harness(overrides: Partial<IParams> = {}) {
  const services: IParams['services'] = {
    getAccount: jest.fn(async () => ({ address: '0xaccount' })),
    buildPermit: jest.fn(async () => ({
      message: 'typed-data',
      deadline: 123,
    })),
    signMessage: jest.fn(async () => 'permit-secret'),
    buildUnstake: jest.fn(async () => ({
      tx: { to: 'contract', value: '0', data: 'data' },
      orderId: 'order-1',
    })),
    buildInternalTx: jest.fn(async () => 'encoded-tx'),
  };
  const navigation: { params?: Parameters<IParams['navigate']>[0] } = {};
  const navigate: IParams['navigate'] = jest.fn(async (params) => {
    navigation.params = params;
  });
  const onSuccess = jest.fn(async () => undefined);
  const params: IParams = {
    taskId: 'lido-task',
    accountId: 'account',
    networkId: 'evm--1',
    provider: 'lido',
    intent: {
      amount: '0',
      symbol: 'ETH',
      inputTokenAddress: 'steth',
      outputTokenAddress: 'eth',
      effectiveApy: '3',
      withdrawType: 'queued',
    },
    stakingInfo: { protocol: 'Lido', label: EEarnLabels.Withdraw, tags: [] },
    services,
    navigate,
    expiredMessage: 'expired',
    onSuccess,
    onObserverError: jest.fn(),
    ...overrides,
  };
  return {
    task: createLidoWithdrawTask(params),
    services,
    navigation,
    params,
    onSuccess,
  };
}

it('signs the original Lido typed data, builds withdrawal and returns on navigation', async () => {
  const { task, services, navigation, onSuccess } = harness();
  await expect(task.run()).resolves.toBe(true);
  expect(services.signMessage).toHaveBeenCalledWith({
    accountId: 'account',
    networkId: 'evm--1',
    request: { origin: 'https://lido.fi/', scope: 'ethereum' },
    unsignedMessage: {
      type: EMessageTypesEth.TYPED_DATA_V4,
      message: 'typed-data',
      payload: ['0xaccount', 'typed-data'],
    },
    walletInternalSign: true,
  });
  expect(services.buildUnstake).toHaveBeenCalledWith({
    amount: '0',
    symbol: 'ETH',
    inputTokenAddress: 'steth',
    outputTokenAddress: 'eth',
    effectiveApy: '3',
    withdrawType: 'queued',
    accountId: 'account',
    networkId: 'evm--1',
    expectedAccountAddress: '0xaccount',
    provider: 'lido',
    signature: 'permit-secret',
    deadline: 123,
  });
  expect(services.buildInternalTx).toHaveBeenCalledWith({
    accountId: 'account',
    networkId: 'evm--1',
    tx: { to: 'contract', value: '0', data: 'data' },
    internalDappType: EInternalDappEnum.Staking,
    stakingAction: EInternalStakingAction.Withdraw,
  });
  expect(navigation.params?.stakingInfo?.orderId).toBe('order-1');
  expect(onSuccess).not.toHaveBeenCalled();
  expect(JSON.stringify(task.getTask())).not.toContain('permit-secret');
  await expect(task.run()).resolves.toBe(false);
  expect(services.signMessage).toHaveBeenCalledTimes(1);
});

it('records a late confirmation on the original order after action scope is invalidated', async () => {
  let actionCurrent = true;
  let sendCurrent = true;
  const { task, navigation, onSuccess } = harness({
    isActionCurrent: () => actionCurrent,
    isSendCurrent: () => sendCurrent,
  });
  await expect(task.run()).resolves.toBe(true);
  actionCurrent = false;
  sendCurrent = false;
  task.cancel();
  await expect(navigation.params?.onBeforeSend?.()).rejects.toThrow('expired');
  const data = [
    { signedTx: { txid: 'txid' }, decodedTx: {} } as ISendTxOnSuccessData,
  ];
  await Promise.resolve(navigation.params?.onSuccess?.(data));
  expect(onSuccess).toHaveBeenCalledWith(
    data,
    expect.objectContaining({ orderId: 'order-1' }),
  );
  await expect(task.run()).resolves.toBe(false);
});

it('rejects a changed account after permit creation before asking for a signature', async () => {
  const base = harness();
  const services = {
    ...base.services,
    getAccount: jest
      .fn()
      .mockResolvedValueOnce({ address: '0xaccount' })
      .mockResolvedValue({ address: '0xother' }),
  };
  const { task } = harness({ services });
  await expect(task.run()).rejects.toThrow();
  expect(services.buildPermit).toHaveBeenCalledWith(
    expect.objectContaining({ expectedAccountAddress: '0xaccount' }),
  );
  expect(services.signMessage).not.toHaveBeenCalled();
  expect(services.buildUnstake).not.toHaveBeenCalled();
});

it('rejects an account that changed before the first backend resolution', async () => {
  const base = harness();
  const services = {
    ...base.services,
    getAccount: jest.fn(async () => ({ address: '0xother' })),
  };
  const { task } = harness({ services, expectedAccountAddress: '0xaccount' });
  await expect(task.run()).rejects.toThrow('Task account address changed');
  expect(services.buildPermit).not.toHaveBeenCalled();
  expect(services.signMessage).not.toHaveBeenCalled();
  expect(services.buildUnstake).not.toHaveBeenCalled();
});

it('discards a late signature if the actual account changed while signing', async () => {
  let finish: (value: string) => void = () => undefined;
  let markStarted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const pending = new Promise<string>((resolve) => {
    finish = resolve;
  });
  const base = harness();
  let address = '0xaccount';
  const services = {
    ...base.services,
    getAccount: jest.fn(async () => ({ address })),
    signMessage: jest.fn(() => {
      markStarted();
      return pending;
    }),
  };
  const { task, navigation } = harness({ services });
  const running = task.run();
  await started;
  address = '0xother';
  finish('late-secret');
  await expect(running).rejects.toThrow();
  expect(services.buildUnstake).not.toHaveBeenCalled();
  expect(navigation.params).toBeUndefined();
});

it('checks the frozen account before transaction send even without a UI send guard', async () => {
  const base = harness();
  let address = '0xaccount';
  const services = {
    ...base.services,
    getAccount: jest.fn(async () => ({ address })),
  };
  const { task, navigation } = harness({ services });
  await expect(task.run()).resolves.toBe(true);
  address = '0xother';
  await expect(navigation.params?.onBeforeSend?.()).rejects.toThrow();
});

it('rejects a scope change while the send owner address is being rechecked', async () => {
  const base = harness();
  let finish: (value: { address: string }) => void = () => undefined;
  const pending = new Promise<{ address: string }>((resolve) => {
    finish = resolve;
  });
  const getAccount = jest.fn(async () => ({ address: '0xaccount' }));
  const services = { ...base.services, getAccount };
  let sendCurrent = true;
  const { task, navigation } = harness({
    services,
    isSendCurrent: () => sendCurrent,
  });
  await expect(task.run()).resolves.toBe(true);
  getAccount.mockReturnValueOnce(pending);
  const sending = navigation.params?.onBeforeSend?.();
  sendCurrent = false;
  finish({ address: '0xaccount' });
  await expect(sending).rejects.toThrow('expired');
});

it('accepts the same EVM account with a different address case', async () => {
  const base = harness();
  const getAccount = jest
    .fn()
    .mockResolvedValueOnce({ address: '0xAbCd' })
    .mockResolvedValue({ address: '0xabcd' });
  const services = { ...base.services, getAccount };
  const { task, navigation } = harness({ services });
  await expect(task.run()).resolves.toBe(true);
  await expect(navigation.params?.onBeforeSend?.()).resolves.toBeUndefined();
  expect(services.buildPermit).toHaveBeenCalledWith(
    expect.objectContaining({ expectedAccountAddress: '0xAbCd' }),
  );
  expect(services.buildUnstake).toHaveBeenCalledWith(
    expect.objectContaining({ expectedAccountAddress: '0xAbCd' }),
  );
});

it('records verified late broadcast facts without calling the old success handler', async () => {
  mockRecordLateOrder.mockClear();
  const { task, navigation, onSuccess } = harness();
  await expect(task.run()).resolves.toBe(true);
  task.cancel();
  const fact = {
    uuid: 'request-1',
    accountId: 'account',
    networkId: 'evm--1',
    txid: 'late-tx',
  };
  await navigation.params?.onLateBroadcastAccepted?.(fact);
  expect(mockRecordLateOrder).toHaveBeenCalledWith({
    fact,
    accountId: 'account',
    networkId: 'evm--1',
    stakeInfo: expect.objectContaining({ orderId: 'order-1' }),
  });
  expect(task.getTask().steps[1].status).toEqual({
    type: 'unknown',
    txid: 'late-tx',
    chainConfirmed: false,
  });
  expect(onSuccess).not.toHaveBeenCalled();
});

it('does not continue to sign after cancellation during account resolution', async () => {
  let finish: ((account: { address: string }) => void) | undefined;
  const pending = new Promise<{ address: string }>((resolve) => {
    finish = resolve;
  });
  const base = harness();
  const services = {
    ...base.services,
    getAccount: jest.fn(async () => pending),
  };
  const { task } = harness({ services });
  const running = task.run();
  task.cancel();
  finish?.({ address: '0xaccount' });
  await expect(running).resolves.toBe(false);
  expect(services.buildPermit).not.toHaveBeenCalled();
  expect(services.signMessage).not.toHaveBeenCalled();
});

it.each(['resolve', 'reject'])(
  'preserves a %s build result when action scope expires',
  async (outcome) => {
    let finish:
      | ((
          value: Awaited<ReturnType<IParams['services']['buildUnstake']>>,
        ) => void)
      | undefined;
    let fail: ((error: Error) => void) | undefined;
    let started: (() => void) | undefined;
    const invoked = new Promise<void>((resolve) => {
      started = resolve;
    });
    const pending = new Promise<
      Awaited<ReturnType<IParams['services']['buildUnstake']>>
    >((resolve, reject) => {
      finish = resolve;
      fail = reject;
    });
    let current = true;
    const base = harness();
    const services = {
      ...base.services,
      buildUnstake: jest.fn(async () => {
        started?.();
        return pending;
      }),
    };
    const { task, navigation } = harness({
      services,
      isActionCurrent: () => current,
    });
    const running = task.run();
    await invoked;
    current = false;
    if (outcome === 'reject') {
      const error = new OneKeyLocalError('build failed');
      fail?.(error);
      await expect(running).rejects.toBe(error);
    } else {
      finish?.({ tx: { to: 'contract', value: '0', data: 'data' } });
      await expect(running).resolves.toBe(false);
    }
    expect(services.buildInternalTx).not.toHaveBeenCalled();
    expect(navigation.params).toBeUndefined();
  },
);

it('propagates signature rejection without opening transaction confirmation', async () => {
  const failure = new OneKeyLocalError('signature rejected');
  const base = harness();
  const services = {
    ...base.services,
    signMessage: jest.fn(async () => {
      throw failure;
    }),
  };
  const { task, navigation } = harness({ services });
  await expect(task.run()).rejects.toBe(failure);
  expect(services.buildUnstake).not.toHaveBeenCalled();
  expect(navigation.params).toBeUndefined();
});

it.each(['resolve', 'reject'])(
  'handles %s of encoded transaction after scope invalidation',
  async (outcome) => {
    let finish: ((value: string) => void) | undefined;
    let fail: ((error: Error) => void) | undefined;
    let started: (() => void) | undefined;
    const invoked = new Promise<void>((resolve) => {
      started = resolve;
    });
    const pending = new Promise<string>((resolve, reject) => {
      finish = resolve;
      fail = reject;
    });
    let current = true;
    const base = harness();
    const services = {
      ...base.services,
      buildInternalTx: jest.fn(async () => {
        started?.();
        return pending;
      }),
    };
    const { task, navigation } = harness({
      services,
      isActionCurrent: () => current,
    });
    const running = task.run();
    await invoked;
    current = false;
    if (outcome === 'reject') {
      const error = new OneKeyLocalError('encode failed');
      fail?.(error);
      await expect(running).rejects.toBe(error);
    } else {
      finish?.('encoded-tx');
      await expect(running).resolves.toBe(false);
    }
    expect(navigation.params).toBeUndefined();
  },
);

it('preserves the original handled navigation failure callback and return timing', async () => {
  const failure = new OneKeyLocalError('cannot prepare confirmation');
  const onFail = jest.fn();
  const navigate: IParams['navigate'] = async (params) => {
    params.onFail?.(failure);
  };
  const { task } = harness({ navigate, onFail });
  await expect(task.run()).resolves.toBe(true);
  expect(onFail).toHaveBeenCalledWith(failure);
});

it('propagates a navigation preparation failure when onFail is absent', async () => {
  const failure = new OneKeyLocalError('cannot prepare confirmation');
  const navigate: IParams['navigate'] = async () => {
    throw failure;
  };
  const { task } = harness({ navigate });
  await expect(task.run()).rejects.toBe(failure);
});

it('runs approval and both Lido steps under one controller without publishing the permit', async () => {
  mockRecordLateOrder.mockClear();
  const { params, services, navigation } = harness();
  const fragment = createLidoWithdrawFragment<{
    lidoPermit?: ILidoWithdrawPermit;
    requestId: string;
  }>(params);
  const identity = {
    accountId: params.accountId,
    networkId: params.networkId,
    provider: params.provider,
  };
  const task = createEarnWorkflowTask({
    taskId: 'combined-withdraw',
    identity,
    steps: [
      { id: 'approve', kind: 'approve', lateSubmitted: 'unknown' },
      ...getLidoWithdrawSteps(),
    ],
  });
  const controller = createEarnWorkflowTaskController<
    typeof identity,
    { lidoPermit?: ILidoWithdrawPermit; requestId: string },
    ILidoWithdrawPrepared
  >({
    task,
    initialContext: { requestId: 'original' },
    isCurrent: () => true,
    expiredMessage: params.expiredMessage,
    onAsyncError: params.onObserverError,
    onStaleTransactionError: fragment.onStaleTransactionError,
    getAdapter: (step, context) => {
      if (step.id === 'approve') {
        return {
          kind: 'transaction',
          handoffOnSubmit: false,
          adapter: {
            prepare: async () => ({
              type: 'confirm',
              prepared: { encodedTx: 'approval' },
            }),
            confirm: async ({ onBeforeSend, onSubmitted }) => {
              onBeforeSend();
              onSubmitted('approval-tx');
              return { type: 'submitted' };
            },
            waitForFinalStatus: async () => 'success',
            verify: async () => true,
          },
        };
      }
      expect(context.requestId).toBe('original');
      return fragment.getAdapter(step, context);
    },
  });
  const pendingResult = fragment.result;
  await controller.run();
  await expect(pendingResult).resolves.toBe(true);
  expect(services.signMessage).toHaveBeenCalledTimes(1);
  expect(services.buildUnstake).toHaveBeenCalledWith(
    expect.objectContaining({ signature: 'permit-secret' }),
  );
  expect(navigation.params).toBeDefined();
  expect(controller.getTask().taskId).toBe('combined-withdraw');
  expect(controller.getTask().steps.map(({ id }) => id)).toEqual([
    'approve',
    'permit',
    'unstake',
  ]);
  expect(JSON.stringify(controller.getTask())).not.toContain('permit-secret');
  fragment.cancel();
  controller.cancel();
  const fact = {
    uuid: 'request-2',
    accountId: identity.accountId,
    networkId: identity.networkId,
    txid: 'late-composed-tx',
  };
  await navigation.params?.onLateBroadcastAccepted?.(fact);
  expect(mockRecordLateOrder).toHaveBeenCalledWith(
    expect.objectContaining({
      fact,
      accountId: 'account',
      networkId: 'evm--1',
    }),
  );
  expect(controller.getTask().steps[2].status).toEqual({
    type: 'unknown',
    txid: 'late-composed-tx',
    chainConfirmed: false,
  });
});

it('settles a composed fragment when a previous step is cancelled', async () => {
  const { params, services } = harness();
  const fragment = createLidoWithdrawFragment<ILidoWithdrawContext>(params);
  const identity = {
    accountId: params.accountId,
    networkId: params.networkId,
    provider: params.provider,
  };
  const task = createEarnWorkflowTask({
    taskId: 'cancelled-withdraw',
    identity,
    steps: [{ id: 'preflight', kind: 'wait' }, ...getLidoWithdrawSteps()],
  });
  const controller = createEarnWorkflowTaskController<
    typeof identity,
    ILidoWithdrawContext,
    ILidoWithdrawPrepared
  >({
    task,
    initialContext: {},
    isCurrent: () => true,
    expiredMessage: params.expiredMessage,
    onAsyncError: fragment.fail,
    getAdapter: (step, context) =>
      step.id === 'preflight'
        ? { kind: 'wait', run: async () => ({ type: 'cancelled' }) }
        : fragment.getAdapter(step, context),
  });
  const unsubscribe = controller.subscribe(() =>
    fragment.observeTask(controller.getTask()),
  );
  const pendingResult = fragment.result;
  await controller.run();
  await expect(pendingResult).resolves.toBe(false);
  expect(services.signMessage).not.toHaveBeenCalled();
  unsubscribe();
});

it('settles a composed fragment with a signing error without opening a transaction', async () => {
  const failure = new OneKeyLocalError('signature rejected');
  const base = harness();
  const services = {
    ...base.services,
    signMessage: jest.fn(async () => {
      throw failure;
    }),
  };
  const { params, navigation } = harness({ services });
  const fragment = createLidoWithdrawFragment<ILidoWithdrawContext>(params);
  const identity = {
    accountId: params.accountId,
    networkId: params.networkId,
    provider: params.provider,
  };
  const task = createEarnWorkflowTask({
    taskId: 'rejected-withdraw',
    identity,
    steps: getLidoWithdrawSteps(),
  });
  const controller = createEarnWorkflowTaskController<
    typeof identity,
    ILidoWithdrawContext,
    ILidoWithdrawPrepared
  >({
    task,
    initialContext: {},
    isCurrent: () => true,
    expiredMessage: params.expiredMessage,
    onAsyncError: fragment.fail,
    getAdapter: fragment.getAdapter,
  });
  const unsubscribe = controller.subscribe(() =>
    fragment.observeTask(controller.getTask()),
  );
  const pendingResult = fragment.result;
  try {
    await controller.run();
  } catch (error) {
    fragment.fail(error);
  }
  await expect(pendingResult).rejects.toBe(failure);
  expect(navigation.params).toBeUndefined();
  unsubscribe();
});

it('keeps the original navigation return pending until navigation finishes after cancellation', async () => {
  let finishNavigation: () => void = () => undefined;
  let markStarted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const pending = new Promise<void>((resolve) => {
    finishNavigation = resolve;
  });
  const navigate: IParams['navigate'] = async () => {
    markStarted();
    await pending;
  };
  const { task } = harness({ navigate });
  let completed = false;
  const running = task.run().then((value) => {
    completed = true;
    return value;
  });
  await started;
  task.cancel();
  await Promise.resolve();
  expect(completed).toBe(false);
  finishNavigation();
  await expect(running).resolves.toBe(false);
});

it('preserves a late signature failure after composed task cancellation', async () => {
  let failSignature: (error: Error) => void = () => undefined;
  let markStarted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const pending = new Promise<string>((_resolve, reject) => {
    failSignature = reject;
  });
  const base = harness();
  const services = {
    ...base.services,
    signMessage: jest.fn(() => {
      markStarted();
      return pending;
    }),
  };
  const { params } = harness({ services });
  const fragment = createLidoWithdrawFragment<ILidoWithdrawContext>(params);
  const identity = {
    accountId: params.accountId,
    networkId: params.networkId,
    provider: params.provider,
  };
  const task = createEarnWorkflowTask({
    taskId: 'cancelled-signature',
    identity,
    steps: getLidoWithdrawSteps(),
  });
  const controller = createEarnWorkflowTaskController<
    typeof identity,
    ILidoWithdrawContext,
    ILidoWithdrawPrepared
  >({
    task,
    initialContext: {},
    isCurrent: () => true,
    expiredMessage: params.expiredMessage,
    onAsyncError: fragment.fail,
    getAdapter: fragment.getAdapter,
  });
  const unsubscribe = controller.subscribe(() =>
    fragment.observeTask(controller.getTask()),
  );
  const result = fragment.result;
  const running = controller.run();
  await started;
  fragment.cancel();
  controller.cancel();
  const failure = new OneKeyLocalError('late signature failure');
  failSignature(failure);
  await expect(running).rejects.toBe(failure);
  await expect(result).rejects.toBe(failure);
  unsubscribe();
});

it('registers the real Lido fragment in the shared approval workflow and records late broadcast', async () => {
  mockRecordLateOrder.mockClear();
  const { params, services, navigation } = harness();
  type IContext = ILidoWithdrawContext & { requestId: string };
  const fragment = createLidoWithdrawFragment<IContext>(params);
  const identity = {
    accountId: params.accountId,
    networkId: params.networkId,
    accountAddress: '0xaccount',
    provider: params.provider,
    action: 'withdraw' as const,
  };
  const steps = getLidoWithdrawSteps();
  const task = createEarnWithdrawApprovalTask<
    string,
    ILidoWithdrawPrepared,
    IContext
  >({
    taskId: 'approval-and-lido',
    identity,
    protocolSteps: steps,
    initialContext: { requestId: 'original' },
    approval: {
      handoffOnSubmit: false,
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: 'approve' }),
        confirm: async ({ prepared, onBeforeSend, onSubmitted }) => {
          expect(prepared).toBe('approve');
          onBeforeSend();
          onSubmitted('approval-tx');
          return { type: 'submitted' };
        },
        waitForFinalStatus: async () => 'success',
        verify: async () => true,
      },
    },
    allowanceCheck: async () => true,
    prepareBusiness: async (handoff) => {
      await handoff.register({
        identity,
        steps,
        getAdapter: fragment.getAdapter,
        result: fragment.result,
        observeTask: fragment.observeTask,
        cancel: fragment.cancel,
      });
    },
    isCurrent: () => true,
    onAsyncError: jest.fn(),
  });
  await expect(task.run()).resolves.toBe(true);
  expect(task.getTask().taskId).toBe('approval-and-lido');
  expect(task.getTask().steps.map(({ id }) => id)).toEqual([
    'approve',
    'allowance',
    'prepareBusiness',
    'permit',
    'unstake',
  ]);
  expect(services.signMessage).toHaveBeenCalledTimes(1);
  expect(services.buildUnstake).toHaveBeenCalledWith(
    expect.objectContaining({ signature: 'permit-secret' }),
  );
  expect(JSON.stringify(task.getTask())).not.toContain('permit-secret');
  task.cancel();
  const fact = {
    uuid: 'real-workflow-request',
    accountId: identity.accountId,
    networkId: identity.networkId,
    txid: 'real-workflow-late-tx',
  };
  await navigation.params?.onLateBroadcastAccepted?.(fact);
  expect(mockRecordLateOrder).toHaveBeenCalledWith(
    expect.objectContaining({
      fact,
      accountId: 'account',
      networkId: 'evm--1',
    }),
  );
  expect(task.getTask().steps[4].status).toEqual({
    type: 'unknown',
    txid: 'real-workflow-late-tx',
    chainConfirmed: false,
  });
});

function createComposedLidoTask({
  params,
  signal,
  isCurrent,
  isFragmentCurrent = isCurrent,
  pageSignal,
}: {
  params: IParams;
  signal?: AbortSignal;
  isCurrent: () => boolean;
  isFragmentCurrent?: () => boolean;
  pageSignal?: AbortSignal;
}) {
  const fragment = createLidoWithdrawFragment<ILidoWithdrawContext>({
    ...params,
    isActionCurrent: isFragmentCurrent,
    verifyEncodedTx: (encodedTx, accountAddress) => {
      if (
        typeof encodedTx === 'object' &&
        encodedTx !== null &&
        'from' in encodedTx &&
        !isTaskEncodedTxOwner(
          { accountAddress, networkId: params.networkId },
          encodedTx,
        )
      ) {
        throw new OneKeyLocalError('Task account changed before withdrawal');
      }
    },
  });
  const identity = {
    accountId: params.accountId,
    networkId: params.networkId,
    accountAddress: '0xaccount',
    provider: params.provider,
    action: 'withdraw' as const,
  };
  const steps = getLidoWithdrawSteps();
  const onAsyncError = jest.fn();
  const task = createEarnWithdrawApprovalTask<
    string,
    ILidoWithdrawPrepared,
    ILidoWithdrawContext
  >({
    taskId: 'abort-lido',
    identity,
    protocolSteps: steps,
    initialContext: {},
    approval: {
      handoffOnSubmit: false,
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: 'approve' }),
        confirm: async ({ onBeforeSend, onSubmitted }) => {
          onBeforeSend();
          onSubmitted('approval-tx');
          return { type: 'submitted' };
        },
        waitForFinalStatus: async () => 'success',
        verify: async () => true,
      },
    },
    allowanceCheck: async () => true,
    prepareBusiness: async (handoff) => {
      const abortPage = () => fragment.abortPage();
      pageSignal?.addEventListener('abort', abortPage, { once: true });
      try {
        if (pageSignal?.aborted) {
          abortPage();
          return;
        }
        await handoff.register({
          identity,
          steps,
          getAdapter: fragment.getAdapter,
          result: fragment.result,
          observeTask: fragment.observeTask,
          cancel: fragment.cancel,
          onStaleTransactionError: fragment.onStaleTransactionError,
          isExpectedCancellation: fragment.isExpectedCancellation,
        });
      } finally {
        pageSignal?.removeEventListener('abort', abortPage);
      }
    },
    signal,
    isCurrent,
    onAsyncError,
  });
  return { task, onAsyncError };
}

it('rejects a composed Lido transaction whose encoded owner differs from the permit owner', async () => {
  const base = harness();
  const services = {
    ...base.services,
    buildInternalTx: jest.fn(async () => ({
      from: '0xother',
      to: '0xcontract',
      value: '0x0',
      data: '0x',
    })),
  };
  const { params, navigation } = harness({ services });
  const { task } = createComposedLidoTask({ params, isCurrent: () => true });

  await expect(task.run()).rejects.toThrow(
    'Task account changed before withdrawal',
  );
  expect(navigation.params).toBeUndefined();
});

it.each([
  { from: '0xACCOUNT', to: '0xcontract', value: '0x0', data: '0x' },
  'encoded-transaction',
])(
  'accepts the permit owner or an encoded transaction string in the composed workflow',
  async (encodedTx) => {
    const base = harness();
    const services = {
      ...base.services,
      buildInternalTx: jest.fn(async () => encodedTx),
    };
    const { params, navigation } = harness({ services });
    const { task } = createComposedLidoTask({ params, isCurrent: () => true });

    await expect(task.run()).resolves.toBe(true);
    expect(navigation.params?.encodedTx).toEqual(encodedTx);
  },
);

it('retains standalone Lido behavior when no encoded transaction verifier is supplied', async () => {
  const base = harness();
  const encodedTx = {
    from: '0xother',
    to: '0xcontract',
    value: '0x0',
    data: '0x',
  };
  const services = {
    ...base.services,
    buildInternalTx: jest.fn(async () => encodedTx),
  };
  const { task, navigation } = harness({ services });

  await expect(task.run()).resolves.toBe(true);
  expect(navigation.params?.encodedTx).toEqual(encodedTx);
});

it.each(['sign', 'build'] as const)(
  'preserves a late Lido %s rejection after composed task abort',
  async (stage) => {
    let fail: (error: Error) => void = () => undefined;
    let markStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const failure = new OneKeyLocalError(`late ${stage} failed`);
    const pending = new Promise<never>((_resolve, reject) => {
      fail = reject;
    });
    const base = harness();
    const services = {
      ...base.services,
      ...(stage === 'sign'
        ? {
            signMessage: jest.fn(() => {
              markStarted();
              return pending;
            }),
          }
        : {
            buildUnstake: jest.fn(() => {
              markStarted();
              return pending;
            }),
          }),
    };
    const { params, navigation } = harness({ services });
    const abort = new AbortController();
    const { task } = createComposedLidoTask({
      params,
      signal: abort.signal,
      isCurrent: () => !abort.signal.aborted,
    });
    const result = task.run().then(
      (value) => ({ type: 'resolved' as const, value }),
      (error: unknown) => ({ type: 'rejected' as const, error }),
    );
    await started;
    abort.abort();
    fail(failure);
    await expect(result).resolves.toEqual({ type: 'rejected', error: failure });
    expect(navigation.params).toBeUndefined();
  },
);

it('treats an expired Lido owner after a completed build as cancellation in the composed workflow', async () => {
  let complete: (
    value: Awaited<ReturnType<IParams['services']['buildUnstake']>>,
  ) => void = () => undefined;
  let markStarted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const pending = new Promise<
    Awaited<ReturnType<IParams['services']['buildUnstake']>>
  >((resolve) => {
    complete = resolve;
  });
  const base = harness();
  const services = {
    ...base.services,
    buildUnstake: jest.fn(() => {
      markStarted();
      return pending;
    }),
  };
  const { params, navigation } = harness({ services });
  let current = true;
  const { task, onAsyncError } = createComposedLidoTask({
    params,
    isCurrent: () => current,
  });
  const result = task.run();
  await started;
  current = false;
  complete({ tx: { to: 'contract', value: '0', data: 'data' } });
  await expect(result).resolves.toBe(false);
  expect(onAsyncError).not.toHaveBeenCalled();
  expect(navigation.params).toBeUndefined();
});

it('treats an expired Lido action as cancellation when the outer owner remains current', async () => {
  let complete: (
    value: Awaited<ReturnType<IParams['services']['buildUnstake']>>,
  ) => void = () => undefined;
  let markStarted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const pending = new Promise<
    Awaited<ReturnType<IParams['services']['buildUnstake']>>
  >((resolve) => {
    complete = resolve;
  });
  const base = harness();
  const services = {
    ...base.services,
    buildUnstake: jest.fn(() => {
      markStarted();
      return pending;
    }),
  };
  const { params, navigation } = harness({ services });
  let actionCurrent = true;
  const { task, onAsyncError } = createComposedLidoTask({
    params,
    isCurrent: () => true,
    isFragmentCurrent: () => actionCurrent,
  });
  const result = task.run();
  await started;
  actionCurrent = false;
  complete({ tx: { to: 'contract', value: '0', data: 'data' } });
  await expect(result).resolves.toBe(false);
  expect(onAsyncError).not.toHaveBeenCalled();
  expect(navigation.params).toBeUndefined();
});

it('preserves a real Lido build error after the action expires while the outer owner remains current', async () => {
  let fail: (error: Error) => void = () => undefined;
  let markStarted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const pending = new Promise<never>((_resolve, reject) => {
    fail = reject;
  });
  const base = harness();
  const services = {
    ...base.services,
    buildUnstake: jest.fn(() => {
      markStarted();
      return pending;
    }),
  };
  const { params, navigation } = harness({ services });
  let actionCurrent = true;
  const { task } = createComposedLidoTask({
    params,
    isCurrent: () => true,
    isFragmentCurrent: () => actionCurrent,
  });
  const result = task.run();
  await started;
  actionCurrent = false;
  const failure = new OneKeyLocalError('RPC unavailable');
  fail(failure);
  await expect(result).rejects.toBe(failure);
  expect(navigation.params).toBeUndefined();
});

it('settles a composed Lido task when only its page aborts during navigation', async () => {
  let markStarted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const pending = new Promise<void>(() => undefined);
  const { params } = harness({
    navigate: async () => {
      markStarted();
      await pending;
    },
  });
  const page = new AbortController();
  const { task } = createComposedLidoTask({
    params,
    isCurrent: () => true,
    pageSignal: page.signal,
    isFragmentCurrent: () => !page.signal.aborted,
  });
  const result = task.run();
  await started;
  page.abort();
  await expect(result).resolves.toBe(false);
});

it.each(['resolve', 'reject'] as const)(
  'waits for an in-flight Lido signature on page abort and preserves its %s',
  async (outcome) => {
    let finish: (value: string) => void = () => undefined;
    let fail: (error: Error) => void = () => undefined;
    let markStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const pending = new Promise<string>((resolve, reject) => {
      finish = resolve;
      fail = reject;
    });
    const base = harness();
    const services = {
      ...base.services,
      signMessage: jest.fn(() => {
        markStarted();
        return pending;
      }),
    };
    const { params, navigation } = harness({ services });
    const page = new AbortController();
    const { task } = createComposedLidoTask({
      params,
      isCurrent: () => true,
      pageSignal: page.signal,
      isFragmentCurrent: () => !page.signal.aborted,
    });
    let settled = false;
    const result = task.run().then(
      (value) => {
        settled = true;
        return { value };
      },
      (error: unknown) => {
        settled = true;
        return { error };
      },
    );
    await started;
    page.abort();
    await Promise.resolve();
    expect(settled).toBe(false);
    if (outcome === 'reject') {
      const error = new OneKeyLocalError('signature failed');
      fail(error);
      await expect(result).resolves.toEqual({ error });
    } else {
      finish('signature');
      await expect(result).resolves.toEqual({ value: false });
    }
    expect(navigation.params).toBeUndefined();
  },
);

it('keeps a composed Lido confirmation retryable after a safe pre-send account error', async () => {
  const base = harness();
  const getAccount = jest.fn(async () => ({ address: '0xaccount' }));
  const services = { ...base.services, getAccount };
  const onSafePreSendFail = jest.fn();
  const { params, navigation, onSuccess } = harness({
    services,
    onSafePreSendFail,
  });
  const { task } = createComposedLidoTask({ params, isCurrent: () => true });
  await expect(task.run()).resolves.toBe(true);
  const confirmation = navigation.params;
  if (!confirmation) throw new OneKeyLocalError('Confirmation did not open');
  const statusBefore = task
    .getTask()
    .steps.find((step) => step.id === 'unstake')?.status;
  const error = new OneKeyLocalError('account temporarily unavailable');
  getAccount.mockRejectedValueOnce(error);
  await expect(confirmation.onBeforeSend?.()).rejects.toBe(error);
  // TxConfirmActions uses onFail only when a potentially side-effecting pre-send
  // transaction exists, otherwise it prefers onSafePreSendFail.
  (
    confirmation.onSafePreSendFail ??
    confirmation.onConfirmationFail ??
    confirmation.onFail
  )?.(error);
  expect(onSafePreSendFail).toHaveBeenCalledWith(error);
  expect(
    task.getTask().steps.find((step) => step.id === 'unstake')?.status,
  ).toEqual(statusBefore);
  await expect(confirmation.onBeforeSend?.()).resolves.toBeUndefined();
  const submitted = [
    { signedTx: { txid: 'retry-tx' }, decodedTx: {} } as ISendTxOnSuccessData,
  ];
  await Promise.resolve(confirmation.onSuccess?.(submitted));
  expect(onSuccess).toHaveBeenCalledWith(
    submitted,
    expect.objectContaining({ orderId: 'order-1' }),
  );
  expect(
    task.getTask().steps.find((step) => step.id === 'unstake')?.status,
  ).toEqual(expect.objectContaining({ txid: 'retry-tx' }));
});

it('keeps a potentially side-effecting pre-send failure on the confirmation failure path', async () => {
  const onFail = jest.fn();
  const onSafePreSendFail = jest.fn();
  const { params, navigation } = harness({ onFail, onSafePreSendFail });
  const { task } = createComposedLidoTask({ params, isCurrent: () => true });
  await expect(task.run()).resolves.toBe(true);
  const confirmation = navigation.params;
  if (!confirmation) throw new OneKeyLocalError('Confirmation did not open');
  const before = task
    .getTask()
    .steps.find((step) => step.id === 'unstake')?.status;
  const error = new OneKeyLocalError('pre-send transaction failed');
  confirmation.onConfirmationFail?.(error);
  expect(onFail).toHaveBeenCalledWith(error);
  expect(onSafePreSendFail).not.toHaveBeenCalled();
  expect(
    task.getTask().steps.find((step) => step.id === 'unstake')?.status,
  ).not.toEqual(before);
});

it('does not enable the safe pre-send callback for standalone Lido withdrawals', async () => {
  const { task, navigation } = harness();
  await expect(task.run()).resolves.toBe(true);
  expect(navigation.params?.onSafePreSendFail).toBeUndefined();
});
