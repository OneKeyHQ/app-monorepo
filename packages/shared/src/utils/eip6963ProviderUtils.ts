import type { EIP6963ProviderDetail } from 'mipd';

const EIP6963_ANNOUNCE_PROVIDER_EVENT = 'eip6963:announceProvider';
const EIP6963_REQUEST_PROVIDER_EVENT = 'eip6963:requestProvider';
const ETHEREUM_INITIALIZED_EVENT = 'ethereum#initialized';
const PROVIDER_REQUEST_RETRY_DELAYS = [300, 1000];

type IEIP6963ProviderListener = () => void;

let cachedProviders: readonly EIP6963ProviderDetail[] = [];
const providerDetailsMap = new Map<string, EIP6963ProviderDetail>();
const listeners = new Set<IEIP6963ProviderListener>();
let hasStartedWatchingProviders = false;

function canUseEIP6963EventTarget() {
  return (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.addEventListener === 'function' &&
    typeof globalThis.dispatchEvent === 'function' &&
    typeof CustomEvent === 'function'
  );
}

function emitProvidersChanged() {
  cachedProviders = Array.from(providerDetailsMap.values());
  listeners.forEach((listener) => listener());
}

function buildProviderCacheKey(providerDetail: EIP6963ProviderDetail) {
  return `${providerDetail.info.uuid}::${providerDetail.info.rdns}`;
}

function isValidProviderDetail(
  detail: unknown,
): detail is EIP6963ProviderDetail {
  const providerDetail = detail as Partial<EIP6963ProviderDetail> | undefined;

  return Boolean(
    providerDetail?.info &&
    typeof providerDetail.info.uuid === 'string' &&
    typeof providerDetail.info.name === 'string' &&
    typeof providerDetail.info.rdns === 'string' &&
    typeof providerDetail.info.icon === 'string' &&
    providerDetail.provider,
  );
}

function handleAnnounceProvider(event: Event) {
  const providerDetail = (event as CustomEvent<unknown>).detail;
  if (!isValidProviderDetail(providerDetail)) {
    return;
  }

  const cacheKey = buildProviderCacheKey(providerDetail);
  const existingProviderDetail = providerDetailsMap.get(cacheKey);
  if (existingProviderDetail?.provider === providerDetail.provider) {
    return;
  }

  providerDetailsMap.set(cacheKey, providerDetail);
  emitProvidersChanged();
}

export function requestEIP6963Providers() {
  if (!canUseEIP6963EventTarget()) {
    return;
  }

  globalThis.dispatchEvent(new CustomEvent(EIP6963_REQUEST_PROVIDER_EVENT));
}

export function requestEIP6963ProvidersWithRetry() {
  requestEIP6963Providers();

  PROVIDER_REQUEST_RETRY_DELAYS.forEach((delay) => {
    setTimeout(() => {
      requestEIP6963Providers();
    }, delay);
  });
}

export function ensureEIP6963ProviderWatcherStarted() {
  if (hasStartedWatchingProviders || !canUseEIP6963EventTarget()) {
    return;
  }

  hasStartedWatchingProviders = true;

  globalThis.addEventListener(
    EIP6963_ANNOUNCE_PROVIDER_EVENT,
    handleAnnounceProvider as EventListener,
  );
  globalThis.addEventListener(
    ETHEREUM_INITIALIZED_EVENT,
    requestEIP6963Providers,
  );

  requestEIP6963ProvidersWithRetry();
}

export function subscribeEIP6963Providers(listener: IEIP6963ProviderListener) {
  ensureEIP6963ProviderWatcherStarted();

  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function getEIP6963Providers() {
  ensureEIP6963ProviderWatcherStarted();
  return cachedProviders;
}
