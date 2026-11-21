/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import { useReserveAccountPosition } from './useReserveAccountPosition';
import { useReserveFormSide } from './useReserveFormSide';

const mockReserves = jest.fn<Promise<unknown>, [unknown]>();
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getBorrowReserves: (params: unknown) => mockReserves(params),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    usePromiseResult: (fn: () => Promise<unknown>, deps: unknown[]) => {
      const [result, setResult] = React.useState<unknown>();
      const method = React.useRef(fn);
      method.current = fn;
      const key = JSON.stringify(deps);
      React.useEffect(() => {
        void method.current().then(setResult);
      }, [key]);
      return {
        result,
        run: async () => {
          const value = await method.current();
          setResult(value);
        },
      };
    },
  };
});

it('rechecks the market for the new address and does not reuse the old position on failure', async () => {
  mockReserves.mockReset();
  mockReserves.mockResolvedValueOnce({
    supplied: {
      assets: [{ reserveAddress: 'reserve', suppliedAmount: { number: '5' } }],
    },
  });
  mockReserves.mockRejectedValue(new Error('offline'));
  const initial = {
    accountId: 'same-id',
    accountAddress: '0xA',
    networkId: 'evm--1',
    provider: 'aave',
    marketAddress: 'market',
    reserveAddress: 'reserve',
  };
  const hook = renderHook(
    (params: typeof initial) => useReserveAccountPosition(params),
    { initialProps: initial },
  );
  await waitFor(() => expect(hook.result.current.hasSupplied).toBe(true));
  hook.rerender({ ...initial, accountAddress: '0xB' });
  expect(hook.result.current.isReady).toBe(false);
  expect(hook.result.current.hasSupplied).toBe(false);
  await waitFor(() =>
    expect(mockReserves).toHaveBeenLastCalledWith(
      expect.objectContaining({ expectedAccountAddress: '0xB' }),
    ),
  );
  expect(hook.result.current.isReady).toBe(false);
});

it('drops a previously selected withdraw side on account change while preserving it after the same account withdraws', async () => {
  const initial = {
    requested: 'withdraw' as const,
    scopeKey: 'A',
    isReady: true,
    hasSupplied: true,
    hasBorrowed: false,
    canBorrow: false,
  };
  const hook = renderHook(
    (props: typeof initial) => useReserveFormSide(props),
    { initialProps: initial },
  );
  await waitFor(() => expect(hook.result.current.side).toBe('withdraw'));
  hook.rerender({ ...initial, hasSupplied: false });
  expect(hook.result.current.side).toBe('withdraw');
  hook.rerender({
    ...initial,
    scopeKey: 'B',
    isReady: false,
    hasSupplied: false,
  });
  expect(hook.result.current.side).toBe('supply');
  expect(hook.result.current.sides).not.toContain('withdraw');
});

it('keeps public borrow available when no account is selected', async () => {
  const hook = renderHook(() => {
    const position = useReserveAccountPosition({
      networkId: 'evm--1',
      provider: 'aave',
      marketAddress: 'market',
      reserveAddress: 'reserve',
    });
    return useReserveFormSide({
      isReady: position.isReady,
      scopeKey: position.scopeKey,
      hasSupplied: position.hasSupplied,
      hasBorrowed: position.hasBorrowed,
      canBorrow: true,
    });
  });
  await waitFor(() => expect(hook.result.current.sides).toContain('borrow'));
});

it('retains the newest successful position when an older refresh finishes later', async () => {
  let finishOld: (value: unknown) => void = () => undefined;
  const old = new Promise<unknown>((resolve) => {
    finishOld = resolve;
  });
  const supplied = (number: string) => ({
    supplied: {
      assets: [{ reserveAddress: 'reserve', suppliedAmount: { number } }],
    },
  });
  mockReserves
    .mockReset()
    .mockResolvedValueOnce(supplied('1'))
    .mockReturnValueOnce(old)
    .mockResolvedValueOnce(supplied('2'))
    .mockRejectedValue(new Error('offline'));
  const initial = {
    accountId: 'same-id',
    accountAddress: '0xA',
    networkId: 'evm--1',
    provider: 'aave',
    marketAddress: 'market',
    reserveAddress: 'reserve',
  };
  const hook = renderHook(() => useReserveAccountPosition(initial));
  await waitFor(() => expect(hook.result.current.hasSupplied).toBe(true));
  let oldRun: Promise<void> = Promise.resolve();
  await act(async () => {
    oldRun = hook.result.current.refresh();
  });
  await act(async () => {
    await hook.result.current.refresh();
  });
  await act(async () => {
    finishOld(supplied('0'));
    await oldRun;
  });
  await act(async () => {
    await hook.result.current.refresh();
  });
  expect(hook.result.current.hasSupplied).toBe(true);
});
