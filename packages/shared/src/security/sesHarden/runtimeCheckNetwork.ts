import { OneKeyLocalError } from '../../errors';

import { assertSesBehavior, checkSesBehavior } from './runtimeCheckBehavior';
import { getSesNetworkFixture } from './runtimeCheckNetworkFixture';

import type { ISesRuntimeCheckItem } from './runtimeCheck';
import type { ISesNetworkFixture } from './runtimeCheckNetworkFixture';

const PURPOSE = '通过当前 DevSession 固定响应验证真实网络行为。';
const MARKER = 'onekey-ses-fixture-v1';

export function isSesFetchAbort(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if ('name' in error && error.name === 'AbortError') return true;
  // Native fetch wraps DOM aborts in FetchError and preserves the cause.
  const cause: unknown = 'cause' in error ? error.cause : undefined;
  if (
    typeof cause === 'object' &&
    cause !== null &&
    'name' in cause &&
    cause.name === 'AbortError'
  )
    return true;
  // Expo's in-flight native cancellation drops the cause in createFromError.
  return (
    error instanceof Error &&
    error.constructor.name === 'FetchError' &&
    error.message === 'fetch failed: Fetch request has been canceled'
  );
}

async function fetchFixture(
  fixture: ISesNetworkFixture,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const headers = new Headers(init?.headers);
  headers.set('x-onekey-ses-session', fixture.sessionId);
  const onAbort = () => controller.abort();
  init?.signal?.addEventListener('abort', onAbort, { once: true });
  if (init?.signal?.aborted) controller.abort();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetch(`${fixture.baseUrl}/${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      }),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new OneKeyLocalError('SES fetch fixture exceeded 5s'));
        }, 5000);
      }),
    ]);
  } finally {
    init?.signal?.removeEventListener('abort', onAbort);
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

async function checkFetch(fixture: ISesNetworkFixture): Promise<string> {
  const response = await fetchFixture(fixture, 'json');
  assertSesBehavior(
    response.status === 200 &&
      response.ok &&
      response.headers.get('x-onekey-ses-fixture') === MARKER,
    'fetch status/headers',
  );
  const cloned = response.clone();
  const json = (await response.json()) as {
    marker?: string;
    value?: number;
    method?: string;
  };
  const clonedJson = JSON.parse(await cloned.text()) as typeof json;
  assertSesBehavior(
    json.marker === MARKER &&
      json.method === 'GET' &&
      json.value === 42 &&
      clonedJson.value === 42 &&
      response.bodyUsed,
    'fetch body/clone',
  );
  const post = await fetchFixture(fixture, 'echo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"value":42}',
  });
  const result = (await post.json()) as {
    method?: string;
    value?: number;
    marker?: string;
  };
  assertSesBehavior(
    post.status === 200 &&
      result.method === 'POST' &&
      result.value === 42 &&
      result.marker === MARKER,
    'fetch POST echo',
  );
  const missing = await fetchFixture(fixture, 'missing');
  assertSesBehavior(
    missing.status === 404 && !missing.ok,
    'fetch HTTP error must resolve with non-ok response',
  );
  return 'GET status/headers, JSON/text, clone/bodyUsed, POST body, HTTP 404';
}

async function checkFetchAbort(fixture: ISesNetworkFixture): Promise<string> {
  for (const preAborted of [true, false]) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (preAborted) controller.abort();
    else timer = setTimeout(() => controller.abort(), 80);
    try {
      let aborted = false;
      try {
        await fetchFixture(fixture, 'slow', { signal: controller.signal });
      } catch (error) {
        aborted = controller.signal.aborted && isSesFetchAbort(error);
      }
      assertSesBehavior(
        aborted,
        `fetch ${preAborted ? 'pre' : 'in-flight'} abort must reject with a recognized cancellation error`,
      );
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
  return 'pre-aborted and in-flight requests reject after signal cancellation; AbortError or Expo native FetchError';
}

function checkXhr(
  fixture: ISesNetworkFixture,
  mode: 'get' | 'post' | 'timeout' | 'abort',
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let abortTimer: ReturnType<typeof setTimeout> | undefined;
    let finished = false;
    const watchdog = setTimeout(() => {
      finish(new OneKeyLocalError(`XHR ${mode} exceeded 5s`));
      xhr.abort();
    }, 5000);
    function finish(error?: unknown) {
      if (finished) return;
      finished = true;
      clearTimeout(watchdog);
      if (abortTimer !== undefined) clearTimeout(abortTimer);
      xhr.onload = null;
      xhr.onerror = null;
      xhr.ontimeout = null;
      xhr.onabort = null;
      if (error) reject(error);
      else resolve(mode);
    }
    try {
      const slow = mode === 'timeout' || mode === 'abort';
      let route = mode === 'post' ? 'echo' : 'json';
      if (slow) route = 'slow';
      xhr.open(mode === 'post' ? 'POST' : 'GET', `${fixture.baseUrl}/${route}`);
      xhr.setRequestHeader('x-onekey-ses-session', fixture.sessionId);
      xhr.timeout = mode === 'timeout' ? 80 : 4000;
      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText) as {
            marker?: string;
            value?: number;
            method?: string;
          };
          assertSesBehavior(
            !slow &&
              xhr.status === 200 &&
              xhr.readyState === 4 &&
              json.marker === MARKER &&
              json.value === 42 &&
              json.method === (mode === 'post' ? 'POST' : 'GET') &&
              xhr.getResponseHeader('x-onekey-ses-fixture') === MARKER,
            `XHR ${mode} response mismatch`,
          );
          finish();
        } catch (error) {
          finish(error);
        }
      };
      xhr.onerror = () =>
        finish(new OneKeyLocalError(`XHR ${mode} network error`));
      xhr.ontimeout = () =>
        finish(
          mode === 'timeout'
            ? undefined
            : new OneKeyLocalError(`unexpected XHR ${mode} timeout`),
        );
      xhr.onabort = () =>
        finish(
          mode === 'abort'
            ? undefined
            : new OneKeyLocalError(`unexpected XHR ${mode} abort`),
        );
      if (mode === 'post')
        xhr.setRequestHeader('content-type', 'application/json');
      xhr.send(mode === 'post' ? '{"value":42}' : undefined);
      if (mode === 'abort') abortTimer = setTimeout(() => xhr.abort(), 80);
    } catch (error) {
      finish(error);
    }
  });
}

export async function runSesNetworkChecks(
  fixture = getSesNetworkFixture(),
): Promise<ISesRuntimeCheckItem[]> {
  if (!fixture) {
    return [
      'fetch requests',
      'fetch cancellation',
      'XHR requests',
      'XHR timeout and abort',
    ].map((name) => ({
      name,
      dimension: 'functionality',
      status: 'info',
      purpose: PURPOSE,
      detail:
        'Requires a native Debug DevSession fixture; real network behavior was not exercised.',
    }));
  }
  return Promise.all([
    checkSesBehavior('fetch requests', PURPOSE, () => checkFetch(fixture)),
    checkSesBehavior('fetch cancellation', PURPOSE, () =>
      checkFetchAbort(fixture),
    ),
    checkSesBehavior(
      'XHR requests',
      PURPOSE,
      async () =>
        `XHR ${await checkXhr(fixture, 'get')}/${await checkXhr(fixture, 'post')}: status, headers, body, readyState`,
    ),
    checkSesBehavior(
      'XHR timeout and abort',
      PURPOSE,
      async () =>
        `XHR ${await checkXhr(fixture, 'timeout')}/${await checkXhr(fixture, 'abort')}: terminal events`,
    ),
  ]);
}
