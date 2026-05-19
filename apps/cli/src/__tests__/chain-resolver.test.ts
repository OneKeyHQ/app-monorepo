import {
  assertChainCapability,
  listEvmChains,
  resolveChain,
} from '../core/chain-resolver';

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

    it('throws for an unsupported chain (e.g., near is not in CLI_SUPPORTED_IMPLS)', () => {
      expect(() => resolveChain('near')).toThrow(/unsupported/i);
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

  describe('BTC/TBTC CLI support', () => {
    it('resolves btc to Bitcoin mainnet config', () => {
      const config = resolveChain('btc');
      expect(config.networkId).toBe('btc--0');
      expect(config.impl).toBe('btc');
      expect(config.nativeDecimals).toBe(8);
      expect(config.nativeSymbol).toBe('BTC');
    });

    it('resolves tbtc to Bitcoin testnet config', () => {
      const config = resolveChain('tbtc');
      expect(config.networkId).toBe('tbtc--0');
      expect(config.impl).toBe('tbtc');
      expect(config.nativeDecimals).toBe(8);
      expect(config.nativeSymbol).toBe('TBTC');
    });

    it('assigns btcTransfer capability to btc and tbtc only', () => {
      const btc = resolveChain('btc');
      const tbtc = resolveChain('tbtc');
      const eth = resolveChain('eth');

      expect(btc.capabilities.has('btcTransfer')).toBe(true);
      expect(tbtc.capabilities.has('btcTransfer')).toBe(true);
      expect(eth.capabilities.has('btcTransfer')).toBe(false);
      expect(() =>
        assertChainCapability(btc, 'btcTransfer', 'transfer'),
      ).not.toThrow();
      expect(() =>
        assertChainCapability(tbtc, 'btcTransfer', 'transfer'),
      ).not.toThrow();
    });

    it('assigns swap capability to btc mainnet only', () => {
      const btc = resolveChain('btc');
      const tbtc = resolveChain('tbtc');

      expect(btc.capabilities.has('swap')).toBe(true);
      expect(tbtc.capabilities.has('swap')).toBe(false);
      expect(() =>
        assertChainCapability(btc, 'swap', 'swap quote'),
      ).not.toThrow();
      expect(() => assertChainCapability(tbtc, 'swap', 'swap quote')).toThrow(
        /does not support chain "tbtc"/i,
      );
    });

    it('keeps btc and tbtc out of evm-only capabilities', () => {
      for (const chain of [resolveChain('btc'), resolveChain('tbtc')]) {
        expect(chain.capabilities.has('evmTransfer')).toBe(false);
        expect(chain.capabilities.has('evmTokenMarket')).toBe(false);
        expect(chain.capabilities.has('evmSecurity')).toBe(false);
      }
    });
  });

  describe('SOL CLI support', () => {
    it('resolves sol to Solana mainnet config', () => {
      const config = resolveChain('sol');
      expect(config.networkId).toBe('sol--101');
      expect(config.impl).toBe('sol');
      expect(config.chainId).toBe('101');
      expect(config.nativeDecimals).toBe(9);
      expect(config.nativeSymbol).toBe('SOL');
      expect(config.feeSymbol).toBe('SOL');
    });

    it('exposes accountRead/historyRead/solTransfer/signMessage/swap capabilities', () => {
      const sol = resolveChain('sol');
      expect(sol.capabilities.has('accountRead')).toBe(true);
      expect(sol.capabilities.has('historyRead')).toBe(true);
      expect(sol.capabilities.has('solTransfer')).toBe(true);
      expect(sol.capabilities.has('signMessage')).toBe(true);
      expect(sol.capabilities.has('swap')).toBe(true);
    });

    it('does NOT expose EVM- or BTC-only capabilities', () => {
      const sol = resolveChain('sol');
      expect(sol.capabilities.has('evmTransfer')).toBe(false);
      expect(sol.capabilities.has('evmTokenMarket')).toBe(false);
      expect(sol.capabilities.has('evmSecurity')).toBe(false);
      expect(sol.capabilities.has('btcTransfer')).toBe(false);
    });

    it('keeps sol out of listEvmChains()', () => {
      const networkIds = listEvmChains().map((c) => c.networkId);
      expect(networkIds).not.toContain('sol--101');
    });
  });
});
