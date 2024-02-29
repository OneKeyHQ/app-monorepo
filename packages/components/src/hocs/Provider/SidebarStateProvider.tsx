import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { ContextSideBar } from './hooks/useProviderSideBarValue';

function SidebarStateProvider({ children }: { children?: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCollapsedAfterAnimated, setIsCollapsedAfterAnimated] =
    useState(false);

  const providerSideBarValue = useMemo(
    () => ({
      leftSidebarCollapsed: isCollapsed,
      setLeftSidebarCollapsed: setIsCollapsed,
      leftSidebarCollapsedAfterAnimated: isCollapsedAfterAnimated,
      setLeftSidebarCollapsedAfterAnimated: setIsCollapsedAfterAnimated,
    }),
    [isCollapsed, isCollapsedAfterAnimated],
  );

  return (
    <ContextSideBar.Provider value={providerSideBarValue}>
      {children}
    </ContextSideBar.Provider>
  );
}

export default SidebarStateProvider;
