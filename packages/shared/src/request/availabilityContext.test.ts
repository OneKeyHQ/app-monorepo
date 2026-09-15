import platformEnv from '../platformEnv';

import {
  AVAILABILITY_PROXY_STATE_MAX_HOSTS,
  AVAILABILITY_PROXY_STATE_TTL_MS,
  getAvailabilityHostname,
  getAvailabilityIpTableState,
  getAvailabilityProxyState,
  noteAvailabilityProxyPreflight,
  resetAvailabilityContextForTest,
  setAvailabilityIpTableState,
} from './availabilityContext';
import { getAvailabilityNetworkType } from './availabilityNetworkType';
import { normalizeAvailabilityConnectionType } from './availabilityNetworkTypeUtils';

const mutablePlatformEnv = platformEnv as {
  isDesktop?: boolean;
  isNative?: boolean;
};

describe('availabilityContext', () => {
  const originalIsNative = mutablePlatformEnv.isNative;
  const originalIsDesktop = mutablePlatformEnv.isDesktop;
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator',
  );

  afterEach(() => {
    resetAvailabilityContextForTest();
    mutablePlatformEnv.isNative = originalIsNative;
    mutablePlatformEnv.isDesktop = originalIsDesktop;
    if (navigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    }
  });

  it('keeps proxy state per hostname as an enum that expires', () => {
    const now = Date.UTC(2026, 8, 15);
    const host = 'wallet.onekeycn.com';
    expect(getAvailabilityProxyState(host, now)).toBe('unknown');

    noteAvailabilityProxyPreflight(host, true, now);
    expect(getAvailabilityProxyState(host, now + 1000)).toBe('on');
    expect(getAvailabilityProxyState('WALLET.onekeycn.com', now)).toBe('on');
    expect(getAvailabilityProxyState('api.hyperliquid.xyz', now)).toBe(
      'unknown',
    );
    expect(getAvailabilityProxyState(undefined, now)).toBe('unknown');

    noteAvailabilityProxyPreflight(host, false, now);
    expect(getAvailabilityProxyState(host, now)).toBe('off');
    noteAvailabilityProxyPreflight(host, null, now);
    expect(getAvailabilityProxyState(host, now)).toBe('unknown');

    noteAvailabilityProxyPreflight(host, true, now);
    expect(
      getAvailabilityProxyState(
        host,
        now + AVAILABILITY_PROXY_STATE_TTL_MS + 1,
      ),
    ).toBe('unknown');
    expect(getAvailabilityProxyState(host, now - 1)).toBe('unknown');

    noteAvailabilityProxyPreflight(undefined, true, now);
    expect(getAvailabilityProxyState(undefined, now)).toBe('unknown');
  });

  it('bounds the proxy cache to the most recent hostnames', () => {
    const now = Date.UTC(2026, 8, 15);
    for (let i = 0; i <= AVAILABILITY_PROXY_STATE_MAX_HOSTS; i += 1) {
      noteAvailabilityProxyPreflight(`host-${i}.onekeycn.com`, true, now);
    }
    expect(getAvailabilityProxyState('host-0.onekeycn.com', now)).toBe(
      'unknown',
    );
    expect(
      getAvailabilityProxyState(
        `host-${AVAILABILITY_PROXY_STATE_MAX_HOSTS}.onekeycn.com`,
        now,
      ),
    ).toBe('on');
  });

  it('extracts hostnames without throwing', () => {
    expect(getAvailabilityHostname('https://Wallet.OneKeyCN.com/a?b=1')).toBe(
      'wallet.onekeycn.com',
    );
    expect(getAvailabilityHostname('/relative/path')).toBeUndefined();
    expect(getAvailabilityHostname(undefined)).toBeUndefined();
  });

  it('reports IP Table state only where IP Table can run', () => {
    mutablePlatformEnv.isNative = false;
    mutablePlatformEnv.isDesktop = false;
    setAvailabilityIpTableState('enabled');
    expect(getAvailabilityIpTableState()).toBe('unsupported');

    mutablePlatformEnv.isDesktop = true;
    expect(getAvailabilityIpTableState()).toBe('enabled');
    resetAvailabilityContextForTest();
    expect(getAvailabilityIpTableState()).toBe('unknown');
  });

  it('maps connection types to a small enum', () => {
    expect(normalizeAvailabilityConnectionType('wifi')).toBe('wifi');
    expect(normalizeAvailabilityConnectionType('CELLULAR')).toBe('cellular');
    expect(normalizeAvailabilityConnectionType('ethernet')).toBe('ethernet');
    expect(normalizeAvailabilityConnectionType('none')).toBe('offline');
    expect(normalizeAvailabilityConnectionType('vpn')).toBe('other');
    expect(normalizeAvailabilityConnectionType('bluetooth')).toBe('other');
    expect(normalizeAvailabilityConnectionType('unknown')).toBe('unknown');
    expect(normalizeAvailabilityConnectionType(undefined)).toBe('unknown');
    expect(normalizeAvailabilityConnectionType({ ssid: 'home' })).toBe(
      'unknown',
    );
  });

  it('reads browser network state synchronously', () => {
    const setNavigator = (value: unknown) =>
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value,
      });

    setNavigator({ onLine: false, connection: { type: 'wifi' } });
    expect(getAvailabilityNetworkType()).toBe('offline');
    setNavigator({ onLine: true, connection: { type: 'cellular' } });
    expect(getAvailabilityNetworkType()).toBe('cellular');
    setNavigator({ onLine: true });
    expect(getAvailabilityNetworkType()).toBe('unknown');
    setNavigator(undefined);
    expect(getAvailabilityNetworkType()).toBe('unknown');
  });
});
