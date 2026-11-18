/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import { EStakingActionType } from '@onekeyhq/shared/types/staking';
import type { IEarnCancelWithdrawalActionIcon } from '@onekeyhq/shared/types/staking';

import { usePortfolioAction } from './usePortfolioAction';

type IEarnAccountFixture = {
  accountId: string;
  networkId: string;
  accountAddress: string;
  account: { id: string };
};
const mockGetEarnAccount = jest.fn<Promise<IEarnAccountFixture>, [unknown]>();
const mockPushModal = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const deferredPromise = jest.requireActual<
    typeof import('@onekeyhq/components/src/hooks/useDeferredPromise')
  >('../../../../../components/src/hooks/useDeferredPromise');
  return {
    Toast: { error: jest.fn() },
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise: deferredPromise.useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
  };
});
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getEarnAccount: (input: unknown) => mockGetEarnAccount(input),
    },
  },
}));
jest.mock('../../Staking/hooks/useUniversalHooks', () => ({
  useUniversalWithdraw: () => jest.fn(),
}));
jest.mock('../../Staking/pages/ProtocolDetails/useHandleClaim', () => ({
  useHandleClaim: () => jest.fn(),
}));
jest.mock('../../Staking/hooks/useEarnSignMessage', () => ({
  useEarnSignMessage: () => jest.fn(),
}));
jest.mock('../../Staking/components/ProtocolDetails/showKYCDialog', () => ({
  showClaimWithKycDialog: jest.fn(),
}));

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const initial = {
  accountId: 'a',
  networkId: 'evm--1',
  symbol: 'eETH',
  provider: 'etherfi',
  vault: 'vault',
};
const cancel: IEarnCancelWithdrawalActionIcon = {
  type: EStakingActionType.CancelWithdrawal,
  disabled: false,
  text: { text: 'Cancel' },
};
const earnAccount = (id: string) => ({
  accountId: id,
  networkId: 'evm--1',
  accountAddress: `address-${id}`,
  account: { id },
});

beforeEach(() => {
  jest.clearAllMocks();
});

it('does not use the previous account while a new account is resolving, including A to B to A', async () => {
  const first = deferred<ReturnType<typeof earnAccount>>();
  const second = deferred<ReturnType<typeof earnAccount>>();
  const third = deferred<ReturnType<typeof earnAccount>>();
  mockGetEarnAccount
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise)
    .mockReturnValueOnce(third.promise);
  const hook = renderHook((props) => usePortfolioAction(props), {
    initialProps: initial,
  });
  await waitFor(() => expect(mockGetEarnAccount).toHaveBeenCalledTimes(1));
  await act(async () => first.resolve(earnAccount('a')));
  await waitFor(() => expect(hook.result.current).toBeDefined());
  await act(async () =>
    hook.result.current.handleAction({ actionIcon: cancel }),
  );
  expect(mockPushModal).toHaveBeenCalledTimes(1);
  hook.rerender({ ...initial, accountId: 'b' });
  await waitFor(() => expect(mockGetEarnAccount).toHaveBeenCalledTimes(2));
  await act(async () =>
    hook.result.current.handleAction({ actionIcon: cancel }),
  );
  expect(mockPushModal).toHaveBeenCalledTimes(1);
  hook.rerender(initial);
  await waitFor(() => expect(mockGetEarnAccount).toHaveBeenCalledTimes(3));
  await act(async () => second.resolve(earnAccount('b')));
  await act(async () =>
    hook.result.current.handleAction({ actionIcon: cancel }),
  );
  expect(mockPushModal).toHaveBeenCalledTimes(1);
  await act(async () => third.resolve(earnAccount('a')));
  await waitFor(async () => {
    await act(async () =>
      hook.result.current.handleAction({ actionIcon: cancel }),
    );
    expect(mockPushModal).toHaveBeenCalledTimes(2);
  });
  expect(mockPushModal.mock.calls[1][1].params.accountId).toBe('a');
});
