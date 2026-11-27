import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { updateDepthChartDomain } from './perpDepthChartGeometry';

import type {
  IDepthChartDomain,
  IPerpDepthLevel,
} from './perpDepthChartGeometry';

type IDepthChartDomainInput = {
  bids: ReadonlyArray<IPerpDepthLevel>;
  asks: ReadonlyArray<IPerpDepthLevel>;
  referenceMidPrice?: number;
  targetKey: string;
  updatesEnabled: boolean;
};

type IDepthChartDomainState = {
  targetKey: string;
  domain: IDepthChartDomain | undefined;
};

export function usePerpDepthChartDomain({
  bids,
  asks,
  referenceMidPrice,
  targetKey,
  updatesEnabled,
}: IDepthChartDomainInput) {
  const [state, setState] = useState<IDepthChartDomainState>(() => ({
    targetKey,
    domain: updateDepthChartDomain({
      bids,
      asks,
      referenceMidPrice,
      now: 0,
    }),
  }));
  const stateRef = useRef(state);
  const refresh = useCallback(
    (now: number, wheelDelta?: number) => {
      if (!updatesEnabled && wheelDelta !== undefined) return false;
      const current = stateRef.current;
      const previous =
        current.targetKey === targetKey ? current.domain : undefined;
      let domain = previous;
      if (updatesEnabled || !previous) {
        domain = updateDepthChartDomain({
          bids,
          asks,
          referenceMidPrice,
          previous,
          now,
          wheelDelta,
        });
      } else if (previous.shrinkAt !== undefined) {
        // Measure the next shrink delay from the first fresh book after pause.
        domain = { ...previous, shrinkAt: undefined };
      }
      if (current.targetKey !== targetKey || domain !== current.domain) {
        const next = { targetKey, domain };
        // Store the accepted viewport now so a burst of wheel events can use it
        // even when React renders them together.
        stateRef.current = next;
        setState(next);
      }
      return previous?.priceRangeRatio !== domain?.priceRangeRatio;
    },
    [asks, bids, referenceMidPrice, targetKey, updatesEnabled],
  );

  const refreshRef = useRef(refresh);
  useLayoutEffect(() => {
    refreshRef.current = refresh;
    refresh(Date.now());
  }, [refresh]);
  const zoomByWheel = useCallback(
    (delta: number) => refreshRef.current(Date.now(), delta),
    [],
  );

  const domain = state.targetKey === targetKey ? state.domain : undefined;
  const shrinkAt = updatesEnabled ? domain?.shrinkAt : undefined;
  useEffect(() => {
    if (shrinkAt === undefined) return undefined;
    // New book snapshots update the callback without restarting this deadline.
    const timer = setTimeout(
      () => refreshRef.current(Math.max(shrinkAt, Date.now())),
      Math.max(0, shrinkAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [shrinkAt, targetKey]);

  return { domain, zoomByWheel };
}
