import {
  EDappWebViewNavigationDecision,
  resolveDappWebViewNavigation,
} from '../dappWebViewNavigationPolicy';

describe('resolveDappWebViewNavigation', () => {
  it('allows ordinary https navigation', () => {
    expect(
      resolveDappWebViewNavigation({ url: 'https://app.uniswap.org/swap' }),
    ).toBe(EDappWebViewNavigationDecision.Allow);
  });

  it('denies script and local targets that keep the wallet bridge alive', () => {
    for (const url of [
      // eslint-disable-next-line no-script-url
      'javascript:alert(1)',
      'http://127.0.0.1:8545',
      'http://localhost:3000',
      'https://192.168.1.10/admin',
      '',
    ]) {
      expect(resolveDappWebViewNavigation({ url })).toBe(
        EDappWebViewNavigationDecision.Deny,
      );
    }
  });

  it('denies punycode hosts', () => {
    expect(
      resolveDappWebViewNavigation({ url: 'https://xn--80ak6aa92e.com' }),
    ).toBe(EDappWebViewNavigationDecision.Deny);
  });

  it('routes OneKey deeplinks to the app instead of loading them', () => {
    expect(
      resolveDappWebViewNavigation({ url: 'onekey-wallet://market/tokens' }),
    ).toBe(EDappWebViewNavigationDecision.Deeplink);
  });
});
