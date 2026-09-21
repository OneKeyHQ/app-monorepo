import {
  buildDeFiListOwnerKey,
  mergeDeFiPositionResults,
  sortDeFiProtocolsByNetWorth,
} from './deFiListDataUtils';

import type { IDeFiPositionResult } from './deFiListDataUtils';

function createResult(
  networkId: string,
  totalValue: number,
  protocol: string,
): IDeFiPositionResult {
  return {
    overview: {
      totalValue,
      totalDebt: 1,
      totalReward: 2,
      netWorth: totalValue - 1,
      chains: [networkId],
      protocolCount: 1,
      positionCount: 1,
    },
    protocols: [
      { networkId, protocol } as IDeFiPositionResult['protocols'][number],
    ],
    protocolMap: {
      [`${networkId}-${protocol}`]: {
        totalValue,
        totalDebt: 1,
        totalReward: 2,
        netWorth: totalValue - 1,
      } as IDeFiPositionResult['protocolMap'][string],
    },
  };
}

describe('deFiListDataUtils', () => {
  it('merges all-network results into one authoritative snapshot', () => {
    const merged = mergeDeFiPositionResults([
      createResult('evm--1', 10, 'aave'),
      createResult('evm--56', 20, 'morpho'),
    ]);

    expect(merged.overview).toMatchObject({
      totalValue: 30,
      totalDebt: 2,
      totalReward: 4,
      netWorth: 28,
      chains: ['evm--1', 'evm--56'],
      protocolCount: 2,
      positionCount: 2,
    });
    expect(merged.protocols).toHaveLength(2);
    expect(Object.keys(merged.protocolMap)).toEqual([
      'evm--1-aave',
      'evm--56-morpho',
    ]);
  });

  it('sorts protocols by the published protocol map net worth', () => {
    const low = createResult('evm--1', 10, 'aave');
    const high = createResult('evm--56', 20, 'morpho');
    expect(
      sortDeFiProtocolsByNetWorth({
        protocols: [...low.protocols, ...high.protocols],
        protocolMap: { ...low.protocolMap, ...high.protocolMap },
      }).map((protocol) => protocol.protocol),
    ).toEqual(['morpho', 'aave']);
  });

  it('builds an owner key only when both identity parts exist', () => {
    expect(
      buildDeFiListOwnerKey({ accountId: 'account-1', networkId: 'evm--1' }),
    ).toBe('account-1:evm--1');
    expect(buildDeFiListOwnerKey({ accountId: 'account-1' })).toBeUndefined();
  });
});
