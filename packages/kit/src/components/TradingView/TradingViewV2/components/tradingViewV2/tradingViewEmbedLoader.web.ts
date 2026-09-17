import {
  TRADING_VIEW_URL,
  TRADING_VIEW_URL_TEST,
} from '@onekeyhq/shared/src/config/appConfig';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { ILocaleJSONSymbol } from '@onekeyhq/shared/src/locale';
import { buildTradingViewEmbedProxyBaseUrl } from '@onekeyhq/shared/src/utils/tradingViewEmbedAssetProxy';
import { TRADING_VIEW_EMBED_SERVICE_WORKER_PATH } from '@onekeyhq/shared/src/utils/tradingViewEmbedServiceWorker';

import { tradingViewLocaleMap } from '../../../utils/tradingViewLocaleMap';

interface ITradingViewEmbedManifestAsset {
  file: string;
  integrity: string;
  size: number;
}

interface ITradingViewEmbedManifestBase {
  version: string;
  baseUrl: string;
  entry: string;
  assets: ITradingViewEmbedManifestAsset[];
}

interface ITradingViewEmbedManifestV1 extends ITradingViewEmbedManifestBase {
  schema: 1;
  styles?: string[];
  bootstrapAssets?: string[];
}

interface ITradingViewEmbedManifestV2 extends ITradingViewEmbedManifestBase {
  schema: 2;
  bootstrap: {
    commonAssets: string[];
    defaultLocale: string;
    localeAssets: Record<string, string[]>;
  };
}

type ITradingViewEmbedManifest =
  | ITradingViewEmbedManifestV1
  | ITradingViewEmbedManifestV2;

interface ITradingViewEmbedManifestPointer {
  baseUrl: string;
  entry: string;
  schema: 1 | 2;
  version: string;
}

export interface ITradingViewEmbedHandle {
  postMessage(message: unknown): void;
  unmount(): void;
}

export interface ITradingViewEmbedModule {
  mountTradingView(options: {
    assetBaseUrl: string;
    container: HTMLElement;
    onMessage(payload: unknown): void;
    params: URLSearchParams;
  }): Promise<ITradingViewEmbedHandle>;
  postTradingViewMessage(message: unknown): boolean;
}

export interface ILoadedTradingViewEmbedModule {
  assetBaseUrl: string;
  module: ITradingViewEmbedModule;
}

const modulePromises = new Map<
  string,
  Promise<ILoadedTradingViewEmbedModule>
>();
const serviceWorkerControllerPromises = new WeakMap<
  ServiceWorkerContainer,
  Promise<ServiceWorker>
>();
const manifestPromises = new Map<
  string,
  Promise<{
    baseUrl: string;
    manifest: ITradingViewEmbedManifest;
  }>
>();
const bootstrapPreloadPromises = new Map<string, Promise<void>>();

const DEFAULT_MANIFEST_URL = 'https://tradingview.onekey.so/embed/latest.json';
const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost']);
const CLAIM_CLIENTS_MESSAGE_TYPE = 'CLAIM_CLIENTS';
const GET_EMBED_PROTOCOL_MESSAGE_TYPE = 'GET_TRADINGVIEW_EMBED_PROTOCOL';
const PREFETCH_MESSAGE_TYPE = 'PREFETCH_TRADINGVIEW_EMBED';
const TRADING_VIEW_EMBED_PROTOCOL_VERSION = 1;
const SERVICE_WORKER_PROTOCOL_PROBE_TIMEOUT_MS = 500;
const SERVICE_WORKER_CONTROLLER_TIMEOUT_MS = 15_000;
const SERVICE_WORKER_PREFETCH_TIMEOUT_MS = 60_000;
const TRUSTED_MANIFEST_ORIGINS = new Set([
  new URL(TRADING_VIEW_URL).origin,
  new URL(TRADING_VIEW_URL_TEST).origin,
]);
const BOOTSTRAP_PRELOAD_CONCURRENCY = 3;
const TRADING_VIEW_BOOTSTRAP_LOCALE_ALIASES: Record<string, string> = {
  zh_CN: 'zh',
  zh_HK: 'zh_TW',
};

function resolveManifestUrl(runtimeUrl?: string): string {
  const locationHref = globalThis.location?.href || DEFAULT_MANIFEST_URL;
  const locationOrigin =
    globalThis.location?.origin || new URL(locationHref).origin;
  if (runtimeUrl) {
    const runtimeOrigin = new URL(runtimeUrl, locationHref);
    const manifestPath = LOCAL_HOSTNAMES.has(runtimeOrigin.hostname)
      ? '/latest.json'
      : '/embed/latest.json';
    return validateManifestUrl(
      new URL(manifestPath, runtimeOrigin.origin),
    ).toString();
  }

  const configuredManifestUrl =
    process.env.TRADINGVIEW_EMBED_MANIFEST_URL?.trim();
  if (configuredManifestUrl) {
    return validateManifestUrl(
      new URL(configuredManifestUrl, locationOrigin),
    ).toString();
  }

  return validateManifestUrl(
    new URL(DEFAULT_MANIFEST_URL, locationOrigin),
  ).toString();
}

function validateManifestUrl(url: URL): URL {
  const isLocal = LOCAL_HOSTNAMES.has(url.hostname);
  if (
    (!isLocal &&
      (url.protocol !== 'https:' ||
        !TRUSTED_MANIFEST_ORIGINS.has(url.origin))) ||
    (isLocal && url.protocol !== 'http:' && url.protocol !== 'https:')
  ) {
    throw new OneKeyLocalError('TradingView embed manifest URL is not trusted');
  }
  return url;
}

function resolveManifestBaseUrl(
  manifest: ITradingViewEmbedManifestPointer,
  manifestUrl: string,
): string {
  const url = new URL(manifest.baseUrl, manifestUrl);
  if (url.origin !== new URL(manifestUrl).origin) {
    throw new OneKeyLocalError('TradingView embed base URL origin mismatch');
  }
  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`;
  }
  if (!LOCAL_HOSTNAMES.has(url.hostname)) {
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.at(-1) !== 'embed' || pathParts.at(-2) !== manifest.version) {
      throw new OneKeyLocalError(
        'TradingView embed base URL is not version pinned',
      );
    }
  }
  return url.toString();
}

function isValidRelativeAssetPath(file: string): boolean {
  if (
    !file ||
    file.startsWith('/') ||
    file.includes('\\') ||
    file.includes('%') ||
    file.includes('?') ||
    file.includes('#')
  ) {
    return false;
  }
  const validationBaseUrl = new URL('https://tradingview.invalid/v1/embed/');
  const resolvedUrl = new URL(file, validationBaseUrl);
  return (
    resolvedUrl.origin === validationBaseUrl.origin &&
    resolvedUrl.href.startsWith(validationBaseUrl.href)
  );
}

function isValidManifestVersion(version: unknown): version is string {
  return (
    typeof version === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(version)
  );
}

function isValidManifestPointer(
  value: unknown,
): value is ITradingViewEmbedManifestPointer {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const manifest = value as Partial<ITradingViewEmbedManifestPointer>;
  return (
    (manifest.schema === 1 || manifest.schema === 2) &&
    isValidManifestVersion(manifest.version) &&
    typeof manifest.baseUrl === 'string' &&
    Boolean(manifest.baseUrl) &&
    typeof manifest.entry === 'string' &&
    isValidRelativeAssetPath(manifest.entry)
  );
}

function getManifestStyles(manifest: ITradingViewEmbedManifest): string[] {
  return manifest.schema === 1 ? manifest.styles || [] : [];
}

function isValidManifestV2Bootstrap(
  bootstrap: unknown,
  assetFiles: Set<string>,
  entry: string,
): bootstrap is ITradingViewEmbedManifestV2['bootstrap'] {
  if (!bootstrap || typeof bootstrap !== 'object') {
    return false;
  }
  const value = bootstrap as Partial<ITradingViewEmbedManifestV2['bootstrap']>;
  if (
    typeof value.defaultLocale !== 'string' ||
    !/^[A-Za-z][A-Za-z0-9_]*$/.test(value.defaultLocale) ||
    !Array.isArray(value.commonAssets) ||
    value.commonAssets.length === 0 ||
    !value.commonAssets.every(
      (file) => isValidRelativeAssetPath(file) && assetFiles.has(file),
    ) ||
    !value.commonAssets.includes(entry) ||
    !value.commonAssets.includes(
      'charting_library/charting_library.standalone.js',
    ) ||
    !value.localeAssets ||
    typeof value.localeAssets !== 'object' ||
    Array.isArray(value.localeAssets)
  ) {
    return false;
  }
  const localeEntries = Object.entries(value.localeAssets);
  return (
    localeEntries.length > 0 &&
    localeEntries.every(
      ([locale, files]) =>
        /^[A-Za-z][A-Za-z0-9_]*$/.test(locale) &&
        Array.isArray(files) &&
        files.length > 0 &&
        files.every(
          (file) => isValidRelativeAssetPath(file) && assetFiles.has(file),
        ),
    ) &&
    Object.prototype.hasOwnProperty.call(
      value.localeAssets,
      value.defaultLocale,
    )
  );
}

function resolveAssetUrl(file: string, baseUrl: string): URL {
  if (!isValidRelativeAssetPath(file)) {
    throw new OneKeyLocalError('TradingView embed asset path is invalid');
  }
  const normalizedBaseUrl = new URL(baseUrl);
  const assetUrl = new URL(file, normalizedBaseUrl);
  if (
    assetUrl.origin !== normalizedBaseUrl.origin ||
    !assetUrl.href.startsWith(normalizedBaseUrl.href)
  ) {
    throw new OneKeyLocalError(
      'TradingView embed asset URL escaped its version directory',
    );
  }
  return assetUrl;
}

function isValidManifest(value: unknown): value is ITradingViewEmbedManifest {
  if (!isValidManifestPointer(value)) {
    return false;
  }
  const manifest = value as ITradingViewEmbedManifestPointer & {
    assets?: ITradingViewEmbedManifestAsset[];
    bootstrap?: unknown;
    bootstrapAssets?: unknown;
    styles?: unknown;
  };
  if (
    !Array.isArray(manifest.assets) ||
    !manifest.assets.every(
      (asset) =>
        isValidRelativeAssetPath(asset?.file) &&
        typeof asset.integrity === 'string' &&
        /^sha384-[A-Za-z0-9+/]+={0,2}$/.test(asset.integrity) &&
        typeof asset.size === 'number' &&
        Number.isSafeInteger(asset.size) &&
        asset.size >= 0,
    )
  ) {
    return false;
  }
  const assetFiles = new Set(manifest.assets.map((asset) => asset.file));
  if (
    assetFiles.size !== manifest.assets.length ||
    !assetFiles.has(manifest.entry)
  ) {
    return false;
  }
  if (manifest.schema === 2) {
    return isValidManifestV2Bootstrap(
      manifest.bootstrap,
      assetFiles,
      manifest.entry,
    );
  }
  return (
    (manifest.styles === undefined ||
      (Array.isArray(manifest.styles) &&
        manifest.styles.every(
          (file: unknown) =>
            typeof file === 'string' &&
            isValidRelativeAssetPath(file) &&
            assetFiles.has(file),
        ))) &&
    (manifest.bootstrapAssets === undefined ||
      (Array.isArray(manifest.bootstrapAssets) &&
        manifest.bootstrapAssets.every(
          (file: unknown) =>
            typeof file === 'string' &&
            isValidRelativeAssetPath(file) &&
            assetFiles.has(file.replace('__LANG__', 'en')),
        )))
  );
}

function supportsTradingViewEmbedProtocol(
  worker: ServiceWorker | null | undefined,
): Promise<boolean> {
  if (!worker || typeof worker.postMessage !== 'function') {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    let settled = false;
    const timeoutRef: {
      current?: ReturnType<typeof setTimeout>;
    } = {};
    const finish = (supported: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      channel.port1.close();
      resolve(supported);
    };
    timeoutRef.current = setTimeout(
      () => finish(false),
      SERVICE_WORKER_PROTOCOL_PROBE_TIMEOUT_MS,
    );
    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      const response = event.data as {
        ok?: boolean;
        protocol?: number;
      };
      finish(
        response?.ok === true &&
          response.protocol === TRADING_VIEW_EMBED_PROTOCOL_VERSION,
      );
    };
    try {
      worker.postMessage({ type: GET_EMBED_PROTOCOL_MESSAGE_TYPE }, [
        channel.port2,
      ]);
    } catch {
      finish(false);
    }
  });
}

function getTradingViewServiceWorkerContainer(): ServiceWorkerContainer {
  const serviceWorkerContainer =
    typeof navigator === 'undefined' ? undefined : navigator.serviceWorker;
  if (
    !serviceWorkerContainer ||
    typeof serviceWorkerContainer.register !== 'function' ||
    typeof serviceWorkerContainer.addEventListener !== 'function' ||
    typeof serviceWorkerContainer.removeEventListener !== 'function' ||
    typeof serviceWorkerContainer.ready?.then !== 'function'
  ) {
    throw new OneKeyLocalError(
      'TradingView embed requires service worker support',
    );
  }
  return serviceWorkerContainer;
}

function isUsableServiceWorkerRegistration(
  registration: ServiceWorkerRegistration | undefined,
): registration is ServiceWorkerRegistration {
  return Boolean(
    registration &&
    typeof registration.addEventListener === 'function' &&
    typeof registration.removeEventListener === 'function',
  );
}

class TradingViewServiceWorkerControllerWaiter {
  private settled = false;

  private registration: ServiceWorkerRegistration | undefined;

  private timeout: ReturnType<typeof setTimeout> | undefined;

  private readonly observedWorkers = new Set<ServiceWorker>();

  private readonly controllerProbePromises = new WeakMap<
    ServiceWorker,
    Promise<boolean>
  >();

  constructor(
    private readonly container: ServiceWorkerContainer,
    private readonly resolve: (worker: ServiceWorker) => void,
    private readonly reject: (error: unknown) => void,
  ) {}

  start(): void {
    this.container.addEventListener(
      'controllerchange',
      this.handleControllerChange,
    );
    this.timeout = setTimeout(
      () =>
        this.fail(
          new OneKeyLocalError(
            'TradingView embed service worker controller timed out',
          ),
        ),
      SERVICE_WORKER_CONTROLLER_TIMEOUT_MS,
    );
    void this.resolveController().then((supported) => {
      if (!this.settled && !supported) {
        void this.registerServiceWorker();
      }
    });
  }

  private cleanup(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.container.removeEventListener(
      'controllerchange',
      this.handleControllerChange,
    );
    this.registration?.removeEventListener(
      'updatefound',
      this.handleUpdateFound,
    );
    this.observedWorkers.forEach((worker) => {
      worker.removeEventListener('statechange', this.handleWorkerStateChange);
    });
  }

  private finish(callback: () => void): void {
    if (this.settled) {
      return;
    }
    this.settled = true;
    this.cleanup();
    callback();
  }

  private fail(error: unknown): void {
    this.finish(() => this.reject(error));
  }

  private probeController(controller: ServiceWorker): Promise<boolean> {
    const pendingProbe = this.controllerProbePromises.get(controller);
    if (pendingProbe) {
      return pendingProbe;
    }
    const probePromise = supportsTradingViewEmbedProtocol(controller);
    this.controllerProbePromises.set(controller, probePromise);
    const clearProbe = () => {
      if (this.controllerProbePromises.get(controller) === probePromise) {
        this.controllerProbePromises.delete(controller);
      }
    };
    void probePromise.then(clearProbe, clearProbe);
    return probePromise;
  }

  private async resolveController(): Promise<boolean> {
    const controller = this.container.controller;
    if (!controller || this.settled) {
      return false;
    }
    const supported = await this.probeController(controller);
    if (this.settled) {
      return supported;
    }
    if (this.container.controller !== controller) {
      return this.resolveController();
    }
    if (supported) {
      this.finish(() => this.resolve(controller));
    }
    return supported;
  }

  private readonly handleControllerChange = () => {
    void this.resolveController();
  };

  private readonly handleWorkerStateChange = (event: Event) => {
    this.handleWorkerState(event.currentTarget as ServiceWorker | null);
  };

  private readonly handleUpdateFound = () => {
    this.observeWorker(this.registration?.installing);
  };

  private handleWorkerState(worker: ServiceWorker | null): void {
    if (!worker || this.settled || worker.state !== 'activated') {
      return;
    }
    void this.probeController(worker).then((supported) => {
      if (!supported || this.settled) {
        return;
      }
      worker.postMessage({ type: CLAIM_CLIENTS_MESSAGE_TYPE });
      void this.resolveController();
    });
  }

  private observeWorker(worker: ServiceWorker | null | undefined): void {
    if (!worker || this.settled || this.observedWorkers.has(worker)) {
      return;
    }
    if (
      typeof worker.addEventListener !== 'function' ||
      typeof worker.removeEventListener !== 'function'
    ) {
      this.fail(
        new OneKeyLocalError(
          'TradingView embed service worker events are unavailable',
        ),
      );
      return;
    }
    this.observedWorkers.add(worker);
    worker.addEventListener('statechange', this.handleWorkerStateChange);
    this.handleWorkerState(worker);
  }

  private requestClientClaim(
    registration: ServiceWorkerRegistration | undefined,
  ): void {
    if (this.settled) {
      return;
    }
    if (!registration) {
      this.fail(
        new OneKeyLocalError(
          'TradingView embed service worker registration is unavailable',
        ),
      );
      return;
    }
    this.observeWorker(registration.active);
    void this.resolveController();
  }

  private useRegistration(
    registration: ServiceWorkerRegistration | undefined,
  ): void {
    if (this.settled) {
      return;
    }
    if (!isUsableServiceWorkerRegistration(registration)) {
      this.fail(
        new OneKeyLocalError(
          'TradingView embed service worker registration is unavailable',
        ),
      );
      return;
    }
    this.registration = registration;
    registration.addEventListener('updatefound', this.handleUpdateFound);
    this.observeWorker(registration.installing);
    this.observeWorker(registration.waiting);
    this.observeWorker(registration.active);
    this.requestClientClaim(registration);
    void this.container.ready
      .then((readyRegistration) => this.requestClientClaim(readyRegistration))
      .catch((error: unknown) => this.fail(error));
  }

  private async registerServiceWorker(): Promise<void> {
    try {
      const registration = await this.container.register(
        TRADING_VIEW_EMBED_SERVICE_WORKER_PATH,
        {
          scope: '/',
          updateViaCache: 'none',
        },
      );
      this.useRegistration(registration);
    } catch (error) {
      this.fail(error);
    }
  }
}

function waitForControllingServiceWorker(): Promise<ServiceWorker> {
  const serviceWorkerContainer = getTradingViewServiceWorkerContainer();
  const pendingPromise = serviceWorkerControllerPromises.get(
    serviceWorkerContainer,
  );
  if (pendingPromise) {
    return pendingPromise;
  }
  const controllerPromise = new Promise<ServiceWorker>((resolve, reject) => {
    new TradingViewServiceWorkerControllerWaiter(
      serviceWorkerContainer,
      resolve,
      reject,
    ).start();
  }).finally(() => {
    serviceWorkerControllerPromises.delete(serviceWorkerContainer);
  });
  serviceWorkerControllerPromises.set(
    serviceWorkerContainer,
    controllerPromise,
  );
  return controllerPromise;
}

function ensureServiceWorkerPrefetch(
  controller: ServiceWorker,
  manifestUrl: string,
  manifest: ITradingViewEmbedManifest,
  locale: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => {
      channel.port1.close();
      reject(
        new OneKeyLocalError('TradingView embed service worker timed out'),
      );
    }, SERVICE_WORKER_PREFETCH_TIMEOUT_MS);
    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      clearTimeout(timeout);
      channel.port1.close();
      const response = event.data as {
        error?: string;
        ok?: boolean;
        version?: string;
      };
      if (response?.ok && response.version === manifest.version) {
        resolve();
        return;
      }
      reject(
        new OneKeyLocalError(
          response?.error ||
            'TradingView embed service worker version mismatch',
        ),
      );
    };
    controller.postMessage(
      {
        type: PREFETCH_MESSAGE_TYPE,
        payload: {
          locale,
          manifest,
          manifestUrl,
          manifestVersion: manifest.version,
        },
      },
      [channel.port2],
    );
  });
}

async function loadManifest(manifestUrl: string): Promise<{
  baseUrl: string;
  manifest: ITradingViewEmbedManifest;
}> {
  const response = await fetch(manifestUrl, {
    cache: 'no-store',
    credentials: 'omit',
    mode: 'cors',
    redirect: 'error',
  });
  if (!response.ok) {
    throw new OneKeyLocalError(
      `TradingView embed manifest request failed: ${response.status}`,
    );
  }
  const manifestPointer = (await response.json()) as unknown;
  if (!isValidManifestPointer(manifestPointer)) {
    throw new OneKeyLocalError('TradingView embed manifest is invalid');
  }
  const baseUrl = resolveManifestBaseUrl(manifestPointer, manifestUrl);
  let manifest: unknown = manifestPointer;
  if (!isValidManifest(manifest)) {
    const versionManifestResponse = await fetch(
      new URL('embed-manifest.json', baseUrl),
      {
        cache: 'no-store',
        credentials: 'omit',
        mode: 'cors',
        redirect: 'error',
      },
    );
    if (!versionManifestResponse.ok) {
      throw new OneKeyLocalError(
        `TradingView embed version manifest request failed: ${versionManifestResponse.status}`,
      );
    }
    manifest = (await versionManifestResponse.json()) as unknown;
    if (
      !isValidManifest(manifest) ||
      manifest.schema !== manifestPointer.schema ||
      manifest.version !== manifestPointer.version ||
      manifest.baseUrl !== manifestPointer.baseUrl ||
      manifest.entry !== manifestPointer.entry
    ) {
      throw new OneKeyLocalError(
        'TradingView embed version manifest does not match latest.json',
      );
    }
  }
  if (!isValidManifest(manifest)) {
    throw new OneKeyLocalError('TradingView embed manifest is invalid');
  }
  return {
    baseUrl,
    manifest,
  };
}

function getManifest(manifestUrl: string): Promise<{
  baseUrl: string;
  manifest: ITradingViewEmbedManifest;
}> {
  const existingPromise = manifestPromises.get(manifestUrl);
  if (existingPromise) {
    return existingPromise;
  }

  const manifestPromise = loadManifest(manifestUrl).catch((error) => {
    manifestPromises.delete(manifestUrl);
    throw error;
  });
  manifestPromises.set(manifestUrl, manifestPromise);
  return manifestPromise;
}

function loadStyle(
  file: string,
  embedBaseUrl: string,
  integrity?: string,
): Promise<void> {
  const url = resolveAssetUrl(file, embedBaseUrl).toString();
  const existing = document.querySelector<HTMLLinkElement>(
    `link[data-onekey-tradingview-embed-style="${CSS.escape(url)}"]`,
  );
  if (existing) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.crossOrigin = 'anonymous';
    link.dataset.onekeyTradingviewEmbedStyle = url;
    if (integrity?.startsWith('sha384-')) {
      link.integrity = integrity;
    }
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener(
      'error',
      () => {
        link.remove();
        reject(new OneKeyLocalError(`TradingView embed style failed: ${file}`));
      },
      { once: true },
    );
    document.head.appendChild(link);
  });
}

async function loadModule(
  manifestUrl: string,
  locale: string,
): Promise<ILoadedTradingViewEmbedModule> {
  const isRemoteManifest = !LOCAL_HOSTNAMES.has(new URL(manifestUrl).hostname);
  // Do not request a cross-origin manifest until the app service worker is
  // available to proxy and validate it. This also keeps unsupported browsers
  // from producing an expected-but-noisy CORS error before iframe fallback.
  const controller = isRemoteManifest
    ? await waitForControllingServiceWorker()
    : undefined;
  const { baseUrl, manifest } = await getManifest(manifestUrl);
  let runtimeAssetBaseUrl = baseUrl;
  if (isRemoteManifest && controller) {
    await ensureServiceWorkerPrefetch(
      controller,
      manifestUrl,
      manifest,
      locale,
    );
    const proxyBaseUrl = buildTradingViewEmbedProxyBaseUrl({
      appOrigin: globalThis.location.origin,
      sourceBaseUrl: baseUrl,
    });
    if (!proxyBaseUrl) {
      throw new OneKeyLocalError('TradingView embed proxy base URL is invalid');
    }
    if (new URL(proxyBaseUrl).origin !== globalThis.location.origin) {
      throw new OneKeyLocalError(
        'TradingView embed proxy must use the app origin',
      );
    }
    runtimeAssetBaseUrl = proxyBaseUrl;
  }
  const integrityByFile = new Map(
    manifest.assets.map((asset) => [asset.file, asset.integrity]),
  );
  await Promise.all(
    getManifestStyles(manifest).map((file) =>
      loadStyle(file, runtimeAssetBaseUrl, integrityByFile.get(file)),
    ),
  );
  const entryUrl = resolveAssetUrl(
    manifest.entry,
    runtimeAssetBaseUrl,
  ).toString();
  const module = (await import(
    /* webpackIgnore: true */ entryUrl
  )) as ITradingViewEmbedModule;
  if (
    typeof module.mountTradingView !== 'function' ||
    typeof module.postTradingViewMessage !== 'function'
  ) {
    throw new OneKeyLocalError('TradingView embed module contract is invalid');
  }
  return {
    assetBaseUrl: runtimeAssetBaseUrl,
    module,
  };
}

function resolveTradingViewLocale(runtimeUrl?: string): string {
  const locationHref = globalThis.location?.href || DEFAULT_MANIFEST_URL;
  const url = new URL(runtimeUrl || locationHref, locationHref);
  const locale = url.searchParams.get('locale') || 'en';
  const tradingViewLocale =
    tradingViewLocaleMap[locale as ILocaleJSONSymbol] || locale;
  return (
    TRADING_VIEW_BOOTSTRAP_LOCALE_ALIASES[tradingViewLocale] ||
    tradingViewLocale
  );
}

function resolveBootstrapAssets(
  manifest: ITradingViewEmbedManifest,
  locale: string,
): ITradingViewEmbedManifestAsset[] {
  const assetsByFile = new Map(
    manifest.assets.map((asset) => [asset.file, asset]),
  );
  const resolvedAssets =
    manifest.schema === 2
      ? [
          ...manifest.bootstrap.commonAssets,
          ...(Object.prototype.hasOwnProperty.call(
            manifest.bootstrap.localeAssets,
            locale,
          )
            ? manifest.bootstrap.localeAssets[locale]
            : manifest.bootstrap.localeAssets[
                manifest.bootstrap.defaultLocale
              ]),
        ].map((file) => assetsByFile.get(file))
      : (manifest.bootstrapAssets || []).map((file) => {
          const localizedFile = file.replace('__LANG__', locale);
          return (
            assetsByFile.get(localizedFile) ||
            assetsByFile.get(file.replace('__LANG__', 'en'))
          );
        });

  return Array.from(
    new Map(
      resolvedAssets
        .filter((asset): asset is ITradingViewEmbedManifestAsset =>
          Boolean(asset),
        )
        .map((asset) => [asset.file, asset]),
    ).values(),
  );
}

async function preloadBootstrapAsset(
  asset: ITradingViewEmbedManifestAsset,
  baseUrl: string,
): Promise<void> {
  const response = await fetch(resolveAssetUrl(asset.file, baseUrl), {
    cache: 'force-cache',
    credentials: 'omit',
    integrity: asset.integrity,
    mode: 'cors',
  });
  if (!response.ok) {
    throw new OneKeyLocalError(
      `TradingView bootstrap asset request failed: ${response.status}`,
    );
  }
  await response.arrayBuffer();
}

export function preloadTradingViewEmbedBootstrapAssets(
  runtimeUrl?: string,
): Promise<void> {
  const manifestUrl = resolveManifestUrl(runtimeUrl);
  const locale = resolveTradingViewLocale(runtimeUrl);
  const preloadKey = `${manifestUrl}:${locale}`;
  const existingPromise = bootstrapPreloadPromises.get(preloadKey);
  if (existingPromise) {
    return existingPromise;
  }

  const preloadPromise = (async () => {
    const isRemoteManifest = !LOCAL_HOSTNAMES.has(
      new URL(manifestUrl).hostname,
    );
    const controller = isRemoteManifest
      ? await waitForControllingServiceWorker()
      : undefined;
    const { baseUrl, manifest } = await getManifest(manifestUrl);
    if (controller) {
      await ensureServiceWorkerPrefetch(
        controller,
        manifestUrl,
        manifest,
        locale,
      );
      return;
    }
    const assets = resolveBootstrapAssets(manifest, locale);
    let index = 0;
    const workers = Array.from(
      { length: Math.min(BOOTSTRAP_PRELOAD_CONCURRENCY, assets.length) },
      async () => {
        while (index < assets.length) {
          const asset = assets[index];
          index += 1;
          await preloadBootstrapAsset(asset, baseUrl);
        }
      },
    );
    await Promise.all(workers);
  })().catch((error) => {
    bootstrapPreloadPromises.delete(preloadKey);
    throw error;
  });
  bootstrapPreloadPromises.set(preloadKey, preloadPromise);
  return preloadPromise;
}

export function loadTradingViewEmbedModule(
  runtimeUrl?: string,
): Promise<ILoadedTradingViewEmbedModule> {
  const manifestUrl = resolveManifestUrl(runtimeUrl);
  const locale = resolveTradingViewLocale(runtimeUrl);
  const moduleKey = `${manifestUrl}:${locale}`;
  const existingPromise = modulePromises.get(moduleKey);
  if (existingPromise) {
    return existingPromise;
  }

  const modulePromise = loadModule(manifestUrl, locale).catch((error) => {
    modulePromises.delete(moduleKey);
    throw error;
  });
  modulePromises.set(moduleKey, modulePromise);
  return modulePromise;
}
