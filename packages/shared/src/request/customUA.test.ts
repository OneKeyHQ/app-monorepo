import { OneKeyLocalError } from '../errors';
import platformEnv from '../platformEnv';

import {
  __resetCustomUARuntimeForTest,
  __setCustomUARuntimeForTest,
  buildCustomUA,
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
  },
}));

const checkIsOneKeyDomainMock = jest.fn();
const getDevSettingsPersistAtomMock = jest.fn();

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
  __resetCustomUARuntimeForTest();
  (platformEnv as any).isDesktop = false;
  (platformEnv as any).isNative = false;
  (platformEnv as any).isExtension = false;
  (platformEnv as any).isWeb = false;
  (platformEnv as any).appPlatform = undefined;
  (platformEnv as any).version = '6.3.0';
  checkIsOneKeyDomainMock.mockReset();
  getDevSettingsPersistAtomMock.mockReset();
  getDevSettingsPersistAtomMock.mockResolvedValue({
    enabled: false,
    settings: {},
  });
});

describe('buildCustomUA', () => {
  it('returns desktop-electron UA when platformEnv.isDesktop is true', async () => {
    (platformEnv as any).isDesktop = true;
    (platformEnv as any).appPlatform = 'desktop';
    expect(await buildCustomUA()).toBe('OneKeyWallet/6.3.0');
  });

  it('returns ios-native UA when iOS native', async () => {
    (platformEnv as any).isNative = true;
    (platformEnv as any).appPlatform = 'ios';
    expect(await buildCustomUA()).toBe('OneKeyWallet/6.3.0');
  });

  it('returns android-native UA when Android native', async () => {
    (platformEnv as any).isNative = true;
    (platformEnv as any).appPlatform = 'android';
    expect(await buildCustomUA()).toBe('OneKeyWallet/6.3.0');
  });

  it('returns CLI UA with constant version 1 (platformEnv.version unsubstituted in CLI bundle)', async () => {
    __setCustomUARuntimeForTest('cli-node');
    (platformEnv as any).version = undefined;
    expect(await buildCustomUA()).toBe('OneKeyWallet/1');
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
    (platformEnv as any).version = undefined;
    expect(await buildCustomUA()).toBe('OneKeyWallet/1');
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
    getDevSettingsPersistAtomMock.mockRejectedValue(new Error('not wired'));
    expect(await buildCustomUA()).toBe('OneKeyWallet/6.3.0');
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

  it('falls back to OneKey-official regex when requestHelper throws (CLI)', async () => {
    __setCustomUARuntimeForTest('cli-node');
    checkIsOneKeyDomainMock.mockRejectedValueOnce(new Error('not wired'));
    expect(
      await shouldInjectUAForUrl('https://swap.onekeycn.com/swap/v1/quote'),
    ).toBe(true);
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

  it('Native refuses to fall back when requestHelper throws (avoid mis-inject)', async () => {
    (platformEnv as any).isNative = true;
    (platformEnv as any).appPlatform = 'ios';
    checkIsOneKeyDomainMock.mockRejectedValueOnce(new Error('flaky DI'));
    expect(
      await shouldInjectUAForUrl('https://swap.onekeycn.com/swap/v1/quote'),
    ).toBe(false);
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
    (platformEnv as any).version = '6.3.0';
  });

  it('writes UA when host is whitelisted', async () => {
    checkIsOneKeyDomainMock.mockResolvedValueOnce(true);
    const out = await withCustomUAHeaders('https://wallet.onekeycn.com/x', {
      'X-Onekey-Request-ID': 'abc',
    });
    expect(out).toEqual({
      'X-Onekey-Request-ID': 'abc',
      'User-Agent': 'OneKeyWallet/6.3.0',
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
    expect(out['User-Agent']).toBe('OneKeyWallet/1');
  });
});
