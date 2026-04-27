import platformEnv from '../platformEnv';

import {
  __resetCustomUARuntimeForTest,
  __setCustomUARuntimeForTest,
  buildCustomUA,
  shouldInjectUAForUrl,
  withCustomUAHeaders,
} from './customUA';

import { checkIsOneKeyDomain } from './checkIsOneKeyDomain';

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

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings', () => ({
  __esModule: true,
  devSettingsPersistAtom: {
    get: jest.fn(async () => ({ enabled: false, settings: {} })),
  },
}));

jest.mock('../logger/logger', () => ({
  __esModule: true,
  defaultLogger: {
    app: { customUA: { decision: jest.fn() } },
  },
}));

describe('buildCustomUA', () => {
  beforeEach(() => {
    __resetCustomUARuntimeForTest();
    (platformEnv as any).isDesktop = false;
    (platformEnv as any).isNative = false;
    (platformEnv as any).isExtension = false;
    (platformEnv as any).isWeb = false;
    (platformEnv as any).appPlatform = undefined;
    (platformEnv as any).version = '6.3.0';
  });

  it('returns desktop-electron UA when platformEnv.isDesktop is true', async () => {
    (platformEnv as any).isDesktop = true;
    (platformEnv as any).appPlatform = 'desktop';
    expect(await buildCustomUA()).toBe('OneKeyWallet/6.3.0 (desktop-electron)');
  });

  it('returns ios-native UA when iOS native', async () => {
    (platformEnv as any).isNative = true;
    (platformEnv as any).appPlatform = 'ios';
    expect(await buildCustomUA()).toBe('OneKeyWallet/6.3.0 (ios-native)');
  });

  it('returns android-native UA when Android native', async () => {
    (platformEnv as any).isNative = true;
    (platformEnv as any).appPlatform = 'android';
    expect(await buildCustomUA()).toBe('OneKeyWallet/6.3.0 (android-native)');
  });

  it('returns cli-node UA after explicit override', async () => {
    __setCustomUARuntimeForTest('cli-node');
    expect(await buildCustomUA()).toBe('OneKeyWallet/6.3.0 (cli-node)');
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

  it('falls back to "unknown" when version is missing', async () => {
    (platformEnv as any).isDesktop = true;
    (platformEnv as any).appPlatform = 'desktop';
    (platformEnv as any).version = undefined;
    expect(await buildCustomUA()).toBe(
      'OneKeyWallet/unknown (desktop-electron)',
    );
  });
});

jest.mock('./checkIsOneKeyDomain', () => ({
  __esModule: true,
  checkIsOneKeyDomain: jest.fn(),
}));

const mockedCheck = checkIsOneKeyDomain as jest.MockedFunction<
  typeof checkIsOneKeyDomain
>;

describe('shouldInjectUAForUrl', () => {
  beforeEach(() => {
    mockedCheck.mockReset();
  });

  it('returns true for whitelisted host', async () => {
    mockedCheck.mockResolvedValueOnce(true);
    expect(
      await shouldInjectUAForUrl('https://wallet.onekeycn.com/wallet/v1/x'),
    ).toBe(true);
    expect(mockedCheck).toHaveBeenCalledWith(
      'https://wallet.onekeycn.com/wallet/v1/x',
    );
  });

  it('returns false for non-whitelisted host (e.g. auth.onekey.so)', async () => {
    mockedCheck.mockResolvedValueOnce(false);
    expect(await shouldInjectUAForUrl('https://auth.onekey.so/health')).toBe(
      false,
    );
  });

  it('returns false on bad URL input', async () => {
    expect(await shouldInjectUAForUrl('')).toBe(false);
    expect(await shouldInjectUAForUrl('not-a-url')).toBe(false);
    expect(mockedCheck).not.toHaveBeenCalled();
  });

  it('returns false for local loopback', async () => {
    mockedCheck.mockResolvedValueOnce(false);
    expect(await shouldInjectUAForUrl('http://127.0.0.1:21320/')).toBe(false);
  });
});

describe('withCustomUAHeaders', () => {
  beforeEach(() => {
    mockedCheck.mockReset();
    __resetCustomUARuntimeForTest();
    (platformEnv as any).isDesktop = true;
    (platformEnv as any).appPlatform = 'desktop';
    (platformEnv as any).version = '6.3.0';
  });

  it('writes UA when host is whitelisted', async () => {
    mockedCheck.mockResolvedValueOnce(true);
    const out = await withCustomUAHeaders('https://wallet.onekeycn.com/x', {
      'X-Onekey-Request-ID': 'abc',
    });
    expect(out).toEqual({
      'X-Onekey-Request-ID': 'abc',
      'User-Agent': 'OneKeyWallet/6.3.0 (desktop-electron)',
    });
  });

  it('returns headers unchanged when host is not whitelisted', async () => {
    mockedCheck.mockResolvedValueOnce(false);
    const input = { 'X-Onekey-Request-ID': 'abc' };
    const out = await withCustomUAHeaders('https://auth.onekey.so/x', input);
    expect(out).toEqual(input);
    expect(out).not.toBe(input); // returns a copy, doesn't mutate
  });

  it('returns headers unchanged when buildCustomUA returns null', async () => {
    mockedCheck.mockResolvedValueOnce(true);
    (platformEnv as any).isDesktop = false;
    (platformEnv as any).isWeb = true;
    (platformEnv as any).appPlatform = 'web';
    const out = await withCustomUAHeaders('https://wallet.onekeycn.com/x', {
      foo: 'bar',
    });
    expect(out).toEqual({ foo: 'bar' });
  });

  it('does not overwrite an explicit User-Agent set by caller', async () => {
    mockedCheck.mockResolvedValueOnce(true);
    const out = await withCustomUAHeaders('https://wallet.onekeycn.com/x', {
      'User-Agent': 'caller-explicit',
    });
    expect(out['User-Agent']).toBe('caller-explicit');
  });
});
