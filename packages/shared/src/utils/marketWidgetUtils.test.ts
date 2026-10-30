import {
  buildMarketWidgetAssets,
  createMarketWidgetConfigurationSync,
  parseMarketWidgetLinkUrl,
} from './marketWidgetUtils';

import type { IMarketWidgetConfiguration } from '../modules/MarketWidget/types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const configuration = (locale: string): IMarketWidgetConfiguration => ({
  schemaVersion: 1,
  assets: [],
  greenUp: true,
  locale,
});

describe('market widget configuration', () => {
  it('keeps supported source order and chain identity, excluding stocks and perps', () => {
    expect(
      buildMarketWidgetAssets([
        { assetId: 'bitcoin', chainId: '', contractAddress: '' },
        { stockId: 'AAPL', chainId: '', contractAddress: '' },
        { perpsCoin: 'BTC', chainId: '', contractAddress: '' },
        {
          chainId: 'sol--101',
          contractAddress: 'MiXeDBase58',
          isNative: false,
        },
        { chainId: 'evm--1', contractAddress: '', isNative: true },
        { assetId: 'bitcoin', chainId: '', contractAddress: '' },
      ]),
    ).toEqual([
      { kind: 'asset', assetId: 'bitcoin', symbol: '', name: '' },
      {
        kind: 'token',
        chainId: 'sol--101',
        contractAddress: 'MiXeDBase58',
        requestTokenAddress: 'MiXeDBase58',
        isNative: false,
        symbol: '',
        name: '',
      },
      {
        kind: 'token',
        chainId: 'evm--1',
        contractAddress: '',
        requestTokenAddress: '',
        isNative: true,
        symbol: '',
        name: '',
      },
    ]);
  });

  it('bounds the exported public metadata and strips additional fields', () => {
    const input = Array.from({ length: 25 }, (_, index) => ({
      assetId: `asset-${index}`,
      chainId: '',
      contractAddress: '',
      accountId: 'private-account',
      balance: '123',
    }));
    const result = buildMarketWidgetAssets(input);
    expect(result).toHaveLength(20);
    expect(result[19]).toEqual({
      kind: 'asset',
      assetId: 'asset-19',
      symbol: '',
      name: '',
    });
    expect(JSON.stringify(result)).not.toContain('private-account');
    expect(buildMarketWidgetAssets([])).toEqual([]);
  });

  it('discards an obsolete background read before calling the native bridge', async () => {
    const old = deferred<IMarketWidgetConfiguration>();
    const write = jest.fn(async () => undefined);
    const sync = createMarketWidgetConfigurationSync({
      write,
      onError: jest.fn(),
    });
    const running = sync.request(() => old.promise);
    void sync.request(async () => configuration('zh-CN'));
    old.resolve(configuration('en-US'));
    await running;
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(configuration('zh-CN'));
  });

  it('serializes native writes while accepting a newer configuration', async () => {
    const oldWrite = deferred<void>();
    const write = jest.fn(async (value: IMarketWidgetConfiguration) => {
      if (value.locale === 'en-US') await oldWrite.promise;
    });
    const sync = createMarketWidgetConfigurationSync({
      write,
      onError: jest.fn(),
    });
    const running = sync.request(async () => configuration('en-US'));
    await Promise.resolve();
    void sync.request(async () => configuration('zh-CN'));
    await Promise.resolve();
    expect(write).toHaveBeenCalledTimes(1);
    oldWrite.resolve();
    await running;
    expect(write.mock.calls.map(([value]) => value.locale)).toEqual([
      'en-US',
      'zh-CN',
    ]);
    await sync.request(async () => configuration('ja-JP'));
    expect(write).toHaveBeenLastCalledWith(configuration('ja-JP'));
  });

  it('cancels an unmounted read and recovers after a native write failure', async () => {
    const old = deferred<IMarketWidgetConfiguration>();
    const write = jest
      .fn()
      .mockRejectedValueOnce(new Error('disk'))
      .mockResolvedValue(undefined);
    const onError = jest.fn();
    const sync = createMarketWidgetConfigurationSync({ write, onError });
    const running = sync.request(() => old.promise);
    sync.cancel();
    old.resolve(configuration('en-US'));
    await running;
    expect(write).not.toHaveBeenCalled();
    await sync.request(async () => configuration('zh-CN'));
    expect(onError).toHaveBeenCalledTimes(1);
    await sync.request(async () => configuration('ja-JP'));
    expect(write).toHaveBeenLastCalledWith(configuration('ja-JP'));
  });
});

describe('market widget deep link identity', () => {
  it('routes editor links by stable profile identity or widget family', () => {
    expect(
      parseMarketWidgetLinkUrl('onekey-wallet://market_widget_config'),
    ).toEqual({
      matches: true,
      target: { kind: 'editor' },
    });
    expect(
      parseMarketWidgetLinkUrl('onekey-wallet://market_widget_config?kind=list')
        .target,
    ).toEqual({
      kind: 'editor',
      widgetKind: 'list',
    });
    expect(
      parseMarketWidgetLinkUrl(
        'onekey-wallet://market_widget_config?kind=single',
      ).target,
    ).toEqual({
      kind: 'editor',
      widgetKind: 'single',
    });
    expect(
      parseMarketWidgetLinkUrl(
        'onekey-wallet://market_widget_config?profileId=4BDFEB88-A55D-4A91-BEDB-DF13ACFAEA39',
      ).target,
    ).toEqual({
      kind: 'editor',
      profileId: '4bdfeb88-a55d-4a91-bedb-df13acfaea39',
    });
  });

  it.each([
    '?profileId=',
    '?profileId=bitcoin',
    '?profileId=4bdfeb88-a55d-4a91-bedb-df13acfaea39&kind=single',
    '?kind=single&kind=list',
    '?profileId=4bdfeb88-a55d-4a91-bedb-df13acfaea39&profileId=4bdfeb88-a55d-4a91-bedb-df13acfaea39',
    '?kind=large',
    '?assetId=bitcoin',
    '?__proto__=single',
    '/private?kind=single',
    '?kind=single#fragment',
  ])('rejects ambiguous or malformed editor identity: %s', (suffix) => {
    expect(
      parseMarketWidgetLinkUrl(`onekey-wallet://market_widget_config${suffix}`),
    ).toEqual({ matches: true });
  });

  it('distinguishes an asset listing from a chain token and native token', () => {
    expect(
      parseMarketWidgetLinkUrl('onekey-wallet://market_widget?assetId=bitcoin')
        .target,
    ).toEqual({ kind: 'asset', assetId: 'bitcoin' });
    expect(
      parseMarketWidgetLinkUrl(
        'onekey-wallet://market_widget?chainId=sui--mainnet&contractAddress=0x2%3A%3Asui%3A%3ASUI&isNative=true',
      ).target,
    ).toEqual({
      kind: 'token',
      chainId: 'sui--mainnet',
      contractAddress: '0x2::sui::SUI',
      isNative: true,
    });
    expect(
      parseMarketWidgetLinkUrl(
        'onekey-wallet://market_widget?chainId=evm--1&contractAddress=&isNative=true',
      ).target,
    ).toEqual({
      kind: 'token',
      chainId: 'evm--1',
      contractAddress: '',
      isNative: true,
    });
    expect(
      parseMarketWidgetLinkUrl('onekey-wallet://market_widget').target,
    ).toEqual({ kind: 'home' });
  });

  it.each([
    '?assetId=bitcoin&assetId=ethereum',
    '?__proto__=bitcoin',
    '?assetId=bitcoin&chainId=evm--1',
    '?assetId=..%2Fprivate',
    '?chainId=evm--1&contractAddress=',
    '?chainId=evm--1&contractAddress=0xabc&isNative=1',
    '?chainId=evm--1&contractAddress=%3Cscript%3E',
    '?chainId=evm--1&contractAddress=0xabc&url=https%3A%2F%2Fevil.test',
    '/unexpected?assetId=bitcoin',
    '?assetId=bitcoin#redirect',
  ])('rejects ambiguous or unsafe input %s', (suffix) => {
    expect(
      parseMarketWidgetLinkUrl(`onekey-wallet://market_widget${suffix}`),
    ).toEqual({ matches: true, target: undefined });
  });

  it('does not claim existing deep link paths or untrusted schemes', () => {
    expect(
      parseMarketWidgetLinkUrl(
        'onekey-wallet://market_detail?coinGeckoId=bitcoin',
      ).matches,
    ).toBe(false);
    expect(
      parseMarketWidgetLinkUrl('https://market_widget?assetId=bitcoin').matches,
    ).toBe(false);
  });
});
