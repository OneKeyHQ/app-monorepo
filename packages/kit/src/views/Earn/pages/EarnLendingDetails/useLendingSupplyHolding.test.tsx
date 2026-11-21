/** @jest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';

import { useLendingSupplyHolding } from './useLendingSupplyHolding';

const mockGetReserves = jest.fn<Promise<unknown>, [unknown]>();
const mockGetHealthFactor = jest.fn<Promise<unknown>, [unknown]>();
let mockRemembered: unknown;
let mockLastPositionEntry: unknown;
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => '' }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getBorrowReserves: (params: unknown) => mockGetReserves(params),
      getBorrowHealthFactor: (params: unknown) => mockGetHealthFactor(params),
    },
  },
}));
jest.mock('../../components/desktopHome/useEarnDesktopHomeData', () => ({
  useRememberedAccountMarket: () => mockRemembered,
}));
jest.mock('../EarnPositions/mobile/earnLendingPositions', () => ({
  findSuppliedReserve: () => undefined,
  lendingSupplyPositionOf: ({
    entry,
  }: {
    entry: { reserves: { supplied: string } };
  }) => {
    mockLastPositionEntry = entry;
    return entry.reserves.supplied;
  },
}));
jest.mock('../EarnPositions/mobile/earnPositionModel', () => ({
  buildHoldingView: ({ sources }: { sources: unknown[] }) => sources[0],
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
      return { result, run: fn };
    },
  };
});

it('does not carry the old address health factor into a new account result', async () => {
  const networkId = 'evm--1';
  const market = {
    provider: 'aave',
    networkId,
    marketAddress: 'market-a',
    name: 'Aave',
    logoURI: '',
    network: {
      networkId,
      network: '',
      name: '',
      symbol: '',
      decimals: 18,
      logoURI: '',
      indexerSupported: true,
      fallbackSupported: false,
      nativeTokenAddress: '',
      coingeckoPlatform: '',
      nativeTokenCoingeckoId: '',
    },
  };
  mockRemembered = {
    accountId: 'same',
    accountAddress: '0xA',
    market,
    reserves: { supplied: 'old' },
    healthFactor: { healthFactor: { text: { text: '1.5' } } },
  };
  mockGetReserves.mockReset();
  mockGetReserves.mockResolvedValue({
    supplied: 'new',
    borrowed: { assets: [{ borrowedAmount: { number: '2' } }] },
  });
  mockGetHealthFactor.mockRejectedValue(new Error('offline'));
  mockLastPositionEntry = undefined;
  const hook = renderHook(() =>
    useLendingSupplyHolding({
      market,
      accountId: 'same',
      accountAddress: '0xB',
      provider: 'aave',
      networkId,
      marketAddress: 'market-a',
      reserveAddress: 'reserve',
    }),
  );
  await waitFor(() => expect(hook.result.current.holding).toBe('new'));
  expect(mockLastPositionEntry).toMatchObject({
    accountId: 'same',
    healthFactor: undefined,
  });
  mockRemembered = undefined;
});

it('does not display the previous address or market holding while the new read fails', async () => {
  mockRemembered = undefined;
  mockGetReserves.mockReset();
  mockGetReserves.mockResolvedValueOnce({ supplied: 'old-holding' });
  mockGetReserves.mockRejectedValue(new Error('offline'));
  const market = {
    provider: 'aave',
    networkId: 'evm--1',
    marketAddress: 'market-a',
    name: 'Aave',
    logoURI: '',
    network: {
      networkId: 'evm--1',
      network: 'ethereum',
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
      logoURI: '',
      indexerSupported: true,
      fallbackSupported: false,
      nativeTokenAddress: '',
      coingeckoPlatform: '',
      nativeTokenCoingeckoId: '',
    },
  };
  const initialProps = {
    market,
    accountId: 'account-1',
    accountAddress: '0xA',
    ...market,
    reserveAddress: 'reserve',
  };
  const hook = renderHook(
    (props: typeof initialProps) => useLendingSupplyHolding(props),
    { initialProps },
  );
  await waitFor(() => expect(hook.result.current.holding).toBe('old-holding'));
  hook.rerender({ ...initialProps, accountAddress: '0xB' });
  expect(hook.result.current.holding).toBeUndefined();
  await waitFor(() =>
    expect(mockGetReserves).toHaveBeenLastCalledWith(
      expect.objectContaining({ expectedAccountAddress: '0xB' }),
    ),
  );
  hook.rerender({ ...initialProps, marketAddress: 'market-b' });
  expect(hook.result.current.holding).toBeUndefined();
});

it.each([
  ['evm--1', '0xAbC', '0xaBc', true],
  ['evm--1', '0xAbC', '0xDef', false],
  ['sol--101', 'AbC', 'abc', false],
])(
  'only uses remembered holdings for the same market account on %s',
  async (networkId, cachedAddress, currentAddress, matches) => {
    mockGetReserves.mockReset();
    mockGetReserves.mockRejectedValue(new Error('offline'));
    const market = {
      provider: 'aave',
      networkId,
      marketAddress: 'market-a',
      name: 'Aave',
      logoURI: '',
      network: {
        networkId,
        network: '',
        name: '',
        symbol: '',
        decimals: 18,
        logoURI: '',
        indexerSupported: true,
        fallbackSupported: false,
        nativeTokenAddress: '',
        coingeckoPlatform: '',
        nativeTokenCoingeckoId: '',
      },
    };
    mockRemembered = {
      accountId: 'account-1',
      accountAddress: cachedAddress,
      market,
      reserves: { supplied: 'remembered' },
    };
    const hook = renderHook(() =>
      useLendingSupplyHolding({
        market,
        accountId: 'account-1',
        accountAddress: currentAddress,
        provider: 'aave',
        networkId,
        marketAddress: 'market-a',
        reserveAddress: 'reserve',
      }),
    );
    expect(hook.result.current.holding).toBe(
      matches ? 'remembered' : undefined,
    );
    await waitFor(() => expect(mockGetReserves).toHaveBeenCalled());
    mockRemembered = undefined;
  },
);
