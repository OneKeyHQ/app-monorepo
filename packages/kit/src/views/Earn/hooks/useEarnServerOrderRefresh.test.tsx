import { act, renderHook } from '@testing-library/react-native';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { useEarnServerOrderRefresh } from './useEarnServerOrderRefresh';

const order = {
  accountId: 'account-a',
  indexedAccountId: 'wallet-a--0',
  networkId: 'evm--56',
  provider: 'unitas',
  vault: 'vault-a',
  orderId: 'order-a',
  status: 'success' as const,
};

function emit(payload = order) {
  act(() => {
    appEventBus.emit(EAppEventBusNames.EarnServerOrderSettled, payload);
  });
}

it('refreshes matching orders and unsubscribes on account change and unmount', () => {
  const onRefresh = jest.fn();
  const { rerender, unmount } = renderHook<void, { accountId: string }>(
    ({ accountId }) =>
      useEarnServerOrderRefresh({
        accountId,
        networkId: order.networkId,
        provider: 'Unitas',
        vault: order.vault,
        onRefresh,
      }),
    { initialProps: { accountId: order.accountId } },
  );
  emit({ ...order, networkId: 'evm--1' });
  emit({ ...order, provider: 'other' });
  emit({ ...order, vault: 'other' });
  expect(onRefresh).not.toHaveBeenCalled();
  emit();
  expect(onRefresh).toHaveBeenCalledTimes(1);
  rerender({ accountId: 'account-b' });
  emit();
  expect(onRefresh).toHaveBeenCalledTimes(1);
  unmount();
  emit({ ...order, accountId: 'account-b' });
  expect(onRefresh).toHaveBeenCalledTimes(1);
});

it('matches multi-network portfolio accounts by indexed identity', () => {
  const onRefresh = jest.fn();
  const { unmount } = renderHook(() =>
    useEarnServerOrderRefresh({
      accountId: 'another-network-account',
      indexedAccountId: order.indexedAccountId,
      onRefresh,
    }),
  );
  emit({ ...order, indexedAccountId: 'other-wallet--0' });
  expect(onRefresh).not.toHaveBeenCalled();
  emit();
  expect(onRefresh).toHaveBeenCalledWith(order);
  unmount();
});
