const TRADING_VIEW_PRECONNECT_ATTRIBUTE = 'data-onekey-trading-view-preconnect';
const TRADING_VIEW_WARMUP_IFRAME_ATTRIBUTE = 'data-onekey-trading-view-warmup';
const TRADING_VIEW_WARMUP_MAX_LIFETIME_MS = 45_000;
const TRADING_VIEW_WARMUP_LOAD_GRACE_MS = 15_000;
const TRADING_VIEW_WARMUP_IDLE_TIMEOUT_MS = 2000;

interface INetworkInformation {
  effectiveType?: string;
  saveData?: boolean;
}

interface INavigatorWithConnection extends Navigator {
  connection?: INetworkInformation;
}

let scheduledWarmupHandle: number | undefined;
let warmupStarted = false;

function getTradingViewOrigin(baseUrl: string) {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return undefined;
  }
}

function hasResourceHint(rel: 'dns-prefetch' | 'preconnect', origin: string) {
  return Boolean(
    document.head.querySelector(
      `link[${TRADING_VIEW_PRECONNECT_ATTRIBUTE}="${rel}"][href="${origin}"]`,
    ),
  );
}

function appendResourceHint(
  rel: 'dns-prefetch' | 'preconnect',
  origin: string,
) {
  if (hasResourceHint(rel, origin)) {
    return;
  }

  const link = document.createElement('link');
  link.rel = rel;
  link.href = origin;
  link.setAttribute(TRADING_VIEW_PRECONNECT_ATTRIBUTE, rel);
  if (rel === 'preconnect') {
    link.crossOrigin = 'anonymous';
  }
  document.head.appendChild(link);
}

export function preconnectTradingView(baseUrl: string) {
  if (typeof document === 'undefined') {
    return;
  }

  const origin = getTradingViewOrigin(baseUrl);
  if (!origin) {
    return;
  }

  appendResourceHint('dns-prefetch', origin);
  appendResourceHint('preconnect', origin);
}

function shouldSkipSpeculativeWarmup() {
  const connection = (navigator as INavigatorWithConnection).connection;
  if (connection?.saveData) {
    return true;
  }

  return (
    connection?.effectiveType === 'slow-2g' ||
    connection?.effectiveType === '2g'
  );
}

function buildWarmupUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  url.searchParams.set('platform', 'web');
  url.searchParams.set('type', 'market');
  url.searchParams.set('symbol', 'crypto');
  url.searchParams.set('decimal', '8');
  url.searchParams.set('storageNamespace', 'market-web-warmup');
  return url.toString();
}

export function startTradingViewColdStartWarmup(baseUrl: string) {
  if (
    warmupStarted ||
    typeof document === 'undefined' ||
    typeof navigator === 'undefined' ||
    shouldSkipSpeculativeWarmup()
  ) {
    return;
  }

  warmupStarted = true;
  preconnectTradingView(baseUrl);

  const iframe = document.createElement('iframe');
  iframe.src = buildWarmupUrl(baseUrl);
  iframe.title = 'TradingView resource warmup';
  iframe.tabIndex = -1;
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute(TRADING_VIEW_WARMUP_IFRAME_ATTRIBUTE, 'true');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '-10000px';
  iframe.style.width = '1280px';
  iframe.style.height = '720px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';

  let cleanupTimer = globalThis.setTimeout(() => {
    iframe.remove();
  }, TRADING_VIEW_WARMUP_MAX_LIFETIME_MS);

  iframe.addEventListener(
    'load',
    () => {
      globalThis.clearTimeout(cleanupTimer);
      cleanupTimer = globalThis.setTimeout(() => {
        iframe.remove();
      }, TRADING_VIEW_WARMUP_LOAD_GRACE_MS);
    },
    { once: true },
  );

  document.body.appendChild(iframe);
}

export function scheduleTradingViewColdStartWarmup(baseUrl: string) {
  if (
    scheduledWarmupHandle !== undefined ||
    warmupStarted ||
    typeof globalThis.window === 'undefined'
  ) {
    return;
  }

  preconnectTradingView(baseUrl);

  if (typeof globalThis.requestIdleCallback === 'function') {
    scheduledWarmupHandle = globalThis.requestIdleCallback(
      () => {
        scheduledWarmupHandle = undefined;
        startTradingViewColdStartWarmup(baseUrl);
      },
      { timeout: TRADING_VIEW_WARMUP_IDLE_TIMEOUT_MS },
    );
    return;
  }

  scheduledWarmupHandle = globalThis.setTimeout(() => {
    scheduledWarmupHandle = undefined;
    startTradingViewColdStartWarmup(baseUrl);
  }, TRADING_VIEW_WARMUP_IDLE_TIMEOUT_MS);
}
