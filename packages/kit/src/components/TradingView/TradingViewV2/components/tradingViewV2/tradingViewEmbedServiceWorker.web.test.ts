import { jest } from '@jest/globals';

import { preloadTradingViewEmbedBootstrapAssets } from './tradingViewEmbedLoader.web';

const buildAsset = (file: string) => ({
  file,
  integrity: 'sha384-dGVzdA==',
  size: 1,
});

test('updates an outdated service worker before starting prefetch', async () => {
  const manifest = {
    schema: 2,
    version: 'controller-ready',
    baseUrl: 'https://tradingview.onekeytest.com/controller-ready/embed/',
    entry: 'onekey-tradingview-embed.js',
    bootstrap: {
      commonAssets: [
        'onekey-tradingview-embed.js',
        'charting_library/charting_library.standalone.js',
      ],
      defaultLocale: 'en',
      localeAssets: { en: ['charting_library/bundles/en.hash.js'] },
    },
    assets: [
      buildAsset('onekey-tradingview-embed.js'),
      buildAsset('charting_library/charting_library.standalone.js'),
      buildAsset('charting_library/bundles/en.hash.js'),
    ],
  };
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator',
  );
  let controller: {
    postMessage(
      message: unknown,
      transfer?: Transferable[] | StructuredSerializeOptions,
    ): void;
    scriptURL: string;
  } | null = {
    postMessage: jest.fn(),
    scriptURL: 'http://localhost/service-worker.js',
  };
  let controllerChangeListener: (() => void) | undefined;
  const postMessage = jest.fn(
    (
      _message: unknown,
      transfer?: Transferable[] | StructuredSerializeOptions,
    ) => {
      const transferList = Array.isArray(transfer)
        ? transfer
        : transfer?.transfer;
      const replyPort = transferList?.[0] as MessagePort | undefined;
      replyPort?.postMessage({ ok: true, version: manifest.version });
    },
  );
  const serviceWorkerScriptUrl =
    'http://localhost/service-worker.js?tradingviewEmbedProtocol=1';
  const activeWorker = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    scriptURL: serviceWorkerScriptUrl,
    state: 'activated',
    postMessage: jest.fn(() => {
      controller = { postMessage, scriptURL: serviceWorkerScriptUrl };
      controllerChangeListener?.();
    }),
  };
  const registration = {
    active: activeWorker,
    addEventListener: jest.fn(),
    installing: null,
    removeEventListener: jest.fn(),
    waiting: null,
  };
  const serviceWorker = {
    addEventListener: jest.fn(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === 'controllerchange') {
          controllerChangeListener = listener as () => void;
        }
      },
    ),
    get controller() {
      return controller;
    },
    ready: Promise.resolve(registration),
    register: jest.fn(() => Promise.resolve(registration)),
    removeEventListener: jest.fn(),
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { serviceWorker },
  });
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      new Response(JSON.stringify(manifest), { status: 200 }),
    );

  try {
    await preloadTradingViewEmbedBootstrapAssets(
      'https://tradingview.onekeytest.com/?locale=en',
    );

    expect(serviceWorker.register).toHaveBeenCalledWith(
      '/service-worker.js?tradingviewEmbedProtocol=1',
      {
        scope: '/',
        updateViaCache: 'none',
      },
    );
    expect(activeWorker.postMessage).toHaveBeenCalledWith({
      type: 'CLAIM_CLIENTS',
    });
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PREFETCH_TRADINGVIEW_EMBED' }),
      expect.any(Array),
    );
    expect(serviceWorker.removeEventListener).toHaveBeenCalledWith(
      'controllerchange',
      expect.any(Function),
    );
  } finally {
    jest.restoreAllMocks();
    if (originalNavigatorDescriptor) {
      Object.defineProperty(
        globalThis,
        'navigator',
        originalNavigatorDescriptor,
      );
    } else {
      Reflect.deleteProperty(globalThis, 'navigator');
    }
  }
});
