import { buildSymbolChangeMessage } from './buildSymbolChangeMessage';

/*
yarn jest packages/kit/src/components/TradingView/ChartWebView/buildSymbolChangeMessage.test.ts
*/

describe('buildSymbolChangeMessage', () => {
  it('always emits a SYMBOL_CHANGE message with force:false', () => {
    const msg = buildSymbolChangeMessage({ type: 'market', symbol: 'UNI' });
    expect(msg.type).toBe('SYMBOL_CHANGE');
    expect(msg.payload.force).toBe(false);
  });

  it('passes networkId / address / decimal through unchanged', () => {
    const msg = buildSymbolChangeMessage({
      type: 'market',
      symbol: 'UNI',
      networkId: 'evm--1',
      address: '0xabc',
      decimal: '6',
    });
    expect(msg.payload).toMatchObject({
      networkId: 'evm--1',
      address: '0xabc',
      decimal: '6',
    });
  });

  describe('source routing', () => {
    it('routes perps to the hyperliquid datafeed', () => {
      const msg = buildSymbolChangeMessage({ type: 'perps', symbol: 'BTC' });
      expect(msg.payload.source).toBe('hyperliquid');
    });

    it('routes a plain market token to the market datafeed', () => {
      const msg = buildSymbolChangeMessage({ type: 'market', symbol: 'UNI' });
      expect(msg.payload.source).toBe('market');
    });

    // The regression: an HL-backed market token (scene=market-hyperliquid) must
    // route to hyperliquid, not market. Looking only at type==='perps' sent BTC
    // to the OneKey market datafeed → dashes / zero volume.
    it('routes an HL-backed market token (scene) to hyperliquid', () => {
      const msg = buildSymbolChangeMessage({
        type: 'market',
        scene: 'market-hyperliquid',
        symbol: 'HL:BTC',
      });
      expect(msg.payload.source).toBe('hyperliquid');
    });

    it('treats an unrelated scene as a plain market token', () => {
      const msg = buildSymbolChangeMessage({
        type: 'market',
        scene: 'market',
        symbol: 'UNI',
      });
      expect(msg.payload.source).toBe('market');
    });
  });

  describe('HL: display-prefix handling', () => {
    it('strips the HL: prefix for hyperliquid so the datafeed gets the bare coin', () => {
      const msg = buildSymbolChangeMessage({
        type: 'market',
        scene: 'market-hyperliquid',
        symbol: 'HL:BTC',
      });
      expect(msg.payload.symbol).toBe('BTC');
    });

    it('keeps the prefixed label for display (displayPair/displayCoin)', () => {
      const msg = buildSymbolChangeMessage({
        type: 'market',
        scene: 'market-hyperliquid',
        symbol: 'HL:BTC',
      });
      expect(msg.payload.displayPair).toBe('HL:BTC');
      expect(msg.payload.displayCoin).toBe('HL:BTC');
    });

    it('leaves an HL-source symbol without the prefix untouched', () => {
      const msg = buildSymbolChangeMessage({
        type: 'market',
        scene: 'market-hyperliquid',
        symbol: 'BTC',
      });
      expect(msg.payload.symbol).toBe('BTC');
    });

    it('does NOT strip HL: from a non-hyperliquid market symbol', () => {
      const msg = buildSymbolChangeMessage({
        type: 'market',
        symbol: 'HL:FOO',
      });
      expect(msg.payload.source).toBe('market');
      expect(msg.payload.symbol).toBe('HL:FOO');
    });

    it('strips the prefix for perps symbols too (idempotent)', () => {
      const msg = buildSymbolChangeMessage({ type: 'perps', symbol: 'HL:ETH' });
      expect(msg.payload.source).toBe('hyperliquid');
      expect(msg.payload.symbol).toBe('ETH');
    });
  });

  describe('missing symbol', () => {
    it('defaults symbol to an empty string when absent', () => {
      const msg = buildSymbolChangeMessage({ type: 'market' });
      expect(msg.payload.symbol).toBe('');
    });

    it('does not invent a display label when symbol is absent', () => {
      const msg = buildSymbolChangeMessage({ type: 'market' });
      expect(msg.payload.displayPair).toBeUndefined();
      expect(msg.payload.displayCoin).toBeUndefined();
    });
  });
});
