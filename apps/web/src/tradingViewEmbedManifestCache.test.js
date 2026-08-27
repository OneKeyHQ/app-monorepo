import {
  cacheTradingViewRecoveryManifest,
  matchTradingViewRecoveryManifest,
} from './tradingViewEmbedManifestCache';

function createMemoryCache(responses = new Map()) {
  return {
    match: jest.fn(async (request) => responses.get(request.url)?.clone()),
    put: jest.fn(async (request, response) => {
      responses.set(request.url, response.clone());
    }),
  };
}

describe('TradingView embed manifest cache', () => {
  const manifestUrl =
    'https://tradingview.onekeytest.com/recovery-v1/embed/embed-manifest.json';
  const manifest = {
    schema: 2,
    version: 'recovery-v1',
  };

  test('restores recovery metadata after worker memory is restarted', async () => {
    const persistedResponses = new Map();
    const initialWorkerCache = createMemoryCache(persistedResponses);

    await cacheTradingViewRecoveryManifest(
      initialWorkerCache,
      manifestUrl,
      new Response(JSON.stringify(manifest)),
    );

    const restartedWorkerCache = createMemoryCache(persistedResponses);
    const completionResponse = await restartedWorkerCache.match(
      new Request(manifestUrl),
    );
    expect(completionResponse).toBeUndefined();
    const recoveryResponse = await matchTradingViewRecoveryManifest(
      restartedWorkerCache,
      manifestUrl,
    );
    expect(await recoveryResponse.json()).toEqual(manifest);
  });

  test('restores manifests from complete caches created before recovery metadata', async () => {
    const cache = createMemoryCache();
    await cache.put(
      new Request(manifestUrl),
      new Response(JSON.stringify(manifest)),
    );

    const recoveryResponse = await matchTradingViewRecoveryManifest(
      cache,
      manifestUrl,
    );

    expect(await recoveryResponse.json()).toEqual(manifest);
  });
});
