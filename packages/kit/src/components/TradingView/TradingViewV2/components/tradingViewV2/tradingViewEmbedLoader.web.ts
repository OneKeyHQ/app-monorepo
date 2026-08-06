import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

interface ITradingViewEmbedManifestAsset {
  file: string;
  integrity: string;
  size: number;
}

interface ITradingViewEmbedManifest {
  schema: number;
  version: string;
  entry: string;
  styles: string[];
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

const embedBaseUrl = new URL(
  'tradingview-embed/',
  new URL(process.env.PUBLIC_URL || '/', globalThis.location.origin),
).toString();

let modulePromise: Promise<ITradingViewEmbedModule> | undefined;

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
    typeof manifest.entry === 'string' &&
    isValidRelativeAssetPath(manifest.entry) &&
    Array.isArray(manifest.styles) &&
    manifest.styles.every(isValidRelativeAssetPath) &&
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

async function loadManifest(): Promise<ITradingViewEmbedManifest> {
  const response = await fetch(new URL('embed-manifest.json', embedBaseUrl), {
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
  return manifest;
}

function loadStyle(file: string, integrity?: string): Promise<void> {
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
      () =>
        reject(new OneKeyLocalError(`TradingView embed style failed: ${file}`)),
      { once: true },
    );
    document.head.appendChild(link);
  });
}

async function loadModule(): Promise<ITradingViewEmbedModule> {
  const manifest = await loadManifest();
  const integrityByFile = new Map(
    manifest.assets.map((asset) => [asset.file, asset.integrity]),
  );
  await Promise.all(
    manifest.styles.map((file) => loadStyle(file, integrityByFile.get(file))),
  );
  const entryUrl = new URL(manifest.entry, embedBaseUrl).toString();
  return import(
    /* webpackIgnore: true */ entryUrl
  ) as Promise<ITradingViewEmbedModule>;
}

export function loadTradingViewEmbedModule(): Promise<ITradingViewEmbedModule> {
  modulePromise ??= loadModule().catch((error) => {
    modulePromise = undefined;
    throw error;
  });
  return modulePromise;
}

export function getTradingViewEmbedBaseUrl(): string {
  return embedBaseUrl;
}
