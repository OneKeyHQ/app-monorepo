import { isSymbolSwitchAck, unwrapChartMessage } from './chartSwitchAck';

/*
yarn jest packages/kit/src/components/TradingView/ChartWebView/chartSwitchAck.test.ts
*/

// Build a chart->app $private message the way the chart bundle sends it.
function barsState(opts: { displayCoin?: string } = {}) {
  return {
    scope: '$private',
    method: 'tradingview_barsState',
    data: { hasBars: true, count: 300, symbol: 'X', ...opts },
  };
}
function renderReady(opts: { displayCoin?: string } = {}) {
  return {
    scope: '$private',
    method: 'tradingview_renderReady',
    data: { symbol: 'X', ...opts },
  };
}

describe('unwrapChartMessage', () => {
  it('parses a raw JSON string (native transport)', () => {
    const raw = JSON.stringify(barsState({ displayCoin: 'USDC' }));
    expect(unwrapChartMessage(raw)?.method).toBe('tradingview_barsState');
  });

  it('accepts the payload object directly', () => {
    expect(unwrapChartMessage(barsState())?.method).toBe(
      'tradingview_barsState',
    );
  });

  it('unwraps a { data: payload } wrapper (desktop transport)', () => {
    const wrapped = { data: renderReady({ displayCoin: 'ETH' }) };
    const payload = unwrapChartMessage(wrapped);
    expect(payload?.method).toBe('tradingview_renderReady');
    expect(payload?.data?.displayCoin).toBe('ETH');
  });

  it('returns null for malformed JSON / non-chart values', () => {
    expect(unwrapChartMessage('not json{')).toBeNull();
    expect(unwrapChartMessage(null)).toBeNull();
    expect(unwrapChartMessage(42)).toBeNull();
    expect(unwrapChartMessage({ foo: 'bar' })).toBeNull();
  });
});

describe('isSymbolSwitchAck', () => {
  describe('new chart bundle (carries displayCoin)', () => {
    it('acks when displayCoin matches the driven symbol', () => {
      expect(isSymbolSwitchAck(barsState({ displayCoin: 'H' }), 'H')).toBe(
        true,
      );
      expect(isSymbolSwitchAck(renderReady({ displayCoin: 'H' }), 'H')).toBe(
        true,
      );
    });

    // The core fix: the HL:BTC boot placeholder's own barsState must NOT ack a
    // host driving a different token (it used to, via symbol-blind matching, and
    // left the chart stuck on BTC).
    it('does NOT ack the placeholder/other symbol', () => {
      expect(isSymbolSwitchAck(barsState({ displayCoin: 'BTC' }), 'H')).toBe(
        false,
      );
      expect(isSymbolSwitchAck(renderReady({ displayCoin: 'BTC' }), 'H')).toBe(
        false,
      );
    });

    it('does NOT ack when the host has no driven symbol yet', () => {
      expect(
        isSymbolSwitchAck(barsState({ displayCoin: 'H' }), undefined),
      ).toBe(false);
    });
  });

  describe('old chart bundle (no displayCoin) — backward compatible', () => {
    it('falls back to symbol-blind ack on barsState/renderReady', () => {
      expect(isSymbolSwitchAck(barsState(), 'H')).toBe(true);
      expect(isSymbolSwitchAck(renderReady(), 'H')).toBe(true);
    });

    it('still acks getKLineData (never carries displayCoin; never sent by the HL placeholder)', () => {
      const klineReq = {
        scope: '$private',
        method: 'tradingview_getKLineData',
        data: { resolution: '1', from: 0, to: 1 },
      };
      expect(isSymbolSwitchAck(klineReq, 'H')).toBe(true);
    });
  });

  it('ignores non-ack methods (e.g. marks requests)', () => {
    const marks = {
      scope: '$private',
      method: 'tradingview_getMarks',
      data: { symbol: 'H', requestId: '1' },
    };
    expect(isSymbolSwitchAck(marks, 'H')).toBe(false);
  });

  it('ignores a null payload', () => {
    expect(isSymbolSwitchAck(null, 'H')).toBe(false);
  });

  it('end-to-end: raw string -> unwrap -> ack (native host path)', () => {
    const placeholder = JSON.stringify(barsState({ displayCoin: 'BTC' }));
    const ours = JSON.stringify(barsState({ displayCoin: 'H' }));
    expect(isSymbolSwitchAck(unwrapChartMessage(placeholder), 'H')).toBe(false);
    expect(isSymbolSwitchAck(unwrapChartMessage(ours), 'H')).toBe(true);
  });
});
