import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { registerOpenTooltip } from '@onekeyhq/components/src/actions/Tooltip/tooltipRegistry';

// The first sidebar tooltip waits a moment; while one is open, or right after
// it closed, the next icon's tooltip opens at once so the pointer can scan the
// icons without waiting on each.
export const SIDEBAR_TOOLTIP_OPEN_DELAY_MS = 300;
export const SIDEBAR_TOOLTIP_SKIP_DELAY_MS = 300;

type ISidebarTooltipGroup = {
  isWarm: () => boolean;
  opened: () => void;
  closed: () => void;
};

function createSidebarTooltipGroup(): ISidebarTooltipGroup {
  let openCount = 0;
  let lastClosedAt = 0;
  return {
    isWarm: () =>
      openCount > 0 ||
      Date.now() - lastClosedAt < SIDEBAR_TOOLTIP_SKIP_DELAY_MS,
    opened: () => {
      openCount += 1;
    },
    closed: () => {
      openCount -= 1;
      lastClosedAt = Date.now();
    },
  };
}

const SidebarTooltipGroupContext = createContext<
  ISidebarTooltipGroup | undefined
>(undefined);

export function SidebarTooltipGroup({ children }: { children: ReactNode }) {
  const group = useMemo(createSidebarTooltipGroup, []);
  return (
    <SidebarTooltipGroupContext.Provider value={group}>
      {children}
    </SidebarTooltipGroupContext.Provider>
  );
}

// Controlled `open` / `onOpenChange` for one sidebar tooltip. Turning it off
// (labels shown again) closes the tooltip and drops a pending open, and so do
// closeAllTooltips() (a modal opening under a still pointer) and a scroll
// anywhere on the page (content moves, the pointer does not).
export function useSidebarTooltipOpen(enabled: boolean) {
  const group = useContext(SidebarTooltipGroupContext);
  const [open, setOpen] = useState(false);
  const isOpenRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const unregisterRef = useRef<(() => void) | undefined>(undefined);
  const removeScrollListenerRef = useRef<(() => void) | undefined>(undefined);

  const show = useCallback(() => {
    timerRef.current = undefined;
    if (!isOpenRef.current) {
      isOpenRef.current = true;
      group?.opened();
      setOpen(true);
    }
  }, [group]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
    unregisterRef.current?.();
    unregisterRef.current = undefined;
    removeScrollListenerRef.current?.();
    removeScrollListenerRef.current = undefined;
    if (isOpenRef.current) {
      isOpenRef.current = false;
      group?.closed();
      setOpen(false);
    }
  }, [group]);

  const onOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        hide();
        return;
      }
      if (isOpenRef.current || timerRef.current) {
        return;
      }
      unregisterRef.current = registerOpenTooltip(hide);
      if (typeof document !== 'undefined') {
        document.addEventListener('scroll', hide, true);
        removeScrollListenerRef.current = () =>
          document.removeEventListener('scroll', hide, true);
      }
      if (!group || group.isWarm()) {
        show();
        return;
      }
      timerRef.current = setTimeout(show, SIDEBAR_TOOLTIP_OPEN_DELAY_MS);
    },
    [group, hide, show],
  );

  useEffect(() => {
    if (!enabled) {
      hide();
    }
  }, [enabled, hide]);
  useEffect(() => hide, [hide]);

  return { open, onOpenChange, close: hide };
}
