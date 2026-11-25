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
  priceStep?: number;
  targetKey: string;
};

type IDepthChartDomainState = {
  targetKey: string;
  domain: IDepthChartDomain | undefined;
};

export function usePerpDepthChartDomain({
  bids,
  asks,
  referenceMidPrice,
  priceStep,
  targetKey,
}: IDepthChartDomainInput) {
  const [state, setState] = useState<IDepthChartDomainState>(() => ({
    targetKey,
    domain: updateDepthChartDomain({
      bids,
      asks,
      referenceMidPrice,
      priceStep,
      now: 0,
    }),
  }));
  const stateRef = useRef(state);
  const refresh = useCallback(
    (now: number, wheelDelta?: number) => {
      const current = stateRef.current;
      const previous =
        current.targetKey === targetKey ? current.domain : undefined;
      const domain = updateDepthChartDomain({
        bids,
        asks,
        referenceMidPrice,
        priceStep,
        previous,
        now,
        wheelDelta,
      });
      if (current.targetKey !== targetKey || domain !== current.domain) {
        const next = { targetKey, domain };
        // Store the accepted viewport now so a burst of wheel events can use it
        // even when React renders them together.
        stateRef.current = next;
        setState(next);
      }
      return previous?.priceRangeRatio !== domain?.priceRangeRatio;
    },
    [asks, bids, priceStep, referenceMidPrice, targetKey],
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
  const shrinkAt = domain?.shrinkAt;
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
