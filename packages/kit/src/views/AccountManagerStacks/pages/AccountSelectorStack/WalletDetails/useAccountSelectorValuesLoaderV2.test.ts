/** @jest-environment jsdom */
import type {
  IAccountSelectorDeFiMap,
  IAccountSelectorValuesMap,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  loadAccountSelectorValuesV2,
  yieldAccountSelectorValuesV2,
} from './useAccountSelectorValuesLoaderV2';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceAccountSelector: {} },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({}));

type IBuildValues = NonNullable<
  Parameters<typeof loadAccountSelectorValuesV2>[1]['buildValues']
>;
const accounts = (count: number, prefix = 'account') =>
  Array.from({ length: count }, (_, index) => ({
    accountId: `${prefix}-${index}`,
    networkId: 'evm--1',
  }));
const result: IBuildValues = async ({ accounts: batch }) => ({
  accountsValue: batch.map(({ accountId }) => ({
    accountId,
    currency: 'usd',
    value: { [`${accountId}_evm--1`]: '1' },
  })),
  accountsDeFiOverview: batch.map(() => ({
    overview: {},
    perpsNetWorthUsd: '3',
  })),
});
function atom<T>(initial: T) {
  let value = initial;
  const publications: T[] = [];
  return {
    read: () => value,
    publications,
    set: jest.fn(async (update: (previous: T) => T) => {
      const next = update(value);
      if (next !== value) publications.push(next);
      value = next;
    }),
  };
}
function dependencies() {
  return {
    valuesAtom: atom<IAccountSelectorValuesMap>({}),
    deFiAtom: atom<IAccountSelectorDeFiMap>({}),
    buildValues: jest.fn(result),
    yieldToUI: jest.fn(async () => undefined),
    now: () => 0,
    networkByNum: new Map<number, string | undefined>(),
    isCancelled: () => false,
  };
}

describe('account V2 balance scheduling', () => {
  it('keeps 20 service batches but publishes 4 maps for 1000 immediately resolved accounts', async () => {
    const deps = dependencies();
    await loadAccountSelectorValuesV2(
      { num: 0, accountsForValuesQuery: accounts(1000) },
      deps,
    );
    expect(deps.buildValues).toHaveBeenCalledTimes(20);
    expect(
      deps.buildValues.mock.calls.every(
        ([params]) => params.accounts.length === 50,
      ),
    ).toBe(true);
    expect(
      deps.valuesAtom.publications.map(
        (value) => Object.keys(value[0] ?? {}).length,
      ),
    ).toEqual([50, 1000]);
    expect(deps.deFiAtom.publications).toHaveLength(2);
    expect(deps.yieldToUI).toHaveBeenCalledTimes(1);
    deps.valuesAtom.publications.length = 0;
    deps.deFiAtom.publications.length = 0;
    await loadAccountSelectorValuesV2(
      { num: 0, accountsForValuesQuery: accounts(1000) },
      deps,
    );
    expect(deps.valuesAtom.publications).toHaveLength(0);
    expect(deps.deFiAtom.publications).toHaveLength(0);
  });

  it('publishes and yields when the work budget expires, including failed batches', async () => {
    const deps = dependencies();
    let time = 0;
    deps.now = () => time;
    deps.buildValues.mockImplementation(async (params) => {
      time += 9;
      if (params.accounts[0].accountId === 'account-50')
        throw new OneKeyLocalError('batch failed');
      return result(params);
    });
    await loadAccountSelectorValuesV2(
      { num: 0, accountsForValuesQuery: accounts(150) },
      deps,
    );
    expect(deps.buildValues).toHaveBeenCalledTimes(3);
    expect(deps.yieldToUI).toHaveBeenCalledTimes(2);
    expect(deps.valuesAtom.read()[0]?.['account-100'].value).toEqual({
      'account-100_evm--1': '1',
    });
    expect(deps.valuesAtom.read()[0]?.['account-50']).toBeUndefined();
  });

  it('preserves refresh balances, prunes other wallets and clears stale network Perps', async () => {
    const deps = dependencies();
    const input = {
      num: 0,
      accountsForValuesQuery: accounts(2),
      linkedNetworkId: 'onekeyall--0',
    };
    await loadAccountSelectorValuesV2(input, deps);
    deps.valuesAtom.publications.length = 0;
    deps.deFiAtom.publications.length = 0;
    deps.buildValues.mockImplementation(async () => {
      throw new OneKeyLocalError('offline');
    });
    await loadAccountSelectorValuesV2(
      { ...input, linkedNetworkId: 'btc--0' },
      deps,
    );
    expect(deps.valuesAtom.publications).toHaveLength(0);
    expect(deps.valuesAtom.read()[0]?.['account-0'].value).toEqual({
      'account-0_evm--1': '1',
    });
    expect(deps.deFiAtom.read()[0]).toEqual({});
    await loadAccountSelectorValuesV2(
      { ...input, accountsForValuesQuery: accounts(2, 'other-wallet') },
      deps,
    );
    expect(deps.valuesAtom.read()[0]).toEqual({});
  });

  it('drops cancelled responses and keeps concurrent selector nums isolated', async () => {
    const deps = dependencies();
    let cancelled = false;
    let release: (() => void) | undefined;
    const oldRequest = loadAccountSelectorValuesV2(
      { num: 0, accountsForValuesQuery: accounts(50, 'old') },
      {
        ...deps,
        isCancelled: () => cancelled,
        buildValues: async (params) => {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          return result(params);
        },
      },
    );
    // Let initialization reach the deferred service call.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    cancelled = true;
    await Promise.all([
      loadAccountSelectorValuesV2(
        { num: 0, accountsForValuesQuery: accounts(2, 'new') },
        deps,
      ),
      loadAccountSelectorValuesV2(
        { num: 1, accountsForValuesQuery: accounts(2, 'second') },
        deps,
      ),
    ]);
    release?.();
    await oldRequest;
    expect(Object.keys(deps.valuesAtom.read()[0] ?? {})).toEqual([
      'new-0',
      'new-1',
    ]);
    expect(Object.keys(deps.valuesAtom.read()[1] ?? {})).toEqual([
      'second-0',
      'second-1',
    ]);
  });

  it('guards a deferred empty-account cleanup after a new load starts', async () => {
    const deps = dependencies();
    await loadAccountSelectorValuesV2(
      { num: 0, accountsForValuesQuery: accounts(1) },
      deps,
    );
    let cancelled = false;
    let runCleanup: (() => Promise<void>) | undefined;
    const cleanup = loadAccountSelectorValuesV2(
      { num: 0, accountsForValuesQuery: [] },
      {
        ...deps,
        isCancelled: () => cancelled,
        valuesAtom: {
          set: (update) =>
            new Promise<void>((resolve) => {
              runCleanup = async () => {
                await deps.valuesAtom.set(update);
                resolve();
              };
            }),
        },
      },
    );
    cancelled = true;
    await runCleanup?.();
    await cleanup;
    expect(deps.valuesAtom.read()[0]?.['account-0'].value).toEqual({
      'account-0_evm--1': '1',
    });
  });

  it('yields beyond a frame callback and remains bounded when rAF is suspended', async () => {
    jest.useFakeTimers();
    let frameCallback: FrameRequestCallback | undefined;
    const scheduler: {
      requestAnimationFrame: (callback: FrameRequestCallback) => number;
      cancelAnimationFrame: (frame: number) => void;
    } = globalThis;
    const raf = jest
      .spyOn(scheduler, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        frameCallback = callback;
        return 1;
      });
    const cancel = jest
      .spyOn(scheduler, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
    try {
      let finished = false;
      const task = yieldAccountSelectorValuesV2().then(() => {
        finished = true;
      });
      await Promise.resolve();
      expect(finished).toBe(false);
      frameCallback?.(0);
      await Promise.resolve();
      expect(finished).toBe(false);
      jest.advanceTimersByTime(0);
      await task;
      expect(finished).toBe(true);
      const suspended = yieldAccountSelectorValuesV2();
      jest.advanceTimersByTime(100);
      await suspended;
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      raf.mockRestore();
      cancel.mockRestore();
      jest.useRealTimers();
    }
  });
});
