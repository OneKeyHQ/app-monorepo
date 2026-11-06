/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import {
  useUniversalBorrowRepay,
  useUniversalBorrowWithdraw,
} from './useUniversalBorrowWithdrawRepayHooks';

type IConfirmation = {
  onSuccess?: (data: ISendTxOnSuccessData[]) => void | Promise<void>;
  onFail?: (error: Error) => void;
  onCancel?: () => void;
  onBeforeSend?: () => void | Promise<void>;
};
const mockNavigate = jest.fn<Promise<void>, [IConfirmation]>();
const mockRisk = jest.fn<Promise<boolean>, [unknown]>();
const mockWithdraw = jest.fn<
  Promise<{ tx: string; orderId: string }>,
  [unknown]
>();
const mockRepay = jest.fn<
  Promise<{ tx: string; orderId: string }>,
  [unknown]
>();
const mockTrack = jest.fn<Promise<void>, [unknown]>();
const mockAccountAddress = jest.fn<Promise<string>, [unknown]>();
const mockSettle = jest.fn<
  Promise<EOnChainHistoryTxStatus | undefined>,
  [unknown]
>();

jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({ navigationToTxConfirm: mockNavigate }),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/EarnRiskWarningDialog',
  () => ({
    useEarnRiskWarningGate: () => mockRisk,
  }),
);
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccountAddressForApi: (params: unknown) => mockAccountAddress(params),
    },
    serviceStaking: {
      borrowBuildWithdrawTransaction: (params: unknown) => mockWithdraw(params),
      borrowBuildRepayTransaction: (params: unknown) => mockRepay(params),
      addEarnOrder: (params: unknown) => mockTrack(params),
    },
  },
}));
jest.mock(
  '@onekeyhq/kit/src/components/DeFi/DeFiActionTxConfirmResult',
  () => ({
    showDeFiActionTxConfirmDialog: (params: unknown) => mockSettle(params),
  }),
);

const owner = { accountId: 'account-1', networkId: 'evm--1' };
const params = {
  amount: '1.23',
  provider: 'aave',
  marketAddress: 'market',
  reserveAddress: 'reserve',
};
const tx = { to: 'pool', data: '0x1234' };
const submitted = [
  {
    signedTx: { txid: 'tx-1' },
    decodedTx: { txid: 'tx-1', status: 'Pending' },
  },
] as ISendTxOnSuccessData[];

describe.each([
  ['withdraw', useUniversalBorrowWithdraw, mockWithdraw, EEarnLabels.Withdraw],
  ['repay', useUniversalBorrowRepay, mockRepay, EEarnLabels.Repay],
] as const)(
  'Borrow %s confirmation baseline',
  (action, useHook, build, label) => {
    beforeEach(() => {
      jest.resetAllMocks();
      mockRisk.mockResolvedValue(true);
      mockNavigate.mockResolvedValue();
      mockWithdraw.mockResolvedValue({
        tx: JSON.stringify(tx),
        orderId: 'order-1',
      });
      mockRepay.mockResolvedValue({
        tx: JSON.stringify(tx),
        orderId: 'order-1',
      });
      mockTrack.mockResolvedValue();
      mockAccountAddress.mockResolvedValue('0xaaa');
      mockSettle.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    });

    it('builds the original intent, awaits the navigation preflight, and hands off', async () => {
      const onBeforeNavigate = jest.fn(async () => undefined);
      const onFail = jest.fn();
      const onCancel = jest.fn();
      const { result } = renderHook(() => useHook(owner));
      const options =
        action === 'withdraw'
          ? { withdrawAll: true, unwrap: false }
          : { repayAll: true };
      await expect(
        result.current({
          ...params,
          ...options,
          onBeforeNavigate,
          onFail,
          onCancel,
        }),
      ).resolves.toBe(true);
      expect(build).toHaveBeenCalledWith({
        ...owner,
        ...params,
        ...options,
        expectedAccountAddress: '0xaaa',
      });
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ encodedTx: tx }),
      );
      expect(build.mock.invocationCallOrder[0]).toBeLessThan(
        onBeforeNavigate.mock.invocationCallOrder[0],
      );
      expect(onBeforeNavigate.mock.invocationCallOrder[0]).toBeLessThan(
        mockNavigate.mock.invocationCallOrder[0],
      );
      expect(mockTrack).not.toHaveBeenCalled();
    });

    it('keeps confirmation after the caller intentionally closes and unmounts', async () => {
      let closed = false;
      const { result, unmount } = renderHook(() => useHook(owner));
      await expect(
        result.current({
          ...params,
          canContinueAfterOwnerClose: () => closed,
          onBeforeNavigate: () => {
            closed = true;
            unmount();
          },
        }),
      ).resolves.toBe(true);
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      await expect(
        mockNavigate.mock.calls[0][0].onBeforeSend?.(),
      ).resolves.toBeUndefined();
    });

    it('continues after an approval already closed the owner', async () => {
      let closed = false;
      const { result, unmount } = renderHook(() => useHook(owner));
      const submit = result.current;
      closed = true;
      unmount();
      await expect(
        submit({
          ...params,
          accountAddress: '0xaaa',
          canContinueAfterOwnerClose: () => closed,
          onBeforeNavigate: () => undefined,
        }),
      ).resolves.toBe(true);
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });

    it('does not replace a prior approval address after the dialog is gone', async () => {
      let closed = false;
      const { result, unmount } = renderHook(() => useHook(owner));
      const submit = result.current;
      closed = true;
      unmount();
      mockAccountAddress.mockResolvedValue('0xbbb');
      await expect(
        submit({
          ...params,
          accountAddress: '0xaaa',
          canContinueAfterOwnerClose: () => closed,
        }),
      ).rejects.toThrow('Borrow transaction confirmation expired');
      expect(build).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('does not first resolve the owner address after the dialog is gone', async () => {
      let closed = false;
      const { result, unmount } = renderHook(() => useHook(owner));
      const submit = result.current;
      closed = true;
      unmount();
      await expect(
        submit({ ...params, canContinueAfterOwnerClose: () => closed }),
      ).rejects.toThrow('Borrow approval account unavailable');
      expect(mockAccountAddress).not.toHaveBeenCalled();
      expect(build).not.toHaveBeenCalled();
    });

    it('does not accept the first address if the owner closes while resolving it', async () => {
      let resolveAddress: (value: string) => void = () => undefined;
      mockAccountAddress.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveAddress = resolve;
        }),
      );
      let closed = false;
      const { result, unmount } = renderHook(() => useHook(owner));
      const started = result.current({
        ...params,
        canContinueAfterOwnerClose: () => closed,
      });
      await waitFor(() => expect(mockAccountAddress).toHaveBeenCalledTimes(1));
      closed = true;
      unmount();
      resolveAddress('0xbbb');
      await expect(started).rejects.toThrow(
        'Borrow approval account unavailable',
      );
      expect(build).not.toHaveBeenCalled();
    });

    it('rejects a stale account switch while the builder is pending', async () => {
      let resolveBuild = (_value: { tx: string; orderId: string }) => {};
      build.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveBuild = resolve;
        }),
      );
      const view = renderHook((scope: typeof owner) => useHook(scope), {
        initialProps: owner,
      });
      const started = view.result.current(params);
      await waitFor(() => expect(build).toHaveBeenCalledTimes(1));
      view.rerender({ accountId: 'account-2', networkId: owner.networkId });
      await act(async () => {
        resolveBuild({ tx: JSON.stringify(tx), orderId: 'order-1' });
      });
      await expect(started).resolves.toBe(false);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('does not continue after an unrelated unmount during the builder', async () => {
      let resolveBuild = (_value: { tx: string; orderId: string }) => {};
      build.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveBuild = resolve;
        }),
      );
      const view = renderHook(() => useHook(owner));
      const started = view.result.current({
        ...params,
        canContinueAfterOwnerClose: () => false,
      });
      await waitFor(() => expect(build).toHaveBeenCalledTimes(1));
      view.unmount();
      await act(async () => {
        resolveBuild({ tx: JSON.stringify(tx), orderId: 'order-1' });
      });
      await expect(started).resolves.toBe(false);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('does not hand off an old account when it changes during the owner-close callback', async () => {
      let resume = () => {};
      const closing = new Promise<void>((resolve) => {
        resume = resolve;
      });
      let closed = false;
      const onBeforeNavigate = jest.fn(async () => {
        closed = true;
        await closing;
      });
      const view = renderHook((scope: typeof owner) => useHook(scope), {
        initialProps: owner,
      });
      const started = view.result.current({
        ...params,
        onBeforeNavigate,
        canContinueAfterOwnerClose: () => closed,
      });
      await waitFor(() => expect(onBeforeNavigate).toHaveBeenCalledTimes(1));
      view.rerender({ accountId: 'account-2', networkId: owner.networkId });
      await act(async () => {
        resume();
      });
      await expect(started).resolves.toBe(false);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('rejects sending when the frozen account address has changed', async () => {
      const { result } = renderHook(() => useHook(owner));
      await expect(result.current(params)).resolves.toBe(true);
      mockAccountAddress.mockResolvedValue('0xbbb');
      await expect(
        mockNavigate.mock.calls[0][0].onBeforeSend?.(),
      ).rejects.toThrow('Borrow transaction confirmation expired');
    });

    it('propagates a navigation preflight rejection without opening confirmation', async () => {
      const error = new Error('preflight failed');
      const { result } = renderHook(() => useHook(owner));
      await expect(
        result.current({
          ...params,
          onBeforeNavigate: async () => {
            throw error;
          },
        }),
      ).rejects.toBe(error);
      expect(build).toHaveBeenCalledTimes(1);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('passes cancellation and failure to their original callbacks', async () => {
      const onFail = jest.fn();
      const onCancel = jest.fn();
      const { result } = renderHook(() => useHook(owner));
      await expect(
        result.current({ ...params, onFail, onCancel }),
      ).resolves.toBe(true);
      const confirmation = mockNavigate.mock.calls[0][0];
      const error = new Error('send failed');
      confirmation.onFail?.(error);
      confirmation.onCancel?.();
      expect(onFail).toHaveBeenCalledWith(error);
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(mockTrack).not.toHaveBeenCalled();
    });

    it('delivers a later successful confirmation through settlement without waiting for tracking', async () => {
      mockTrack.mockReturnValueOnce(new Promise(() => {}));
      const onSuccess = jest.fn();
      const onSettleResult = jest.fn();
      const info = { label, protocol: 'Aave', tags: [label] };
      const { result } = renderHook(() => useHook(owner));
      await expect(
        result.current({
          ...params,
          stakingInfo: info,
          onSuccess,
          onSettleResult,
        }),
      ).resolves.toBe(true);
      expect(mockTrack).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
      await mockNavigate.mock.calls[0][0].onSuccess?.(submitted);
      expect(mockTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-1',
          networkId: owner.networkId,
          txId: 'tx-1',
        }),
      );
      expect(mockSettle).toHaveBeenCalledWith(
        expect.objectContaining({
          ...owner,
          expectedAccountAddress: '0xaaa',
          data: submitted,
        }),
      );
      expect(onSettleResult).toHaveBeenCalledWith({
        status: EOnChainHistoryTxStatus.Success,
        data: submitted,
      });
      expect(onSuccess).toHaveBeenCalledWith(submitted);
    });

    it('does not notify success when the settlement callback stops continuation', async () => {
      const onSuccess = jest.fn();
      const onSettleResult = jest.fn().mockResolvedValue(false);
      const { result } = renderHook(() => useHook(owner));
      await result.current({
        ...params,
        stakingInfo: { label, protocol: 'Aave', tags: [label] },
        onSuccess,
        onSettleResult,
      });
      await mockNavigate.mock.calls[0][0].onSuccess?.(submitted);
      expect(onSettleResult).toHaveBeenCalledTimes(1);
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('does not notify success when the settlement result is failed', async () => {
      mockSettle.mockResolvedValue(EOnChainHistoryTxStatus.Failed);
      const onSuccess = jest.fn();
      const onSettleResult = jest.fn();
      const { result } = renderHook(() => useHook(owner));
      await result.current({
        ...params,
        stakingInfo: { label, protocol: 'Aave', tags: [label] },
        onSuccess,
        onSettleResult,
      });
      await mockNavigate.mock.calls[0][0].onSuccess?.(submitted);
      expect(onSettleResult).toHaveBeenCalledWith({
        status: EOnChainHistoryTxStatus.Failed,
        data: submitted,
      });
      expect(onSuccess).not.toHaveBeenCalled();
    });
  },
);
