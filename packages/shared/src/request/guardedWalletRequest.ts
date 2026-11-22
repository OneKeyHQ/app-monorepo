import axios from 'axios';

import platformEnv from '../platformEnv';

import { createFetchInterceptor, fetchOrigin } from './createFetchInterceptor';
import { AVAILABILITY_COUNTED_FETCH_OPTION } from './requestConst';

import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';

export type IGuardedWalletRequest = {
  expectedURL: string;
  admit: (headers: Headers) => Promise<(() => boolean) | undefined>;
};

declare module 'axios' {
  interface AxiosRequestConfig {
    $oneKeyGuardedWalletRequest?: IGuardedWalletRequest;
  }
}

export function isGuardedWalletRequestTransportAvailable() {
  return (
    !platformEnv.isNative &&
    !platformEnv.isDesktop &&
    (platformEnv.isWeb || platformEnv.isExtension) &&
    typeof globalThis.Request === 'function' &&
    typeof globalThis.Response === 'function' &&
    typeof globalThis.fetch === 'function'
  );
}

function cancelled(config?: InternalAxiosRequestConfig) {
  return new axios.CanceledError(
    'The Cloud Wallet request was cancelled.',
    config,
  );
}

type IGuardedRequestContext = {
  admission: IGuardedWalletRequest;
  verified: (url: string) => void;
};
type IFetchOptions = RequestInit & {
  oneKeyWalletContext?: IGuardedRequestContext;
};

const activeRequests = new WeakMap<Request, IGuardedRequestContext>();
const guardedBrowserFetch = createFetchInterceptor(async (input, options) => {
  if (!(input instanceof Request)) throw cancelled();
  const context = activeRequests.get(input);
  const signal = options?.signal ?? input.signal;
  if (!context || signal.aborted) throw cancelled();

  // Keep the ordinary Axios headers through the Fetch policy wrapper without
  // discarding any headers it added (the first construction ran both client
  // and global Axios interceptors already).
  const headers = new Headers(options?.headers);
  input.headers.forEach((value, key) => headers.set(key, value));
  const requestInit = { ...options, headers, redirect: 'error' as const };
  const isCurrent = await context.admission.admit(headers);
  if (signal.aborted || !isCurrent?.()) throw cancelled();
  const response = await fetchOrigin.call(globalThis, input, requestInit);
  if (
    signal.aborted ||
    !isCurrent() ||
    response.redirected ||
    response.url !== context.admission.expectedURL
  )
    throw cancelled();
  return response;
});

function matchesExpectedRequest(request: Request, expectedURL: string) {
  const url = new URL(request.url);
  return (
    request.url === expectedURL &&
    request.method === 'POST' &&
    request.redirect === 'error' &&
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    (url.pathname === '/prime/v1/sync/check' ||
      url.pathname === '/prime/v1/sync/upload')
  );
}

// Axios caches adapter factories by env.fetch identity. Keep this callable
// stable so that per-request admission closures are never retained by Axios.
const invokeGuardedFetch = async (
  request: RequestInfo | URL,
  options?: IFetchOptions,
) => {
  const context = options?.oneKeyWalletContext;
  if (
    !context ||
    !(request instanceof Request) ||
    !matchesExpectedRequest(request, context.admission.expectedURL) ||
    request.signal.aborted
  )
    throw cancelled();
  activeRequests.set(request, context);
  try {
    // All Axios-owned method, body, headers, credentials and signal are
    // already on the Request. Do not pass the internal context to fetch.
    const requestInit: RequestInit & Record<string, unknown> = {
      redirect: 'error',
      [AVAILABILITY_COUNTED_FETCH_OPTION]: true,
    };
    const response = await guardedBrowserFetch(request, requestInit);
    if (
      request.signal.aborted ||
      response.redirected ||
      response.url !== context.admission.expectedURL
    )
      throw cancelled();
    context.verified(response.url);
    return response;
  } finally {
    activeRequests.delete(request);
  }
};

export async function dispatchGuardedWalletRequest(
  config: InternalAxiosRequestConfig,
) {
  const admission = config.$oneKeyGuardedWalletRequest;
  if (!admission || !isGuardedWalletRequestTransportAvailable())
    throw cancelled(config);

  let finalURL: string | undefined;
  const context: IGuardedRequestContext = {
    admission,
    verified: (url) => {
      finalURL = url;
    },
  };
  const protectedConfig: InternalAxiosRequestConfig = {
    ...config,
    env: { fetch: invokeGuardedFetch },
    fetchOptions: { redirect: 'error', oneKeyWalletContext: context },
    // Axios maps maxRedirects=0 to "manual", overriding Fetch's stricter
    // "error". Supply only the explicit WHATWG policy for this request.
    maxRedirects: undefined,
  };
  // Axios 1.20's adapter selector takes the resolved request config, which
  // its public declaration omits. Never use a list with fallback adapters.
  const adapter = Reflect.apply(axios.getAdapter, axios, [
    'fetch',
    protectedConfig,
  ]) as AxiosAdapter;
  const response = await adapter(protectedConfig);
  if (!finalURL) throw cancelled(config);
  return {
    ...response,
    request: { responseURL: finalURL, oneKeyVerifiedFinalUrl: finalURL },
  };
}
