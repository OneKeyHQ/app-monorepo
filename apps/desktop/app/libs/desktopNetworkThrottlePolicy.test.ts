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
});
