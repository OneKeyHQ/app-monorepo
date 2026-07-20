import { projectHomeCapabilitySet } from '../capabilities/homeCapabilityMatrix';

import type { IHomeCapabilityContext } from '../capabilities/homeCapabilityTypes';

function context(
  networkFamily: IHomeCapabilityContext['networkFamily'],
  overrides: Partial<IHomeCapabilityContext> = {},
): IHomeCapabilityContext {
  return {
    accountType: 'hd',
    allNetworks: networkFamily === 'allNetworks',
    networkFamily,
    perpsDestination: 'inline',
    productAvailability: {
      defi: 'available',
      history: 'available',
      market: 'available',
      nft: 'available',
      perps: 'available',
    },
    serverConfig: {
      defi: 'available',
      history: 'available',
      market: 'available',
      nft: 'available',
      perps: 'available',
    },
    ...overrides,
  };
}

describe('homeCapabilityMatrix', () => {
  it.each(['allNetworks', 'btc', 'evm', 'sol', 'ton', 'tron'] as const)(
    'projects only explicit evidence for %s',
    (networkFamily) => {
      expect(projectHomeCapabilitySet(context(networkFamily)).tabs).toEqual([
        'portfolio',
        'perps',
        'defi',
        'nft',
        'history',
      ]);
    },
  );

  it('applies server kill switches and preserves typed Perps destinations', () => {
    const web = projectHomeCapabilitySet(
      context('evm', {
        perpsDestination: 'web',
        serverConfig: {
          defi: 'available',
          history: 'available',
          market: 'available',
          nft: 'unavailable',
          perps: 'available',
        },
      }),
    );
    expect(web.perpsDestination).toBe('web');
    expect(web.destinations.perps).toBe('web');
    expect(web.sections.perps).toBe(false);
    expect(web.tabs).not.toContain('nft');
  });

  it('keeps unrelated tabs ready while only Perps config is unknown', () => {
    expect(
      projectHomeCapabilitySet(
        context('evm', {
          perpsDestination: 'unavailable',
          serverConfig: {
            defi: 'available',
            history: 'available',
            market: 'available',
            nft: 'available',
            perps: 'unknown',
          },
        }),
      ).tabs,
    ).toEqual(['portfolio', 'defi', 'nft', 'history']);
  });
});
