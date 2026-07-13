import { useEffect, useState } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import CreateAvatarListWorker from './createAvatarList.worker.js';

import type { IUseBlockieImageUri } from './type.js';

// @ts-expect-error
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
const worker = new CreateAvatarListWorker() as Worker;

const events = new Map<string, ((data: string) => void)[]>();

// Main-thread cache of resolved blockie data URIs, keyed by blockie id.
// The web worker keeps its own cache but every request still requires a
// `postMessage` round-trip + a React re-render before the URI reaches the
// `<img>` element, so a freshly mounted AccountAvatar always renders an
// empty `src` on its first frame. Caching on the main thread lets the
// `useState` initial value be the resolved URI, eliminating the
// "blank avatar -> blockie" flash whenever the same address is rendered
// again (re-open the account selector, scroll a row back into view, the
// same address shown in another panel, etc.).
// Mirrors the eviction policy of `shownAvatarSourcesCache` in
// AccountAvatar.tsx so both caches stay symmetric and bounded.
const MAIN_THREAD_CACHE_LIMIT = 500;
const mainThreadCache = new Map<string, string>();

worker.onmessage = (event: MessageEvent<{ id: string; data: string }>) => {
  const { id, data } = event.data;
  if (data) {
    if (mainThreadCache.size >= MAIN_THREAD_CACHE_LIMIT) {
      mainThreadCache.clear();
    }
    mainThreadCache.set(id, data);
  } else {
    // Worker returned empty data — don't poison the cache, but log so
    // we notice if this regresses into a silent retry loop (every new
    // mount of the same id would re-post since we never cache "").
    defaultLogger.app.error.log(
      `blockie worker returned empty data for id=${id}`,
    );
  }
  const callbacks = events.get(id);
  callbacks?.forEach((callback) => {
    callback(data);
  });
  events.delete(id);
};

function makeBlockieImageUri(id: string) {
  return new Promise<string>((resolve) => {
    const cached = mainThreadCache.get(id);
    if (cached) {
      resolve(cached);
      return;
    }
    const callbacks = events.get(id) || [];
    const isFirstSubscriber = callbacks.length === 0;
    callbacks.push(resolve);
    events.set(id, callbacks);
    // Only post once per id while a request is in flight; additional
    // callers get attached to the same pending promise.
    if (isFirstSubscriber) {
      worker.postMessage(id);
    }
  });
}

export const useBlockieImageUri: IUseBlockieImageUri = (id?: string) => {
  const [uri, setUri] = useState<string>(() =>
    id ? (mainThreadCache.get(id) ?? '') : '',
  );

  useEffect(() => {
    if (!id) {
      setUri('');
      return;
    }
    // Fast path: cache hit. No async work is started here, so no
    // cleanup is needed — the early return is intentional.
    const cached = mainThreadCache.get(id);
    if (cached) {
      setUri((prev) => (prev === cached ? prev : cached));
      return;
    }
    let cancelled = false;
    makeBlockieImageUri(id)
      .then((imageUri: string) => {
        if (cancelled || !imageUri) return;
        setUri(imageUri);
      })
      .catch((error) => {
        defaultLogger.app.error.log(
          `makeBlockieImageUri rejected for id=${id}: ${
            (error as Error)?.message ?? String(error)
          }`,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return uri;
};
