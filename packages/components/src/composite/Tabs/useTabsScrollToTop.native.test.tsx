/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react';

import { renderHook } from '@testing-library/react';

import { CollapsibleTabContext } from './CollapsibleTabContext';
import { useTabsScrollToTop } from './useTabsScrollToTop.native';

type ICollapsibleContextValue = React.ContextType<typeof CollapsibleTabContext>;

// The patched container reserves the header with content padding, so the
// context carries no inset.
let contextValue = {} as ICollapsibleContextValue;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <CollapsibleTabContext.Provider value={contextValue}>
      {children}
    </CollapsibleTabContext.Provider>
  );
}

function renderWithPanes(refMap: Record<string, { current: unknown }>) {
  const scrollY = { value: { Spot: 320, History: 540 } as unknown };
  contextValue = {
    refMap,
    contentInset: 0,
    scrollY,
  } as unknown as ICollapsibleContextValue;
  const { result } = renderHook(() => useTabsScrollToTop(), { wrapper });
  return { scrollToTop: result.current, scrollY };
}

describe('useTabsScrollToTop (native)', () => {
  it('scrolls a SectionList pane through its scroll responder, not scrollToLocation', () => {
    // Section 0's header sits below the header padding, so scrollToLocation
    // would land the pane on the collapsed position.
    const responderScrollTo = jest.fn();
    const scrollToLocation = jest.fn();
    const sectionList = {
      scrollToLocation,
      getScrollResponder: () => ({ scrollTo: responderScrollTo }),
    };
    const { scrollToTop } = renderWithPanes({
      History: { current: sectionList },
    });

    scrollToTop();

    expect(responderScrollTo).toHaveBeenCalledWith({
      x: 0,
      y: 0,
      animated: false,
    });
    expect(scrollToLocation).not.toHaveBeenCalled();
  });

  it('uses the pane own scrollTo / scrollToOffset when available', () => {
    const scrollTo = jest.fn();
    const scrollToOffset = jest.fn();
    const { scrollToTop } = renderWithPanes({
      Spot: { current: { scrollTo } },
      DeFi: { current: { scrollToOffset } },
      Unmounted: { current: null },
    });

    scrollToTop();

    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 0, animated: false });
    expect(scrollToOffset).toHaveBeenCalledWith({
      offset: 0,
      animated: false,
    });
  });

  it('zeroes every saved pane offset', () => {
    const { scrollToTop, scrollY } = renderWithPanes({
      Spot: { current: { scrollTo: jest.fn() } },
      History: { current: { getScrollResponder: () => null } },
    });

    scrollToTop();

    expect(scrollY.value).toEqual({ Spot: 0, History: 0 });
  });
});
