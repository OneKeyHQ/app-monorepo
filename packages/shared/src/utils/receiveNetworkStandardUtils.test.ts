import {
  getReceiveNetworkDisplayName,
  resolveReceiveNetworkStandard,
} from './receiveNetworkStandardUtils';

describe('resolveReceiveNetworkStandard', () => {
  it('resolves bundled standards for the launch set', () => {
    expect(resolveReceiveNetworkStandard({ networkId: 'evm--1' })).toBe(
      'ERC20',
    );
    expect(resolveReceiveNetworkStandard({ networkId: 'evm--56' })).toBe(
      'BEP20',
    );
    expect(
      resolveReceiveNetworkStandard({ networkId: 'tron--0x2b6653dc' }),
    ).toBe('TRC20');
  });

  it('does NOT generalize by impl — other EVM chains stay untagged', () => {
    expect(
      resolveReceiveNetworkStandard({ networkId: 'evm--137' }),
    ).toBeUndefined();
    expect(
      resolveReceiveNetworkStandard({ networkId: 'evm--42161' }),
    ).toBeUndefined();
    expect(
      resolveReceiveNetworkStandard({ networkId: 'btc--0' }),
    ).toBeUndefined();
    expect(
      resolveReceiveNetworkStandard({ networkId: 'sol--101' }),
    ).toBeUndefined();
  });

  it('hides for testnets, custom networks and missing networkId', () => {
    expect(
      resolveReceiveNetworkStandard({ networkId: 'evm--1', isTestnet: true }),
    ).toBeUndefined();
    expect(
      resolveReceiveNetworkStandard({
        networkId: 'evm--1',
        isCustomNetwork: true,
      }),
    ).toBeUndefined();
    expect(
      resolveReceiveNetworkStandard({ networkId: undefined }),
    ).toBeUndefined();
  });

  it('server override beats bundled defaults', () => {
    expect(
      resolveReceiveNetworkStandard({
        networkId: 'evm--1',
        override: { byNetworkId: { 'evm--1': 'ERC-20' } },
      }),
    ).toBe('ERC-20');
    // override can add networks not in the bundled map
    expect(
      resolveReceiveNetworkStandard({
        networkId: 'sol--101',
        override: { byNetworkId: { 'sol--101': 'SPL' } },
      }),
    ).toBe('SPL');
  });

  it('empty-string override force-hides; malformed override falls through', () => {
    expect(
      resolveReceiveNetworkStandard({
        networkId: 'evm--1',
        override: { byNetworkId: { 'evm--1': '' } },
      }),
    ).toBeUndefined();
    expect(
      resolveReceiveNetworkStandard({
        networkId: 'evm--1',
        override: { byNetworkId: { 'evm--1': '  ' } },
      }),
    ).toBeUndefined();
    expect(
      resolveReceiveNetworkStandard({
        networkId: 'evm--1',
        override: { byNetworkId: { 'evm--1': 123 as unknown as string } },
      }),
    ).toBe('ERC20');
  });
});

describe('getReceiveNetworkDisplayName', () => {
  it('appends the standard tag when available', () => {
    expect(
      getReceiveNetworkDisplayName({
        networkName: 'Ethereum',
        networkId: 'evm--1',
      }),
    ).toBe('Ethereum (ERC20)');
    expect(
      getReceiveNetworkDisplayName({
        networkName: 'Tron',
        networkId: 'tron--0x2b6653dc',
      }),
    ).toBe('Tron (TRC20)');
  });

  it('returns the plain network name when no standard applies', () => {
    expect(
      getReceiveNetworkDisplayName({
        networkName: 'Bitcoin',
        networkId: 'btc--0',
      }),
    ).toBe('Bitcoin');
    expect(
      getReceiveNetworkDisplayName({
        networkName: 'Polygon',
        networkId: 'evm--137',
      }),
    ).toBe('Polygon');
  });

  it('returns empty string without a network name', () => {
    expect(
      getReceiveNetworkDisplayName({
        networkName: undefined,
        networkId: 'evm--1',
      }),
    ).toBe('');
  });
});
