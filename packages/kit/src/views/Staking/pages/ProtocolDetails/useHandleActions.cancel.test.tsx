/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import { EStakingActionType } from '@onekeyhq/shared/types/staking';
import type { IProtocolInfo } from '@onekeyhq/shared/types/staking';

import { useHandleWithdraw } from './useHandleActions';

const mockPush = jest.fn<
  void,
  [EModalStakingRoutes, { onSuccess?: () => void }]
>();
const mockGetConfig = jest.fn<Promise<unknown>, unknown[]>();
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: mockPush }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getStakingConfigs: (...args: unknown[]) => mockGetConfig(...args),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it('routes EtherFi cancellation to the request picker before building a transaction', async () => {
  const hook = renderHook(() => useHandleWithdraw());
  await act(async () =>
    hook.result.current({
      accountId: 'account',
      networkId: 'evm--1',
      symbol: 'eETH',
      provider: 'ETHERFI',
      withdrawType: EStakingActionType.CancelWithdrawal,
    }),
  );
  expect(mockPush).toHaveBeenCalledWith(
    EModalStakingRoutes.WithdrawOptions,
    expect.objectContaining({
      accountId: 'account',
      provider: 'ETHERFI',
      withdrawType: 'cancel',
    }),
  );
  expect(mockGetConfig).not.toHaveBeenCalled();
});

it('does not route a picker with a different resolved account or network', async () => {
  const protocolInfo: IProtocolInfo = {
    provider: 'etherfi',
    networkId: 'evm--1',
    symbol: 'ETH',
    vault: 'vault',
    stakeTag: '',
    providerDetail: { name: 'EtherFi', logoURI: '' },
    earnAccount: {
      accountId: 'other-account',
      networkId: 'evm--1',
      accountAddress: '0xowner',
      account: {
        id: 'other-account',
        name: 'Account',
        type: undefined,
        path: '',
        coinType: '60',
        impl: 'evm',
        pub: '',
        address: '0xowner',
        addressDetail: {
          isValid: true,
          networkId: 'evm--1',
          address: '0xowner',
          baseAddress: '0xowner',
          normalizedAddress: '0xowner',
          displayAddress: '0xowner',
          allowEmptyAddress: false,
        },
      },
    },
  };
  const hook = renderHook(() => useHandleWithdraw());
  await act(async () =>
    hook.result.current({
      accountId: 'account',
      networkId: 'evm--1',
      symbol: 'ETH',
      provider: 'etherfi',
      withdrawType: EStakingActionType.CancelWithdrawal,
      protocolInfo,
    }),
  );
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockGetConfig).not.toHaveBeenCalled();
});

it('does not invoke the original picker callback after switching scope away and back', async () => {
  const onSuccess = jest.fn();
  const hook = renderHook(({ scope }) => useHandleWithdraw(scope), {
    initialProps: { scope: 'account-a' },
  });
  await act(async () =>
    hook.result.current({
      accountId: 'account',
      networkId: 'evm--1',
      symbol: 'ETH',
      provider: 'etherfi',
      withdrawType: EStakingActionType.CancelWithdrawal,
      onSuccess,
    }),
  );
  const callback = mockPush.mock.calls[0]?.[1].onSuccess;
  expect(callback).toBeDefined();
  hook.rerender({ scope: 'account-b' });
  hook.rerender({ scope: 'account-a' });
  act(() => callback?.());
  expect(onSuccess).not.toHaveBeenCalled();
});

it('continues direct-provider routing through the config lookup', async () => {
  mockGetConfig.mockResolvedValue({ withdrawWithTx: true });
  const hook = renderHook(() => useHandleWithdraw());
  await act(async () =>
    hook.result.current({
      accountId: 'account',
      networkId: 'evm--1',
      symbol: 'ETH',
      provider: 'native',
      withdrawType: EStakingActionType.WithdrawOrder,
    }),
  );
  expect(mockGetConfig).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith(
    EModalStakingRoutes.WithdrawOptions,
    expect.objectContaining({ provider: 'native' }),
  );
});
