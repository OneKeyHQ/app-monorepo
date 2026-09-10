/* eslint-disable import/first */

const mockSnapshot: {
  result?: { scope: string; pools: ILocalWalletSendPool[] | undefined };
} = {};
let mockRequest: (() => Promise<unknown>) | undefined;
const mockGetPools = jest.fn<
  Promise<ILocalWalletSendPool[] | undefined>,
  [{ accountId: string; networkId: string; toAddress?: string }]
>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrivacyChain: {
      getLocalWalletSendPools: (params: {
        accountId: string;
        networkId: string;
        toAddress?: string;
      }) => mockGetPools(params),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (request: () => Promise<unknown>) => {
    mockRequest = request;
    return mockSnapshot;
  },
}));

import { act, renderHook } from '@testing-library/react-native';

import type { ILocalWalletSendPool } from '@onekeyhq/kit-bg/src/vaults/localWallet/types';

import {
  getDefaultLocalWalletSendPool,
  useLocalWalletSendPool,
} from './useLocalWalletSendPool';

const pools: ILocalWalletSendPool[] = [
  {
    key: 'ironwood',
    label: 'Ironwood',
    spendable: '200000000',
    spendableParsed: '2',
    isDefault: true,
  },
  {
    key: 'orchard',
    label: 'Orchard',
    spendable: '100000000',
    spendableParsed: '1',
  },
  {
    key: 'transparent',
    label: 'Transparent',
    spendable: '500000000',
    spendableParsed: '5',
  },
];
const props = {
  enabled: true,
  accountId: 'account-a',
  networkId: 'zec--0',
  recipientAddress: 't1-recipient',
};
const scopeFor = (input: typeof props) =>
  JSON.stringify([input.accountId, input.networkId, input.recipientAddress]);

beforeEach(() => {
  mockSnapshot.result = undefined;
  mockRequest = undefined;
  mockGetPools.mockReset();
});

describe('local wallet source pool selection', () => {
  it('takes the vault-marked default when nothing is preferred', () => {
    expect(getDefaultLocalWalletSendPool({ pools })?.key).toBe('ironwood');
  });

  it('honors an explicit compatible source over the default', () => {
    expect(
      getDefaultLocalWalletSendPool({ pools, preferredPool: 'orchard' })?.key,
    ).toBe('orchard');
  });

  it('ignores a preferred pool the vault did not offer', () => {
    expect(
      getDefaultLocalWalletSendPool({ pools, preferredPool: 'unsupported' })
        ?.key,
    ).toBe('ironwood');
  });

  it('hides pools the vault marked ineligible for the recipient', () => {
    mockSnapshot.result = {
      scope: scopeFor(props),
      pools: pools.map((pool) =>
        pool.key === 'transparent' ? { ...pool, eligible: false } : pool,
      ),
    };
    const { result } = renderHook(() => useLocalWalletSendPool(props));
    expect(result.current.pools?.map((pool) => pool.key)).toEqual([
      'ironwood',
      'orchard',
    ]);
  });

  it('falls back to the first pool when none is marked default', () => {
    expect(
      getDefaultLocalWalletSendPool({
        pools: pools.map((pool) => ({ ...pool, isDefault: undefined })),
      })?.key,
    ).toBe('ironwood');
  });
});

describe('useLocalWalletSendPool', () => {
  it('waits for account-scoped balances and forwards the recipient to the background', async () => {
    const { result } = renderHook(() => useLocalWalletSendPool(props));
    expect(result.current.isReady).toBe(false);
    expect(result.current.selectedPool).toBeUndefined();
    mockGetPools.mockResolvedValue(pools);
    await mockRequest?.();
    expect(mockGetPools).toHaveBeenCalledWith({
      accountId: props.accountId,
      networkId: props.networkId,
      toAddress: props.recipientAddress,
    });
  });

  it('keeps a manual selection and its balance after a refresh', () => {
    mockSnapshot.result = { scope: scopeFor(props), pools };
    const { result, rerender } = renderHook(() =>
      useLocalWalletSendPool(props),
    );
    act(() => result.current.selectPool('orchard'));
    expect(result.current.selectedPool?.spendableParsed).toBe('1');
    mockSnapshot.result = {
      scope: scopeFor(props),
      pools: pools.map((pool) => ({ ...pool, spendableParsed: '0.5' })),
    };
    rerender({});
    expect(result.current.selectedPool?.key).toBe('orchard');
    expect(result.current.selectedPool?.spendableParsed).toBe('0.5');
    expect(result.current.isReady).toBe(true);
  });

  it('blocks submission during a failed refresh and restores the manual source', () => {
    mockSnapshot.result = { scope: scopeFor(props), pools };
    const { result, rerender } = renderHook(() =>
      useLocalWalletSendPool(props),
    );
    act(() => result.current.selectPool('orchard'));
    mockSnapshot.result = undefined;
    rerender({});
    expect(result.current.isReady).toBe(false);
    mockSnapshot.result = { scope: scopeFor(props), pools };
    rerender({});
    expect(result.current.selectedPool?.key).toBe('orchard');
    expect(result.current.isReady).toBe(true);
  });

  it('does not carry another account or destination balance into the new form', () => {
    mockSnapshot.result = { scope: scopeFor(props), pools };
    const { result, rerender } = renderHook(
      (input: typeof props) => useLocalWalletSendPool(input),
      { initialProps: props },
    );
    act(() => result.current.selectPool('orchard'));
    const next = {
      ...props,
      accountId: 'account-b',
      recipientAddress: 'u1-recipient',
    };
    rerender(next);
    expect(result.current.isReady).toBe(false);
    expect(result.current.selectedPool).toBeUndefined();
    mockSnapshot.result = { scope: scopeFor(next), pools };
    rerender(next);
    expect(result.current.isReady).toBe(true);
    expect(result.current.selectedPool?.key).toBe('ironwood');
  });

  it('keeps flows without pools and non-local-wallet networks usable', () => {
    mockSnapshot.result = { scope: scopeFor(props), pools: undefined };
    const { result, rerender } = renderHook(
      (input: typeof props) => useLocalWalletSendPool(input),
      { initialProps: props },
    );
    expect(result.current.isReady).toBe(true);
    expect(result.current.pools).toBeUndefined();
    rerender({ ...props, enabled: false, networkId: 'btc--0' });
    expect(result.current.isReady).toBe(true);
  });
});
