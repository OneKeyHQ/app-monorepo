/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EApproveType,
  EEarnLabels,
  type IStakeTxResponse,
} from '@onekeyhq/shared/types/staking';

import { createEarnWithdrawApprovalTask } from '../../Earn/tasks/earnWithdrawApprovalTask';
import { getUniversalWithdrawProtocolPlan } from '../earnWithdrawTask/types';

import {
  useUniversalClaim,
  useUniversalStake,
  useUniversalWithdraw,
} from './useUniversalHooks';

import type {
  IUniversalWithdrawContext,
  IUniversalWithdrawPrepared,
} from '../../Earn/protocols/withdrawProtocolRuntime';

type IMockNavigationParams = {
  onBeforeSend?: () => Promise<void>;
  onCancel?: () => void;
  onSuccess?: (
    data: { decodedTx: { txid: string; status: string } }[],
  ) => Promise<void>;
};

const mockBuildStake = jest.fn<Promise<IStakeTxResponse>, [unknown]>();
const mockBuildUnstake = jest.fn<Promise<IStakeTxResponse>, [unknown]>();
const mockBuildClaim = jest.fn<Promise<IStakeTxResponse>, [unknown]>();
const mockConversion = jest.fn(async (_params: unknown) => 'success' as const);
const mockNavigate = jest.fn(
  async (_params: IMockNavigationParams) => undefined,
);
const mockAddOrder = jest.fn(async (_params: unknown) => undefined);
const mockAssertApproval = jest.fn<Promise<void>, [unknown]>();
const mockFetchAllowance = jest.fn(async () => ({ allowanceParsed: '0' }));
const mockAccountAddress = jest.fn(async () => '0xaccount');
const mockWaitForOrder = jest.fn<Promise<unknown>, [unknown]>();
const mockShowOrder = jest.fn<
  Promise<{ status: 'failed'; errorMessage: string } | undefined>,
  [unknown]
>();
const mockBuildInternal = jest.fn<Promise<unknown>, unknown[]>();
const mockRiskAccepted = jest.fn(async () => true);

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccountAddressForApi: () => mockAccountAddress(),
      getAccount: jest.fn(async () => ({ address: '0xaccount' })),
    },
    serviceStaking: {
      assertEarnApproval: (params: unknown) => mockAssertApproval(params),
      fetchTokenAllowance: () => mockFetchAllowance(),
      buildStakeTransaction: (params: unknown) => mockBuildStake(params),
      buildUnstakeTransaction: (params: unknown) => mockBuildUnstake(params),
      buildClaimTransaction: (params: unknown) => mockBuildClaim(params),
      addEarnOrder: (params: unknown) => mockAddOrder(params),
      estimateFee: jest.fn(async () => ({})),
      getStakingConfigs: jest.fn(async () => ({})),
      buildInternalDappTx: (...params: unknown[]) =>
        mockBuildInternal(...params),
      waitForServerExecutedOrder: (params: unknown) => mockWaitForOrder(params),
    },
  },
}));
jest.mock('../components/ServerExecutedOrderDialog', () => ({
  showServerExecutedOrderDialog: (scope: unknown) => mockShowOrder(scope),
}));
jest.mock('../components/ClaimConversionDialog', () => ({
  runClaimConversion: (...params: [unknown]) => mockConversion(...params),
}));
jest.mock('../components/EarnRiskWarningDialog', () => ({
  showEarnRiskWarningDialog: () => mockRiskAccepted(),
  useEarnRiskWarningGate: () => mockRiskAccepted,
}));
jest.mock('../components/EstimateNetworkFee', () => ({
  useShowClaimEstimateGasAlert: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({ navigationToTxConfirm: mockNavigate }),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

function deferred<T>() {
  let resolve: (value: T) => void = (_value) => {
    throw new OneKeyLocalError('Promise not initialized');
  };
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

const account = { accountId: 'account-a', networkId: 'evm--56' };
const stake = {
  amount: '1',
  symbol: 'USDT',
  provider: 'unitas',
  protocolVault: 'vault-a',
};
const withdraw = { ...stake, withdrawAll: false };
const expectedTracking = {
  ...account,
  orderId: 'order-a',
  refreshScope: { provider: 'unitas', vault: 'vault-a' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAssertApproval.mockResolvedValue(undefined);
  mockAccountAddress.mockResolvedValue('0xaccount');
  mockWaitForOrder.mockResolvedValue({ status: 'timeout' });
  mockShowOrder.mockResolvedValue(undefined);
});

it('tracks an accepted stake against the original account when its response arrives after switching accounts', async () => {
  const pending = deferred<IStakeTxResponse>();
  mockBuildStake.mockReturnValue(pending.promise);
  const onSuccess = jest.fn();
  const onFail = jest.fn();
  const { result, rerender } = renderHook(
    ({ accountId }) => useUniversalStake({ ...account, accountId }),
    { initialProps: { accountId: account.accountId } },
  );
  const operation = result.current({ ...stake, onSuccess, onFail });
  await waitFor(() => expect(mockBuildStake).toHaveBeenCalledTimes(1));
  rerender({ accountId: 'account-b' });
  pending.resolve({ tx: null, orderId: 'order-a' });
  await expect(operation).resolves.toBe(false);
  expect(mockWaitForOrder).toHaveBeenCalledWith(expectedTracking);
  expect(mockShowOrder).not.toHaveBeenCalled();
  expect(mockBuildInternal).not.toHaveBeenCalled();
  expect(onSuccess).not.toHaveBeenCalled();
  expect(onFail).not.toHaveBeenCalled();
});

it('keeps the normal server stake dialog and callback when the scope is current', async () => {
  mockBuildStake.mockResolvedValue({ tx: null, orderId: 'order-a' });
  const onSuccess = jest.fn();
  const { result } = renderHook(() => useUniversalStake(account));
  await expect(
    result.current({ ...stake, onSuccess, utm: { utmSource: 'campaign' } }),
  ).resolves.toBe(true);
  expect(mockBuildStake).toHaveBeenCalledWith(
    expect.objectContaining({ utmSource: 'campaign' }),
  );
  expect(mockShowOrder).toHaveBeenCalledWith({
    ...account,
    orderId: 'order-a',
  });
  expect(mockWaitForOrder).not.toHaveBeenCalled();
  expect(onSuccess).toHaveBeenCalledWith([]);
});

it('tracks a server stake if the account changes while its dialog is open', async () => {
  const pendingDialog = deferred<undefined>();
  mockBuildStake.mockResolvedValue({ tx: null, orderId: 'order-a' });
  mockShowOrder.mockReturnValue(pendingDialog.promise);
  const onSuccess = jest.fn();
  const { result, rerender } = renderHook(
    ({ accountId }) => useUniversalStake({ ...account, accountId }),
    { initialProps: { accountId: account.accountId } },
  );
  const operation = result.current({ ...stake, onSuccess });
  await waitFor(() => expect(mockShowOrder).toHaveBeenCalledTimes(1));
  rerender({ accountId: 'account-b' });
  pendingDialog.resolve(undefined);
  await expect(operation).resolves.toBe(false);
  expect(mockWaitForOrder).toHaveBeenCalledWith(expectedTracking);
  expect(onSuccess).not.toHaveBeenCalled();
});

it('does not display an old account failure after its address changes', async () => {
  const pendingDialog = deferred<undefined>();
  mockBuildStake.mockResolvedValue({ tx: null, orderId: 'order-a' });
  mockShowOrder.mockReturnValue(pendingDialog.promise);
  const onFail = jest.fn();
  const onSuccess = jest.fn();
  const { result } = renderHook(() => useUniversalStake(account));
  const operation = result.current({ ...stake, onSuccess, onFail });
  await waitFor(() => expect(mockShowOrder).toHaveBeenCalledTimes(1));
  mockAccountAddress.mockResolvedValue('0xother');
  pendingDialog.resolve(undefined);
  await expect(operation).resolves.toBe(false);
  expect(mockWaitForOrder).toHaveBeenCalledWith(expectedTracking);
  expect(onFail).not.toHaveBeenCalled();
  expect(onSuccess).not.toHaveBeenCalled();
});

it('tracks an accepted withdrawal without opening a stale action even if its result scope is still current', async () => {
  const pending = deferred<IStakeTxResponse>();
  mockBuildUnstake.mockReturnValue(pending.promise);
  let actionCurrent = true;
  const onSuccess = jest.fn();
  const { result } = renderHook(() => useUniversalWithdraw(account));
  const operation = result.current({
    ...withdraw,
    onSuccess,
    isActionCurrent: () => actionCurrent,
    isResultCurrent: () => true,
  });
  await waitFor(() => expect(mockBuildUnstake).toHaveBeenCalledTimes(1));
  actionCurrent = false;
  pending.resolve({ tx: null, orderId: 'order-a' });
  await expect(operation).resolves.toBe(false);
  expect(mockWaitForOrder).toHaveBeenCalledWith(expectedTracking);
  expect(mockShowOrder).not.toHaveBeenCalled();
  expect(onSuccess).not.toHaveBeenCalled();
});

it('keeps the normal server withdrawal dialog and callback when the scope is current', async () => {
  mockBuildUnstake.mockResolvedValue({ tx: null, orderId: 'order-a' });
  const onSuccess = jest.fn();
  const { result } = renderHook(() => useUniversalWithdraw(account));
  await expect(
    result.current({ ...withdraw, onSuccess, utm: { utmSource: 'campaign' } }),
  ).resolves.toBe(true);
  expect(mockBuildUnstake).toHaveBeenCalledWith(
    expect.objectContaining({ utmSource: 'campaign' }),
  );
  expect(mockShowOrder).toHaveBeenCalledWith({
    ...account,
    orderId: 'order-a',
  });
  expect(mockWaitForOrder).not.toHaveBeenCalled();
  expect(onSuccess).toHaveBeenCalledWith([]);
});

it('rejects a stake response without a transaction or server order', async () => {
  mockBuildStake.mockResolvedValue({ tx: null, orderId: '' });
  const { result } = renderHook(() => useUniversalStake(account));
  await expect(result.current(stake)).rejects.toThrow(
    'neither a transaction nor an orderId',
  );
  expect(mockBuildStake).toHaveBeenCalledTimes(1);
  expect(mockShowOrder).not.toHaveBeenCalled();
});

it('completes the approval workflow when Unitas executes the withdrawal', async () => {
  mockBuildUnstake.mockResolvedValue({ tx: null, orderId: 'order-a' });
  const { result } = renderHook(() => useUniversalWithdraw(account));
  const plan = getUniversalWithdrawProtocolPlan({
    provider: 'unitas',
    config: { enabled: true, tokenAddress: '', displayProfit: true },
  });
  const task = createEarnWithdrawApprovalTask<
    string,
    IUniversalWithdrawPrepared,
    IUniversalWithdrawContext
  >({
    taskId: 'unitas-withdraw',
    identity: {
      ...account,
      accountAddress: '0xaccount',
      provider: 'unitas',
      action: 'withdraw',
    },
    protocolSteps: plan.steps,
    initialContext: plan.initialContext,
    approval: {
      handoffOnSubmit: false,
      adapter: {
        prepare: async () => ({ type: 'confirm', prepared: 'approve' }),
        confirm: async ({ onBeforeSend, onSubmitted }) => {
          onBeforeSend();
          onSubmitted('approve-tx');
          return { type: 'submitted' };
        },
        waitForFinalStatus: async () => 'success',
        verify: async () => true,
      },
    },
    allowanceCheck: async () => true,
    prepareBusiness: async (workflowHandoff) => {
      await result.current({
        ...withdraw,
        taskAccountAddress: '0xaccount',
        workflowHandoff,
      });
    },
    isCurrent: () => true,
    onAsyncError: jest.fn(),
  });
  await expect(task.run()).resolves.toBe(true);
  expect(mockBuildUnstake).toHaveBeenCalledTimes(1);
  expect(mockShowOrder).toHaveBeenCalledTimes(1);
  expect(task.getTask().steps.at(-1)?.status.type).not.toBe('awaitingUser');
});

it('does not report a failed server withdrawal as successful', async () => {
  mockBuildUnstake.mockResolvedValue({ tx: null, orderId: 'order-a' });
  mockShowOrder.mockResolvedValueOnce({
    status: 'failed',
    errorMessage: 'rejected',
  });
  const onSuccess = jest.fn();
  const onFail = jest.fn();
  const { result } = renderHook(() => useUniversalWithdraw(account));
  await expect(
    result.current({ ...withdraw, onSuccess, onFail }),
  ).resolves.toBe(false);
  expect(onSuccess).not.toHaveBeenCalled();
  expect(onFail).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'rejected' }),
  );
});

it('tracks a claim accepted after the account changes', async () => {
  const pending = deferred<IStakeTxResponse>();
  mockBuildClaim.mockReturnValue(pending.promise);
  const onSuccess = jest.fn();
  const { result, rerender } = renderHook(
    ({ accountId }) => useUniversalClaim({ ...account, accountId }),
    { initialProps: { accountId: account.accountId } },
  );
  const operation = result.current({ ...stake, vault: 'vault-a', onSuccess });
  await waitFor(() => expect(mockBuildClaim).toHaveBeenCalledTimes(1));
  rerender({ accountId: 'account-b' });
  pending.resolve({ tx: null, orderId: 'order-a' });
  await expect(operation).resolves.toBe(false);
  expect(mockWaitForOrder).toHaveBeenCalledWith(expectedTracking);
  expect(mockShowOrder).not.toHaveBeenCalled();
  expect(onSuccess).not.toHaveBeenCalled();
});

it('runs a direct conversion without building a claim transaction', async () => {
  const onSuccess = jest.fn();
  const { result } = renderHook(() => useUniversalClaim(account));
  await act(async () => {
    await result.current({
      ...stake,
      identity: 'convert',
      vault: 'vault-a',
      claimFollowUp: { identity: 'convert' },
      onSuccess,
    });
  });
  expect(mockBuildClaim).not.toHaveBeenCalled();
  expect(mockConversion).toHaveBeenCalledWith(
    expect.objectContaining({
      withClaimStep: false,
      request: expect.objectContaining({ identity: 'convert' }),
    }),
  );
  expect(onSuccess).toHaveBeenCalledWith([]);
});

it('does not open claim approval after its account scope changes during validation', async () => {
  const pending = deferred<void>();
  mockAssertApproval.mockReturnValueOnce(pending.promise);
  const { result, rerender } = renderHook(
    ({ accountId }) => useUniversalClaim({ ...account, accountId }),
    { initialProps: { accountId: account.accountId } },
  );
  const operation = result.current({
    ...stake,
    vault: 'vault-a',
    claimApprove: {
      approveType: EApproveType.Legacy,
      approveTarget: 'spender',
      tokenAddress: 'token',
      symbol: 'USDu',
      decimals: 18,
    },
  });
  await waitFor(() => expect(mockAssertApproval).toHaveBeenCalledTimes(1));
  rerender({ accountId: 'account-b' });
  pending.resolve();
  await expect(operation).resolves.toBe(false);
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockBuildClaim).not.toHaveBeenCalled();
});

it('blocks claim approval immediately before send after an account switch', async () => {
  const { result, rerender } = renderHook(
    ({ accountId }) => useUniversalClaim({ ...account, accountId }),
    { initialProps: { accountId: account.accountId } },
  );
  const operation = result.current({
    ...stake,
    vault: 'vault-a',
    claimApprove: {
      approveType: EApproveType.Legacy,
      approveTarget: 'spender',
      tokenAddress: 'token',
      symbol: 'USDu',
      decimals: 18,
    },
  });
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
  const navigation = mockNavigate.mock.calls[0]?.[0];
  if (!navigation?.onBeforeSend || !navigation.onCancel) {
    throw new OneKeyLocalError('Approval confirmation was not opened');
  }
  rerender({ accountId: 'account-b' });
  await expect(navigation.onBeforeSend()).rejects.toThrow(
    'Claim account changed',
  );
  navigation.onCancel();
  await expect(operation).resolves.toBe(false);
  expect(mockBuildClaim).not.toHaveBeenCalled();
});

it('records a broadcast claim before running its conversion and refreshing', async () => {
  const events: string[] = [];
  mockBuildClaim.mockResolvedValue({
    tx: { exitBroadcasted: true, validators: [] },
    orderId: 'claim-order',
  });
  mockBuildInternal.mockResolvedValue({ from: '0xaccount' });
  mockAddOrder.mockImplementation(async () => {
    events.push('record');
  });
  mockConversion.mockImplementation(async () => {
    events.push('convert');
    return 'success';
  });
  const onSuccess = jest.fn(() => {
    events.push('refresh');
  });
  const { result } = renderHook(() => useUniversalClaim(account));
  await act(async () => {
    await result.current({
      ...stake,
      identity: 'claim',
      vault: 'vault-a',
      claimFollowUp: { identity: 'convert' },
      stakingInfo: { label: EEarnLabels.Claim, protocol: 'unitas', tags: [] },
      onSuccess,
    });
  });
  const navigation = mockNavigate.mock.calls[0]?.[0];
  if (!navigation?.onSuccess) {
    throw new OneKeyLocalError('Claim confirmation was not opened');
  }
  const onConfirmationSuccess = navigation.onSuccess;
  await act(async () => {
    await onConfirmationSuccess([
      { decodedTx: { txid: '0xclaim', status: 'pending' } },
    ]);
  });
  expect(events).toEqual(['record', 'convert', 'refresh']);
  expect(mockConversion).toHaveBeenCalledWith(
    expect.objectContaining({
      withClaimStep: true,
      request: expect.objectContaining({ identity: 'convert' }),
    }),
  );
});
