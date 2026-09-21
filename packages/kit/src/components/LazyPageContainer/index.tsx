import { useEffect, useRef } from 'react';
import type { PropsWithChildren } from 'react';

import { useIsFocused, useRoute } from '@react-navigation/core';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { useIsFirstFocused } from '../../hooks/useIsFirstFocused';

export function LazyPageContainer({
  children,
  eager,
}: PropsWithChildren<{ eager?: boolean }>) {
  const route = useRoute();
  const isPageFocused = useIsFocused();
  const isFirstFocused = useIsFirstFocused(isPageFocused);
  // A root tab scene is only ever mounted while blurred because the navigator
  // preloaded it: a tab that was never visited and never preloaded renders
  // TabView's lazy placeholder and never reaches this component. So a first
  // render without focus means "preloaded", and the page tree should be built
  // during that idle window instead of on the tap — otherwise preloading
  // mounts an empty shell and the user still waits for the whole page on
  // first open.
  const preloaded = useRef(!isPageFocused);
  const render = Boolean(eager || isFirstFocused || preloaded.current);

  const hasLoggedRef = useRef(false);
  useEffect(() => {
    if (!render || hasLoggedRef.current) {
      return;
    }
    hasLoggedRef.current = true;
    defaultLogger.app.perf.tabPreloadStage({
      stage: 'pageBodyRendered',
      tab: route.name,
      aheadOfFocus: preloaded.current,
    });
  }, [render, route.name]);

  return render ? children : null;
}
