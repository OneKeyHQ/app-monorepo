import { buildSwapProPositionsNetworkIdsKey } from './swapProPositionsKeyUtils';

describe('swapProPositionsKeyUtils', () => {
  it('builds deterministic position owner network keys', () => {
    expect(
      buildSwapProPositionsNetworkIdsKey([
        'z-network',
        'evm--56',
        'A-network',
        'evm--1',
        'evm--56',
        '',
      ]),
    ).toBe('A-network,evm--1,evm--56,z-network');
  });
});
