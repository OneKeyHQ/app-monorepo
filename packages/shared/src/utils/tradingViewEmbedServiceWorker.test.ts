import {
  TRADING_VIEW_EMBED_SERVICE_WORKER_PATH,
  buildTradingViewEmbedServiceWorkerPath,
} from './tradingViewEmbedServiceWorker';

describe('tradingViewEmbedServiceWorker', () => {
  test('includes the app build in the service worker URL', () => {
    expect(
      buildTradingViewEmbedServiceWorkerPath({
        buildNumber: '1026081503',
        commitHash: '7f00d811',
      }),
    ).toBe(
      '/service-worker.js?tradingviewEmbedProtocol=1&appBuild=7f00d811-1026081503',
    );
  });

  test('encodes build identifiers before adding them to the URL', () => {
    expect(
      buildTradingViewEmbedServiceWorkerPath({
        buildNumber: 'build 1',
        commitHash: 'release/test',
      }),
    ).toBe(
      '/service-worker.js?tradingviewEmbedProtocol=1&appBuild=release%2Ftest-build%201',
    );
  });

  test('exports a build-versioned runtime path', () => {
    expect(TRADING_VIEW_EMBED_SERVICE_WORKER_PATH).toMatch(
      /^\/service-worker\.js\?tradingviewEmbedProtocol=1&appBuild=.+/,
    );
  });
});
