/** @jest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';

import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import type {
  IBroadcastAcceptedFact,
  ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';

import {
  useUniversalBorrowBorrow,
  useUniversalBorrowClaim,
  useUniversalBorrowSupply,
} from './useUniversalBorrowHooks';

type IConfirm = {
  onSuccess?: (data: ISendTxOnSuccessData[]) => void | Promise<void>;
  onLateBroadcastAccepted?: (
    fact: IBroadcastAcceptedFact,
  ) => void | Promise<void>;
  onFail?: (error: Error) => void;
  onConfirmationFail?: (error: Error) => void;
  onCancel?: () => void;
  onBeforeSend?: () => void | Promise<void>;
  isNavigationCurrent?: () => boolean;
};

const mockRiskAccepted = jest.fn<Promise<boolean>, [unknown]>();
const mockNavigation = jest.fn<Promise<void>, [IConfirm]>();
const mockSignatureConfirm = jest.fn();
const mockSupply = jest.fn<
  Promise<{ tx: string; orderId: string }>,
  [unknown]
>();
const mockBorrow = jest.fn<
  Promise<{ tx: string; orderId: string }>,
  [unknown]
>();
const mockClaim = jest.fn<
  Promise<{ tx: string; orderId: string }>,
  [unknown]
>();
const mockAddOrder = jest.fn<
  Promise<void | { localStatus: 'saved'; remoteStatus: 'synced' }>,
  [unknown, { remoteSync: 'once'; preserveExistingTx?: boolean }?]
>();
const mockAccountAddress = jest.fn<Promise<string>, [unknown]>();

jest.mock('@onekeyhq/components', () => ({ Toast: { error: jest.fn() } }));
jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: (params: unknown) => {
    mockSignatureConfirm(params);
    return { navigationToTxConfirm: mockNavigation };
  },
}));
jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/EarnRiskWarningDialog',
  () => ({ useEarnRiskWarningGate: () => mockRiskAccepted }),
);
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccountAddressForApi: (params: unknown) => mockAccountAddress(params),
    },
    serviceStaking: {
      borrowBuildSupplyTransaction: (params: unknown) => mockSupply(params),
      borrowBuildBorrowTransaction: (params: unknown) => mockBorrow(params),
      borrowBuildClaimTransaction: (params: unknown) => mockClaim(params),
      addEarnOrder: (
        params: unknown,
        options?: { remoteSync: 'once'; preserveExistingTx?: boolean },
      ) => (options ? mockAddOrder(params, options) : mockAddOrder(params)),
    },
  },
}));
jest.mock(
  '@onekeyhq/kit/src/components/DeFi/DeFiActionTxConfirmResult',
  () => ({ showDeFiActionTxConfirmDialog: jest.fn() }),
);

const owner = { accountId: 'account-1', networkId: 'evm--42161' };
const input = {
  amount: '12.34',
  provider: 'aave',
  marketAddress: '0xmarket',
  reserveAddress: '0xreserve',
};
const encodedTx = { to: '0xpool', data: '0x1234', value: '0x0' };
const successData = [
  {
    signedTx: { txid: 'tx-1' },
    decodedTx: { txid: 'tx-1', status: 'Pending' },
  },
] as ISendTxOnSuccessData[];

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe.each([
  ['supply', useUniversalBorrowSupply, mockSupply],
  ['borrow', useUniversalBorrowBorrow, mockBorrow],
] as const)('Borrow %s handoff', (_action, useHook, build) => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockRiskAccepted.mockResolvedValue(true);
    mockNavigation.mockResolvedValue(undefined);
    mockSupply.mockResolvedValue({
      tx: JSON.stringify(encodedTx),
      orderId: 'order-1',
    });
    mockBorrow.mockResolvedValue({
      tx: JSON.stringify(encodedTx),
      orderId: 'order-1',
    });
    mockAddOrder.mockResolvedValue();
    mockAccountAddress.mockResolvedValue('0xAaA');
  });

  it('passes the account, market, reserve and amount into one build and confirmation', async () => {
    const onFail = jest.fn();
    const info = { protocol: 'Aave', label: EEarnLabels.Supply, tags: [] };
    const { result } = renderHook(() => useHook(owner));

    await expect(
      result.current({ ...input, stakingInfo: info, onFail }),
    ).resolves.toBe(true);

    expect(mockSignatureConfirm).toHaveBeenCalledWith(owner);
    expect(build).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledWith({
      ...owner,
      ...input,
      expectedAccountAddress: '0xAaA',
    });
    expect(mockNavigation).toHaveBeenCalledTimes(1);
    expect(mockNavigation).toHaveBeenCalledWith(
      expect.objectContaining({
        encodedTx,
        stakingInfo: { ...info, orderId: 'order-1' },
        onFail: expect.any(Function),
      }),
    );
    const failure = new Error('failure');
    mockNavigation.mock.calls[0][0].onFail?.(failure);
    expect(onFail).toHaveBeenCalledWith(failure);
    // Handoff alone does not mean the user signed or broadcast a transaction.
    expect(mockAddOrder).not.toHaveBeenCalled();
  });

  it('records an accepted late broadcast for its original order without reopening the result', async () => {
    mockAddOrder.mockResolvedValueOnce({
      localStatus: 'saved',
      remoteStatus: 'synced',
    });
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useHook(owner));
    await expect(result.current({ ...input, onSuccess })).resolves.toBe(true);
    const confirmation = mockNavigation.mock.calls[0][0];
    confirmation.onCancel?.();
    await confirmation.onLateBroadcastAccepted?.({
      uuid: 'request-1',
      ...owner,
      txid: 'late-tx',
    });
    expect(mockAddOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', txId: 'late-tx' }),
      { remoteSync: 'once', preserveExistingTx: true },
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('does not build or navigate when the risk disclaimer is declined', async () => {
    mockRiskAccepted.mockResolvedValue(false);
    const { result } = renderHook(() => useHook(owner));

    await expect(result.current(input)).resolves.toBe(false);
    expect(build).not.toHaveBeenCalled();
    expect(mockNavigation).not.toHaveBeenCalled();
    expect(mockAddOrder).not.toHaveBeenCalled();
  });

  it('does not start an old build when account changes during the risk gate', async () => {
    const gate = deferred();
    mockRiskAccepted.mockImplementationOnce(async () => {
      await gate.promise;
      return true;
    });
    const { result, rerender } = renderHook((scope) => useHook(scope), {
      initialProps: owner,
    });
    const pending = result.current(input);
    rerender({ accountId: 'account-2', networkId: owner.networkId });
    gate.resolve();
    await expect(pending).resolves.toBe(false);
    expect(build).not.toHaveBeenCalled();
    expect(mockNavigation).not.toHaveBeenCalled();
  });

  it('does not open confirmation after unmount during the build', async () => {
    const gate = deferred();
    build.mockImplementationOnce(async () => {
      await gate.promise;
      return { tx: JSON.stringify(encodedTx), orderId: 'old-order' };
    });
    const { result, unmount } = renderHook(() => useHook(owner));
    const pending = result.current(input);
    await waitFor(() => expect(build).toHaveBeenCalledTimes(1));
    unmount();
    gate.resolve();
    await expect(pending).resolves.toBe(false);
    expect(mockNavigation).not.toHaveBeenCalled();
  });

  it('preserves a missing failure handler and propagates a navigation error', async () => {
    const error = new Error('navigation failed without a handler');
    mockNavigation.mockImplementationOnce(async (params) => {
      expect(params.onFail).toBeUndefined();
      throw error;
    });
    const { result } = renderHook(() => useHook(owner));
    await expect(result.current(input)).rejects.toBe(error);
  });

  it('keeps a synchronous failure callback followed by a resolved navigation', async () => {
    const error = new Error('preparation failed');
    const onFail = jest.fn();
    mockNavigation.mockImplementationOnce(async (params) => {
      params.onFail?.(error);
    });
    const { result } = renderHook(() => useHook(owner));
    await expect(result.current({ ...input, onFail })).resolves.toBe(true);
    expect(onFail).toHaveBeenCalledWith(error);
    expect(mockAddOrder).not.toHaveBeenCalled();
  });

  it('observes a confirmation failure without installing a navigation failure handler', async () => {
    const { result } = renderHook(() => useHook(owner));
    await expect(result.current(input)).resolves.toBe(true);
    const callbacks = mockNavigation.mock.calls[0][0];
    expect(callbacks.onFail).toBeUndefined();
    expect(callbacks.onConfirmationFail).toEqual(expect.any(Function));
    expect(() =>
      callbacks.onConfirmationFail?.(new Error('send failed')),
    ).not.toThrow();
  });

  it('delivers a later confirmation failure to the caller exactly once', async () => {
    const error = new Error('send failed');
    const onFail = jest.fn();
    const { result } = renderHook(() => useHook(owner));
    await expect(result.current({ ...input, onFail })).resolves.toBe(true);
    mockNavigation.mock.calls[0][0].onConfirmationFail?.(error);
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail).toHaveBeenCalledWith(error);
  });

  it.each([false, true])(
    'keeps late success after cancellation with send observed=%s',
    async (sendObserved) => {
      const onSuccess = jest.fn();
      const { result } = renderHook(() => useHook(owner));
      await expect(result.current({ ...input, onSuccess })).resolves.toBe(true);
      const callbacks = mockNavigation.mock.calls[0][0];
      if (sendObserved) await callbacks.onBeforeSend?.();
      callbacks.onCancel?.();
      await callbacks.onSuccess?.(successData);
      expect(mockAddOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-1',
          networkId: owner.networkId,
          txId: 'tx-1',
        }),
      );
      expect(onSuccess).toHaveBeenCalledWith(successData);
    },
  );

  it('keeps an earlier order and callback bound to its original account after rerender', async () => {
    const onSuccess = jest.fn();
    const { result, rerender } = renderHook((scope) => useHook(scope), {
      initialProps: owner,
    });
    await result.current({ ...input, onSuccess });
    const first = mockNavigation.mock.calls[0][0];
    rerender({ accountId: 'account-2', networkId: 'evm--1' });
    await result.current(input);
    await first.onSuccess?.(successData);
    expect(mockAddOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        networkId: owner.networkId,
        orderId: 'order-1',
      }),
    );
    expect(onSuccess).toHaveBeenCalledWith(successData);
  });

  it('uses the new account, network and request after the hook scope changes', async () => {
    const nextOwner = { accountId: 'account-2', networkId: 'evm--1' };
    const nextInput = {
      amount: '4.5',
      provider: 'aave',
      marketAddress: '0xother-market',
      reserveAddress: '0xother-reserve',
    };
    const { result, rerender } = renderHook((scope) => useHook(scope), {
      initialProps: owner,
    });

    await expect(result.current(input)).resolves.toBe(true);
    rerender(nextOwner);
    await expect(result.current(nextInput)).resolves.toBe(true);

    expect(mockSignatureConfirm).toHaveBeenLastCalledWith(nextOwner);
    expect(build).toHaveBeenCalledTimes(2);
    expect(build).toHaveBeenNthCalledWith(1, {
      ...owner,
      ...input,
      expectedAccountAddress: '0xAaA',
    });
    expect(build).toHaveBeenNthCalledWith(2, {
      ...nextOwner,
      ...nextInput,
      expectedAccountAddress: '0xAaA',
    });
  });

  it.each([
    ['account', { accountId: 'account-2', networkId: owner.networkId }],
    ['network', { accountId: owner.accountId, networkId: 'evm--1' }],
  ])(
    'does not open an old confirmation when %s changes during the build',
    async (_name, nextOwner) => {
      const gate = deferred();
      build.mockImplementationOnce(async () => {
        await gate.promise;
        return { tx: JSON.stringify(encodedTx), orderId: 'old-order' };
      });
      const { result, rerender } = renderHook((scope) => useHook(scope), {
        initialProps: owner,
      });
      const pending = result.current(input);
      await waitFor(() => expect(build).toHaveBeenCalledTimes(1));
      rerender(nextOwner);
      gate.resolve();
      await expect(pending).resolves.toBe(false);
      expect(mockNavigation).not.toHaveBeenCalled();
    },
  );

  it('invalidates navigation during scope change while preserving a late success callback', async () => {
    const gate = deferred();
    const onSuccess = jest.fn();
    mockNavigation.mockImplementationOnce(async () => gate.promise);
    const { result, rerender } = renderHook((scope) => useHook(scope), {
      initialProps: owner,
    });
    const pending = result.current({ ...input, onSuccess });
    await waitFor(() => expect(mockNavigation).toHaveBeenCalledTimes(1));
    const callbacks = mockNavigation.mock.calls[0][0];
    expect(callbacks.isNavigationCurrent?.()).toBe(true);
    rerender({ accountId: 'account-2', networkId: owner.networkId });
    expect(callbacks.isNavigationCurrent?.()).toBe(false);
    gate.resolve();
    await expect(pending).resolves.toBe(false);
    await callbacks.onSuccess?.(successData);
    expect(mockAddOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        networkId: owner.networkId,
      }),
    );
    expect(onSuccess).toHaveBeenCalledWith(successData);
  });

  it('invalidates the build when the same account id changes address', async () => {
    const gate = deferred();
    build.mockImplementationOnce(async () => {
      await gate.promise;
      return { tx: JSON.stringify(encodedTx), orderId: 'old-order' };
    });
    const { result, rerender } = renderHook((scope) => useHook(scope), {
      initialProps: { ...owner, accountAddress: '0xAaA' },
    });
    const pending = result.current(input);
    await waitFor(() => expect(build).toHaveBeenCalledTimes(1));
    rerender({ ...owner, accountAddress: '0xBbB' });
    gate.resolve();
    await expect(pending).resolves.toBe(false);
    expect(mockNavigation).not.toHaveBeenCalled();
  });

  it('binds the backend build to the frozen account address', async () => {
    const { result } = renderHook(() =>
      useHook({ ...owner, accountAddress: '0xAaA' }),
    );
    await expect(result.current(input)).resolves.toBe(true);
    expect(build).toHaveBeenCalledWith({
      ...owner,
      ...input,
      expectedAccountAddress: '0xAaA',
    });
  });

  it('does not build when scope changes while resolving the missing address', async () => {
    const gate = deferred();
    mockAccountAddress.mockImplementationOnce(async () => {
      await gate.promise;
      return '0xAaA';
    });
    const { result, rerender } = renderHook((scope) => useHook(scope), {
      initialProps: owner,
    });
    const pending = result.current(input);
    await waitFor(() => expect(mockAccountAddress).toHaveBeenCalledTimes(1));
    rerender({ ...owner, accountId: 'account-2' });
    gate.resolve();
    await expect(pending).resolves.toBe(false);
    expect(build).not.toHaveBeenCalled();
    expect(mockNavigation).not.toHaveBeenCalled();
  });

  it('rejects a changed resolved address before send and retains a late success', async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() =>
      useHook({ ...owner, accountAddress: '0xAaA' }),
    );
    await expect(result.current({ ...input, onSuccess })).resolves.toBe(true);
    const callbacks = mockNavigation.mock.calls[0][0];
    mockAccountAddress.mockResolvedValue('0xBbB');
    await expect(callbacks.onBeforeSend?.()).rejects.toThrow(
      'Borrow transaction confirmation expired',
    );
    await callbacks.onSuccess?.(successData);
    expect(mockAddOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        networkId: owner.networkId,
      }),
    );
    expect(onSuccess).toHaveBeenCalledWith(successData);
  });

  it('accepts the same EVM address with different letter case', async () => {
    const { result } = renderHook(() =>
      useHook({ ...owner, accountAddress: '0xaaa' }),
    );
    await expect(result.current(input)).resolves.toBe(true);
    await expect(
      mockNavigation.mock.calls[0][0].onBeforeSend?.(),
    ).resolves.toBeUndefined();
  });

  it('keeps a handed-off confirmation valid when the form amount is reset', async () => {
    const { result, rerender } = renderHook(
      ({ formAmount: _formAmount, ...scope }) => useHook(scope),
      {
        initialProps: {
          ...owner,
          accountAddress: '0xAaA',
          formAmount: '12.34',
        },
      },
    );
    await expect(result.current(input)).resolves.toBe(true);
    const callbacks = mockNavigation.mock.calls[0][0];
    rerender({ ...owner, accountAddress: '0xAaA', formAmount: '' });
    expect(callbacks.isNavigationCurrent?.()).toBe(true);
    await expect(callbacks.onBeforeSend?.()).resolves.toBeUndefined();
  });

  it('checks scope again after awaiting the pre-send account address', async () => {
    const gate = deferred();
    mockAccountAddress
      .mockResolvedValueOnce('0xAaA')
      .mockImplementationOnce(async () => {
        await gate.promise;
        return '0xAaA';
      });
    const { result, rerender } = renderHook((scope) => useHook(scope), {
      initialProps: { ...owner, accountAddress: '0xAaA' },
    });
    await expect(result.current(input)).resolves.toBe(true);
    const beforeSend = mockNavigation.mock.calls[0][0].onBeforeSend?.();
    rerender({ ...owner, accountAddress: '0xBbB' });
    gate.resolve();
    await expect(beforeSend).rejects.toThrow(
      'Borrow transaction confirmation expired',
    );
  });

  it('rejects a mismatched background account address before opening the page', async () => {
    mockAccountAddress.mockResolvedValue('0xBbB');
    const { result } = renderHook(() =>
      useHook({ ...owner, accountAddress: '0xAaA' }),
    );
    await expect(result.current(input)).rejects.toThrow(
      'Borrow transaction confirmation expired',
    );
    expect(mockNavigation).not.toHaveBeenCalled();
  });

  it('propagates a build failure and never opens confirmation', async () => {
    const failure = new Error('build failed');
    build.mockRejectedValue(failure);
    const { result } = renderHook(() => useHook(owner));

    await expect(result.current(input)).rejects.toBe(failure);
    expect(mockNavigation).not.toHaveBeenCalled();
    expect(mockAddOrder).not.toHaveBeenCalled();
  });

  it('propagates a confirmation navigation failure without recording an order', async () => {
    const failure = new Error('confirmation unavailable');
    mockNavigation.mockRejectedValue(failure);
    const { result } = renderHook(() => useHook(owner));

    await expect(result.current(input)).rejects.toBe(failure);
    expect(build).toHaveBeenCalledTimes(1);
    expect(mockNavigation).toHaveBeenCalledTimes(1);
    expect(mockAddOrder).not.toHaveBeenCalled();
  });

  it('records a later confirmation before notifying the caller', async () => {
    const tracking = deferred();
    const onSuccess = jest.fn();
    const info = { protocol: 'Aave', label: EEarnLabels.Supply, tags: [] };
    mockAddOrder.mockReturnValueOnce(tracking.promise);
    const { result } = renderHook(() => useHook(owner));
    await expect(
      result.current({ ...input, stakingInfo: info, onSuccess }),
    ).resolves.toBe(true);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(mockAddOrder).not.toHaveBeenCalled();

    const confirmation = mockNavigation.mock.calls[0][0];
    const success = confirmation.onSuccess?.(successData);
    expect(mockAddOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        networkId: owner.networkId,
        txId: 'tx-1',
        stakingLabel: info.label,
        stakingProtocol: info.protocol,
      }),
    );
    expect(onSuccess).not.toHaveBeenCalled();
    tracking.resolve();
    await success;
    expect(onSuccess).toHaveBeenCalledWith(successData);
  });
});

describe('Borrow claim handoff', () => {
  const claim = {
    provider: 'aave',
    marketAddress: '0xmarket',
    ids: ['id-1', 'id-2'],
  };
  const info = {
    protocol: 'Aave',
    label: EEarnLabels.Borrow,
    tags: ['reward'],
  };

  beforeEach(() => {
    jest.resetAllMocks();
    mockRiskAccepted.mockResolvedValue(true);
    mockNavigation.mockResolvedValue(undefined);
    mockClaim.mockResolvedValue({
      tx: JSON.stringify(encodedTx),
      orderId: 'claim-order',
    });
    mockAddOrder.mockResolvedValue();
    mockAccountAddress.mockResolvedValue('0xAaA');
  });

  it('preserves the reward ids and records a later success before notifying the caller', async () => {
    const tracking = deferred();
    const onSuccess = jest.fn();
    const onFail = jest.fn();
    mockAddOrder.mockReturnValueOnce(tracking.promise);
    const { result } = renderHook(() => useUniversalBorrowClaim(owner));
    await expect(
      result.current({ ...claim, stakingInfo: info, onSuccess, onFail }),
    ).resolves.toBe(true);
    expect(mockClaim).toHaveBeenCalledWith({ ...owner, ...claim });
    expect(mockNavigation).toHaveBeenCalledWith(
      expect.objectContaining({
        encodedTx,
        stakingInfo: { ...info, orderId: 'claim-order' },
        onFail: expect.any(Function),
      }),
    );
    const failure = new Error('failure');
    mockNavigation.mock.calls[0][0].onFail?.(failure);
    expect(onFail).toHaveBeenCalledWith(failure);
    expect(mockAddOrder).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();

    const success = mockNavigation.mock.calls[0][0].onSuccess?.(successData);
    expect(mockAddOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'claim-order',
        networkId: owner.networkId,
        txId: 'tx-1',
        stakingLabel: info.label,
        stakingProtocol: info.protocol,
        stakingTags: info.tags,
      }),
    );
    expect(onSuccess).not.toHaveBeenCalled();
    tracking.resolve();
    await success;
    expect(onSuccess).toHaveBeenCalledWith(successData);
  });

  it('freezes the selected reward ids before waiting for the risk dialog', async () => {
    const gate = deferred();
    mockRiskAccepted.mockImplementationOnce(async () => {
      await gate.promise;
      return true;
    });
    const ids = ['id-1'];
    const { result } = renderHook(() => useUniversalBorrowClaim(owner));
    const pending = result.current({ ...claim, ids });
    ids.push('id-2');
    gate.resolve();
    await expect(pending).resolves.toBe(true);
    expect(mockClaim).toHaveBeenCalledWith(
      expect.objectContaining({ ids: ['id-1'] }),
    );
  });

  it.each([
    ['account', { accountId: 'account-2', networkId: owner.networkId }],
    ['network', { accountId: owner.accountId, networkId: 'evm--1' }],
  ])(
    'does not open an old claim confirmation when %s changes during the build',
    async (_name, nextOwner) => {
      const gate = deferred();
      mockClaim.mockImplementationOnce(async () => {
        await gate.promise;
        return { tx: JSON.stringify(encodedTx), orderId: 'old-claim' };
      });
      const { result, rerender } = renderHook(
        (scope) => useUniversalBorrowClaim(scope),
        { initialProps: owner },
      );
      const pending = result.current(claim);
      await waitFor(() => expect(mockClaim).toHaveBeenCalledTimes(1));
      rerender(nextOwner);
      gate.resolve();
      await expect(pending).resolves.toBe(false);
      expect(mockNavigation).not.toHaveBeenCalled();
    },
  );

  it('keeps an already handed-off claim callback bound to its original order', async () => {
    const onSuccess = jest.fn();
    const { result, rerender } = renderHook(
      (scope) => useUniversalBorrowClaim(scope),
      { initialProps: owner },
    );
    await expect(result.current({ ...claim, onSuccess })).resolves.toBe(true);
    const callbacks = mockNavigation.mock.calls[0][0];
    rerender({ accountId: owner.accountId, networkId: 'evm--1' });
    expect(callbacks.isNavigationCurrent?.()).toBe(false);
    await callbacks.onSuccess?.(successData);
    expect(mockAddOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'claim-order',
        networkId: owner.networkId,
      }),
    );
    expect(onSuccess).toHaveBeenCalledWith(successData);
  });

  it('does not open a claim after the resolved account address changes during build', async () => {
    const gate = deferred();
    mockClaim.mockImplementationOnce(async () => {
      await gate.promise;
      return { tx: JSON.stringify(encodedTx), orderId: 'old-claim' };
    });
    const { result, rerender } = renderHook(
      (scope) => useUniversalBorrowClaim(scope),
      {
        initialProps: { ...owner, accountAddress: '0xAaA' },
      },
    );
    const pending = result.current(claim);
    await waitFor(() => expect(mockClaim).toHaveBeenCalledTimes(1));
    rerender({ ...owner, accountAddress: '0xBbB' });
    gate.resolve();
    await expect(pending).resolves.toBe(false);
    expect(mockNavigation).not.toHaveBeenCalled();
  });

  it('checks a bound claim address before sending while keeping later callbacks', async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() =>
      useUniversalBorrowClaim({ ...owner, accountAddress: '0xAaA' }),
    );
    await expect(result.current({ ...claim, onSuccess })).resolves.toBe(true);
    const callbacks = mockNavigation.mock.calls[0][0];
    mockAccountAddress.mockResolvedValue('0xBbB');
    await expect(callbacks.onBeforeSend?.()).rejects.toThrow(
      'Borrow transaction confirmation expired',
    );
    await callbacks.onSuccess?.(successData);
    expect(mockAddOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'claim-order',
        networkId: owner.networkId,
      }),
    );
    expect(onSuccess).toHaveBeenCalledWith(successData);
  });

  it('does not build or invoke callbacks when the risk disclaimer is declined', async () => {
    mockRiskAccepted.mockResolvedValue(false);
    const onSuccess = jest.fn();
    const onFail = jest.fn();
    const { result } = renderHook(() => useUniversalBorrowClaim(owner));
    await expect(result.current({ ...claim, onSuccess, onFail })).resolves.toBe(
      false,
    );
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockNavigation).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFail).not.toHaveBeenCalled();
  });

  it('does not start an old claim when network changes during the risk gate', async () => {
    const gate = deferred();
    mockRiskAccepted.mockImplementationOnce(async () => {
      await gate.promise;
      return true;
    });
    const { result, rerender } = renderHook(
      (scope) => useUniversalBorrowClaim(scope),
      { initialProps: owner },
    );
    const pending = result.current(claim);
    rerender({ accountId: owner.accountId, networkId: 'evm--1' });
    gate.resolve();
    await expect(pending).resolves.toBe(false);
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockNavigation).not.toHaveBeenCalled();
  });

  it('propagates a navigation error without recording or invoking callbacks', async () => {
    const error = new Error('navigation failed');
    mockNavigation.mockRejectedValue(error);
    const onSuccess = jest.fn();
    const onFail = jest.fn();
    const { result } = renderHook(() => useUniversalBorrowClaim(owner));
    await expect(result.current({ ...claim, onSuccess, onFail })).rejects.toBe(
      error,
    );
    expect(mockAddOrder).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFail).not.toHaveBeenCalled();
  });

  it('propagates a claim build error without opening confirmation', async () => {
    const error = new Error('claim build failed');
    mockClaim.mockRejectedValue(error);
    const { result } = renderHook(() => useUniversalBorrowClaim(owner));
    await expect(result.current(claim)).rejects.toBe(error);
    expect(mockNavigation).not.toHaveBeenCalled();
    expect(mockAddOrder).not.toHaveBeenCalled();
  });

  it('does not notify claim success if order recording rejects', async () => {
    const error = new Error('order recording failed');
    const onSuccess = jest.fn();
    mockAddOrder.mockRejectedValueOnce(error);
    const { result } = renderHook(() => useUniversalBorrowClaim(owner));
    await expect(result.current({ ...claim, onSuccess })).resolves.toBe(true);
    await expect(
      mockNavigation.mock.calls[0][0].onSuccess?.(successData),
    ).rejects.toBe(error);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('keeps a synchronous failure callback followed by a resolved navigation', async () => {
    const error = new Error('preparation failed');
    const onFail = jest.fn();
    mockNavigation.mockImplementationOnce(async (params) => {
      params.onFail?.(error);
    });
    const { result } = renderHook(() => useUniversalBorrowClaim(owner));
    await expect(result.current({ ...claim, onFail })).resolves.toBe(true);
    expect(onFail).toHaveBeenCalledWith(error);
  });

  it('preserves a missing claim failure handler and propagates navigation errors', async () => {
    const error = new Error('navigation failed without a handler');
    mockNavigation.mockImplementationOnce(async (params) => {
      expect(params.onFail).toBeUndefined();
      throw error;
    });
    const { result } = renderHook(() => useUniversalBorrowClaim(owner));
    await expect(result.current(claim)).rejects.toBe(error);
  });

  it('observes a later claim failure without installing a navigation failure handler', async () => {
    const { result } = renderHook(() => useUniversalBorrowClaim(owner));
    await expect(result.current(claim)).resolves.toBe(true);
    const callbacks = mockNavigation.mock.calls[0][0];
    expect(callbacks.onFail).toBeUndefined();
    expect(callbacks.onConfirmationFail).toEqual(expect.any(Function));
    expect(() =>
      callbacks.onConfirmationFail?.(new Error('send failed')),
    ).not.toThrow();
  });

  it('records a claim success that arrives after cancellation', async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUniversalBorrowClaim(owner));
    await expect(result.current({ ...claim, onSuccess })).resolves.toBe(true);
    const callbacks = mockNavigation.mock.calls[0][0];
    callbacks.onCancel?.();
    await callbacks.onSuccess?.(successData);
    expect(mockAddOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'claim-order', txId: 'tx-1' }),
    );
    expect(onSuccess).toHaveBeenCalledWith(successData);
  });
});

describe('Borrow unwrap option', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockRiskAccepted.mockResolvedValue(true);
    mockNavigation.mockResolvedValue(undefined);
    mockBorrow.mockResolvedValue({
      tx: JSON.stringify(encodedTx),
      orderId: '',
    });
    mockAccountAddress.mockResolvedValue('0xAaA');
  });

  it.each([true, false, undefined])(
    'preserves unwrap=%s in the borrow build request',
    async (unwrap) => {
      const { result } = renderHook(() => useUniversalBorrowBorrow(owner));

      await expect(result.current({ ...input, unwrap })).resolves.toBe(true);
      expect(mockBorrow).toHaveBeenCalledWith({
        ...owner,
        ...input,
        expectedAccountAddress: '0xAaA',
        ...(unwrap !== undefined ? { unwrap } : {}),
      });
    },
  );
});
