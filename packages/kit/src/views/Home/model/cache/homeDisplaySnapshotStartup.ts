import { globalColdStartHydrationReadyHandler } from '@onekeyhq/kit-bg/src/states/jotai/coldStartReady';
import { perfMark } from '@onekeyhq/shared/src/performance/mark';

import { loadHomeStartupPreparedDisplaySnapshot } from './homeStartupPreparedDisplaySnapshot';

void globalColdStartHydrationReadyHandler.ready
  .then(() => {
    const startedAt = Date.now();
    perfMark('Home:displayCache:startupLoadStart');
    const handle = loadHomeStartupPreparedDisplaySnapshot();
    if (!handle) {
      perfMark('Home:displayCache:startupLoadDone', {
        elapsedMs: Date.now() - startedAt,
        hit: false,
      });
      return;
    }
    if (handle.kind === 'ready') {
      perfMark('Home:displayCache:startupLoadDone', {
        elapsedMs: Date.now() - startedAt,
        hit: Boolean(handle.result.displaySnapshot),
      });
      return;
    }
    return handle.task.then((result) => {
      perfMark('Home:displayCache:startupLoadDone', {
        elapsedMs: Date.now() - startedAt,
        hit: Boolean(result.displaySnapshot),
      });
    });
  })
  .catch(() => undefined);
