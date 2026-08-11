import { getNetworkThrottleDevServerOrigin } from './devServerPolicy';

describe('getNetworkThrottleDevServerOrigin', () => {
  it.each([
    [
      'http://localhost:8081/.expo/.virtual-metro-entry.bundle?platform=ios',
      'http://localhost:8081',
    ],
    [
      'http://10.0.2.2:8081/index.bundle?platform=android',
      'http://10.0.2.2:8081',
    ],
    [
      'https://192.168.1.20:8081/index.bundle?platform=ios',
      'https://192.168.1.20:8081',
    ],
  ])('returns the exact Metro origin for %s', (scriptURL, expected) => {
    expect(getNetworkThrottleDevServerOrigin(scriptURL)).toBe(expected);
  });

  it.each([
    'file:///var/mobile/Containers/Data/Application/main.jsbundle',
    'assets://index.android.bundle',
    'not-a-url',
    '',
    undefined,
  ])('ignores non-network bundle URL %s', (scriptURL) => {
    expect(getNetworkThrottleDevServerOrigin(scriptURL)).toBeUndefined();
  });

  it('does not broaden the bypass to the rest of the private network', () => {
    expect(
      getNetworkThrottleDevServerOrigin(
        'http://192.168.1.20:8081/index.bundle?platform=android',
      ),
    ).toBe('http://192.168.1.20:8081');
  });
});
