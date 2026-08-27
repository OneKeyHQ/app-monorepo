import { jest } from '@jest/globals';

import { TRADING_VIEW_EMBED_SERVICE_WORKER_PATH } from '@onekeyhq/shared/src/utils/tradingViewEmbedServiceWorker';

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
  let initialProtocolReplyPort: MessagePort | undefined;
  const replacementPostMessage = jest.fn(
    (
      message: { type?: string },
      transfer?: Transferable[] | StructuredSerializeOptions,
    ) => {
      if (message.type === 'GET_TRADINGVIEW_EMBED_PROTOCOL') {
        const transferList = Array.isArray(transfer)
          ? transfer
          : transfer?.transfer;
        const replyPort = transferList?.[0] as MessagePort | undefined;
        replyPort?.postMessage({ ok: false, protocol: 0 });
      }
    },
  );
  let controller: {
    postMessage(
      message: unknown,
      transfer?: Transferable[] | StructuredSerializeOptions,
    ): void;
    scriptURL: string;
  } | null = {
    postMessage: jest.fn(
      (
        message: { type?: string },
        transfer?: Transferable[] | StructuredSerializeOptions,
      ) => {
        if (message.type === 'GET_TRADINGVIEW_EMBED_PROTOCOL') {
          const transferList = Array.isArray(transfer)
            ? transfer
            : transfer?.transfer;
          initialProtocolReplyPort = transferList?.[0] as
            | MessagePort
            | undefined;
        }
      },
    ),
    scriptURL: 'http://localhost/service-worker.js',
  };
  let controllerChangeListener: (() => void) | undefined;
  const postMessage = jest.fn(
    (
      message: { type?: string },
      transfer?: Transferable[] | StructuredSerializeOptions,
    ) => {
      const transferList = Array.isArray(transfer)
        ? transfer
        : transfer?.transfer;
      const replyPort = transferList?.[0] as MessagePort | undefined;
      replyPort?.postMessage(
        message.type === 'GET_TRADINGVIEW_EMBED_PROTOCOL'
          ? { ok: true, protocol: 1 }
          : { ok: true, version: manifest.version },
      );
    },
  );
  const serviceWorkerScriptUrl = new URL(
    TRADING_VIEW_EMBED_SERVICE_WORKER_PATH,
    'http://localhost',
  ).toString();
  const activeWorker = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    scriptURL: serviceWorkerScriptUrl,
    state: 'activated',
    postMessage: jest.fn(
      (
        message: { type?: string },
        transfer?: Transferable[] | StructuredSerializeOptions,
      ) => {
        if (message.type === 'GET_TRADINGVIEW_EMBED_PROTOCOL') {
          const transferList = Array.isArray(transfer)
            ? transfer
            : transfer?.transfer;
          const replyPort = transferList?.[0] as MessagePort | undefined;
          replyPort?.postMessage({ ok: true, protocol: 1 });
          return;
        }
        if (message.type === 'CLAIM_CLIENTS') {
          controller = { postMessage, scriptURL: serviceWorkerScriptUrl };
          controllerChangeListener?.();
        }
      },
    ),
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
  process.env.TRADINGVIEW_EMBED_MANIFEST_URL =
    'https://tradingview.onekeytest.com/controller-ready/embed/embed-manifest.json';

  try {
    const preloadPromise = preloadTradingViewEmbedBootstrapAssets(
      'https://tradingview.onekeytest.com/?locale=en',
    );
    controller = {
      postMessage: replacementPostMessage,
      scriptURL: 'http://localhost/replacement-service-worker.js',
    };
    initialProtocolReplyPort?.postMessage({ ok: true, protocol: 1 });
    await preloadPromise;

    expect(serviceWorker.register).toHaveBeenCalledWith(
      TRADING_VIEW_EMBED_SERVICE_WORKER_PATH,
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
    expect(replacementPostMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PREFETCH_TRADINGVIEW_EMBED' }),
      expect.any(Array),
    );
    expect(serviceWorker.removeEventListener).toHaveBeenCalledWith(
      'controllerchange',
      expect.any(Function),
    );
  } finally {
    delete process.env.TRADINGVIEW_EMBED_MANIFEST_URL;
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

test('reuses a compatible controller without matching its script URL', async () => {
  const manifest = {
    schema: 2,
    version: 'compatible-controller',
    baseUrl: 'https://tradingview.onekey.so/compatible-controller/embed/',
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
  const postMessage = jest.fn(
    (
      message: { type?: string },
      transfer?: Transferable[] | StructuredSerializeOptions,
    ) => {
      const transferList = Array.isArray(transfer)
        ? transfer
        : transfer?.transfer;
      const replyPort = transferList?.[0] as MessagePort | undefined;
      replyPort?.postMessage(
        message.type === 'GET_TRADINGVIEW_EMBED_PROTOCOL'
          ? { ok: true, protocol: 1 }
          : { ok: true, version: manifest.version },
      );
    },
  );
  const register = jest.fn();
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      serviceWorker: {
        addEventListener: jest.fn(),
        controller: {
          postMessage,
          scriptURL: 'http://localhost/legacy-service-worker.js',
        },
        ready: Promise.resolve({}),
        register,
        removeEventListener: jest.fn(),
      },
    },
  });
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      new Response(JSON.stringify(manifest), { status: 200 }),
    );
  process.env.TRADINGVIEW_EMBED_MANIFEST_URL =
    'https://tradingview.onekey.so/compatible-controller/embed/embed-manifest.json';

  try {
    await preloadTradingViewEmbedBootstrapAssets(
      'https://tradingview.onekey.so/?locale=en',
    );

    expect(register).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'GET_TRADINGVIEW_EMBED_PROTOCOL' },
      expect.any(Array),
    );
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PREFETCH_TRADINGVIEW_EMBED' }),
      expect.any(Array),
    );
  } finally {
    delete process.env.TRADINGVIEW_EMBED_MANIFEST_URL;
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

test('rejects instead of waiting forever when no compatible controller takes over', async () => {
  jest.useFakeTimers();
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator',
  );
  const activeWorker = {
    addEventListener: jest.fn(),
    postMessage: jest.fn(),
    removeEventListener: jest.fn(),
    scriptURL: 'http://localhost/service-worker.js',
    state: 'activated',
  };
  const registration = {
    active: activeWorker,
    addEventListener: jest.fn(),
    installing: null,
    removeEventListener: jest.fn(),
    waiting: null,
  };
  const fetchMock = jest.spyOn(globalThis, 'fetch');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      serviceWorker: {
        addEventListener: jest.fn(),
        controller: null,
        ready: Promise.resolve(registration),
        register: jest.fn(() => Promise.resolve(registration)),
        removeEventListener: jest.fn(),
      },
    },
  });
  process.env.TRADINGVIEW_EMBED_MANIFEST_URL =
    'https://tradingview.onekeytest.com/controller-timeout/embed/embed-manifest.json';

  try {
    const preloadPromise = preloadTradingViewEmbedBootstrapAssets(
      'https://tradingview.onekeytest.com/?locale=zh-CN',
    );
    const rejectionMessagePromise = preloadPromise.then(
      () => 'resolved unexpectedly',
      (error: unknown) => String(error),
    );

    await jest.advanceTimersByTimeAsync(15_000);
    await expect(rejectionMessagePromise).resolves.toContain(
      'TradingView embed service worker controller timed out',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  } finally {
    delete process.env.TRADINGVIEW_EMBED_MANIFEST_URL;
    jest.useRealTimers();
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
