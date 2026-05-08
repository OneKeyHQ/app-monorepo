import defiUtils from './defiUtils';

import type {
  IDeFiAsset,
  IDeFiPosition,
  IProtocolSummary,
} from '../../types/defi';

function makeAsset(
  overrides: Pick<IDeFiAsset, 'symbol' | 'address' | 'value' | 'category'>,
): IDeFiAsset {
  return {
    amount: String(overrides.value),
    price: 1,
    meta: {
      decimals: 18,
      isVerified: true,
    },
    ...overrides,
  };
}

function makePosition(
  overrides: Pick<
    IDeFiPosition,
    'category' | 'groupId' | 'name' | 'assets' | 'debts' | 'rewards'
  >,
): IDeFiPosition {
  return {
    networkId: 'evm--1',
    owner: '0xC693B4FFB338579467a541b2bF267B1955870920',
    protocol: 'pendle',
    protocolName: 'Pendle',
    chain: 'ethereum',
    metrics: {
      healthFactor: null,
    },
    source: {
      provider: 'zerion',
      fetchedAt: '2026-05-07T00:00:00.000Z',
      ttl: 60_000,
      cached: false,
    },
    ...overrides,
  };
}

describe('defiUtils.transformDeFiData', () => {
  it('combines supplied assets and rewards with the same groupId into one position', () => {
    const groupId = 'pendle-lp-position';
    const protocolSummary: IProtocolSummary = {
      protocol: 'pendle',
      protocolName: 'Pendle',
      totalValue: 105,
      totalDebt: 0,
      totalReward: 5,
      netWorth: 105,
      networkIds: ['evm--1'],
      positionCount: 2,
      positionIndices: [],
      protocolLogo: '',
      protocolUrl: '',
    };

    const result = defiUtils.transformDeFiData({
      positions: {
        'evm--1': [
          makePosition({
            category: 'liquidity_pool',
            groupId,
            name: 'Pendle LP',
            assets: [
              makeAsset({
                symbol: 'PENDLE-LP',
                address: '0xlp',
                value: 100,
                category: 'liquidity_pool',
              }),
            ],
            debts: [],
            rewards: [],
          }),
          makePosition({
            category: 'rewards',
            groupId,
            name: 'Pendle LP Rewards',
            assets: [],
            debts: [],
            rewards: [
              makeAsset({
                symbol: 'PENDLE',
                address: '0xreward',
                value: 5,
                category: 'rewards',
              }),
            ],
          }),
        ],
      },
      protocolSummaries: [protocolSummary],
    });

    expect(result.protocols).toHaveLength(1);
    expect(result.protocols[0].positions).toHaveLength(1);
    expect(result.protocols[0].positions[0]).toMatchObject({
      groupId,
      value: '105',
    });
    expect(result.protocols[0].positions[0].assets).toHaveLength(1);
    expect(result.protocols[0].positions[0].rewards).toHaveLength(1);
  });

  it('keeps the supplied position metadata when rewards arrive first', () => {
    const groupId = 'pendle-lp-position';
    const protocolSummary: IProtocolSummary = {
      protocol: 'pendle',
      protocolName: 'Pendle',
      totalValue: 105,
      totalDebt: 0,
      totalReward: 5,
      netWorth: 105,
      networkIds: ['evm--1'],
      positionCount: 2,
      positionIndices: [],
      protocolLogo: '',
      protocolUrl: '',
    };

    const result = defiUtils.transformDeFiData({
      positions: {
        'evm--1': [
          makePosition({
            category: 'rewards',
            groupId,
            name: 'Pendle LP Rewards',
            assets: [],
            debts: [],
            rewards: [
              makeAsset({
                symbol: 'PENDLE',
                address: '0xreward',
                value: 5,
                category: 'rewards',
              }),
            ],
          }),
          makePosition({
            category: 'liquidity_pool',
            groupId,
            name: 'Pendle LP',
            assets: [
              makeAsset({
                symbol: 'PENDLE-LP',
                address: '0xlp',
                value: 100,
                category: 'liquidity_pool',
              }),
            ],
            debts: [],
            rewards: [],
          }),
        ],
      },
      protocolSummaries: [protocolSummary],
    });

    expect(result.protocols).toHaveLength(1);
    expect(result.protocols[0].positions).toHaveLength(1);
    expect(result.protocols[0].positions[0]).toMatchObject({
      groupId,
      poolName: 'Pendle LP',
      category: 'liquidity_pool',
      value: '105',
    });
    expect(result.protocols[0].positions[0].assets).toHaveLength(1);
    expect(result.protocols[0].positions[0].rewards).toHaveLength(1);
  });
});
