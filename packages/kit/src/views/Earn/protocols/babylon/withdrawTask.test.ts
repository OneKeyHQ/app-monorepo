import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EEarnLabels,
  EInternalDappEnum,
  EInternalStakingAction,
  type IStakeTxResponse,
  type IWithdrawBaseParams,
} from '@onekeyhq/shared/types/staking';
import {
  EDecodedTxStatus,
  type ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';

import { createEarnWithdrawApprovalTask } from '../../tasks/earnWithdrawApprovalTask';

import {
  createBabylonWithdrawFragment,
  createBabylonWithdrawTask,
  getBabylonWithdrawSteps,
  prepareBabylonConfirmation,
} from './withdrawTask';

import type {
  IBabylonWithdrawContext,
  IBabylonWithdrawFact,
  IBabylonWithdrawFacts,
  IBabylonWithdrawFragmentParams,
} from './withdrawTask';

type INavigateParams = Parameters<
  ReturnType<typeof useSignatureConfirm>['navigationToTxConfirm']
>[0];
function invokeSuccess(
  params: INavigateParams | undefined,
  data: ISendTxOnSuccessData[],
): Promise<void> {
  return Promise.resolve(params?.onSuccess?.(data));
}
const accountId = 'btc-account';
const networkId = 'btc--0';
const transaction = { psbtHex: 'unsigned-psbt' };

it('encodes an accepted Babylon response with original order and BTC fee settings', async () => {
  const encodedTx: IEncodedTxBtc = {
    inputs: [],
    outputs: [],
    inputsForCoinSelect: [],
    outputsForCoinSelect: [],
    fee: '42',
    txSize: undefined,
  };
  const buildInternalTx = jest.fn(async () => encodedTx);
  const stakingInfo = {
    label: EEarnLabels.Withdraw,
    protocol: 'Babylon',
    tags: [],
  };
  await expect(
    prepareBabylonConfirmation({
      request: { accountId, networkId },
      stakeTx: { tx: transaction, orderId: 'order-1' },
      stakingInfo,
      services: { buildInternalTx },
      isActionCurrent: () => true,
    }),
  ).resolves.toEqual({
    type: 'prepared',
    value: {
      encodedTx,
      stakeInfo: { ...stakingInfo, orderId: 'order-1' },
      useFeeInTx: true,
      feeInfoEditable: false,
    },
  });
  expect(buildInternalTx).toHaveBeenCalledWith({
    accountId,
    networkId,
    tx: transaction,
    internalDappType: EInternalDappEnum.Staking,
    stakingAction: EInternalStakingAction.Withdraw,
  });
});

it('encodes a Babylon response only while the original action remains current', async () => {
  const pending = deferred<IEncodedTx>();
  let current = true;
  const buildInternalTx = jest.fn(async () => pending.promise);
  const running = prepareBabylonConfirmation({
    request: { accountId, networkId },
    stakeTx: { tx: transaction },
    services: { buildInternalTx },
    isActionCurrent: () => current,
  });
  current = false;
  pending.resolve('encoded-psbt');
  await expect(running).resolves.toEqual({ type: 'cancelled' });
  expect(buildInternalTx).toHaveBeenCalledTimes(1);
});

it('passes a string transaction to the encoder without treating it as a broadcast', async () => {
  const buildInternalTx = jest.fn(async () => 'encoded-psbt');
  await expect(
    prepareBabylonConfirmation({
      request: { accountId, networkId },
      stakeTx: { tx: 'unsigned-psbt' },
      services: { buildInternalTx },
      isActionCurrent: () => true,
    }),
  ).resolves.toMatchObject({ type: 'prepared' });
  expect(buildInternalTx).toHaveBeenCalledWith(
    expect.objectContaining({ tx: 'unsigned-psbt' }),
  );
});

it('retains a Babylon external broadcast fact even when the scope is stale', async () => {
  const buildInternalTx = jest.fn(async () => 'encoded-psbt');
  await expect(
    prepareBabylonConfirmation({
      request: { accountId, networkId },
      stakeTx: { tx: { exitBroadcasted: true, validators: [] } },
      services: { buildInternalTx },
      isActionCurrent: () => false,
    }),
  ).resolves.toEqual({ type: 'externalBroadcast' });
  expect(buildInternalTx).not.toHaveBeenCalled();
});

it('propagates an encoding error even after scope invalidation', async () => {
  const pending = deferred<IEncodedTx>();
  let current = true;
  const failure = new OneKeyLocalError('encoding failed');
  const running = prepareBabylonConfirmation({
    request: { accountId, networkId },
    stakeTx: { tx: transaction },
    services: { buildInternalTx: async () => pending.promise },
    isActionCurrent: () => current,
  });
  current = false;
  pending.reject(failure);
  await expect(running).rejects.toBe(failure);
});

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function signedData(psbt = 'signed-psbt'): ISendTxOnSuccessData[] {
  return [
    {
      signedTx: {
        txid: '',
        rawTx: '',
        encodedTx: null,
        finalizedPsbtHex: psbt,
      },
      decodedTx: {
        accountId,
        networkId,
        txid: '',
        status: EDecodedTxStatus.Pending,
        owner: 'owner',
        signer: 'owner',
        nonce: 0,
        actions: [],
        extraInfo: null,
      },
    },
  ];
}
function harness({
  identity = 'request-1',
  isActionCurrent = () => true,
  isSendCurrent,
  isResultCurrent,
  navigate,
  onFail,
}: {
  identity?: string;
  isActionCurrent?: () => boolean;
  isSendCurrent?: () => boolean;
  isResultCurrent?: () => boolean;
  navigate?: (params: INavigateParams) => Promise<void>;
  onFail?: (error: Error) => void;
} = {}) {
  const buildUnstake = jest.fn<
    Promise<IStakeTxResponse>,
    [IWithdrawBaseParams]
  >(async () => ({ tx: transaction, orderId: 'order-1' }));
  const buildInternalTx = jest.fn<Promise<IEncodedTx>, [unknown]>(
    async () => 'encoded-psbt',
  );
  const getAccountAddress = jest.fn(async () => 'btc-address-A');
  const unstakePush = jest.fn<Promise<void>, [unknown]>(async () => undefined);
  const navigation: { params?: INavigateParams } = {};
  const open = jest.fn(async (params: INavigateParams) => {
    navigation.params = params;
    await navigate?.(params);
  });
  const onSuccess = jest.fn();
  const onObserverError = jest.fn();
  const onPushError = jest.fn();
  const params = {
    taskId: 'task-1',
    accountId,
    networkId,
    provider: 'babylon',
    identity,
    intent: { amount: '1.25', symbol: 'BTC', withdrawAll: false },
    stakingInfo: { label: EEarnLabels.Withdraw, protocol: 'Babylon', tags: [] },
    services: { buildUnstake, buildInternalTx, unstakePush, getAccountAddress },
    navigate: open,
    isActionCurrent,
    isSendCurrent,
    isResultCurrent,
    expiredMessage: 'expired',
    onSuccess,
    onFail,
    onObserverError,
    onPushError,
  };
  const task = createBabylonWithdrawTask(params);
  return {
    params,
    task,
    navigation,
    open,
    onSuccess,
    onObserverError,
    onPushError,
    buildUnstake,
    buildInternalTx,
    unstakePush,
    getAccountAddress,
  };
}

it('binds the original address to build and push when the receive address changes during signing', async () => {
  const h = harness();
  let accountAddress = 'btc-address-A';
  h.getAccountAddress.mockImplementation(async () => accountAddress);
  h.unstakePush.mockImplementation(async (params: unknown) => {
    const { expectedAccountAddress } = params as {
      expectedAccountAddress?: string;
    };
    if (expectedAccountAddress !== accountAddress)
      throw new OneKeyLocalError('Account address changed');
  });
  await expect(h.task.run()).resolves.toBe(true);
  expect(h.buildUnstake).toHaveBeenCalledWith(
    expect.objectContaining({ expectedAccountAddress: 'btc-address-A' }),
  );
  accountAddress = 'btc-address-B';
  await expect(
    invokeSuccess(h.navigation.params, signedData()),
  ).rejects.toThrow('Account address changed');
  expect(h.unstakePush).toHaveBeenCalledWith(
    expect.objectContaining({ expectedAccountAddress: 'btc-address-A' }),
  );
  expect(h.onSuccess).not.toHaveBeenCalled();
});

it('hands off sign-only confirmation before the signed PSBT arrives', async () => {
  const h = harness();
  await expect(h.task.run()).resolves.toBe(true);
  expect(h.open).toHaveBeenCalledWith(
    expect.objectContaining({ signOnly: true }),
  );
  expect(h.buildUnstake).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId,
      networkId,
      identity: 'request-1',
      amount: '1.25',
      symbol: 'BTC',
      provider: 'babylon',
    }),
  );
  expect(h.buildInternalTx).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId,
      networkId,
      tx: transaction,
      internalDappType: EInternalDappEnum.Staking,
      stakingAction: EInternalStakingAction.Withdraw,
    }),
  );
  expect(h.unstakePush).not.toHaveBeenCalled();
  const data = signedData();
  await invokeSuccess(h.navigation.params, data);
  expect(h.unstakePush).toHaveBeenCalledWith({
    txId: 'request-1',
    networkId,
    accountId,
    symbol: 'BTC',
    provider: 'babylon',
    unstakeTxHex: 'signed-psbt',
    expectedAccountAddress: 'btc-address-A',
  });
  expect(h.onSuccess).toHaveBeenCalledWith(data);
  expect(JSON.stringify(h.task.getTask())).not.toContain('signed-psbt');
});

it('rejects a missing account address before attempting a withdrawal', async () => {
  const h = harness();
  h.getAccountAddress.mockResolvedValue('');
  await expect(h.task.run()).rejects.toThrow('Missing task account address');
  expect(h.buildUnstake).not.toHaveBeenCalled();
  expect(h.open).not.toHaveBeenCalled();
});

it('does not build if the account scope expires while resolving its address', async () => {
  const pending = deferred<string>();
  let current = true;
  const h = harness({ isActionCurrent: () => current });
  h.getAccountAddress.mockReturnValue(pending.promise);
  const running = h.task.run();
  await new Promise<void>((resolve) => setImmediate(resolve));
  current = false;
  h.task.cancel();
  pending.resolve('btc-address-A');
  await expect(running).resolves.toBe(false);
  expect(h.buildUnstake).not.toHaveBeenCalled();
  expect(h.open).not.toHaveBeenCalled();
});

it('pushes a late signature only once after the old page scope expires', async () => {
  const pending = deferred<void>();
  let current = true;
  const h = harness({
    isActionCurrent: () => current,
    isResultCurrent: () => current,
  });
  await expect(h.task.run()).resolves.toBe(true);
  h.unstakePush.mockReturnValue(pending.promise);
  current = false;
  h.task.cancel();
  const data = signedData();
  const callbacks = Promise.all([
    invokeSuccess(h.navigation.params, data),
    invokeSuccess(h.navigation.params, data),
  ]);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(h.unstakePush).toHaveBeenCalledTimes(1);
  pending.resolve();
  await callbacks;
  expect(h.onSuccess).not.toHaveBeenCalled();
  expect(JSON.stringify(h.task.getTask())).not.toContain('signed-psbt');
});

it('does not call an expired page without a separate result guard', async () => {
  let current = true;
  const h = harness({ isActionCurrent: () => current });
  await expect(h.task.run()).resolves.toBe(true);
  current = false;
  h.task.cancel();
  await invokeSuccess(h.navigation.params, signedData());
  expect(h.unstakePush).toHaveBeenCalledTimes(1);
  expect(h.onSuccess).not.toHaveBeenCalled();
});

it('closes a dispatched sign continuation if navigation was blocked by scope loss', async () => {
  const pending = deferred<void>();
  let current = true;
  const h = harness({
    isActionCurrent: () => current,
    navigate: async (params) => {
      await pending.promise;
      params.isNavigationCurrent?.();
    },
  });
  const running = h.task.run();
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(h.open).toHaveBeenCalledTimes(1);
  current = false;
  h.task.cancel();
  pending.resolve();
  await expect(running).resolves.toBe(false);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(h.task.getTask().steps[1].status.type).toBe('cancelled');
  expect(h.unstakePush).not.toHaveBeenCalled();
});

it('does not deadlock when navigation waits for a synchronous confirmation callback', async () => {
  const push = deferred<void>();
  const h = harness({
    navigate: async (params) => {
      await invokeSuccess(params, signedData());
    },
  });
  h.unstakePush.mockReturnValue(push.promise);
  const running = h.task.run();
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(h.unstakePush).toHaveBeenCalledTimes(1);
  push.resolve();
  await expect(running).resolves.toBe(true);
  expect(h.onSuccess).toHaveBeenCalledTimes(1);
});

it.each([
  { identity: '', psbt: 'signed-psbt' },
  { identity: 'request-1', psbt: '' },
])(
  'opens confirmation but never pushes missing input: %p',
  async ({ identity, psbt }) => {
    const h = harness({ identity });
    await expect(h.task.run()).resolves.toBe(true);
    await invokeSuccess(h.navigation.params, signedData(psbt));
    expect(h.unstakePush).not.toHaveBeenCalled();
    expect(h.onSuccess).not.toHaveBeenCalled();
  },
);

it('does not replay an uncertain push and preserves the original rejection', async () => {
  const h = harness();
  const failure = new OneKeyLocalError('push response unavailable');
  h.unstakePush.mockRejectedValueOnce(failure);
  await expect(h.task.run()).resolves.toBe(true);
  await expect(invokeSuccess(h.navigation.params, signedData())).rejects.toBe(
    failure,
  );
  await h.task.run();
  expect(h.unstakePush).toHaveBeenCalledTimes(1);
  expect(h.onSuccess).not.toHaveBeenCalled();
});

it('reports push failure when confirmation does not await the success callback', async () => {
  const h = harness();
  const failure = new OneKeyLocalError('Task account address changed');
  h.unstakePush.mockRejectedValueOnce(failure);
  await expect(h.task.run()).resolves.toBe(true);
  void invokeSuccess(h.navigation.params, signedData());
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(h.onPushError).toHaveBeenCalledWith(failure);
  expect(h.onSuccess).not.toHaveBeenCalled();
  expect(h.task.getTask().steps[2].status.type).toBe('unknown');
  await h.task.run();
  expect(h.unstakePush).toHaveBeenCalledTimes(1);
});

it('does not display a push error for a detached owner', async () => {
  const h = harness();
  const failure = new OneKeyLocalError('Task account address changed');
  h.unstakePush.mockRejectedValueOnce(failure);
  await expect(h.task.run()).resolves.toBe(true);
  h.task.cancel();
  void invokeSuccess(h.navigation.params, signedData());
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(h.onPushError).not.toHaveBeenCalled();
  expect(h.onObserverError).toHaveBeenCalledWith(failure);
  expect(h.unstakePush).toHaveBeenCalledTimes(1);
});

it('does not repeat an uncertain Babylon build request', async () => {
  const h = harness();
  const failure = new OneKeyLocalError('build response unavailable');
  h.buildUnstake.mockRejectedValueOnce(failure);
  await expect(h.task.run()).rejects.toBe(failure);
  await h.task.run();
  expect(h.buildUnstake).toHaveBeenCalledTimes(1);
  expect(h.open).not.toHaveBeenCalled();
});

it('does not start a Babylon build for an already expired action scope', async () => {
  const h = harness({ isActionCurrent: () => false });
  await expect(h.task.run()).resolves.toBe(false);
  expect(h.buildUnstake).not.toHaveBeenCalled();
  expect(h.open).not.toHaveBeenCalled();
});

it('does not open confirmation for a build response after scope cancellation', async () => {
  const pending = deferred<IStakeTxResponse>();
  let current = true;
  const h = harness({ isActionCurrent: () => current });
  h.buildUnstake.mockReturnValue(pending.promise);
  const running = h.task.run();
  await new Promise<void>((resolve) => setImmediate(resolve));
  current = false;
  h.task.cancel();
  pending.resolve({ tx: transaction, orderId: 'order-1' });
  await expect(running).resolves.toBe(false);
  expect(h.buildUnstake).toHaveBeenCalledTimes(1);
  expect(h.buildInternalTx).not.toHaveBeenCalled();
  expect(h.open).not.toHaveBeenCalled();
  await h.task.run();
  expect(h.buildUnstake).toHaveBeenCalledTimes(1);
});

it('retains a late build-time broadcast without starting confirmation', async () => {
  const pending = deferred<IStakeTxResponse>();
  let current = true;
  const h = harness({ isActionCurrent: () => current });
  h.buildUnstake.mockReturnValue(pending.promise);
  const running = h.task.run();
  await new Promise<void>((resolve) => setImmediate(resolve));
  current = false;
  h.task.cancel();
  pending.resolve({ tx: { exitBroadcasted: true, validators: [] } });
  await expect(running).resolves.toBe(false);
  expect(
    h.task.getTask().steps.find((step) => step.kind === 'external')?.status
      .type,
  ).toBe('completed');
  expect(h.buildInternalTx).not.toHaveBeenCalled();
  expect(h.open).not.toHaveBeenCalled();
  expect(h.unstakePush).not.toHaveBeenCalled();
});

it('retains an accepted push after its page expires without updating that page', async () => {
  const pending = deferred<void>();
  let current = true;
  const h = harness({ isResultCurrent: () => current });
  h.unstakePush.mockReturnValue(pending.promise);
  await expect(h.task.run()).resolves.toBe(true);
  const result = invokeSuccess(h.navigation.params, signedData());
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(h.unstakePush).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(h.task.getTask())).not.toContain('signed-psbt');
  current = false;
  h.task.cancel();
  pending.resolve();
  await result;
  expect(h.onSuccess).not.toHaveBeenCalled();
  expect(
    h.task.getTask().steps.find((step) => step.kind === 'external')?.status
      .type,
  ).toBe('completed');
  expect(JSON.stringify(h.task.getTask())).not.toContain('signed-psbt');
  await h.task.run();
  expect(h.unstakePush).toHaveBeenCalledTimes(1);
});

it('does not authorize a push if the send guard rejected the signing attempt', async () => {
  const h = harness({ isSendCurrent: () => false });
  await expect(h.task.run()).resolves.toBe(true);
  await expect(
    Promise.resolve().then(() => h.navigation.params?.onBeforeSend?.()),
  ).rejects.toThrow('expired');
  await invokeSuccess(h.navigation.params, signedData());
  expect(h.unstakePush).not.toHaveBeenCalled();
  expect(h.onSuccess).not.toHaveBeenCalled();
});

it.each(['accountId', 'networkId'] as const)(
  'does not push a signed result for another %s',
  async (key) => {
    const h = harness();
    await expect(h.task.run()).resolves.toBe(true);
    const data = signedData();
    data[0].decodedTx[key] = 'other';
    await invokeSuccess(h.navigation.params, data);
    expect(h.unstakePush).not.toHaveBeenCalled();
    expect(h.onSuccess).not.toHaveBeenCalled();
  },
);

it('does not push when decoded transaction identity is missing', async () => {
  const h = harness();
  await expect(h.task.run()).resolves.toBe(true);
  const data = signedData();
  Reflect.deleteProperty(data[0], 'decodedTx');
  await invokeSuccess(h.navigation.params, data);
  expect(h.unstakePush).not.toHaveBeenCalled();
  expect(h.onSuccess).not.toHaveBeenCalled();
});

it.each(['accountId', 'networkId'] as const)(
  'does not push when signed-result %s is missing at runtime',
  async (key) => {
    const h = harness();
    await expect(h.task.run()).resolves.toBe(true);
    const data = signedData();
    Reflect.deleteProperty(data[0].decodedTx, key);
    await invokeSuccess(h.navigation.params, data);
    expect(h.unstakePush).not.toHaveBeenCalled();
    expect(h.onSuccess).not.toHaveBeenCalled();
  },
);

it('never pushes when sign-only confirmation is cancelled', async () => {
  const h = harness();
  await expect(h.task.run()).resolves.toBe(true);
  h.navigation.params?.onCancel?.();
  await invokeSuccess(h.navigation.params, signedData());
  expect(h.unstakePush).not.toHaveBeenCalled();
  expect(h.onSuccess).not.toHaveBeenCalled();
});

it.each([false, true])(
  'preserves confirmation preparation error handling with onFail=%s',
  async (hasOnFail) => {
    const failure = new OneKeyLocalError('confirmation preparation failed');
    const onFail = jest.fn();
    const h = harness({
      onFail: hasOnFail ? onFail : undefined,
      navigate: async (params) => {
        if (params.onFail) params.onFail(failure);
        else throw failure;
      },
    });
    if (hasOnFail) {
      await expect(h.task.run()).resolves.toBe(true);
      expect(onFail).toHaveBeenCalledWith(failure);
    } else await expect(h.task.run()).rejects.toBe(failure);
    expect(h.unstakePush).not.toHaveBeenCalled();
  },
);

type IComposedBabylonContext = IBabylonWithdrawContext & { flowId: string };

function createComposedBabylon(
  params: IBabylonWithdrawFragmentParams,
  signal: AbortSignal,
  { useRetained = true }: { useRetained?: boolean } = {},
) {
  const fragment =
    createBabylonWithdrawFragment<IComposedBabylonContext>(params);
  const identity = {
    accountId: params.accountId,
    networkId: params.networkId,
    accountAddress: 'btc-address-A',
    provider: params.provider,
    action: 'withdraw' as const,
  };
  const steps = getBabylonWithdrawSteps();
  const outer = createEarnWithdrawApprovalTask<
    string,
    never,
    IComposedBabylonContext,
    IBabylonWithdrawFacts,
    IBabylonWithdrawFact
  >({
    taskId: 'combined-babylon',
    identity,
    protocolSteps: steps,
    initialContext: { flowId: 'original' },
    approval: {
      handoffOnSubmit: true,
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: 'approval' }),
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
      await handoff.register({
        identity,
        steps,
        getAdapter: (step, context) => {
          expect(context.flowId).toBe('original');
          return fragment.getAdapter(step, context);
        },
        result: fragment.result,
        bindRuntime: fragment.bindRuntime,
        detachView: fragment.detachView,
        lifecycle: fragment.lifecycle,
        handlesContinuationErrors: fragment.handlesContinuationErrors,
      });
    },
    isCurrent: () => true,
    signal,
    onAsyncError: params.onObserverError,
    retained: useRetained
      ? {
          facts: {
            initial: { build: 'pending' },
            reduce: (facts, fact) =>
              fact.type === 'buildAccepted'
                ? { ...facts, build: fact.broadcast ? 'broadcast' : 'prepared' }
                : facts,
          },
        }
      : undefined,
  });
  return { outer, fragment };
}

it.each([false, true])(
  'reports a composed Babylon push failure once and cleans up the owner listener (detached=%s)',
  async (detach) => {
    const h = harness();
    const signal = new AbortController();
    const removeListener = jest.spyOn(signal.signal, 'removeEventListener');
    const { outer, fragment } = createComposedBabylon(h.params, signal.signal);
    const push = deferred<void>();
    const failure = new OneKeyLocalError('push failed');
    h.unstakePush.mockReturnValueOnce(push.promise);
    await expect(outer.run()).resolves.toBe(true);
    expect(removeListener).not.toHaveBeenCalledWith('abort', expect.anything());
    if (detach) signal.abort();
    const signed = invokeSuccess(h.navigation.params, signedData());
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(h.unstakePush).toHaveBeenCalledTimes(1);
    if (!detach)
      expect(removeListener).not.toHaveBeenCalledWith(
        'abort',
        expect.anything(),
      );
    push.reject(failure);
    await expect(signed).rejects.toBe(failure);
    await fragment.lifecycle;
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(h.onPushError).toHaveBeenCalledTimes(detach ? 0 : 1);
    expect(h.onObserverError).toHaveBeenCalledTimes(detach ? 1 : 0);
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(h.onSuccess).not.toHaveBeenCalled();
    removeListener.mockRestore();
  },
);

it('reports an observer failure while a composed Babylon push is claimed', async () => {
  const h = harness();
  const signal = new AbortController();
  const { outer, fragment } = createComposedBabylon(h.params, signal.signal);
  const push = deferred<void>();
  const failure = new OneKeyLocalError('observer failed');
  h.unstakePush.mockReturnValueOnce(push.promise);
  await expect(outer.run()).resolves.toBe(true);
  let thrown = false;
  const unsubscribe = outer.subscribe(() => {
    const task = outer.getTask();
    const step = task.steps[task.currentStepIndex];
    if (
      !thrown &&
      task.signContinuation?.status === 'claimed' &&
      step?.id === 'push'
    ) {
      thrown = true;
      throw failure;
    }
  });
  const signed = invokeSuccess(h.navigation.params, signedData());
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(h.unstakePush).toHaveBeenCalledTimes(1);
  expect(h.onObserverError).toHaveBeenCalledTimes(1);
  expect(h.onObserverError).toHaveBeenCalledWith(failure);
  expect(h.onPushError).not.toHaveBeenCalled();
  push.resolve();
  await signed;
  await fragment.lifecycle;
  unsubscribe();
});

it('runs approval and Babylon steps in one task and pushes a late signature once after detach', async () => {
  const h = harness();
  const signal = new AbortController();
  const { outer } = createComposedBabylon(h.params, signal.signal);
  await expect(outer.run()).resolves.toBe(true);
  expect(outer.getTask().taskId).toBe('combined-babylon');
  expect(outer.getTask().steps.map(({ id }) => id)).toEqual([
    'approve',
    'allowance',
    'prepareBusiness',
    'build',
    'sign',
    'push',
  ]);
  expect(outer.getTask().facts).toEqual({ build: 'prepared' });
  signal.abort();
  const pendingPush = deferred<void>();
  h.unstakePush.mockReturnValueOnce(pendingPush.promise);
  const data = signedData();
  const callbacks = Promise.all([
    invokeSuccess(h.navigation.params, data),
    invokeSuccess(h.navigation.params, data),
  ]);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(h.unstakePush).toHaveBeenCalledTimes(1);
  pendingPush.resolve();
  await callbacks;
  expect(h.onSuccess).not.toHaveBeenCalled();
  expect(JSON.stringify(outer.getTask())).not.toContain('signed-psbt');
});

it('retains a composed Babylon build broadcast fact after cancellation without starting sign', async () => {
  const h = harness();
  const signal = new AbortController();
  const pending = deferred<IStakeTxResponse>();
  const started = deferred<void>();
  h.buildUnstake.mockImplementationOnce(async () => {
    started.resolve();
    return pending.promise;
  });
  const { outer } = createComposedBabylon(h.params, signal.signal);
  const result = outer.run();
  await started.promise;
  signal.abort();
  await expect(result).resolves.toBe(false);
  pending.resolve({ tx: { exitBroadcasted: true, validators: [] } });
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(outer.getTask().facts).toEqual({ build: 'broadcast' });
  expect(
    outer.getTask().steps.find(({ id }) => id === 'build')?.status.type,
  ).toBe('completed');
  expect(h.open).not.toHaveBeenCalled();
  expect(h.unstakePush).not.toHaveBeenCalled();
});

it('keeps the Babylon lifecycle active after detach until the late push settles', async () => {
  const h = harness();
  const signal = new AbortController();
  const { outer, fragment } = createComposedBabylon(h.params, signal.signal);
  let finished = false;
  void fragment.lifecycle.then(() => {
    finished = true;
  });
  await expect(outer.run()).resolves.toBe(true);
  await Promise.resolve();
  expect(finished).toBe(false);
  signal.abort();
  await Promise.resolve();
  expect(finished).toBe(false);
  const pendingPush = deferred<void>();
  h.unstakePush.mockReturnValueOnce(pendingPush.promise);
  const signed = invokeSuccess(h.navigation.params, signedData());
  await new Promise<void>((resolve) => setImmediate(resolve));
  h.navigation.params?.onCancel?.();
  await Promise.resolve();
  expect(finished).toBe(false);
  expect(h.unstakePush).toHaveBeenCalledTimes(1);
  pendingPush.resolve();
  await signed;
  await fragment.lifecycle;
  expect(finished).toBe(true);
  expect(h.onSuccess).not.toHaveBeenCalled();
});

it('keeps the Babylon lifecycle active until a cancelled build records its late fact', async () => {
  const h = harness();
  const signal = new AbortController();
  const pending = deferred<IStakeTxResponse>();
  const started = deferred<void>();
  h.buildUnstake.mockImplementationOnce(async () => {
    started.resolve();
    return pending.promise;
  });
  const { outer, fragment } = createComposedBabylon(h.params, signal.signal);
  let finished = false;
  void fragment.lifecycle.then(() => {
    finished = true;
  });
  const result = outer.run();
  await started.promise;
  signal.abort();
  await expect(result).resolves.toBe(false);
  await Promise.resolve();
  expect(finished).toBe(false);
  pending.resolve({ tx: { exitBroadcasted: true, validators: [] } });
  await fragment.lifecycle;
  expect(outer.getTask().facts).toEqual({ build: 'broadcast' });
  expect(h.open).not.toHaveBeenCalled();
});

it('does not finish the Babylon lifecycle until a cancelled sign navigation returns', async () => {
  const pendingNavigation = deferred<void>();
  const navigationStarted = deferred<void>();
  const h = harness({
    navigate: async () => {
      navigationStarted.resolve();
      await pendingNavigation.promise;
    },
  });
  const signal = new AbortController();
  const { outer, fragment } = createComposedBabylon(h.params, signal.signal);
  let finished = false;
  void fragment.lifecycle.then(() => {
    finished = true;
  });
  const result = outer.run();
  await navigationStarted.promise;
  h.navigation.params?.onCancel?.();
  await Promise.resolve();
  expect(finished).toBe(false);
  pendingNavigation.resolve();
  await result;
  await fragment.lifecycle;
  expect(h.unstakePush).not.toHaveBeenCalled();
});

it('rejects a non-retained Babylon host before starting the build request', async () => {
  const h = harness();
  const signal = new AbortController();
  const { outer, fragment } = createComposedBabylon(h.params, signal.signal, {
    useRetained: false,
  });
  await expect(outer.run()).rejects.toThrow('Babylon requires a retained task');
  const lifecycleClosed = await Promise.race([
    fragment.lifecycle.then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 50)),
  ]);
  expect(lifecycleClosed).toBe(true);
  expect(h.getAccountAddress).not.toHaveBeenCalled();
  expect(h.buildUnstake).not.toHaveBeenCalled();
  expect(h.open).not.toHaveBeenCalled();
});

it('settles the Babylon lifecycle after an invalid signed result without pushing', async () => {
  const h = harness();
  const signal = new AbortController();
  const { outer, fragment } = createComposedBabylon(h.params, signal.signal);
  await expect(outer.run()).resolves.toBe(true);
  await invokeSuccess(h.navigation.params, signedData(''));
  await fragment.lifecycle;
  expect(h.unstakePush).not.toHaveBeenCalled();
  expect(h.onSuccess).not.toHaveBeenCalled();
});

it('settles the Babylon lifecycle after a synchronous navigation failure', async () => {
  const h = harness();
  const signal = new AbortController();
  const error = new OneKeyLocalError('navigation failed');
  const { outer, fragment } = createComposedBabylon(
    {
      ...h.params,
      navigate: () => {
        throw error;
      },
    },
    signal.signal,
  );
  await expect(outer.run()).rejects.toBe(error);
  await fragment.lifecycle;
  expect(h.unstakePush).not.toHaveBeenCalled();
});

it('waits for a cancelled address lookup before closing the Babylon lifecycle', async () => {
  const h = harness();
  const signal = new AbortController();
  const address = deferred<string>();
  const started = deferred<void>();
  h.getAccountAddress.mockImplementationOnce(async () => {
    started.resolve();
    return address.promise;
  });
  const { outer, fragment } = createComposedBabylon(h.params, signal.signal);
  let finished = false;
  void fragment.lifecycle.then(() => {
    finished = true;
  });
  const result = outer.run();
  await started.promise;
  signal.abort();
  await expect(result).resolves.toBe(false);
  await Promise.resolve();
  expect(finished).toBe(false);
  address.resolve('btc-address-A');
  await fragment.lifecycle;
  expect(h.buildUnstake).not.toHaveBeenCalled();
});
