import { useCallback } from 'react';

import { ScrollContentRegistrationContext } from '../ScrollContentRegistration';

import { useTabsContext } from './context';
import { TabNameContext } from './TabNameContext';

import type { IRegisterScrollContent } from '../ScrollContentRegistration';
import type { TabProps } from 'react-native-collapsible-tab-view';

export function Tab<TabName extends string>({
  name,
  children,
}: TabProps<TabName>) {
  const { scrollTabElementsRef, requestRemeasure } = useTabsContext();
  const registerContent = useCallback<IRegisterScrollContent>(
    (element, height) => {
      const entries = scrollTabElementsRef?.current;
      if (!entries) return () => {};
      const entry = { element, height };
      entries[name] = entry;
      requestRemeasure?.();
      return () => {
        if (entries[name] === entry) {
          delete entries[name];
          requestRemeasure?.();
        }
      };
    },
    [name, scrollTabElementsRef, requestRemeasure],
  );
  return (
    <TabNameContext.Provider value={name}>
      <ScrollContentRegistrationContext.Provider value={registerContent}>
        {children}
      </ScrollContentRegistrationContext.Provider>
    </TabNameContext.Provider>
  );
}
