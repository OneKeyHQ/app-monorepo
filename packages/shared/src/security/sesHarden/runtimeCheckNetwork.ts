import { OneKeyLocalError } from '../../errors';

import { assertSesBehavior, checkSesBehavior } from './runtimeCheckBehavior';
import { withSesCheckDeadline } from './runtimeCheckDeadline';
import { getSesNetworkFixture } from './runtimeCheckNetworkFixture';

import type { ISesRuntimeCheckItem } from './runtimeCheck';
import type { ISesCheckDeadline } from './runtimeCheckDeadline';
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

async function fetchFixture<T>(
  fixture: ISesNetworkFixture,
  path: string,
  consume: (response: Response) => Promise<T>,
  init?: RequestInit,
  parentSignal?: AbortSignal,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('x-onekey-ses-session', fixture.sessionId);
  return withSesCheckDeadline(
    'SES fetch fixture',
    async (signal) => {
      const response = await fetch(`${fixture.baseUrl}/${path}`, {
        ...init,
        headers,
        signal,
      });
      return consume(response);
    },
    { timeoutMs: 5000, signal: init?.signal ?? parentSignal },
  );
}

async function checkFetch(
  fixture: ISesNetworkFixture,
  signal: AbortSignal,
): Promise<string> {
  await fetchFixture(
    fixture,
    'json',
    async (response) => {
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
    },
    undefined,
    signal,
  );
  await fetchFixture(
    fixture,
    'echo',
    async (post) => {
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
    },
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"value":42}',
    },
    signal,
  );
  await fetchFixture(
    fixture,
    'missing',
    async (missing) => {
      assertSesBehavior(
        missing.status === 404 && !missing.ok,
        'fetch HTTP error must resolve with non-ok response',
      );
      await missing.text();
    },
    undefined,
    signal,
  );
  return 'GET status/headers, JSON/text, clone/bodyUsed, POST body, HTTP 404';
}

async function checkFetchAbort(
  fixture: ISesNetworkFixture,
  signal: AbortSignal,
): Promise<string> {
  for (const preAborted of [true, false]) {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) controller.abort();
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (preAborted) controller.abort();
    else timer = setTimeout(() => controller.abort(), 80);
    try {
      let aborted = false;
      try {
        // Exercise fetch's own cancellation contract rather than the deadline's cancellation error.
        await withSesCheckDeadline(
          'SES fetch cancellation',
          async () => {
            const response = await fetch(`${fixture.baseUrl}/slow`, {
              headers: { 'x-onekey-ses-session': fixture.sessionId },
              signal: controller.signal,
            });
            await response.text();
          },
          { timeoutMs: 5000, signal },
        );
      } catch (error) {
        aborted = controller.signal.aborted && isSesFetchAbort(error);
      }
      assertSesBehavior(
        aborted,
        `fetch ${preAborted ? 'pre' : 'in-flight'} abort must reject with a recognized cancellation error`,
      );
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      controller.abort();
    }
  }
  return 'pre-aborted and in-flight requests reject after signal cancellation; AbortError or Expo native FetchError';
}

function checkXhr(
  fixture: ISesNetworkFixture,
  mode: 'get' | 'post' | 'timeout' | 'abort',
  signal: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
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
      signal.removeEventListener('abort', onAbort);
      xhr.onload = null;
      xhr.onerror = null;
      xhr.ontimeout = null;
      xhr.onabort = null;
      if (error) reject(error);
      else resolve(mode);
    }
    try {
      if (signal.aborted) {
        finish(new OneKeyLocalError('XHR probe cancelled'));
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
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
      xhr.abort();
    }
  });
}

export async function runSesNetworkChecks(
  fixture = getSesNetworkFixture(),
  options?: ISesCheckDeadline,
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
    checkSesBehavior(
      'fetch requests',
      PURPOSE,
      (signal) => checkFetch(fixture, signal),
      options,
    ),
    checkSesBehavior(
      'fetch cancellation',
      PURPOSE,
      (signal) => checkFetchAbort(fixture, signal),
      options,
    ),
    checkSesBehavior(
      'XHR requests',
      PURPOSE,
      async (signal) =>
        `XHR ${await checkXhr(fixture, 'get', signal)}/${await checkXhr(fixture, 'post', signal)}: status, headers, body, readyState`,
      options,
    ),
    checkSesBehavior(
      'XHR timeout and abort',
      PURPOSE,
      async (signal) =>
        `XHR ${await checkXhr(fixture, 'timeout', signal)}/${await checkXhr(fixture, 'abort', signal)}: terminal events`,
      options,
    ),
  ]);
}
