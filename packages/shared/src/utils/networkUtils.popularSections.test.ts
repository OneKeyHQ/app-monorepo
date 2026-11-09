import {
  POPULAR_NETWORK_IDS,
  buildPopularFirstNetworkSections,
} from './networkUtils';

import type { IServerNetwork } from '../../types';

function network(id: string, name: string): IServerNetwork {
  return { id, name } as IServerNetwork;
}

const NETWORKS = [
  network('evm--43114', 'Avalanche'),
  network('aptos--1', 'Aptos'),
  network('evm--1', 'Ethereum'),
  network('btc--0', 'Bitcoin'),
  network('tron--0x2b6653dc', 'Tron'),
  network('evm--56', 'BNB Chain'),
  network('evm--42161', 'Arbitrum'),
  network('sui--mainnet', 'Sui'),
  network('evm--8453', 'Base'),
  network('zcash--0', 'zcash'),
];

describe('buildPopularFirstNetworkSections', () => {
  it('puts the popular block first in fixed order and skips missing ids', () => {
    const sections = buildPopularFirstNetworkSections({
      networks: NETWORKS,
      popularTitle: 'Popular',
    });
    expect(sections[0].title).toBe('Popular');
    expect(sections[0].data.map((n) => n.id)).toEqual([
      'tron--0x2b6653dc',
      'btc--0',
      'evm--1',
      'evm--56',
      'evm--42161',
      'evm--8453',
    ]);
  });

  it('groups the rest by upper-cased first letter without repeating popular networks', () => {
    const sections = buildPopularFirstNetworkSections({ networks: NETWORKS });
    const letters = sections.slice(1);
    expect(letters.map((s) => s.title)).toEqual(['A', 'S', 'Z']);
    expect(letters[0].data.map((n) => n.name)).toEqual(['Avalanche', 'Aptos']);
    expect(letters[2].data.map((n) => n.name)).toEqual(['zcash']);
    const ids = letters.flatMap((s) => s.data.map((n) => n.id));
    POPULAR_NETWORK_IDS.forEach((id) => expect(ids).not.toContain(id));
  });

  it('omits the popular block when none of its networks is available', () => {
    expect(
      buildPopularFirstNetworkSections({
        networks: [network('sui--mainnet', 'Sui')],
        popularTitle: 'Popular',
      }),
    ).toEqual([{ title: 'S', data: [network('sui--mainnet', 'Sui')] }]);
  });

  it('accepts a custom popular list', () => {
    const sections = buildPopularFirstNetworkSections({
      networks: NETWORKS,
      popularNetworkIds: ['sui--mainnet', 'evm--1'],
    });
    expect(sections[0].data.map((n) => n.id)).toEqual([
      'sui--mainnet',
      'evm--1',
    ]);
  });
});
