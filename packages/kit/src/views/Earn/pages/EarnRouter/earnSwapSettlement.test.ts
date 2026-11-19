import {
  ESwapCrossChainStatus as CrossChainStatus,
  ESwapTxHistoryStatus as OrderStatus,
} from '@onekeyhq/shared/types/swap/types';

import { getEarnSwapSettlement } from './earnSwapSettlement';

it('requires the destination success for a bridge, including on recovery', () => {
  expect(getEarnSwapSettlement({ state: OrderStatus.SUCCESS }, true)).toBe(
    'pending',
  );
  expect(
    getEarnSwapSettlement(
      {
        state: OrderStatus.SUCCESS,
        crossChainStatus: CrossChainStatus.FROM_SUCCESS,
      },
      true,
    ),
  ).toBe('pending');
  expect(
    getEarnSwapSettlement(
      {
        state: OrderStatus.SUCCESS,
        crossChainStatus: CrossChainStatus.TO_SUCCESS,
      },
      true,
    ),
  ).toBe('delivered');
  expect(getEarnSwapSettlement({ state: OrderStatus.SUCCESS }, false)).toBe(
    'delivered',
  );
});

it('keeps failed or expired bridge legs pending while a refund is still unproven', () => {
  for (const crossChainStatus of [
    CrossChainStatus.BRIDGE_FAILED,
    CrossChainStatus.TO_FAILED,
    CrossChainStatus.EXPIRED,
    undefined,
  ]) {
    expect(
      getEarnSwapSettlement(
        { state: OrderStatus.FAILED, crossChainStatus },
        true,
      ),
    ).toBe('pending');
  }
  expect(
    getEarnSwapSettlement(
      {
        state: OrderStatus.FAILED,
        crossChainStatus: CrossChainStatus.REFUNDED,
      },
      true,
    ),
  ).toBe('failed');
  expect(
    getEarnSwapSettlement(
      {
        state: OrderStatus.FAILED,
        crossChainStatus: CrossChainStatus.FROM_FAILED,
      },
      true,
    ),
  ).toBe('failed');
  expect(getEarnSwapSettlement({ state: OrderStatus.FAILED }, false)).toBe(
    'failed',
  );
});
