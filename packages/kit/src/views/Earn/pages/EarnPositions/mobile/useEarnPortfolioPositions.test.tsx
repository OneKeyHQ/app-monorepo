/* eslint-disable import/first */

type IDeferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T>(): IDeferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Every positions read the hook sends, in the order it sent them; the test
// settles them in whatever order the scenario needs.
const reads: IDeferred<IEarnPortfolioPositionsResponse>[] = [];

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getAvailableAssetsV2: () =>
        Promise.resolve([
          { type: 'normal', networkId: 'evm--1', provider: 'morpho' },
        ]),
      getEarnAvailableAccountsParams: () =>
        Promise.resolve([{ networkId: 'evm--1', accountAddress: '0x1' }]),
      getPortfolioPositions: () => {
        const read = deferred<IEarnPortfolioPositionsResponse>();
        reads.push(read);
        return read.promise;
      },
    },
  },
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      account: { id: 'acc-1', indexedAccountId: 'idx-1' },
      indexedAccount: { id: 'idx-1' },
    },
  }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/earn', () => {
  const { useState } = jest.requireActual<typeof import('react')>('react');
  return {
    useEarnPortfolioPositionsAtom: () =>
      useState<Record<string, Record<string, unknown>>>({}),
  };
});

jest.mock('../../../hooks/useEarnAccountKey', () => ({
  useEarnAccountKey: () => 'wallet-1',
}));

import { act, renderHook } from '@testing-library/react-native';

import type { IEarnPortfolioPositionsResponse } from '@onekeyhq/shared/types/earn/portfolioPositions';

import { useEarnPortfolioPositions } from './useEarnPortfolioPositions';

const flush = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

const response = (amount: string): IEarnPortfolioPositionsResponse =>
  ({
    positions: {
      'evm--1': [
        {
          protocol: 'morpho',
          assets: [{ symbol: 'USDC', amount }],
          earn: {
            manage: {
              networkId: 'evm--1',
              provider: 'morpho',
              symbol: 'USDC',
              vault: '0xA',
            },
            symbol: 'USDC',
            vault: '0xA',
          },
        },
      ],
    },
    protocolSummaries: [],
    errors: [],
  }) as unknown as IEarnPortfolioPositionsResponse;

const amountsOf = (merged: IEarnPortfolioPositionsResponse) =>
  Object.values(merged.positions)
    .flat()
    .map((position) => position.assets[0].amount);

describe('useEarnPortfolioPositions read order', () => {
  beforeEach(() => {
    reads.length = 0;
  });

  // The full load's read of the provider went out before the claim, so its
  // balance predates the claim; it must not replace what the claim's
  // partial read, sent later, has shown.
  it('drops a scope read sent earlier than the one the scope shows', async () => {
    const { result } = renderHook(() =>
      useEarnPortfolioPositions({ isActive: true }),
    );
    await act(flush);
    expect(reads).toHaveLength(1);

    await act(async () => {
      void result.current.refresh({ provider: 'morpho' });
      await flush();
    });
    expect(reads).toHaveLength(2);

    await act(async () => {
      reads[1].resolve(response('after-claim'));
      await flush();
    });
    expect(amountsOf(result.current.response)).toEqual(['after-claim']);

    await act(async () => {
      reads[0].resolve(response('before-claim'));
      await flush();
    });
    expect(amountsOf(result.current.response)).toEqual(['after-claim']);
  });

  it('lets a read sent later replace what an earlier read showed, whichever lands first', async () => {
    const { result } = renderHook(() =>
      useEarnPortfolioPositions({ isActive: true }),
    );
    await act(flush);
    await act(async () => {
      void result.current.refresh({ provider: 'morpho' });
      await flush();
    });
    expect(reads).toHaveLength(2);

    await act(async () => {
      reads[0].resolve(response('before-claim'));
      await flush();
    });
    expect(amountsOf(result.current.response)).toEqual(['before-claim']);

    await act(async () => {
      reads[1].resolve(response('after-claim'));
      await flush();
    });
    expect(amountsOf(result.current.response)).toEqual(['after-claim']);
    expect(result.current.isLoading).toBe(false);
  });
});
