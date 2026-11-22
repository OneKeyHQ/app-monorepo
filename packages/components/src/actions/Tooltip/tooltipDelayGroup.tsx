import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

// Tooltips in a group wait before the first one opens. While one is open, or
// shortly after it closed, moving onto another opens it at once: the user is
// scanning adjacent triggers.
export const TOOLTIP_GROUP_OPEN_DELAY_MS = 300;
export const TOOLTIP_GROUP_SKIP_DELAY_MS = 300;

export interface ITooltipDelayGroup {
  isWarm: () => boolean;
  // Returns the release to call when that tooltip closes.
  markOpen: () => () => void;
}

function createTooltipDelayGroup(): ITooltipDelayGroup {
  let openCount = 0;
  let lastClosedAt = 0;
  return {
    isWarm: () =>
      openCount > 0 || Date.now() - lastClosedAt < TOOLTIP_GROUP_SKIP_DELAY_MS,
    markOpen: () => {
      openCount += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        openCount -= 1;
        lastClosedAt = Date.now();
      };
    },
  };
}

const TooltipDelayGroupContext = createContext<ITooltipDelayGroup | undefined>(
  undefined,
);

export function TooltipDelayGroup({
  enabled = true,
  children,
}: {
  // Off keeps the tooltips' own timing, without remounting the children.
  enabled?: boolean;
  children: ReactNode;
}) {
  const group = useMemo(createTooltipDelayGroup, []);
  return (
    <TooltipDelayGroupContext.Provider value={enabled ? group : undefined}>
      {children}
    </TooltipDelayGroupContext.Provider>
  );
}

export function useTooltipDelayGroup() {
  return useContext(TooltipDelayGroupContext);
}
