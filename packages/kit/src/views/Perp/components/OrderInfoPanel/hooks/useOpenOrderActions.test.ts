/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { useOpenOrderActions } from './useOpenOrderActions';

let mockAddress = '0xabc';
const mockCancel = jest.fn().mockResolvedValue(undefined);
const mockChase = jest.fn().mockResolvedValue(undefined);
const mockEnsure = jest.fn().mockResolvedValue(undefined);
const mockMeta = jest
  .fn<
    Promise<{ assetId: number; universe: { szDecimals: number } }>,
    unknown[]
  >()
  .mockResolvedValue({
    assetId: 12,
    universe: { szDecimals: 2 },
  });
jest.mock('@onekeyhq/components', () => ({
  Toast: { error: jest.fn(), message: jest.fn() },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: {
      getSymbolMeta: (
        ...args: unknown[]
      ): Promise<{ assetId: number; universe: { szDecimals: number } }> =>
        mockMeta(...args),
      fetchL2BookByCoin: async () => ({
        levels: [[{ px: '10' }], [{ px: '11' }]],
      }),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useHyperliquidActions: () => ({
    current: { cancelOrder: mockCancel, chaseOrder: mockChase },
  }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountAtom: () => [{ accountAddress: mockAddress }],
  usePerpsCustomSettingsAtom: () => [{ skipOrderConfirm: true }],
}));
jest.mock('../../../hooks/useEnableTradingWithDepositFallback', () => ({
  useEnsureTradingEnabled: () => mockEnsure,
}));
jest.mock('../ChaseOrderConfirmModal', () => ({
  showChaseOrderConfirmDialog: jest.fn(),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

it('routes Chase and Close correctly and blocks cancellation after an account switch', async () => {
  const order = {
    coin: 'BTC',
    oid: 7,
    side: 'B',
    orderType: 'Limit',
    tif: 'Gtc',
    isTrigger: false,
    reduceOnly: false,
    sz: '1',
    origSz: '1',
    limitPx: '9',
  } as IPerpsFrontendOrder;
  const { result, rerender } = renderHook(() => useOpenOrderActions('0xabc'));
  await act(async () => result.current.handleChaseOrderPress(order));
  expect(mockChase).toHaveBeenCalledWith({
    coin: 'BTC',
    oid: 7,
    newPrice: '11',
    expectedAccountAddress: '0xabc',
  });
  await act(async () => result.current.handleCancelOrder(order));
  expect(mockCancel).toHaveBeenCalledWith({
    orders: [{ assetId: 12, oid: 7 }],
  });
  mockCancel.mockClear();
  let finishSetup: (() => void) | undefined;
  mockEnsure.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishSetup = resolve;
      }),
  );
  let pending: Promise<void> | undefined;
  await act(async () => {
    pending = result.current.handleCancelOrder(order);
  });
  mockAddress = '0xdef';
  rerender();
  await act(async () => {
    finishSetup?.();
    await pending;
  });
  expect(mockCancel).not.toHaveBeenCalled();
  expect(Toast.error).toHaveBeenCalled();
});
