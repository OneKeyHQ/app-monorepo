/** @jest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IStakeTxResponse } from '@onekeyhq/shared/types/staking';

import { useUniversalStake, useUniversalWithdraw } from './useUniversalHooks';

const mockBuildStake = jest.fn<Promise<IStakeTxResponse>, [unknown]>();
const mockBuildUnstake = jest.fn<Promise<IStakeTxResponse>, [unknown]>();
const mockWaitForOrder = jest.fn<Promise<unknown>, [unknown]>();
const mockShowOrder = jest.fn<Promise<undefined>, [unknown]>();
const mockBuildInternal = jest.fn<unknown, unknown[]>();
const mockRiskAccepted = jest.fn(async () => true);

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      buildStakeTransaction: (params: unknown) => mockBuildStake(params),
      buildUnstakeTransaction: (params: unknown) => mockBuildUnstake(params),
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
  runClaimConversion: jest.fn(),
}));
jest.mock('../components/EarnRiskWarningDialog', () => ({
  showEarnRiskWarningDialog: () => mockRiskAccepted(),
  useEarnRiskWarningGate: () => mockRiskAccepted,
}));
jest.mock('../components/EstimateNetworkFee', () => ({
  useShowClaimEstimateGasAlert: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({ navigationToTxConfirm: jest.fn() }),
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
  await expect(result.current({ ...stake, onSuccess })).resolves.toBe(true);
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
  await expect(result.current({ ...withdraw, onSuccess })).resolves.toBe(true);
  expect(mockShowOrder).toHaveBeenCalledWith({
    ...account,
    orderId: 'order-a',
  });
  expect(mockWaitForOrder).not.toHaveBeenCalled();
  expect(onSuccess).toHaveBeenCalledWith([]);
});
