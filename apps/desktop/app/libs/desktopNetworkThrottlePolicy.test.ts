import {
  DESKTOP_ONEKEY_THROTTLED_URL_PATTERNS,
  buildDesktopOneKeyOriginNetworkConditionRules,
} from './desktopNetworkThrottlePolicy';

const SLOW_4G = {
  latency: 562.5,
  downloadThroughput: 180_000,
  uploadThroughput: 84_375,
};

describe('desktopNetworkThrottlePolicy', () => {
  it('throttles only OneKey origins, with no catch-all rule', () => {
    const rules = buildDesktopOneKeyOriginNetworkConditionRules(SLOW_4G);

    expect(rules).toEqual(
      DESKTOP_ONEKEY_THROTTLED_URL_PATTERNS.map((urlPattern) => ({
        urlPattern,
        ...SLOW_4G,
      })),
    );
    // An empty pattern would match every request, which is exactly what this
    // policy must never do.
    expect(rules.some((rule) => rule.urlPattern === '')).toBe(false);
  });

  // URLPattern is only a global from Node 23.8; package.json still allows
  // Node >=22.12.0, so skip rather than fail on an older local runtime.
  const urlPatternDescribe =
    typeof URLPattern === 'undefined' ? describe.skip : describe;

  urlPatternDescribe('throttled URL patterns', () => {
    // CDP drops unparsable patterns without reporting an error, so an invalid
    // entry would silently leave OneKey traffic at full speed.
    it('keeps every pattern constructible', () => {
      for (const urlPattern of DESKTOP_ONEKEY_THROTTLED_URL_PATTERNS) {
        expect(() => new URLPattern(urlPattern)).not.toThrow();
      }
    });

    const matches = (url: string) =>
      DESKTOP_ONEKEY_THROTTLED_URL_PATTERNS.some((urlPattern) =>
        new URLPattern(urlPattern).test(url),
      );

    it.each([
      'https://wallet.onekeycn.com/wallet/v1/account/balance',
      'https://swap.onekeycn.com/swap/v1/quote',
      'https://earn.onekeycn.com/earn/v1/list',
      'https://config.onekeycn.com/data.json',
      'wss://notification.onekeycn.com/socket.io/?EIO=4&transport=websocket',
      'https://notification.onekeycn.com/socket.io/?EIO=4&transport=polling',
      'https://wallet.onekeytest.com/wallet/v1/account/balance',
      'https://uni.onekey-asset.com/static/logo/eth.png',
      'https://common.onekey-asset.com/token/evm-1/0x0.png',
      'https://app-assets.onekey.so/img/a.png',
    ])('throttles OneKey traffic %s', (url) => {
      expect(matches(url)).toBe(true);
    });

    it.each([
      // DApp pages and third-party services keep full speed
      'https://app.uniswap.org/',
      'https://mainnet.infura.io/v3/key',
      'https://api.hyperliquid.xyz/info',
      'wss://relay.walletconnect.com/',
      // the local dev server is not a OneKey origin either
      'http://localhost:8081/index.bundle',
      'http://127.0.0.1:3001/main.js',
      'http://[::1]:8081/index.bundle',
      // look-alike hosts must not be caught by the wildcards
      'https://evil-onekeycn.com/x',
      'https://notonekey.com/?ref=uni.onekey-asset.com',
    ])('leaves %s untouched', (url) => {
      expect(matches(url)).toBe(false);
    });
  });
});
