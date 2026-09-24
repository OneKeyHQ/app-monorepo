/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react';

import { renderHook } from '@testing-library/react';

import { TabsContext } from './context';
import { useTabsScrollToTop } from './useTabsScrollToTop';

type ITabsContextValue = React.ContextType<typeof TabsContext>;

// The web Container is the single scroller for every pane; the per-tab nodes
// in `scrollTabElementsRef` are measurement targets and must NOT be what the
// hook scrolls (scrollTo on a non-scrolling element is a silent no-op).
const scrollToTop = jest.fn();
const tabElementScrollTo = jest.fn();
const contextValue = {
  scrollToTop,
  scrollTabElementsRef: {
    current: {
      Spot: { element: { scrollTo: tabElementScrollTo }, height: 800 },
    },
  },
} as unknown as ITabsContextValue;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <TabsContext.Provider value={contextValue}>{children}</TabsContext.Provider>
  );
}

beforeEach(() => {
  scrollToTop.mockClear();
  tabElementScrollTo.mockClear();
});

describe('useTabsScrollToTop (web)', () => {
  it('delegates to the container scroller, not the per-tab measurement nodes', () => {
    const { result } = renderHook(() => useTabsScrollToTop(), { wrapper });

    result.current();

    expect(scrollToTop).toHaveBeenCalledTimes(1);
    expect(tabElementScrollTo).not.toHaveBeenCalled();
  });

  it('is a no-op outside a Tabs.Container (no scrollToTop in context)', () => {
    const { result } = renderHook(() => useTabsScrollToTop());
    expect(() => result.current()).not.toThrow();
    expect(scrollToTop).not.toHaveBeenCalled();
  });
});
