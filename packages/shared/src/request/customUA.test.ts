import { OneKeyLocalError } from '../errors';
import platformEnv from '../platformEnv';

import {
  DESKTOP_CUSTOM_UA_HEADER,
  __resetCustomUARuntimeForTest,
  __setCustomUARuntimeForTest,
  buildCustomUA,
  resolveDesktopCustomUAHeaders,
  shouldInjectUAForUrl,
  withCustomUAHeaders,
} from './customUA';
import requestHelper from './requestHelper';

jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: false,
    isNative: false,
    isExtension: false,
    isWeb: false,
    isWebEmbed: false,
    appPlatform: undefined as
      | 'extension'
      | 'ios'
      | 'android'
      | 'desktop'
      | 'web'
      | 'web-embed'
      | undefined,
    version: '6.3.0',
    isDesktopMac: false,
    isDesktopWin: false,
    isDesktopLinux: false,
  },
}));

const checkIsOneKeyDomainMock = jest.fn();
const getDevSettingsPersistAtomMock = jest.fn();
const originalDesktopApi = globalThis.desktopApi;
const mockCallerConflict = jest.fn<void, [unknown]>();

jest.mock('../appGlobals', () => ({
  __esModule: true,
  default: {
    $defaultLogger: {
      app: {
        customUA: {
          callerConflict: (info: unknown) => mockCallerConflict(info),
        },
      },
    },
  },
}));

beforeAll(() => {
  // Replace requestHelper methods with mocks. The other three
  // overrideMethods fields (settings / settingsValue / ipTable) are required
  // by the type signature but never called by customUA — provide stubs
  // that throw, matching the default rejection behavior.
  requestHelper.overrideMethods({
    checkIsOneKeyDomain: checkIsOneKeyDomainMock as unknown as (
      url: string,
    ) => Promise<boolean>,
    getDevSettingsPersistAtom:
      getDevSettingsPersistAtomMock as unknown as () => Promise<any>,
    getSettingsPersistAtom: async () => {
      throw new OneKeyLocalError('not used in customUA tests');
    },
    getSettingsValuePersistAtom: async () => {
      throw new OneKeyLocalError('not used in customUA tests');
    },
    getIpTableConfig: async () => {
      throw new OneKeyLocalError('not used in customUA tests');
    },
  });
});

beforeEach(() => {
  globalThis.desktopApi = {
    ...originalDesktopApi,
    supportsCustomUserAgent: true,
  };
  jest.clearAllMocks();
  __resetCustomUARuntimeForTest();
  (platformEnv as any).isDesktop = false;
  (platformEnv as any).isNative = false;
  (platformEnv as any).isExtension = false;
  (platformEnv as any).isWeb = false;
  (platformEnv as any).appPlatform = undefined;
  (platformEnv as any).version = '6.3.0';
  (platformEnv as any).isDesktopMac = false;
  (platformEnv as any).isDesktopWin = false;
  (platformEnv as any).isDesktopLinux = false;
  checkIsOneKeyDomainMock.mockReset();
  getDevSettingsPersistAtomMock.mockReset();
  getDevSettingsPersistAtomMock.mockResolvedValue({
    enabled: false,
    settings: {},
  });
});

afterEach(() => {
  globalThis.desktopApi = originalDesktopApi;
});

describe('buildCustomUA', () => {
  it('returns desktop-electron UA with the macOS label', async () => {
    (platformEnv as any).isDesktop = true;
    (platformEnv as any).appPlatform = 'desktop';
    (platformEnv as any).isDesktopMac = true;
    expect(await buildCustomUA()).toBe('OneKey macOS 6.3.0');
  });

  it('returns desktop-electron UA with the Windows label', async () => {
    (platformEnv as any).isDesktop = true;
    (platformEnv as any).appPlatform = 'desktop';
    (platformEnv as any).isDesktopWin = true;
    expect(await buildCustomUA()).toBe('OneKey Windows 6.3.0');
  });

  it('returns desktop-electron UA with the Linux label', async () => {
    (platformEnv as any).isDesktop = true;
    (platformEnv as any).appPlatform = 'desktop';
    (platformEnv as any).isDesktopLinux = true;
    expect(await buildCustomUA()).toBe('OneKey Linux 6.3.0');
  });

  it('derives the desktop label from process.platform when platformEnv flags are unset (Electron main)', async () => {
    (platformEnv as any).isDesktop = true;
    (platformEnv as any).appPlatform = 'desktop';
    const originalPlatform = Object.getOwnPropertyDescriptor(
      process,
      'platform',
    );
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });
    try {
      expect(await buildCustomUA()).toBe('OneKey Windows 6.3.0');
    } finally {
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    }
  });

  it('returns ios-native UA when iOS native', async () => {
    (platformEnv as any).isNative = true;
    (platformEnv as any).appPlatform = 'ios';
    expect(await buildCustomUA()).toBe('OneKey iOS 6.3.0');
  });

  it('returns android-native UA when Android native', async () => {
    (platformEnv as any).isNative = true;
    (platformEnv as any).appPlatform = 'android';
    expect(await buildCustomUA()).toBe('OneKey Android 6.3.0');
  });

  it('returns CLI UA with constant version 1 (platformEnv.version unsubstituted in CLI bundle)', async () => {
    __setCustomUARuntimeForTest('cli-node');
    (platformEnv as any).version = undefined;
    expect(await buildCustomUA()).toBe('OneKey CLI 1');
  });

  it('returns null on Web (browser default UA suffices)', async () => {
    (platformEnv as any).isWeb = true;
    (platformEnv as any).appPlatform = 'web';
    expect(await buildCustomUA()).toBeNull();
  });

  it('returns null on Extension', async () => {
    (platformEnv as any).isExtension = true;
    (platformEnv as any).appPlatform = 'extension';
    expect(await buildCustomUA()).toBeNull();
  });

  it('falls back to "1" when version is missing', async () => {
    (platformEnv as any).isDesktop = true;
    (platformEnv as any).appPlatform = 'desktop';
    (platformEnv as any).isDesktopMac = true;
    (platformEnv as any).version = undefined;
    expect(await buildCustomUA()).toBe('OneKey macOS 1');
  });

  it('returns null when dev toggle disableCustomUA is on', async () => {
    (platformEnv as any).isDesktop = true;
    (platformEnv as any).appPlatform = 'desktop';
    getDevSettingsPersistAtomMock.mockResolvedValue({
      enabled: true,
      settings: { disableCustomUA: true },
    });
    expect(await buildCustomUA()).toBeNull();
  });

  it('treats dev toggle as off when getDevSettingsPersistAtom throws (CLI fallback)', async () => {
    (platformEnv as any).isDesktop = true;
    (platformEnv as any).appPlatform = 'desktop';
    (platformEnv as any).isDesktopMac = true;
    getDevSettingsPersistAtomMock.mockRejectedValue(new Error('not wired'));
    expect(await buildCustomUA()).toBe('OneKey macOS 6.3.0');
  });
});

describe('shouldInjectUAForUrl', () => {
  it('returns true when requestHelper.checkIsOneKeyDomain says yes', async () => {
    checkIsOneKeyDomainMock.mockResolvedValueOnce(true);
    expect(
      await shouldInjectUAForUrl('https://wallet.onekeycn.com/wallet/v1/x'),
    ).toBe(true);
  });

  it('returns false when requestHelper says no', async () => {
    checkIsOneKeyDomainMock.mockResolvedValueOnce(false);
    expect(await shouldInjectUAForUrl('https://auth.onekey.so/health')).toBe(
      false,
    );
  });

  it('CLI fallback strips port (uses hostname, not host)', async () => {
    __setCustomUARuntimeForTest('cli-node');
    checkIsOneKeyDomainMock.mockRejectedValueOnce(new Error('not wired'));
    expect(
      await shouldInjectUAForUrl('https://swap.onekeycn.com:443/quote'),
    ).toBe(true);
  });

  it('fallback returns false for non-official host when requestHelper throws (CLI)', async () => {
    __setCustomUARuntimeForTest('cli-node');
    checkIsOneKeyDomainMock.mockRejectedValueOnce(new Error('not wired'));
    expect(await shouldInjectUAForUrl('https://example.com/foo')).toBe(false);
  });

  it('Electron main falls back to OneKey-official regex when requestHelper throws (renderer-only init)', async () => {
    (platformEnv as any).isDesktop = true;
    (platformEnv as any).appPlatform = 'desktop';
    checkIsOneKeyDomainMock.mockRejectedValueOnce(new Error('not wired'));
    expect(
      await shouldInjectUAForUrl('https://utility.onekeycn.com/utility/v1/x'),
    ).toBe(true);
  });

  it('Electron main fallback rejects non-official hosts when requestHelper throws', async () => {
    (platformEnv as any).isDesktop = true;
    (platformEnv as any).appPlatform = 'desktop';
    checkIsOneKeyDomainMock.mockRejectedValueOnce(new Error('not wired'));
    expect(await shouldInjectUAForUrl('https://example.com/foo')).toBe(false);
  });

  it('returns false on bad URL input', async () => {
    expect(await shouldInjectUAForUrl('')).toBe(false);
    expect(await shouldInjectUAForUrl('not-a-url')).toBe(false);
    expect(checkIsOneKeyDomainMock).not.toHaveBeenCalled();
  });

  it('returns false for local loopback', async () => {
    checkIsOneKeyDomainMock.mockResolvedValueOnce(false);
    expect(await shouldInjectUAForUrl('http://127.0.0.1:21320/')).toBe(false);
  });
});

describe('withCustomUAHeaders', () => {
  beforeEach(() => {
    (platformEnv as any).isDesktop = true;
    (platformEnv as any).appPlatform = 'desktop';
    (platformEnv as any).isDesktopMac = true;
    (platformEnv as any).version = '6.3.0';
  });

  it('writes UA when host is whitelisted', async () => {
    checkIsOneKeyDomainMock.mockResolvedValueOnce(true);
    const out = await withCustomUAHeaders('https://wallet.onekeycn.com/x', {
      'X-Onekey-Request-ID': 'abc',
    });
    expect(out).toEqual({
      'X-Onekey-Request-ID': 'abc',
      'User-Agent': 'OneKey macOS 6.3.0',
    });
  });

  it('returns headers unchanged when host is not whitelisted', async () => {
    checkIsOneKeyDomainMock.mockResolvedValueOnce(false);
    const input = { 'X-Onekey-Request-ID': 'abc' };
    const out = await withCustomUAHeaders('https://auth.onekey.so/x', input);
    expect(out).toEqual(input);
    expect(out).not.toBe(input); // returns a copy, doesn't mutate
  });

  it('returns headers unchanged when buildCustomUA returns null (Web)', async () => {
    checkIsOneKeyDomainMock.mockResolvedValueOnce(true);
    (platformEnv as any).isDesktop = false;
    (platformEnv as any).isWeb = true;
    (platformEnv as any).appPlatform = 'web';
    const out = await withCustomUAHeaders('https://wallet.onekeycn.com/x', {
      foo: 'bar',
    });
    expect(out).toEqual({ foo: 'bar' });
  });

  it('does not overwrite an explicit User-Agent set by caller', async () => {
    checkIsOneKeyDomainMock.mockResolvedValueOnce(true);
    const out = await withCustomUAHeaders('https://wallet.onekeycn.com/x', {
      'User-Agent': 'caller-explicit',
    });
    expect(out['User-Agent']).toBe('caller-explicit');
    expect(mockCallerConflict).toHaveBeenCalledWith({
      url: 'https://wallet.onekeycn.com/x',
      existing: 'caller-explicit',
    });
  });

  it('bridges the UA only for desktop browser transports', async () => {
    checkIsOneKeyDomainMock.mockResolvedValue(true);
    expect(
      await withCustomUAHeaders(
        'https://wallet.onekeycn.com/x',
        {},
        {
          browserTransport: true,
        },
      ),
    ).toEqual({
      'User-Agent': 'OneKey macOS 6.3.0',
      [DESKTOP_CUSTOM_UA_HEADER]: JSON.stringify([
        'https://wallet.onekeycn.com',
        'OneKey macOS 6.3.0',
      ]),
    });
    platformEnv.isDesktop = false;
    platformEnv.isNative = true;
    platformEnv.appPlatform = 'ios';
    expect(
      await withCustomUAHeaders(
        'https://wallet.onekeycn.com/x',
        {},
        {
          browserTransport: true,
        },
      ),
    ).toEqual({ 'User-Agent': 'OneKey iOS 6.3.0' });
  });

  it.each([undefined, false])(
    'leaves browser headers unchanged on a shell without UA support (%s)',
    async (supportsCustomUserAgent) => {
      globalThis.desktopApi = {
        ...globalThis.desktopApi,
        supportsCustomUserAgent,
      };
      checkIsOneKeyDomainMock.mockResolvedValue(true);
      expect(
        await withCustomUAHeaders(
          'https://wallet.onekeycn.com/x',
          { Accept: 'application/json' },
          { browserTransport: true },
        ),
      ).toEqual({ Accept: 'application/json' });
      expect(
        await withCustomUAHeaders(
          'https://wallet.onekeycn.com/x',
          { 'User-Agent': 'caller-explicit' },
          { browserTransport: true },
        ),
      ).toEqual({ 'User-Agent': 'caller-explicit' });
    },
  );

  it('does not report a conflict when health probes apply the same UA twice', async () => {
    checkIsOneKeyDomainMock.mockResolvedValue(true);
    const url = 'https://wallet.onekeycn.com/health';
    const headers = await withCustomUAHeaders(url);
    expect(await withCustomUAHeaders(url, headers)).toEqual(headers);
    expect(mockCallerConflict).not.toHaveBeenCalled();
  });

  it('preserves an explicit mixed-case UA through the desktop bridge', async () => {
    checkIsOneKeyDomainMock.mockResolvedValue(true);
    expect(
      await withCustomUAHeaders(
        'https://wallet.onekeycn.com/x',
        { 'uSeR-aGeNt': 'caller-explicit' },
        { browserTransport: true },
      ),
    ).toEqual({
      'uSeR-aGeNt': 'caller-explicit',
      [DESKTOP_CUSTOM_UA_HEADER]: JSON.stringify([
        'https://wallet.onekeycn.com',
        'caller-explicit',
      ]),
    });
  });

  it('does not add a bridge header when custom UA is disabled', async () => {
    checkIsOneKeyDomainMock.mockResolvedValue(true);
    getDevSettingsPersistAtomMock.mockResolvedValue({
      enabled: true,
      settings: { disableCustomUA: true },
    });
    expect(
      await withCustomUAHeaders(
        'https://wallet.onekeycn.com/x',
        {},
        {
          browserTransport: true,
        },
      ),
    ).toEqual({});
  });

  it('removes the internal desktop header before direct SNI transport', async () => {
    checkIsOneKeyDomainMock.mockResolvedValue(true);
    expect(
      await withCustomUAHeaders('https://wallet.onekeycn.com/x', {
        'User-Agent': 'caller-explicit',
        [DESKTOP_CUSTOM_UA_HEADER]: 'caller-explicit',
      }),
    ).toEqual({ 'User-Agent': 'caller-explicit' });
  });

  it('writes UA via fallback regex when requestHelper is not wired (CLI)', async () => {
    __setCustomUARuntimeForTest('cli-node');
    (platformEnv as any).version = undefined; // CLI bundle reality
    checkIsOneKeyDomainMock.mockRejectedValueOnce(new Error('not wired'));
    getDevSettingsPersistAtomMock.mockRejectedValueOnce(new Error('not wired'));
    const out = await withCustomUAHeaders(
      'https://swap.onekeycn.com/swap/v1/quote/events',
      { 'X-Onekey-Request-Platform': 'cli' },
    );
    expect(out['User-Agent']).toBe('OneKey CLI 1');
  });
});

describe('resolveDesktopCustomUAHeaders', () => {
  it('replaces Chromium UA and strips the bridge header on allowed requests', () => {
    const headers = {
      'User-Agent': 'Chromium default',
      [DESKTOP_CUSTOM_UA_HEADER.toLowerCase()]: JSON.stringify([
        'https://wallet.onekeycn.com',
        'OneKey macOS 6.3.0',
      ]),
      'X-Onekey-Request-ID': 'test-id',
    };
    expect(
      resolveDesktopCustomUAHeaders('https://wallet.onekeycn.com/x', headers),
    ).toEqual({
      'User-Agent': 'OneKey macOS 6.3.0',
      'X-Onekey-Request-ID': 'test-id',
    });
    expect(headers[DESKTOP_CUSTOM_UA_HEADER.toLowerCase()]).toBeDefined();
  });

  it('strips the bridge header without changing UA on cross-origin redirects', () => {
    expect(
      resolveDesktopCustomUAHeaders('https://example.com/redirected', {
        'User-Agent': 'Chromium default',
        [DESKTOP_CUSTOM_UA_HEADER]: JSON.stringify([
          'https://wallet.onekeycn.com',
          'OneKey macOS 6.3.0',
        ]),
      }),
    ).toEqual({ 'User-Agent': 'Chromium default' });
  });

  it('leaves browser and DApp requests without a bridge header unchanged', () => {
    const untouched = { 'User-Agent': 'Chromium default' };
    expect(
      resolveDesktopCustomUAHeaders('https://wallet.onekeycn.com/x', untouched),
    ).toBe(untouched);
    expect(
      resolveDesktopCustomUAHeaders('https://wallet.onekeycn.com/x', {
        'User-Agent': 'Chromium default',
      }),
    ).toEqual({ 'User-Agent': 'Chromium default' });
    expect(checkIsOneKeyDomainMock).not.toHaveBeenCalled();
  });

  it('honors a custom endpoint approved by the renderer whitelist', () => {
    expect(
      resolveDesktopCustomUAHeaders('https://custom.example.com/api', {
        [DESKTOP_CUSTOM_UA_HEADER]: JSON.stringify([
          'https://custom.example.com',
          'OneKey macOS 6.3.0',
        ]),
      }),
    ).toEqual({ 'User-Agent': 'OneKey macOS 6.3.0' });
  });

  it.each([
    'not JSON',
    JSON.stringify(['https://wallet.onekeycn.com', '']),
    JSON.stringify(['https://wallet.onekeycn.com', 'invalid\r\nUA']),
  ])(
    'strips malformed bridge header %# and preserves the default UA',
    (bridge) => {
      expect(
        resolveDesktopCustomUAHeaders('https://wallet.onekeycn.com/x', {
          'User-Agent': 'Chromium default',
          [DESKTOP_CUSTOM_UA_HEADER]: bridge,
        }),
      ).toEqual({ 'User-Agent': 'Chromium default' });
    },
  );
});
