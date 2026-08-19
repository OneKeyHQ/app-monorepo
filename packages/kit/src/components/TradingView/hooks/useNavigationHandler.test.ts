import { isTradingViewNavigationAllowed } from './useNavigationHandler';

describe('isTradingViewNavigationAllowed', () => {
  const tradingViewUrl =
    'https://tradingview.onekey.so/?type=market&symbol=BTC';

  it('allows navigation within the configured TradingView origin', () => {
    expect(
      isTradingViewNavigationAllowed({
        requestUrl: 'https://tradingview.onekey.so/chart/settings',
        tradingViewUrl,
      }),
    ).toBe(true);
  });

  it('blocks navigation to every other origin', () => {
    expect(
      isTradingViewNavigationAllowed({
        requestUrl: 'https://www.tradingview.com/chart',
        tradingViewUrl,
      }),
    ).toBe(false);
    expect(
      isTradingViewNavigationAllowed({
        requestUrl: 'https://malicious.example/chart',
        tradingViewUrl,
      }),
    ).toBe(false);
  });

  it('fails closed for malformed URLs while allowing the initial blank page', () => {
    expect(
      isTradingViewNavigationAllowed({
        requestUrl: 'not-a-url',
        tradingViewUrl,
      }),
    ).toBe(false);
    expect(
      isTradingViewNavigationAllowed({
        requestUrl: 'about:blank',
        tradingViewUrl,
      }),
    ).toBe(true);
  });
});
