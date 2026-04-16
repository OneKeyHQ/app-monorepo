import defiUtils from './defiUtils';

import type { IDeFiPosition, IProtocolSummary } from '../../types/defi';

function createDeFiPosition(
  overrides: Partial<IDeFiPosition> = {},
): IDeFiPosition {
  return {
    networkId: 'evm--1',
    owner: '0xowner',
    protocol: 'aave',
    protocolName: 'Aave',
    chain: 'ethereum',
    category: 'lending',
    assets: [
      {
        symbol: 'ETH',
        address: '0xeth',
        amount: '1',
        value: 100,
        price: 100,
        category: 'deposit',
        meta: {
          decimals: 18,
          isVerified: true,
        },
      },
    ],
    debts: [],
    rewards: [],
    metrics: {
      healthFactor: null,
    },
    source: {
      provider: 'zerion',
      fetchedAt: '2026-04-16T00:00:00.000Z',
      ttl: 60,
      cached: false,
    },
    groupId: 'group-1',
    name: 'Main Pool',
    ...overrides,
  };
}

function createProtocolSummary(
  overrides: Partial<IProtocolSummary> = {},
): IProtocolSummary {
  return {
    protocol: 'aave',
    protocolName: 'Aave',
    totalValue: 100,
    totalDebt: 0,
    totalReward: 0,
    netWorth: 100,
    networkIds: ['evm--1'],
    positionCount: 1,
    positionIndices: [],
    protocolLogo: 'https://example.com/aave.png',
    protocolUrl: 'https://app.aave.com',
    ...overrides,
  };
}

describe('transformDeFiData', () => {
  test('preserves assets with the same token but different protocol types', () => {
    const { protocols } = defiUtils.transformDeFiData({
      positions: {
        'evm--1': [
          createDeFiPosition(),
          createDeFiPosition({
            assets: [
              {
                symbol: 'ETH',
                address: '0xeth',
                amount: '2',
                value: 200,
                price: 100,
                category: 'locked',
                meta: {
                  decimals: 18,
                  isVerified: true,
                },
              },
            ],
          }),
        ],
      },
      protocolSummaries: [
        createProtocolSummary({ totalValue: 300, netWorth: 300 }),
      ],
    });

    expect(protocols[0].positions[0].assets).toHaveLength(2);
    expect(
      protocols[0].positions[0].assets.map((asset) => asset.category),
    ).toEqual(['locked', 'deposit']);
  });

  test('splits mixed module categories into separate positions while preserving group id', () => {
    const { protocols } = defiUtils.transformDeFiData({
      positions: {
        'evm--1': [
          createDeFiPosition({
            category: 'farming',
            assets: [],
            rewards: [
              {
                symbol: 'AAVE',
                address: '0xaave',
                amount: '1',
                value: 10,
                price: 10,
                category: 'reward',
                meta: {
                  decimals: 18,
                  isVerified: true,
                },
              },
            ],
          }),
          createDeFiPosition({
            category: 'staked',
            assets: [],
            rewards: [
              {
                symbol: 'stkAAVE',
                address: '0xstkaave',
                amount: '2',
                value: 20,
                price: 10,
                category: 'reward',
                meta: {
                  decimals: 18,
                  isVerified: true,
                },
              },
            ],
          }),
        ],
      },
      protocolSummaries: [
        createProtocolSummary({ totalReward: 30, netWorth: 30 }),
      ],
    });

    expect(protocols[0].positions).toHaveLength(2);
    expect(protocols[0].positions.map((position) => position.groupId)).toEqual([
      'group-1',
      'group-1',
    ]);
    expect(protocols[0].positions.map((position) => position.category)).toEqual(
      ['staked', 'farming'],
    );
    expect(
      protocols[0].positions.map((position) => position.categories),
    ).toEqual([['staked'], ['farming']]);
  });
});
