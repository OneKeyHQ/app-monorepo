import { useState } from 'react';

import { useOnRouterChange } from '@onekeyhq/components';
import {
  ERootRoutes,
  ETabRoutes,
  PRIME_REDEEM_LANDING_PATH,
} from '@onekeyhq/shared/src/routes';

function readWebLocationPathname(): string | undefined {
  return globalThis.location?.pathname;
}

export function shouldHideDesktopWebFooter({
  currentTab,
  pathname,
}: {
  currentTab: ETabRoutes | null;
  pathname: string | undefined;
}): boolean {
  return (
    currentTab === ETabRoutes.WebviewPerpTrade ||
    pathname === PRIME_REDEEM_LANDING_PATH ||
    pathname === `${PRIME_REDEEM_LANDING_PATH}/`
  );
}

function readCurrentTabFromRouterState(state: {
  routes?: {
    name?: string;
    state?: {
      index?: number;
      routeNames?: string[];
      routes?: { name?: string }[];
    };
  }[];
}): ETabRoutes {
  const rootState = state.routes?.find(
    ({ name }) => name === ERootRoutes.Main,
  )?.state;
  return rootState?.routeNames
    ? (rootState.routeNames[rootState.index || 0] as ETabRoutes)
    : (rootState?.routes?.[0]?.name as ETabRoutes);
}

export function useDesktopWebFooterRoute() {
  const [currentTab, setCurrentTab] = useState<ETabRoutes | null>(null);
  const [pathname, setPathname] = useState(readWebLocationPathname);

  useOnRouterChange((state) => {
    setPathname(readWebLocationPathname());
    if (!state) {
      setCurrentTab(ETabRoutes.Home);
      return;
    }
    setCurrentTab(readCurrentTabFromRouterState(state));
  });

  return {
    currentTab,
    hidden: shouldHideDesktopWebFooter({ currentTab, pathname }),
    pathname,
  };
}
