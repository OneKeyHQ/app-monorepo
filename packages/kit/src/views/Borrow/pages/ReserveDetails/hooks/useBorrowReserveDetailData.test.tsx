/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { useBorrowReserveDetailData } from './useBorrowReserveDetailData';

const mockGetDetails = jest.fn<Promise<unknown>, [unknown]>();
const mockAccount = { address: '0xA' };
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getBorrowReserveDetails: (params: unknown) => mockGetDetails(params),
      getBorrowReserves: jest.fn(),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  useCurrency: () => ({ id: 'usd' }),
}));
jest.mock('@onekeyhq/kit/src/views/Staking/hooks/useEarnAccount', () => ({
  useEarnAccount: () => ({
    earnAccount: { account: { id: 'account-1', address: mockAccount.address } },
    isLoading: false,
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    usePromiseResult: (fn: () => Promise<unknown>, deps: unknown[]) => {
      const [result, setResult] = React.useState<unknown>();
      const method = React.useRef(fn);
      method.current = fn;
      const depsKey = JSON.stringify(deps);
      React.useEffect(() => {
        void method.current().then(setResult, () => undefined);
      }, [depsKey]);
      return { result, isLoading: false, run: fn };
    },
  };
});

const params = {
  accountId: 'account-1',
  networkId: 'evm--1',
  provider: 'aave',
  marketAddress: 'market-a',
  reserveAddress: 'reserve',
};

it('does not expose a previous account or market result while the new read fails', async () => {
  mockAccount.address = '0xA';
  mockGetDetails.mockReset();
  mockGetDetails.mockResolvedValueOnce({ userInfo: { suppliedBalance: '10' } });
  mockGetDetails.mockRejectedValue(new Error('offline'));
  const hook = renderHook(
    (props: typeof params) => useBorrowReserveDetailData(props),
    { initialProps: params },
  );
  await waitFor(() =>
    expect(hook.result.current.userInfo?.suppliedBalance).toBe('10'),
  );
  expect(mockGetDetails).toHaveBeenCalledWith(
    expect.objectContaining({ expectedAccountAddress: '0xA' }),
  );
  mockAccount.address = '0xB';
  hook.rerender(params);
  expect(hook.result.current.userInfo).toBeUndefined();
  await act(async () => {
    await Promise.resolve();
  });
  expect(hook.result.current.userInfo).toBeUndefined();
  expect(mockGetDetails).toHaveBeenLastCalledWith(
    expect.objectContaining({ expectedAccountAddress: '0xB' }),
  );
  hook.rerender({ ...params, marketAddress: 'market-b' });
  expect(hook.result.current.userInfo).toBeUndefined();
});

it('does not expose an old address response arriving after a new address', async () => {
  mockAccount.address = '0xA';
  mockGetDetails.mockReset();
  let finishOld: (value: {
    userInfo: { suppliedBalance: string };
  }) => void = () => undefined;
  const old = new Promise<{ userInfo: { suppliedBalance: string } }>(
    (resolve) => {
      finishOld = resolve;
    },
  );
  mockGetDetails
    .mockReturnValueOnce(old)
    .mockResolvedValue({ userInfo: { suppliedBalance: '2' } });
  const hook = renderHook(
    (props: typeof params) => useBorrowReserveDetailData(props),
    { initialProps: params },
  );
  mockAccount.address = '0xB';
  hook.rerender(params);
  await waitFor(() =>
    expect(hook.result.current.userInfo?.suppliedBalance).toBe('2'),
  );
  await act(async () => {
    finishOld({ userInfo: { suppliedBalance: '10' } });
    await old;
  });
  expect(hook.result.current.userInfo?.suppliedBalance).not.toBe('10');
});

it('continues to load public reserve details without an account', async () => {
  mockGetDetails.mockReset();
  mockGetDetails.mockResolvedValue({ symbol: 'USDC' });
  const hook = renderHook(() =>
    useBorrowReserveDetailData({ ...params, accountId: undefined }),
  );
  await waitFor(() =>
    expect(hook.result.current.details).toEqual({ symbol: 'USDC' }),
  );
  expect(mockGetDetails).toHaveBeenCalledWith(
    expect.not.objectContaining({ accountId: expect.anything() }),
  );
});
