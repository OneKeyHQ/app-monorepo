import type { IEncodedTx } from '@onekeyhq/core/src/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { runDirectDepositTask } from './directDepositTask';
import { waitForEarnTransactionConfirm } from './transactionConfirm';

import type { IDepositTaskHandle } from './types';

const mockAllowance = jest.fn<Promise<{ allowanceParsed: string }>, []>();
const mockAccount = jest.fn(async () => ({ address: 'owner' }));
const mockWait = jest.fn<Promise<EOnChainHistoryTxStatus | undefined>, []>();
const mockToast = jest.fn<void, unknown[]>();
const mockAddOrder = jest.fn<Promise<unknown>, [unknown, unknown]>();

jest.mock('@onekeyhq/components', () => ({
  Toast: {
    error: (...args: unknown[]) => mockToast(...args),
    message: (...args: unknown[]) => mockToast(...args),
  },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      fetchTokenAllowance: () => mockAllowance(),
      addEarnOrder: (order: unknown, options: unknown) =>
        mockAddOrder(order, options),
    },
    serviceAccount: {
      getAccount: () => mockAccount(),
      getAccountAddressForApi: async () => 'owner',
    },
  },
}));
jest.mock('@onekeyhq/kit/src/utils/waitForTxFinalStatus', () => ({
  waitForTxFinalStatus: () => mockWait(),
}));
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/utils/timerUtils')
  >('@onekeyhq/shared/src/utils/timerUtils');
  return {
    __esModule: true,
    default: { ...actual.default, wait: async () => undefined },
  };
});

const identity = {
  accountId: 'account',
  accountAddress: 'owner',
  networkId: 'evm--1',
  provider: 'etherfi',
  vault: 'vault',
  inputTokenAddress: 'token',
  depositTokenAddress: 'token',
  amount: '10',
  spenderAddress: 'spender',
};
const token: IToken = {
  address: 'token',
  symbol: 'USDT',
  name: 'Tether',
  decimals: 6,
  isNative: false,
};
const encodedTx = {
  from: 'owner',
  to: 'spender',
  value: '0',
  data: '0x',
} as IEncodedTx;

function successData(txid: string): ISendTxOnSuccessData[] {
  return [
    {
      signedTx: { txid, rawTx: '0x', encodedTx: null },
      decodedTx: {
        accountId: 'account',
        networkId: 'evm--1',
        txid,
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

type IArgs = Parameters<typeof runDirectDepositTask>[0];
type IConfirm = IArgs['confirm'];

function setup({
  startingAllowance = '0',
  reset = false,
}: { startingAllowance?: string; reset?: boolean } = {}) {
  let allowance = startingAllowance;
  let handle: IDepositTaskHandle | undefined;
  const actions: string[] = [];
  const onDepositSuccess = jest.fn(async () => undefined);
  const onTaskSettled = jest.fn();
  const onFail = jest.fn();
  const prepareDeposit: IArgs['prepareDeposit'] = jest.fn<
    ReturnType<IArgs['prepareDeposit']>,
    Parameters<IArgs['prepareDeposit']>
  >(async () => ({
    type: 'confirm',
    prepared: {
      encodedTx,
      stakeInfoWithOrderId: undefined,
      useFeeInTx: undefined,
      feeInfoEditable: undefined,
    },
  }));
  const confirm: IConfirm = jest.fn<ReturnType<IConfirm>, Parameters<IConfirm>>(
    async (params) => {
      await params.beforeSendGuard?.();
      params.onSendStarted?.();
      const amount = params.approvesInfo?.[0]?.amount;
      let action = 'deposit';
      if (amount === '0') action = 'reset';
      else if (amount) action = 'approve';
      actions.push(action);
      if (action === 'reset') allowance = '0';
      if (action === 'approve') allowance = '10';
      const data = successData(`${action}-tx`);
      params.onSubmitted?.(data);
      return { status: 'success', data };
    },
  );
  mockAllowance.mockImplementation(async () => ({
    allowanceParsed: allowance,
  }));
  const args: IArgs = {
    identity,
    token,
    requiresAllowanceReset: reset,
    signal: new AbortController().signal,
    isCurrent: () => true,
    confirm,
    prepareDeposit,
    onTaskReady: (value) => {
      handle = value;
    },
    onDepositSuccess,
    onTaskSettled,
    onFail,
    formatMessage: (id) => id,
  };
  return {
    args,
    actions,
    getHandle: () => handle,
    onDepositSuccess,
    onTaskSettled,
    onFail,
    prepareDeposit,
    setAllowance: (value: string) => {
      allowance = value;
    },
  };
}

describe('direct deposit task', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAccount.mockResolvedValue({ address: 'owner' });
    mockWait.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    mockAddOrder.mockResolvedValue({
      localStatus: 'saved',
      remoteStatus: 'synced',
    });
  });

  it('records a verified late deposit without treating it as settled or notifying the old page', async () => {
    const test = setup({ startingAllowance: '10' });
    let late: Parameters<IConfirm>[0]['onLateBroadcastAccepted'];
    const confirm: IConfirm = async (params) => {
      await params.beforeSendGuard?.();
      params.onSendStarted?.();
      late = params.onLateBroadcastAccepted;
      return { status: 'cancel' };
    };
    const prepared = await test.args.prepareDeposit(
      new AbortController().signal,
    );
    if (prepared.type !== 'confirm')
      throw new OneKeyLocalError('Missing preparation');
    prepared.prepared.stakeInfoWithOrderId = {
      label: EEarnLabels.Stake,
      protocol: 'etherfi',
      tags: [],
      orderId: 'order',
    };
    await runDirectDepositTask({
      ...test.args,
      confirm,
      prepareDeposit: async () => prepared,
    });
    await late?.({
      uuid: 'uuid',
      accountId: 'other',
      networkId: 'evm--1',
      txid: 'tx',
    });
    expect(mockAddOrder).not.toHaveBeenCalled();
    await late?.({
      uuid: 'uuid',
      accountId: 'account',
      networkId: 'evm--1',
      txid: 'tx',
    });
    await late?.({
      uuid: 'uuid',
      accountId: 'account',
      networkId: 'evm--1',
      txid: 'tx',
    });
    expect(test.getHandle()?.getTask().steps[1].status).toEqual({
      type: 'unknown',
      txid: 'tx',
      chainConfirmed: false,
    });
    expect(mockAddOrder).toHaveBeenCalledTimes(1);
    expect(mockAddOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order', txId: 'tx' }),
      { remoteSync: 'once', preserveExistingTx: true },
    );
    expect(test.onDepositSuccess).not.toHaveBeenCalled();
    expect(test.onTaskSettled).not.toHaveBeenCalled();
  });

  it('marks a success as late when the scope changed before the confirmation settled', async () => {
    const test = setup({ startingAllowance: '10' });
    let current = true;
    const confirm: IConfirm = async (params) => {
      await params.beforeSendGuard?.();
      params.onSendStarted?.();
      current = false;
      const data = successData('deposit-tx');
      params.onSubmitted?.(data, { lateAfterSettlement: false });
      return { status: 'success', data };
    };
    await runDirectDepositTask({
      ...test.args,
      confirm,
      isCurrent: () => current,
    });
    expect(test.onDepositSuccess).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      expect.objectContaining({ lateAfterSettlement: true }),
    );
  });

  it('does not start an order write when conflicting late hashes arrive before recording', async () => {
    const test = setup({ startingAllowance: '10' });
    let late: Parameters<IConfirm>[0]['onLateBroadcastAccepted'];
    const confirm: IConfirm = async (params) => {
      await params.beforeSendGuard?.();
      params.onSendStarted?.();
      late = params.onLateBroadcastAccepted;
      return { status: 'cancel' };
    };
    const prepared = await test.args.prepareDeposit(
      new AbortController().signal,
    );
    if (prepared.type !== 'confirm')
      throw new OneKeyLocalError('Missing preparation');
    prepared.prepared.stakeInfoWithOrderId = {
      label: EEarnLabels.Stake,
      protocol: 'etherfi',
      tags: [],
      orderId: 'order',
    };
    await runDirectDepositTask({
      ...test.args,
      confirm,
      prepareDeposit: async () => prepared,
    });
    const fact = {
      uuid: 'uuid',
      accountId: 'account',
      networkId: 'evm--1',
      txid: 'tx-a',
    };
    const first = late?.(fact);
    const second = late?.({ ...fact, txid: 'tx-b' });
    await Promise.all([first, second]);
    expect(mockAddOrder).not.toHaveBeenCalled();
    expect(test.getHandle()?.getTask().steps[1].status).toEqual({
      type: 'unknown',
      chainConfirmed: false,
      txidConflict: ['tx-a', 'tx-b'],
    });
  });

  it('skips approval when the current allowance already covers the amount', async () => {
    const test = setup({ startingAllowance: '10' });
    await expect(runDirectDepositTask(test.args)).resolves.toBe(true);
    expect(test.actions).toEqual(['deposit']);
    expect(
      test
        .getHandle()
        ?.getTask()
        .steps.map((step) => step.status.type),
    ).toEqual(['skipped', 'handedOff']);
    expect(test.onDepositSuccess).toHaveBeenCalledTimes(1);
  });

  it('waits for approval receipt and the new allowance before preparing deposit', async () => {
    const test = setup();
    await expect(runDirectDepositTask(test.args)).resolves.toBe(true);
    expect(test.actions).toEqual(['approve', 'deposit']);
    expect(mockWait).toHaveBeenCalledTimes(1);
    expect(
      test
        .getHandle()
        ?.getTask()
        .steps.map((step) => step.status.type),
    ).toEqual(['succeeded', 'handedOff']);
  });

  it('resets nonzero USDT allowance, verifies zero, then approves and deposits', async () => {
    const test = setup({ startingAllowance: '4', reset: true });
    const confirmReset = jest.fn(async () => true);
    await expect(
      runDirectDepositTask({ ...test.args, confirmReset }),
    ).resolves.toBe(true);
    expect(confirmReset).toHaveBeenCalledTimes(1);
    expect(test.actions).toEqual(['reset', 'approve', 'deposit']);
    expect(mockWait).toHaveBeenCalledTimes(2);
    expect(
      test
        .getHandle()
        ?.getTask()
        .steps.map((step) => step.status.type),
    ).toEqual(['succeeded', 'succeeded', 'handedOff']);
  });

  it('requires a new reset confirmation when allowance changes again after a confirmed reset', async () => {
    const test = setup({ startingAllowance: '4', reset: true });
    const confirmReset = jest.fn(async () => true);
    const submitted: string[] = [];
    let resetCount = 0;
    let changedExternally = false;
    test.args.confirmReset = confirmReset;
    test.args.beforeSendGuard = async (step) => {
      if (step === 'approve' && !changedExternally) {
        expect(test.getHandle()?.getTask().steps[0].status).toEqual({
          type: 'succeeded',
          txid: 'reset-1',
        });
        changedExternally = true;
        test.setAllowance('4');
      }
      return true;
    };
    test.args.confirm = async (params) => {
      await params.beforeSendGuard?.();
      params.onSendStarted?.();
      const amount = params.approvesInfo?.[0]?.amount;
      let txid = 'deposit-1';
      if (amount === '0') {
        resetCount += 1;
        txid = `reset-${resetCount}`;
        test.setAllowance('0');
      } else if (amount) {
        txid = 'approve-1';
        test.setAllowance('10');
      }
      submitted.push(txid);
      const data = successData(txid);
      params.onSubmitted?.(data);
      return { status: 'success', data };
    };

    await expect(runDirectDepositTask(test.args)).resolves.toBe(false);
    expect(submitted).toEqual(['reset-1']);
    expect(confirmReset).toHaveBeenCalledTimes(1);
    expect(test.prepareDeposit).not.toHaveBeenCalled();
    expect(test.getHandle()?.getTask().steps[1].status).toEqual({
      type: 'failed',
      stage: 'beforeSend',
    });

    await test.getHandle()?.retry();
    expect(confirmReset).toHaveBeenCalledTimes(2);
    expect(submitted).toEqual(['reset-1', 'reset-2', 'approve-1', 'deposit-1']);
    expect(test.onDepositSuccess).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: 'ERC20', reset: false, changedAllowance: '0' },
    { name: 'USDT', reset: true, changedAllowance: '4' },
  ])(
    'repairs the $name allowance on explicit retry after the confirmed approval becomes insufficient',
    async ({ reset, changedAllowance }) => {
      const test = setup({ startingAllowance: '0', reset });
      const confirmReset = jest.fn(async () => true);
      test.args.confirmReset = confirmReset;
      const prepare = test.args.prepareDeposit;
      let approvalCount = 0;
      let depositAttempts = 0;
      let allowanceRevoked = false;

      test.args.confirm = async (params) => {
        await params.beforeSendGuard?.();
        params.onSendStarted?.();
        const amount = params.approvesInfo?.[0]?.amount;
        let txid = 'deposit-1';
        if (amount === '0') {
          test.actions.push('reset');
          test.setAllowance('0');
          txid = 'reset-1';
        } else if (amount) {
          approvalCount += 1;
          test.actions.push('approve');
          test.setAllowance('10');
          txid = `approve-${approvalCount}`;
          if (approvalCount > 1) allowanceRevoked = false;
        } else {
          test.actions.push('deposit');
        }
        const data = successData(txid);
        params.onSubmitted?.(data);
        return { status: 'success', data };
      };
      test.args.prepareDeposit = async (signal) => {
        depositAttempts += 1;
        if (depositAttempts === 1) {
          const originalApproval = test
            .getHandle()
            ?.getTask()
            .steps.find((step) => step.kind === 'approve');
          expect(originalApproval?.status).toEqual({
            type: 'succeeded',
            txid: 'approve-1',
          });
          test.setAllowance(changedAllowance);
          allowanceRevoked = true;
        }
        if (allowanceRevoked) {
          throw new OneKeyLocalError('EtherFi: deposit approval required');
        }
        return prepare(signal);
      };

      await expect(runDirectDepositTask(test.args)).resolves.toBe(false);
      expect(test.actions).toEqual(['approve']);
      const beforeRetry = test.getHandle()?.getTask();
      expect(beforeRetry?.steps[beforeRetry.currentStepIndex].status).toEqual({
        type: 'failed',
        stage: 'beforeSend',
      });
      expect(test.onDepositSuccess).not.toHaveBeenCalled();
      expect(confirmReset).not.toHaveBeenCalled();

      await test.getHandle()?.retry();

      expect(test.actions).toEqual(
        reset
          ? ['approve', 'reset', 'approve', 'deposit']
          : ['approve', 'approve', 'deposit'],
      );
      expect(confirmReset).toHaveBeenCalledTimes(reset ? 1 : 0);
      expect(
        test
          .getHandle()
          ?.getTask()
          .steps.find((step) => step.kind === 'approve')?.status,
      ).toEqual({
        type: 'succeeded',
        txid: 'approve-1',
      });
      expect(
        test
          .getHandle()
          ?.getTask()
          .steps.filter((step) => step.kind === 'approve')
          .map((step) => step.status),
      ).toEqual([
        { type: 'succeeded', txid: 'approve-1' },
        { type: 'succeeded', txid: 'approve-2' },
      ]);
      expect(test.onDepositSuccess).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { name: 'ERC20', reset: false, changedAllowance: '0' },
    { name: 'USDT', reset: true, changedAllowance: '4' },
  ])(
    'blocks a $name deposit if allowance changes in confirmation and repairs it on retry',
    async ({ reset, changedAllowance }) => {
      const test = setup({ startingAllowance: '0', reset });
      if (!reset) {
        test.args.token = { ...token, symbol: 'USDC', name: 'USD Coin' };
      }
      const confirmReset = jest.fn(async () => true);
      test.args.confirmReset = confirmReset;
      const originalConfirm = test.args.confirm;
      let depositConfirmations = 0;
      test.args.confirm = async (params) => {
        if (!params.approvesInfo) {
          depositConfirmations += 1;
          if (depositConfirmations === 1) test.setAllowance(changedAllowance);
        }
        return originalConfirm(params);
      };

      await expect(runDirectDepositTask(test.args)).resolves.toBe(false);
      expect(depositConfirmations).toBe(1);
      expect(test.actions).toEqual(['approve']);
      const beforeRetry = test.getHandle()?.getTask();
      expect(beforeRetry?.steps[beforeRetry.currentStepIndex].status).toEqual({
        type: 'failed',
        stage: 'beforeSend',
      });
      expect(test.onFail).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Token allowance changed before deposit',
        }),
      );
      expect(test.onDepositSuccess).not.toHaveBeenCalled();
      expect(confirmReset).not.toHaveBeenCalled();

      await test.getHandle()?.retry();

      expect(test.actions).toEqual(
        reset
          ? ['approve', 'reset', 'approve', 'deposit']
          : ['approve', 'approve', 'deposit'],
      );
      expect(confirmReset).toHaveBeenCalledTimes(reset ? 1 : 0);
      expect(depositConfirmations).toBe(2);
      expect(test.prepareDeposit).toHaveBeenCalledTimes(2);
      expect(test.onDepositSuccess).toHaveBeenCalledTimes(1);
    },
  );

  it('does not send or rebuild on retry while the allowance RPC fails', async () => {
    const test = setup({ startingAllowance: '10' });
    const rpcError = new Error('Allowance RPC unavailable');
    let rpcUnavailable = false;
    mockAllowance.mockImplementation(async () => {
      if (rpcUnavailable) throw rpcError;
      return { allowanceParsed: '10' };
    });
    const originalConfirm = test.args.confirm;
    let depositConfirmations = 0;
    test.args.confirm = async (params) => {
      if (!params.approvesInfo) {
        depositConfirmations += 1;
        if (depositConfirmations === 1) rpcUnavailable = true;
      }
      return originalConfirm(params);
    };

    await expect(runDirectDepositTask(test.args)).resolves.toBe(false);
    expect(test.actions).toEqual([]);
    expect(test.prepareDeposit).toHaveBeenCalledTimes(1);
    expect(test.onFail).toHaveBeenCalledWith(rpcError);

    await test.getHandle()?.retry();

    expect(test.actions).toEqual([]);
    expect(test.prepareDeposit).toHaveBeenCalledTimes(1);
    expect(depositConfirmations).toBe(1);
    expect(test.onFail).toHaveBeenCalledTimes(2);
    const failed = test.getHandle()?.getTask();
    expect(failed?.steps[failed.currentStepIndex].status).toEqual({
      type: 'failed',
      stage: 'beforeSend',
    });

    rpcUnavailable = false;
    await test.getHandle()?.retry();
    expect(test.actions).toEqual(['deposit']);
    expect(test.prepareDeposit).toHaveBeenCalledTimes(2);
    expect(test.onDepositSuccess).toHaveBeenCalledTimes(1);
  });

  it('never rebuilds or resends a deposit with unknown broadcast result', async () => {
    const test = setup({ startingAllowance: '10' });
    test.args.confirm = async (params) => {
      await params.beforeSendGuard?.();
      params.onSendStarted?.();
      const data = successData('');
      params.onSubmitted?.(data);
      return { status: 'success', data };
    };

    await expect(runDirectDepositTask(test.args)).resolves.toBe(false);
    expect(test.prepareDeposit).toHaveBeenCalledTimes(1);
    const task = test.getHandle()?.getTask();
    expect(task?.steps[task.currentStepIndex].status).toEqual({
      type: 'unknown',
      chainConfirmed: false,
    });
    await test.getHandle()?.retry();
    await test.getHandle()?.retryStatus();
    expect(test.prepareDeposit).toHaveBeenCalledTimes(1);
    expect(test.onDepositSuccess).not.toHaveBeenCalled();
  });

  it('never resends an uncertain reset when the user retries or checks its status', async () => {
    const test = setup({ startingAllowance: '4', reset: true });
    const confirmReset = jest.fn(async () => true);
    mockWait.mockResolvedValue(undefined);
    await expect(
      runDirectDepositTask({ ...test.args, confirmReset }),
    ).resolves.toBe(false);
    expect(test.actions).toEqual(['reset']);
    expect(test.getHandle()?.getTask().steps[0].status).toEqual({
      type: 'unknown',
      txid: 'reset-tx',
      chainConfirmed: false,
    });

    await test.getHandle()?.retry();
    await test.getHandle()?.retryStatus();
    expect(test.actions).toEqual(['reset']);
    expect(confirmReset).toHaveBeenCalledTimes(1);
    expect(test.prepareDeposit).not.toHaveBeenCalled();
  });

  it('stops when a reset was skipped but a nonzero insufficient allowance appears', async () => {
    const test = setup({ startingAllowance: '0', reset: true });
    mockAllowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockResolvedValueOnce({ allowanceParsed: '4' });
    await expect(runDirectDepositTask(test.args)).resolves.toBe(false);
    expect(test.actions).toEqual([]);
    expect(test.onFail).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Token allowance must be reset before approval',
      }),
    );
  });

  it('cancels the reset without opening a transaction when the user declines', async () => {
    const test = setup({ startingAllowance: '4', reset: true });
    await expect(
      runDirectDepositTask({ ...test.args, confirmReset: async () => false }),
    ).resolves.toBe(false);
    expect(test.actions).toEqual([]);
    expect(test.getHandle()?.getTask().steps[0].status.type).toBe('cancelled');
  });

  it('does not automatically resend a submitted approval with unknown receipt', async () => {
    const test = setup();
    mockWait.mockResolvedValue(undefined);
    await expect(runDirectDepositTask(test.args)).resolves.toBe(false);
    expect(test.actions).toEqual(['approve']);
    expect(test.getHandle()?.getTask().steps[0].status).toEqual({
      type: 'unknown',
      txid: 'approve-tx',
      chainConfirmed: false,
    });
    mockWait.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    await test.getHandle()?.retryStatus();
    expect(test.actions).toEqual(['approve']);
    expect(test.getHandle()?.getTask().steps[1].status.type).toBe('ready');
  });

  it('rebuilds deposit preparation after a pre-send cancellation', async () => {
    const test = setup({ startingAllowance: '10' });
    let first = true;
    const original = test.args.prepareDeposit;
    test.args.prepareDeposit = jest.fn<
      ReturnType<IArgs['prepareDeposit']>,
      Parameters<IArgs['prepareDeposit']>
    >(async (signal) => {
      if (first) {
        first = false;
        return { type: 'cancelled' };
      }
      return original(signal);
    });
    await expect(runDirectDepositTask(test.args)).resolves.toBe(false);
    await test.getHandle()?.retry();
    expect(test.args.prepareDeposit).toHaveBeenCalledTimes(2);
    expect(test.actions).toEqual(['deposit']);
  });

  it('rechecks the send guard and refuses a changed USDT allowance', async () => {
    const test = setup({ startingAllowance: '0', reset: true });
    let checks = 0;
    test.args.beforeSendGuard = async (step) => {
      if (step === 'approve') {
        checks += 1;
        if (checks === 2) test.setAllowance('4');
      }
      return true;
    };
    await expect(runDirectDepositTask(test.args)).resolves.toBe(false);
    expect(test.actions).toEqual([]);
    expect(test.onFail).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Token allowance changed before approval',
      }),
    );
  });

  it('does not send when the synchronous guard changes during the final allowance read', async () => {
    const test = setup({ startingAllowance: '0', reset: true });
    let finishAllowance: (value: {
      allowanceParsed: string;
    }) => void = () => {};
    let markReadStarted: () => void = () => {};
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve;
    });
    mockAllowance
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockResolvedValueOnce({ allowanceParsed: '0' })
      .mockImplementationOnce(() => {
        markReadStarted();
        return new Promise((resolve) => {
          finishAllowance = resolve;
        });
      });
    let allowed = true;
    test.args.canSendNow = (step) => allowed && step === 'approve';
    const running = runDirectDepositTask(test.args);
    await readStarted;
    allowed = false;
    finishAllowance({ allowanceParsed: '0' });
    await expect(running).resolves.toBe(false);
    expect(test.actions).toEqual([]);
    expect(test.getHandle()?.getTask().steps[1].status).toEqual({
      type: 'failed',
      stage: 'beforeSend',
    });
  });

  it('stops at the failed approval receipt without depositing', async () => {
    const test = setup();
    mockWait.mockResolvedValue(EOnChainHistoryTxStatus.Failed);
    await expect(runDirectDepositTask(test.args)).resolves.toBe(false);
    expect(test.actions).toEqual(['approve']);
    expect(test.getHandle()?.getTask().steps[0].status).toEqual({
      type: 'failed',
      stage: 'onChain',
      txid: 'approve-tx',
    });
  });

  it('keeps an approval with no transaction hash unknown and does not resubmit it', async () => {
    const test = setup();
    test.args.confirm = async (params) => {
      await params.beforeSendGuard?.();
      params.onSendStarted?.();
      const data = successData('');
      params.onSubmitted?.(data);
      return { status: 'success', data };
    };
    await expect(runDirectDepositTask(test.args)).resolves.toBe(false);
    expect(test.getHandle()?.getTask().steps[0].status).toEqual({
      type: 'unknown',
      chainConfirmed: false,
    });
    await test.getHandle()?.retry();
    await test.getHandle()?.retryStatus();
    expect(mockWait).not.toHaveBeenCalled();
    expect(test.prepareDeposit).not.toHaveBeenCalled();
  });

  it('does not proceed when approval succeeded but the allowance has not settled', async () => {
    const test = setup();
    mockAllowance.mockResolvedValue({ allowanceParsed: '0' });
    await expect(runDirectDepositTask(test.args)).resolves.toBe(false);
    expect(test.actions).toEqual(['approve']);
    expect(test.getHandle()?.getTask().steps[0].status).toEqual({
      type: 'unknown',
      txid: 'approve-tx',
      chainConfirmed: true,
    });
    expect(test.prepareDeposit).not.toHaveBeenCalled();
  });

  it('does not open the next transaction after account scope changes during receipt lookup', async () => {
    const test = setup();
    let current = true;
    test.args.isCurrent = () => current;
    mockWait.mockImplementation(async () => {
      current = false;
      return EOnChainHistoryTxStatus.Success;
    });
    await expect(runDirectDepositTask(test.args)).resolves.toBe(false);
    expect(test.actions).toEqual(['approve']);
    expect(test.prepareDeposit).not.toHaveBeenCalled();
  });

  it('cancels before opening confirmation when the action guard rejects', async () => {
    const test = setup();
    test.args.beforeSendGuard = async () => false;
    await expect(runDirectDepositTask(test.args)).resolves.toBe(false);
    expect(test.actions).toEqual([]);
    expect(test.args.confirm).not.toHaveBeenCalled();
    expect(test.onFail).not.toHaveBeenCalled();
    expect(test.prepareDeposit).not.toHaveBeenCalled();
    expect(test.getHandle()?.getTask().steps[0].status.type).toBe('cancelled');
  });

  it('blocks sending if the guard changes after the confirmation opens', async () => {
    const test = setup();
    let checks = 0;
    test.args.beforeSendGuard = async () => {
      checks += 1;
      return checks === 1;
    };
    await expect(runDirectDepositTask(test.args)).resolves.toBe(false);
    expect(test.args.confirm).toHaveBeenCalledTimes(1);
    expect(test.actions).toEqual([]);
    expect(test.prepareDeposit).not.toHaveBeenCalled();
    expect(test.getHandle()?.getTask().steps[0].status).toEqual({
      type: 'failed',
      stage: 'beforeSend',
    });
  });

  it('blocks sending when the action becomes invalid while send-start is recorded', async () => {
    const test = setup();
    let valid = true;
    let blockFirst = true;
    const broadcast = jest.fn();
    const confirmNormally = test.args.confirm;
    test.args.canSendNow = () => valid;
    test.args.onTaskChange = (task) => {
      if (
        blockFirst &&
        task.steps[task.currentStepIndex]?.status.type === 'sending'
      ) {
        valid = false;
        blockFirst = false;
      }
    };
    test.args.confirm = (params) => {
      if (!blockFirst && valid) return confirmNormally(params);
      return waitForEarnTransactionConfirm({
        ...params,
        expiredMessage: 'expired',
        navigationToTxConfirm: async ({ onBeforeSend }) => {
          await onBeforeSend?.();
          broadcast();
        },
      });
    };
    await expect(runDirectDepositTask(test.args)).resolves.toBe(false);
    expect(broadcast).not.toHaveBeenCalled();
    expect(test.prepareDeposit).not.toHaveBeenCalled();
    expect(test.getHandle()?.getTask().steps[0].status).toEqual({
      type: 'failed',
      stage: 'beforeSend',
    });
    valid = true;
    await test.getHandle()?.retry();
    expect(broadcast).not.toHaveBeenCalled();
    expect(test.actions).toEqual(['approve', 'deposit']);
  });

  it('rejects a mismatched input asset and an amount exceeding token precision', async () => {
    const test = setup();
    await expect(
      runDirectDepositTask({
        ...test.args,
        identity: { ...identity, inputTokenAddress: 'different' },
      }),
    ).rejects.toThrow('Invalid direct deposit task identity');
    await expect(
      runDirectDepositTask({
        ...test.args,
        identity: { ...identity, amount: '0.0000001' },
      }),
    ).rejects.toThrow('Invalid direct deposit task identity');
    expect(test.actions).toEqual([]);
  });

  it.each(['reset', 'deposit'] as const)(
    'passes an abortable task signal to the %s dialog when the task is disposed',
    async (dialog) => {
      const test = setup({
        startingAllowance: dialog === 'reset' ? '4' : '10',
        reset: dialog === 'reset',
      });
      let opened: () => void = () => undefined;
      const isOpen = new Promise<void>((resolve) => {
        opened = resolve;
      });
      let dialogSignal: AbortSignal | undefined;
      const waitForClose = (signal: AbortSignal) => {
        dialogSignal = signal;
        opened();
        return new Promise<void>((resolve) => {
          signal.addEventListener('abort', () => resolve(), { once: true });
        });
      };
      if (dialog === 'reset') {
        test.args.confirmReset = async (signal) => {
          await waitForClose(signal);
          return true;
        };
      } else {
        test.args.prepareDeposit = async (signal) => {
          await waitForClose(signal);
          return {
            type: 'confirm',
            prepared: {
              encodedTx,
              stakeInfoWithOrderId: undefined,
              useFeeInTx: undefined,
              feeInfoEditable: undefined,
            },
          };
        };
      }
      const running = runDirectDepositTask(test.args);
      await isOpen;
      expect(dialogSignal?.aborted).toBe(false);
      test.getHandle()?.dispose();
      await expect(running).resolves.toBe(false);
      expect(dialogSignal?.aborted).toBe(true);
      expect(test.actions).toEqual([]);
      expect(mockAccount).not.toHaveBeenCalled();
    },
  );
});
