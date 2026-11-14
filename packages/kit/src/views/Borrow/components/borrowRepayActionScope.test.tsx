import { renderHook } from '@testing-library/react-native';

import { useCommittedEarnScopeGuard } from '@onekeyhq/kit/src/views/Staking/hooks/useCommittedEarnScopeGuard';

import { buildBorrowRepayPositionKey } from './borrowRepayPosition.utils';

it.each(['amount', 'collateralReserveAddress', 'slippageBps'] as const)(
  'invalidates a submitted collateral repay when %s changes, including change-back',
  (field) => {
    const original = {
      amount: '1',
      collateralReserveAddress: 'collateral-a',
      repayAll: false,
      slippageBps: 50,
      scopeKey: 'account-network-market',
    };
    const { result, rerender } = renderHook(
      (value: typeof original) =>
        useCommittedEarnScopeGuard(buildBorrowRepayPositionKey(value)),
      { initialProps: original },
    );
    const submitted = result.current.capture();
    expect(submitted()).toBe(true);
    const changed = {
      amount: '2',
      collateralReserveAddress: 'collateral-b',
      slippageBps: 75,
    };
    rerender({ ...original, [field]: changed[field] });
    expect(submitted()).toBe(false);
    rerender(original);
    expect(submitted()).toBe(false);
    expect(result.current.capture()()).toBe(true);
  },
);
