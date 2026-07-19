import type { ICustomTokenDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityCustomTokens';

import {
  commitNativeHomeSnapshotAfterProjection,
  projectNativeHomeCustomTokens,
} from './nativeHomeCustomTokenProjection';

const currentToken = {
  $key: 'current-token',
  address: '0xcurrent',
  decimals: 18,
  isNative: false,
  name: 'Current',
  networkId: 'evm--1',
  symbol: 'CURRENT',
};
const otherOwnerToken = {
  $key: 'other-token',
  address: '0xother',
  decimals: 18,
  isNative: false,
  name: 'Other',
  networkId: 'evm--1',
  symbol: 'OTHER',
};
const aggregateToken = {
  $key: 'aggregate-token',
  address: 'aggregate-token',
  decimals: 18,
  isAggregateToken: true,
  isNative: false,
  name: 'Aggregate',
  networkId: 'aggregate--0',
  symbol: 'AGG',
};

const rawData: ICustomTokenDBStruct = {
  customMap: {
    'evm--1__account:current-address': {
      current: currentToken.symbol,
    },
    'evm--1__account:other-address': {
      other: otherOwnerToken.symbol,
    },
    'aggregate--0__account:indexed-1': {
      aggregate: aggregateToken.symbol,
    },
  },
  hiddenMap: {},
  tokens: {
    aggregate: aggregateToken,
    current: currentToken,
    other: otherOwnerToken,
  },
};

describe('projectNativeHomeCustomTokens', () => {
  it('projects only the current owner plus the Legacy aggregate scope', () => {
    expect(
      projectNativeHomeCustomTokens({
        rawData,
        scopes: [
          {
            accountXpubOrAddress: 'current-address',
            networkId: 'evm--1',
          },
          {
            accountXpubOrAddress: 'indexed-1',
            networkId: 'aggregate--0',
          },
        ],
      }).map((token) => token.$key),
    ).toEqual(['current-token', 'aggregate-token']);
  });

  it('deduplicates a token referenced by multiple current-owner scopes', () => {
    expect(
      projectNativeHomeCustomTokens({
        rawData: {
          ...rawData,
          customMap: {
            ...rawData.customMap,
            'evm--2__account:current-address': {
              current: currentToken.symbol,
            },
          },
        },
        scopes: [
          {
            accountXpubOrAddress: 'current-address',
            networkId: 'evm--1',
          },
          {
            accountXpubOrAddress: 'current-address',
            networkId: 'evm--2',
          },
        ],
      }).map((token) => token.$key),
    ).toEqual(['current-token']);
  });

  it('drops an old scope after token fetch but before projection resolves', async () => {
    let resolveOldProjection: (value: string[]) => void = () => undefined;
    const oldProjectionTask = new Promise<string[]>((resolve) => {
      resolveOldProjection = resolve;
    });
    let currentGeneration = 1;
    const commit = jest.fn();
    const commitTask = commitNativeHomeSnapshotAfterProjection({
      commit,
      getCurrentGeneration: () => currentGeneration,
      generation: 1,
      projectionTask: oldProjectionTask,
      snapshot: ['old-scope-token'],
    });

    currentGeneration = 2;
    resolveOldProjection(['old-scope-custom-token']);

    await expect(commitTask).resolves.toBe(false);
    expect(commit).not.toHaveBeenCalled();
  });
});
