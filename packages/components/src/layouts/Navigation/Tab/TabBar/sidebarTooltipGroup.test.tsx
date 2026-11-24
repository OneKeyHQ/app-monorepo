/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';

import {
  SIDEBAR_TOOLTIP_OPEN_DELAY_MS,
  SIDEBAR_TOOLTIP_SKIP_DELAY_MS,
  SidebarTooltipGroup,
  useSidebarTooltipOpen,
} from './sidebarTooltipGroup';

// The app-wide registry modal navigation uses to close every tooltip.
const mockClosers = new Set<() => void>();
jest.mock('@onekeyhq/components/src/actions/Tooltip/tooltipRegistry', () => ({
  registerOpenTooltip: (close: () => void) => {
    mockClosers.add(close);
    return () => mockClosers.delete(close);
  },
}));
function closeAllTooltips() {
  Array.from(mockClosers).forEach((close) => close());
}

function wait(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('useSidebarTooltipOpen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  // Two adjacent sidebar icons under the same group.
  function renderGroup(initialEnabled = true) {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SidebarTooltipGroup>{children}</SidebarTooltipGroup>
    );
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        [
          useSidebarTooltipOpen(enabled),
          useSidebarTooltipOpen(enabled),
        ] as const,
      { wrapper, initialProps: { enabled: initialEnabled } },
    );
    return {
      first: () => result.current[0],
      second: () => result.current[1],
      setEnabled: (enabled: boolean) => rerender({ enabled }),
    };
  }

  it('waits before opening the first tooltip', () => {
    const { first } = renderGroup();
    act(() => first().onOpenChange(true));
    expect(first().open).toBe(false);

    wait(SIDEBAR_TOOLTIP_OPEN_DELAY_MS);
    expect(first().open).toBe(true);
  });

  it('does not open when the pointer leaves before the delay ends', () => {
    const { first } = renderGroup();
    act(() => first().onOpenChange(true));
    act(() => first().onOpenChange(false));

    wait(SIDEBAR_TOOLTIP_OPEN_DELAY_MS);
    expect(first().open).toBe(false);
  });

  it('opens the next icon at once while moving between icons', () => {
    const { first, second } = renderGroup();
    act(() => first().onOpenChange(true));
    wait(SIDEBAR_TOOLTIP_OPEN_DELAY_MS);

    act(() => first().onOpenChange(false));
    act(() => second().onOpenChange(true));
    expect(first().open).toBe(false);
    expect(second().open).toBe(true);
  });

  it('waits again once the pointer has been away for a while', () => {
    const { first, second } = renderGroup();
    act(() => first().onOpenChange(true));
    wait(SIDEBAR_TOOLTIP_OPEN_DELAY_MS);
    act(() => first().onOpenChange(false));

    wait(SIDEBAR_TOOLTIP_SKIP_DELAY_MS);
    act(() => second().onOpenChange(true));
    expect(second().open).toBe(false);
  });

  it('a press on the icon drops a pending open', () => {
    const { first } = renderGroup();
    act(() => first().onOpenChange(true));
    act(() => first().close());

    wait(SIDEBAR_TOOLTIP_OPEN_DELAY_MS);
    expect(first().open).toBe(false);
  });

  it('showing the labels again closes an open tooltip', () => {
    const { first, setEnabled } = renderGroup();
    act(() => first().onOpenChange(true));
    wait(SIDEBAR_TOOLTIP_OPEN_DELAY_MS);
    expect(first().open).toBe(true);

    setEnabled(false);
    expect(first().open).toBe(false);
  });

  it('closeAllTooltips closes an open tooltip and drops a pending one', () => {
    const { first, second } = renderGroup();
    act(() => first().onOpenChange(true));
    wait(SIDEBAR_TOOLTIP_OPEN_DELAY_MS);
    expect(first().open).toBe(true);

    act(() => closeAllTooltips());
    expect(first().open).toBe(false);

    wait(SIDEBAR_TOOLTIP_SKIP_DELAY_MS);
    act(() => second().onOpenChange(true));
    act(() => closeAllTooltips());
    wait(SIDEBAR_TOOLTIP_OPEN_DELAY_MS);
    expect(second().open).toBe(false);
  });

  it('scrolling a pane on the page closes an open tooltip', () => {
    const { first } = renderGroup();
    act(() => first().onOpenChange(true));
    wait(SIDEBAR_TOOLTIP_OPEN_DELAY_MS);
    expect(first().open).toBe(true);

    // Scroll events don't bubble: a nested pane's scroll only reaches a
    // capturing listener.
    const pane = document.createElement('div');
    document.body.appendChild(pane);
    act(() => {
      pane.dispatchEvent(new Event('scroll', { bubbles: false }));
    });
    pane.remove();
    expect(first().open).toBe(false);
  });
});
