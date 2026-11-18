import { getAvailabilityNetworkType } from './availabilityNetworkType';

const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

function setNavigator(value: unknown) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value,
  });
}

describe('availabilityNetworkType (browser realms)', () => {
  afterEach(() => {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else delete (globalThis as { navigator?: unknown }).navigator;
  });

  it('reports unsupported where Chromium implements no connection type', () => {
    // Desktop and web: `NetworkInformation.type` ships only on Android and
    // ChromeOS, so the field is absent rather than unreadable. Reading it as a
    // type is what made api_net 100% unknown on those targets.
    setNavigator({ onLine: true });
    expect(getAvailabilityNetworkType()).toBe('unsupported');

    setNavigator({ onLine: true, connection: {} });
    expect(getAvailabilityNetworkType()).toBe('unsupported');

    setNavigator({ onLine: true, connection: { type: 42 } });
    expect(getAvailabilityNetworkType()).toBe('unsupported');
  });

  it('reports the transport where the realm does implement it', () => {
    setNavigator({ onLine: true, connection: { type: 'cellular' } });
    expect(getAvailabilityNetworkType()).toBe('cellular');
  });

  it('reports offline ahead of the transport', () => {
    setNavigator({ onLine: false, connection: { type: 'wifi' } });
    expect(getAvailabilityNetworkType()).toBe('none');
  });

  it('reads nothing, rather than throwing, in a realm without navigator', () => {
    setNavigator(undefined);
    expect(getAvailabilityNetworkType()).toBeUndefined();

    setNavigator({
      get onLine(): boolean {
        throw new TypeError('illegal invocation');
      },
    });
    expect(getAvailabilityNetworkType()).toBeUndefined();
  });
});
