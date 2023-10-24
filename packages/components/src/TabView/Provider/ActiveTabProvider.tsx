import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { ActiveTabContext } from './ActiveTabContext';

function ActiveTabProvider({ children }: { children?: ReactNode }) {
  const [activeTabKey, setActiveTabKey] = useState<string>();

  const providerActiveTab = useMemo(
    () => ({
      activeTabKey,
      setActiveTabKey,
    }),
    [activeTabKey],
  );

  return (
    <ActiveTabContext.Provider value={providerActiveTab}>
      {/* <ContextIsVerticalLayout.Provider value={isVerticalLayout}> */}
      {children}
      {/* </ContextIsVerticalLayout.Provider> */}
    </ActiveTabContext.Provider>
  );
}

export default ActiveTabProvider;
