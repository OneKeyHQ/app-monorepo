import { listEvmChains, resolveChain } from '../core/chain-resolver';

describe('chain-resolver', () => {
  describe('resolveChain', () => {
    it('resolves "eth" to Ethereum config', () => {
      const config = resolveChain('eth');
      expect(config.networkId).toBe('evm--1');
      expect(config.impl).toBe('evm');
      expect(config.chainId).toBe('1');
      expect(config.nativeDecimals).toBe(18);
      expect(config.feeDecimals).toBe(9);
      expect(config.feeSymbol).toBe('Gwei');
      expect(config.nativeSymbol).toBe('ETH');
    });

    it('resolves "bsc" to BNB Chain config', () => {
      const config = resolveChain('bsc');
      expect(config.networkId).toBe('evm--56');
      expect(config.nativeSymbol).toBe('BNB');
    });

    it('resolves "avalanche" (new chain not in old CHAINS)', () => {
      const config = resolveChain('avalanche');
      expect(config.networkId).toBe('evm--43114');
      expect(config.nativeSymbol).toBe('AVAX');
    });

    it('resolves legacy alias "ethereum" to "eth"', () => {
      const config = resolveChain('ethereum');
      expect(config.networkId).toBe('evm--1');
    });

    it('resolves "avax" alias to avalanche', () => {
      const config = resolveChain('avax');
      expect(config.networkId).toBe('evm--43114');
    });

    it('throws for unknown chain with fuzzy suggestion', () => {
      expect(() => resolveChain('opti')).toThrow(/did you mean.*optimism/i);
    });

    it('throws for non-EVM chain', () => {
      expect(() => resolveChain('btc')).toThrow(/unsupported/i);
    });

    it('is case-insensitive', () => {
      const config = resolveChain('ETH');
      expect(config.networkId).toBe('evm--1');
    });
  });

  describe('listEvmChains', () => {
    it('returns only EVM chains', () => {
      const chains = listEvmChains();
      expect(chains.length).toBeGreaterThan(7);
      chains.forEach((c) => expect(c.impl).toBe('evm'));
    });

    it('does not include non-EVM chains like btc', () => {
      const chains = listEvmChains();
      const networkIds = chains.map((c) => c.networkId);
      expect(networkIds).not.toContain('btc--0');
    });
  });
});
