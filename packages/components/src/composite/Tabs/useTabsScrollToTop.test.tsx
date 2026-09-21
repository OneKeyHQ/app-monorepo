/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react';

import { renderHook } from '@testing-library/react';

import { TabsContext } from './context';
import { useTabsScrollToTop } from './useTabsScrollToTop';

type ITabsContextValue = React.ContextType<typeof TabsContext>;

function makeElement() {
  return { scrollTo: jest.fn() } as unknown as HTMLElement;
}

describe('useTabsScrollToTop (web)', () => {
  it('scrolls every registered tab element to the top instantly', () => {
    const spot = makeElement();
    const history = makeElement();
    const scrollTabElementsRef = {
      current: {
        Spot: { element: spot, height: 800 },
        History: { element: history },
      },
    } as unknown as ITabsContextValue['scrollTabElementsRef'];
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TabsContext.Provider
        value={{ scrollTabElementsRef } as unknown as ITabsContextValue}
      >
        {children}
      </TabsContext.Provider>
    );
    const { result } = renderHook(() => useTabsScrollToTop(), { wrapper });

    result.current();

    expect(spot.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
    expect(history.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'instant',
    });
  });

  it('is a no-op outside a Tabs.Container (no registered elements)', () => {
    const { result } = renderHook(() => useTabsScrollToTop());
    expect(() => result.current()).not.toThrow();
  });
});
