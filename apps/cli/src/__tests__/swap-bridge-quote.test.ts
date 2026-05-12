import { getProtocolConfig } from '../commands/swap/swap-protocol-config';

describe('bridge quote protocol selection', () => {
  it('selects Bridge protocol when chains differ', () => {
    const config = getProtocolConfig('evm--1', 'evm--42161');
    expect(config.protocol).toBe('Bridge');
  });

  it('selects Swap protocol when chains are same', () => {
    const config = getProtocolConfig('evm--1', 'evm--1');
    expect(config.protocol).toBe('Swap');
  });
});

describe('cross-chain network validation', () => {
  const makeNetwork = (networkId: string, crossChain: boolean) => ({
    networkId,
    name: networkId,
    chainId: '1',
    nativeSymbol: 'ETH',
    supportSingleSwap: true,
    supportCrossChainSwap: crossChain,
    supportLimit: false,
  });

  function validateBridgeNetworks(
    fromNetworkId: string,
    toNetworkId: string,
    networks: { networkId: string; supportCrossChainSwap: boolean }[],
  ): string | null {
    if (fromNetworkId === toNetworkId) return null;
    const fromNet = networks.find((n) => n.networkId === fromNetworkId);
    const toNet = networks.find((n) => n.networkId === toNetworkId);
    if (!fromNet?.supportCrossChainSwap)
      return `Network ${fromNetworkId} does not support cross-chain bridge`;
    if (!toNet?.supportCrossChainSwap)
      return `Network ${toNetworkId} does not support cross-chain bridge`;
    return null;
  }

  it('rejects when source chain does not support cross-chain swap', () => {
    const networks = [
      makeNetwork('evm--1', false),
      makeNetwork('evm--42161', true),
    ];
    expect(validateBridgeNetworks('evm--1', 'evm--42161', networks)).toContain(
      'evm--1',
    );
  });

  it('rejects when dest chain does not support cross-chain swap', () => {
    const networks = [
      makeNetwork('evm--1', true),
      makeNetwork('evm--42161', false),
    ];
    expect(validateBridgeNetworks('evm--1', 'evm--42161', networks)).toContain(
      'evm--42161',
    );
  });

  it('accepts when both chains support cross-chain swap', () => {
    const networks = [
      makeNetwork('evm--1', true),
      makeNetwork('evm--42161', true),
    ];
    expect(validateBridgeNetworks('evm--1', 'evm--42161', networks)).toBeNull();
  });
});
