import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  groupNetworkIdsByImpl,
  pickNetworkIdsWithoutAccount,
  resolveNetworkIdsWithoutAccount,
} from './networksWithoutAccount';

import type { INetworkImplGroupDeriveTypes } from './networksWithoutAccount';

/*
yarn jest packages/kit-bg/src/services/ServiceAllNetwork/networksWithoutAccount.test.ts
*/

describe('groupNetworkIdsByImpl', () => {
  it('keeps insertion order inside each impl group', () => {
    expect(
      groupNetworkIdsByImpl([
        { id: 'evm--1', impl: 'evm' },
        { id: 'btc--0', impl: 'btc' },
        { id: 'evm--10', impl: 'evm' },
      ]),
    ).toEqual([
      { impl: 'evm', networkIds: ['evm--1', 'evm--10'] },
      { impl: 'btc', networkIds: ['btc--0'] },
    ]);
  });
});

describe('pickNetworkIdsWithoutAccount', () => {
  const group = { impl: 'btc', networkIds: ['btc--0', 'tbtc--0'] };

  it('reports the whole group when no derive type has an account', () => {
    expect(
      pickNetworkIdsWithoutAccount({
        group,
        mergeDeriveAssetsEnabled: true,
        accountDeriveTypes: [],
        currentDeriveType: 'default',
      }),
    ).toEqual(['btc--0', 'tbtc--0']);
    expect(
      pickNetworkIdsWithoutAccount({
        group,
        mergeDeriveAssetsEnabled: false,
        accountDeriveTypes: [],
        currentDeriveType: 'default',
      }),
    ).toEqual(['btc--0', 'tbtc--0']);
  });

  it('accepts any derive type when the network merges derive assets', () => {
    expect(
      pickNetworkIdsWithoutAccount({
        group,
        mergeDeriveAssetsEnabled: true,
        accountDeriveTypes: ['BIP86'],
        currentDeriveType: 'default',
      }),
    ).toEqual([]);
  });

  it('requires the current derive type otherwise', () => {
    expect(
      pickNetworkIdsWithoutAccount({
        group,
        mergeDeriveAssetsEnabled: false,
        accountDeriveTypes: ['BIP86'],
        currentDeriveType: 'default',
      }),
    ).toEqual(['btc--0', 'tbtc--0']);
    expect(
      pickNetworkIdsWithoutAccount({
        group,
        mergeDeriveAssetsEnabled: false,
        accountDeriveTypes: ['BIP86', 'default'],
        currentDeriveType: 'default',
      }),
    ).toEqual([]);
  });
});

describe('resolveNetworkIdsWithoutAccount', () => {
  const groups = [
    { impl: 'evm', networkIds: ['evm--1', 'evm--56'] },
    { impl: 'btc', networkIds: ['btc--0', 'tbtc--0'] },
    { impl: 'sol', networkIds: ['sol--101'] },
  ];
  const settingsByNetwork: Record<string, INetworkImplGroupDeriveTypes> = {
    'evm--1': {
      mergeDeriveAssetsEnabled: false,
      deriveTypes: ['default', 'ledgerLive'],
      currentDeriveType: 'default',
    },
    'btc--0': {
      mergeDeriveAssetsEnabled: true,
      deriveTypes: ['default', 'BIP86', 'BIP84'],
      currentDeriveType: '',
    },
    'sol--101': {
      mergeDeriveAssetsEnabled: false,
      deriveTypes: ['default', 'ledgerLive'],
      currentDeriveType: 'ledgerLive',
    },
  };
  const accountId = ({
    networkId,
    deriveType,
  }: {
    networkId: string;
    deriveType: string;
  }) => `acc:${networkId}:${deriveType}`;

  function setup(existing: string[]) {
    const events: string[] = [];
    let running = 0;
    let maxRunning = 0;
    const getGroupDeriveTypes = jest.fn(async (networkId: string) => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      events.push(`settings:${networkId}`);
      await Promise.resolve();
      running -= 1;
      return settingsByNetwork[networkId];
    });
    const getAccountId = jest.fn(
      async (params: { networkId: string; deriveType: string }) =>
        accountId(params),
    );
    const getExistingAccountIds = jest.fn(async (ids: string[]) => {
      events.push(`ids:${ids.length}`);
      return new Set(ids.filter((id) => existing.includes(id)));
    });
    const yieldToQueue = jest.fn(async () => {
      events.push('yield');
    });
    return {
      events,
      getMaxRunning: () => maxRunning,
      getAccountId,
      getExistingAccountIds,
      run: () =>
        resolveNetworkIdsWithoutAccount({
          groups,
          getGroupDeriveTypes,
          getAccountId,
          getExistingAccountIds,
          yieldToQueue,
        }),
    };
  }

  it('checks one group at a time, yields before each and reads ids once', async () => {
    const ctx = setup([]);
    await ctx.run();
    expect(ctx.getMaxRunning()).toBe(1);
    expect(ctx.events).toEqual([
      'yield',
      'settings:evm--1',
      'yield',
      'settings:btc--0',
      'yield',
      'settings:sol--101',
      'ids:5',
    ]);
    expect(ctx.getExistingAccountIds).toHaveBeenCalledTimes(1);
  });

  it('only derives the current derive type unless the network merges assets', async () => {
    const ctx = setup([]);
    await ctx.run();
    expect(ctx.getAccountId.mock.calls.map(([params]) => params)).toEqual([
      { networkId: 'evm--1', deriveType: 'default' },
      { networkId: 'btc--0', deriveType: 'default' },
      { networkId: 'btc--0', deriveType: 'BIP86' },
      { networkId: 'btc--0', deriveType: 'BIP84' },
      { networkId: 'sol--101', deriveType: 'ledgerLive' },
    ]);
  });

  it('reports groups whose derived account ids are not stored', async () => {
    const ctx = setup([
      accountId({ networkId: 'evm--1', deriveType: 'default' }),
      accountId({ networkId: 'btc--0', deriveType: 'BIP86' }),
      // A different derive type than the current one does not count.
      accountId({ networkId: 'sol--101', deriveType: 'default' }),
    ]);
    await expect(ctx.run()).resolves.toEqual(['sol--101']);
  });

  it('treats an underivable type as missing and skips groups without settings', async () => {
    const getAccountId = jest.fn(
      async (params: { networkId: string; deriveType: string }) => {
        if (params.networkId === 'evm--1') {
          throw new OneKeyLocalError('no derive info');
        }
        return accountId(params);
      },
    );
    await expect(
      resolveNetworkIdsWithoutAccount({
        groups,
        getGroupDeriveTypes: async (networkId) => {
          if (networkId === 'btc--0') {
            throw new OneKeyLocalError('settings unavailable');
          }
          return settingsByNetwork[networkId];
        },
        getAccountId,
        getExistingAccountIds: async (ids) => new Set(ids),
        yieldToQueue: async () => {},
      }),
    ).resolves.toEqual(['evm--1', 'evm--56']);
  });
});
