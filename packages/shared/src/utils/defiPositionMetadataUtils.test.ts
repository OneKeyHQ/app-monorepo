import { normalizeDeFiPositionMetadata } from './defiPositionMetadataUtils';

import type { IDeFiPosition } from '../../types/defi';

function makePosition(overrides: Partial<IDeFiPosition> = {}): IDeFiPosition {
  return {
    networkId: 'evm--1',
    owner: '0xowner',
    protocol: 'uniswap-v3',
    protocolName: 'Uniswap V3',
    chain: 'ethereum',
    category: 'liquidity',
    assets: [],
    debts: [],
    rewards: [],
    metrics: {
      healthFactor: null,
    },
    source: {
      provider: 'debank',
      fetchedAt: '2026-06-03T00:00:00.000Z',
      ttl: 60_000,
      cached: false,
    },
    groupId: '0x1111111111111111111111111111111111111111#123',
    name: 'Uniswap Position',
    ...overrides,
  };
}

describe('normalizeDeFiPositionMetadata', () => {
  it('extracts tokenId from pool-position groupId without deriving pool contract metadata', () => {
    const position = normalizeDeFiPositionMetadata(makePosition());

    expect(position.tokenId).toBe('123');
    expect(position.contracts?.pool).toBeUndefined();
    expect(position.contracts?.poolAddress).toBeUndefined();
  });

  it('preserves explicit pool contract metadata', () => {
    const position = normalizeDeFiPositionMetadata(
      makePosition({
        contracts: {
          pool: '0x2222222222222222222222222222222222222222',
        },
      }),
    );

    expect(position.tokenId).toBe('123');
    expect(position.contracts?.pool).toBe(
      '0x2222222222222222222222222222222222222222',
    );
  });
});
