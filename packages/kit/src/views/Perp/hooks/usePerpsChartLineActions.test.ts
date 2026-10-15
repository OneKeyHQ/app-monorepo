/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { usePerpsChartLineActions } from './usePerpsChartLineActions';

const mockCancelOrder = jest.fn<Promise<void>, [unknown]>();
jest.mock('@onekeyhq/components', () => ({ Toast: { error: jest.fn() } }));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: { ready: true, account: { id: 'account-1' } },
  }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useHyperliquidActions: () => ({
    current: { cancelChartOrder: mockCancelOrder },
  }),
}));
jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/utils/config',
  () => ({
    getPerpsOrderChangedMessage: () => 'Order changed',
  }),
);
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountAtom: () => [
    { accountId: 'account-1', accountAddress: '0xaccount' },
  ],
  usePerpsAccountLoadingInfoAtom: () => [{ selectAccountLoading: false }],
}));
jest.mock('./useEnableTradingWithDepositFallback', () => ({
  useEnsureTradingEnabled: () => async () => undefined,
}));

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('chart cancellation state', () => {
  it.each([false, true])(
    'locks only the pending order and clears loading after failure=%s',
    async (fails) => {
      const cancel = deferred();
      mockCancelOrder.mockReset().mockReturnValue(cancel.promise);
      const line = {
        id: 'order:1',
        symbol: 'BTC',
        kind: 'order' as const,
        price: '80000',
        version: 1,
        editable: true,
        meta: { orderId: '1', coin: 'BTC' },
      };
      const { result } = renderHook(() =>
        usePerpsChartLineActions({
          lines: [line],
          enabled: true,
          symbol: 'BTC',
          szDecimals: 5,
          isSpot: false,
        }),
      );
      const id = result.current.getLineId(line);
      const action = { id, originalPrice: 80_000, type: 'cancel' as const };
      let request: Promise<void> | undefined;
      let failure: unknown;
      await act(async () => {
        request = result.current
          .onReferenceLineAction(action)
          .catch((error: unknown) => {
            failure = error;
          });
        await Promise.resolve();
      });
      expect(result.current.pending[id]).toMatchObject({ type: 'cancel' });
      expect(Object.keys(result.current.pending)).toEqual([id]);
      await act(async () => {
        await result.current.onReferenceLineAction(action);
      });
      expect(mockCancelOrder).toHaveBeenCalledTimes(1);
      const error = new OneKeyLocalError('Cancel rejected');
      await act(async () => {
        if (fails) cancel.reject(error);
        else cancel.resolve();
        await request;
      });
      expect(failure).toBe(fails ? error : undefined);
      expect(result.current.pending).toEqual({});
    },
  );
});
