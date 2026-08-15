import {
  DESKTOP_DEV_SERVER_LOCAL_BYPASS_PATTERNS,
  buildDesktopRemoteOnlyNetworkConditionRules,
} from './desktopNetworkThrottlePolicy';

describe('desktopNetworkThrottlePolicy', () => {
  it('bypasses loopback requests before applying the global remote rule', () => {
    const rules = buildDesktopRemoteOnlyNetworkConditionRules({
      latency: 562.5,
      downloadThroughput: 180_000,
      uploadThroughput: 84_375,
    });

    expect(rules.slice(0, -1)).toEqual(
      DESKTOP_DEV_SERVER_LOCAL_BYPASS_PATTERNS.map((urlPattern) => ({
        urlPattern,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
      })),
    );
    expect(rules.at(-1)).toEqual({
      urlPattern: '',
      latency: 562.5,
      downloadThroughput: 180_000,
      uploadThroughput: 84_375,
    });
  });

  // CDP drops unparsable patterns without reporting an error, so an invalid
  // entry would silently throttle the dev server instead of bypassing it.
  it('keeps every bypass pattern constructible and loopback-scoped', () => {
    for (const urlPattern of DESKTOP_DEV_SERVER_LOCAL_BYPASS_PATTERNS) {
      const pattern = new URLPattern(urlPattern);
      expect(pattern.test('https://wallet.onekeycn.com/v1/ping')).toBe(false);
    }
  });

  it.each([
    ['http://localhost:8081/index.bundle', 0],
    ['http://127.0.0.1:3001/main.js', 1],
    ['http://[::1]:8081/index.bundle', 2],
  ])('bypasses dev server URL %s', (url, patternIndex) => {
    const pattern = new URLPattern(
      DESKTOP_DEV_SERVER_LOCAL_BYPASS_PATTERNS[patternIndex],
    );
    expect(pattern.test(url)).toBe(true);
  });
});
