/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import { EStakingActionType } from '@onekeyhq/shared/types/staking';

import { useHandleWithdraw } from './useHandleActions';

const mockPush = jest.fn();
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
