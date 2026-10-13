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
  > &
    Partial<Pick<IDeFiPosition, 'protocol' | 'protocolName'>>,
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

  it('builds protocol summary fallback from positions when protocolSummaries is missing', () => {
    const result = defiUtils.transformDeFiData({
      positions: {
        'evm--1': [
          makePosition({
            protocol: 'lido',
            protocolName: 'Lido',
            category: 'staking',
            groupId: 'lido-steth',
            name: 'Lido stETH',
            assets: [
              makeAsset({
                symbol: 'stETH',
                address: '0xsteth',
                value: 120,
                category: 'deposit',
              }),
            ],
            debts: [],
            rewards: [
              makeAsset({
                symbol: 'ETH',
                address: '0xeth',
                value: 3,
                category: 'rewards',
              }),
            ],
          }),
        ],
      },
      protocolSummaries: [],
    });

    const summary = result.protocolMap['evm--1-lido'];
    expect(summary).toMatchObject({
      protocol: 'lido',
      protocolName: 'Lido',
      totalValue: 120,
      totalDebt: 0,
      totalReward: 3,
      netWorth: 123,
    });
  });

  it('preserves account identity on transformed protocols', () => {
    const result = defiUtils.transformDeFiData({
      accountId: 'evm-account-1',
      indexedAccountId: 'indexed-account-1',
      positions: {
        'evm--1': [
          makePosition({
            protocol: 'aave-v3',
            protocolName: 'Aave V3',
            category: 'lending',
            groupId: 'aave-usde',
            name: 'Aave USDe',
            assets: [
              makeAsset({
                symbol: 'USDe',
                address: '0xusde',
                value: 10,
                category: 'deposit',
              }),
            ],
            debts: [],
            rewards: [],
          }),
        ],
      },
      protocolSummaries: [],
    });

    expect(result.protocols[0]).toMatchObject({
      accountId: 'evm-account-1',
      indexedAccountId: 'indexed-account-1',
    });
  });
});

describe('defiUtils.transformDeFiData fallback summary', () => {
  it('carries protocol logo and url from positions into the fallback summary', () => {
    const position: IDeFiPosition = {
      ...makePosition({
        category: 'lending',
        groupId: 'aave-group',
        name: 'Aave V3',
        assets: [
          makeAsset({
            symbol: 'USDC',
            address: '0xusdc',
            value: 10,
            category: 'supplied',
          }),
        ],
        debts: [],
        rewards: [],
        protocol: 'aave-v3',
        protocolName: 'Aave V3',
      }),
      protocolLogo: 'https://logo/aave.png',
      protocolUrl: 'https://aave.com',
    };

    const { protocolMap } = defiUtils.transformDeFiData({
      positions: { 'evm--1': [position] },
      protocolSummaries: [],
    });

    expect(protocolMap['evm--1-aave-v3']).toMatchObject({
      protocolName: 'Aave V3',
      protocolLogo: 'https://logo/aave.png',
      protocolUrl: 'https://aave.com',
      netWorth: 10,
    });
  });

  it('drops a non-HTTP(S) protocol url from the fallback summary', () => {
    const position: IDeFiPosition = {
      ...makePosition({
        category: 'lending',
        groupId: 'aave-group',
        name: 'Aave V3',
        assets: [
          makeAsset({
            symbol: 'USDC',
            address: '0xusdc',
            value: 10,
            category: 'supplied',
          }),
        ],
        debts: [],
        rewards: [],
        protocol: 'aave-v3',
        protocolName: 'Aave V3',
      }),
      protocolLogo: 'https://logo/aave.png',
      // eslint-disable-next-line no-script-url
      protocolUrl: 'javascript:alert(1)',
    };

    const { protocolMap } = defiUtils.transformDeFiData({
      positions: { 'evm--1': [position] },
      protocolSummaries: [],
    });

    expect(protocolMap['evm--1-aave-v3']).toMatchObject({
      protocolLogo: 'https://logo/aave.png',
      protocolUrl: '',
    });
  });

  it('drops a non-HTTP(S) protocol url from a server protocol summary', () => {
    const summary: IProtocolSummary = {
      protocol: 'aave-v3',
      protocolName: 'Aave V3',
      totalValue: 10,
      totalDebt: 0,
      totalReward: 0,
      netWorth: 10,
      networkIds: ['evm--1'],
      positionCount: 1,
      positionIndices: [],
      protocolLogo: '',
      protocolUrl: 'onekey-wallet://open',
    };

    const { protocolMap } = defiUtils.transformDeFiData({
      positions: { 'evm--1': [] },
      protocolSummaries: [summary],
    });

    expect(protocolMap['evm--1-aave-v3']).toMatchObject({
      protocolName: 'Aave V3',
      netWorth: 10,
      protocolUrl: '',
    });
  });

  it('keeps http and https protocol urls', () => {
    const summaries: IProtocolSummary[] = [
      'http://aave.com',
      'https://aave.com/',
    ].map((protocolUrl, index) => ({
      protocol: `aave-${index}`,
      protocolName: 'Aave',
      totalValue: 0,
      totalDebt: 0,
      totalReward: 0,
      netWorth: 0,
      networkIds: ['evm--1'],
      positionCount: 0,
      positionIndices: [],
      protocolLogo: '',
      protocolUrl,
    }));

    const { protocolMap } = defiUtils.transformDeFiData({
      positions: { 'evm--1': [] },
      protocolSummaries: summaries,
    });

    expect(protocolMap['evm--1-aave-0'].protocolUrl).toBe('http://aave.com');
    expect(protocolMap['evm--1-aave-1'].protocolUrl).toBe('https://aave.com/');
  });
});

describe('defiUtils.splitDeFiPositionsByNetwork', () => {
  function makeNetworkPosition({
    networkId,
    chain,
    protocol,
    groupId,
    value,
    reward = 0,
    debt = 0,
  }: {
    networkId: string;
    chain: string;
    protocol: string;
    groupId: string;
    value: number;
    reward?: number;
    debt?: number;
  }): IDeFiPosition {
    return {
      ...makePosition({
        category: 'lending',
        groupId,
        name: `${protocol} ${groupId}`,
        assets: [
          makeAsset({
            symbol: 'A',
            address: '0xa',
            value,
            category: 'supplied',
          }),
        ],
        debts: debt
          ? [
              makeAsset({
                symbol: 'D',
                address: '0xd',
                value: debt,
                category: 'borrowed',
              }),
            ]
          : [],
        rewards: reward
          ? [
              makeAsset({
                symbol: 'R',
                address: '0xr',
                value: reward,
                category: 'rewards',
              }),
            ]
          : [],
        protocol,
        protocolName: protocol,
      }),
      networkId,
      chain,
      protocolLogo: `https://logo/${protocol}.png`,
    };
  }

  const positions: Record<string, IDeFiPosition[]> = {
    'evm--1': [
      makeNetworkPosition({
        networkId: 'evm--1',
        chain: 'eth',
        protocol: 'aave-v3',
        groupId: 'g1',
        value: 100,
        debt: 20,
      }),
      makeNetworkPosition({
        networkId: 'evm--1',
        chain: 'eth',
        protocol: 'yearn2',
        groupId: 'g2',
        value: 5,
      }),
    ],
    'evm--8453': [
      makeNetworkPosition({
        networkId: 'evm--8453',
        chain: 'base',
        protocol: 'aave-v3',
        groupId: 'g3',
        value: 50,
        reward: 1,
      }),
    ],
  };

  it('derives one result per requested network from that network positions only', () => {
    const result = defiUtils.splitDeFiPositionsByNetwork({
      accountId: 'hd-1--1',
      networkIds: ['evm--1', 'evm--8453'],
      positions,
    });

    expect(result.map((r) => r.networkId)).toEqual(['evm--1', 'evm--8453']);
    expect(Object.keys(result[0].protocolMap).toSorted()).toEqual([
      'evm--1-aave-v3',
      'evm--1-yearn2',
    ]);
    expect(result[0].protocolMap['evm--1-aave-v3']).toMatchObject({
      netWorth: 80,
      networkIds: ['evm--1'],
      protocolLogo: 'https://logo/aave-v3.png',
    });
    expect(result[0].overview).toEqual({
      totalValue: 105,
      totalDebt: 20,
      totalReward: 0,
      netWorth: 85,
      chains: ['eth'],
      protocolCount: 2,
      positionCount: 2,
    });
    expect(Object.keys(result[1].protocolMap)).toEqual(['evm--8453-aave-v3']);
    expect(result[1].overview).toMatchObject({
      netWorth: 51,
      chains: ['base'],
      protocolCount: 1,
      positionCount: 1,
    });
    expect(result[0].protocols.every((p) => p.accountId === 'hd-1--1')).toBe(
      true,
    );
  });

  it('returns empty data for a network the backend did not return', () => {
    const [missing] = defiUtils.splitDeFiPositionsByNetwork({
      networkIds: ['evm--137'],
      positions,
    });

    expect(missing).toEqual({
      networkId: 'evm--137',
      protocols: [],
      protocolMap: {},
      overview: defiUtils.getEmptyDeFiData().overview,
    });
  });
});
