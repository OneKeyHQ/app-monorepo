import { useEffect, useRef } from 'react';
import type { PropsWithChildren } from 'react';

import { useIsFocused, useRoute } from '@react-navigation/core';

import { useTabScene } from '@onekeyhq/components/src/layouts/Navigation/BottomTabs';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { useIsFirstFocused } from '../../hooks/useIsFirstFocused';

export function LazyPageContainer({
  children,
  eager,
}: PropsWithChildren<{ eager?: boolean }>) {
  const route = useRoute();
  const tabScene = useTabScene();
  const isPageFocused = useIsFocused();
  const isFirstFocused = useIsFirstFocused(isPageFocused);
  // The navigator tells us whether this scene was preloaded; do not infer it
  // from "mounted while blurred", which is also true for a lazy module that
  // only resolves after the user has navigated away, and would then mount the
  // page body on a device where preloading is switched off entirely.
  // A preloaded scene should build its page tree during that idle window
  // rather than on the tap — otherwise preloading mounts an empty shell and
  // the user still waits for the whole page the first time they open the tab.
  const preloadedAtMount = useRef(Boolean(tabScene?.preloaded));
  const render = Boolean(eager || isFirstFocused || preloadedAtMount.current);

  // Root tab name where available, so this stage can be joined with the
  // navigator's own stages; nested screens have their own route name.
  const tabName = tabScene?.tabName ?? route.name;
  const hasLoggedRef = useRef(false);
  useEffect(() => {
    if (!render || hasLoggedRef.current) {
      return;
    }
    hasLoggedRef.current = true;
    defaultLogger.app.perf.tabPreloadStage({
      stage: 'pageBodyRendered',
      tab: tabName,
      aheadOfFocus: preloadedAtMount.current,
    });
  }, [render, tabName]);

  return render ? children : null;
}
