import { wcPayChainIdToNetworkId } from './payConstant';

describe('wcPayChainIdToNetworkId', () => {
  it('maps whitelisted eip155 references', () => {
    expect(wcPayChainIdToNetworkId('eip155:1')).toBe('evm--1');
    expect(wcPayChainIdToNetworkId('eip155:8453')).toBe('evm--8453');
  });

  it('maps the whitelisted solana reference', () => {
    expect(
      wcPayChainIdToNetworkId('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'),
    ).toBe('sol--101');
  });

  it('rejects non-whitelisted references', () => {
    expect(wcPayChainIdToNetworkId('eip155:2')).toBeNull();
    expect(
      wcPayChainIdToNetworkId('solana:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ'),
    ).toBeNull();
    expect(wcPayChainIdToNetworkId('cosmos:cosmoshub-4')).toBeNull();
  });

  it('rejects trailing segments on an otherwise valid id', () => {
    expect(wcPayChainIdToNetworkId('eip155:1:extra')).toBeNull();
    expect(wcPayChainIdToNetworkId('eip155:1:')).toBeNull();
    expect(
      wcPayChainIdToNetworkId('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:x'),
    ).toBeNull();
  });

  it('rejects malformed shapes', () => {
    expect(wcPayChainIdToNetworkId('')).toBeNull();
    expect(wcPayChainIdToNetworkId('eip155')).toBeNull();
    expect(wcPayChainIdToNetworkId('eip155:')).toBeNull();
    expect(wcPayChainIdToNetworkId(':1')).toBeNull();
    expect(wcPayChainIdToNetworkId(':')).toBeNull();
  });
});
