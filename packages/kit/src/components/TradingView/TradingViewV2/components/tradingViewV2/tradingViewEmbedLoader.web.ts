import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

interface ITradingViewEmbedManifestAsset {
  file: string;
  integrity: string;
  size: number;
}

interface ITradingViewEmbedManifest {
  schema: number;
  version: string;
  baseUrl: string;
  entry: string;
  styles: string[];
  bootstrapAssets?: string[];
  assets: ITradingViewEmbedManifestAsset[];
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
}

export interface ILoadedTradingViewEmbedModule {
  assetBaseUrl: string;
  module: ITradingViewEmbedModule;
}

const modulePromises = new Map<
  string,
  Promise<ILoadedTradingViewEmbedModule>
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
const BOOTSTRAP_PRELOAD_CONCURRENCY = 3;
const TRADING_VIEW_LOCALE_MAP: Record<string, string> = {
  'ja-JP': 'ja',
  'ko-KR': 'ko',
  'zh-CN': 'zh',
  'zh-HK': 'zh_TW',
  'zh-TW': 'zh_TW',
};

function resolveManifestUrl(runtimeUrl?: string): string {
  const locationHref = globalThis.location?.href || DEFAULT_MANIFEST_URL;
  const locationOrigin =
    globalThis.location?.origin || new URL(locationHref).origin;
  const configuredManifestUrl =
    process.env.TRADINGVIEW_EMBED_MANIFEST_URL?.trim();
  if (configuredManifestUrl) {
    return new URL(configuredManifestUrl, locationOrigin).toString();
  }

  if (runtimeUrl) {
    const runtimeOrigin = new URL(runtimeUrl, locationHref);
    const manifestPath = LOCAL_HOSTNAMES.has(runtimeOrigin.hostname)
      ? '/latest.json'
      : '/embed/latest.json';
    return new URL(manifestPath, runtimeOrigin.origin).toString();
  }

  return new URL(DEFAULT_MANIFEST_URL, locationOrigin).toString();
}

function resolveManifestBaseUrl(
  manifest: ITradingViewEmbedManifest,
  manifestUrl: string,
): string {
  const url = new URL(manifest.baseUrl, manifestUrl);
  if (url.origin !== new URL(manifestUrl).origin) {
    throw new OneKeyLocalError('TradingView embed base URL origin mismatch');
  }
  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`;
  }
  return url.toString();
}

function isValidRelativeAssetPath(file: string): boolean {
  return (
    Boolean(file) &&
    !file.startsWith('/') &&
    !file.includes('..') &&
    !file.includes('\\')
  );
}

function isValidManifest(value: unknown): value is ITradingViewEmbedManifest {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const manifest = value as Partial<ITradingViewEmbedManifest>;
  return (
    manifest.schema === 1 &&
    typeof manifest.version === 'string' &&
    Boolean(manifest.version) &&
    typeof manifest.baseUrl === 'string' &&
    Boolean(manifest.baseUrl) &&
    typeof manifest.entry === 'string' &&
    isValidRelativeAssetPath(manifest.entry) &&
    Array.isArray(manifest.styles) &&
    manifest.styles.every(isValidRelativeAssetPath) &&
    (manifest.bootstrapAssets === undefined ||
      (Array.isArray(manifest.bootstrapAssets) &&
        manifest.bootstrapAssets.every(isValidRelativeAssetPath))) &&
    Array.isArray(manifest.assets) &&
    manifest.assets.every(
      (asset) =>
        isValidRelativeAssetPath(asset?.file) &&
        typeof asset.integrity === 'string' &&
        asset.integrity.startsWith('sha384-') &&
        typeof asset.size === 'number' &&
        Number.isSafeInteger(asset.size) &&
        asset.size >= 0,
    )
  );
}

async function loadManifest(manifestUrl: string): Promise<{
  baseUrl: string;
  manifest: ITradingViewEmbedManifest;
}> {
  const response = await fetch(manifestUrl, {
    credentials: 'omit',
  });
  if (!response.ok) {
    throw new OneKeyLocalError(
      `TradingView embed manifest request failed: ${response.status}`,
    );
  }
  const manifest = (await response.json()) as unknown;
  if (!isValidManifest(manifest)) {
    throw new OneKeyLocalError('TradingView embed manifest is invalid');
  }
  return {
    baseUrl: resolveManifestBaseUrl(manifest, manifestUrl),
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
  const url = new URL(file, embedBaseUrl).toString();
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
): Promise<ILoadedTradingViewEmbedModule> {
  const { baseUrl, manifest } = await getManifest(manifestUrl);
  const integrityByFile = new Map(
    manifest.assets.map((asset) => [asset.file, asset.integrity]),
  );
  await Promise.all(
    manifest.styles.map((file) =>
      loadStyle(file, baseUrl, integrityByFile.get(file)),
    ),
  );
  const entryUrl = new URL(manifest.entry, baseUrl).toString();
  const module = (await import(
    /* webpackIgnore: true */ entryUrl
  )) as ITradingViewEmbedModule;
  return {
    assetBaseUrl: baseUrl,
    module,
  };
}

function resolveTradingViewLocale(runtimeUrl?: string): string {
  const locationHref = globalThis.location?.href || DEFAULT_MANIFEST_URL;
  const url = new URL(runtimeUrl || locationHref, locationHref);
  const locale = url.searchParams.get('locale') || 'en';
  return TRADING_VIEW_LOCALE_MAP[locale] || locale;
}

function resolveBootstrapAssets(
  manifest: ITradingViewEmbedManifest,
  locale: string,
): ITradingViewEmbedManifestAsset[] {
  const assetsByFile = new Map(
    manifest.assets.map((asset) => [asset.file, asset]),
  );
  const resolvedAssets = (manifest.bootstrapAssets || []).map((file) => {
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
  const response = await fetch(new URL(asset.file, baseUrl), {
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

  const preloadPromise = getManifest(manifestUrl)
    .then(async ({ baseUrl, manifest }) => {
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
    })
    .catch((error) => {
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
  const existingPromise = modulePromises.get(manifestUrl);
  if (existingPromise) {
    return existingPromise;
  }

  const modulePromise = loadModule(manifestUrl).catch((error) => {
    modulePromises.delete(manifestUrl);
    throw error;
  });
  modulePromises.set(manifestUrl, modulePromise);
  return modulePromise;
}
