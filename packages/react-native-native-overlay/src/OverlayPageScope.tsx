import { createContext, useContext, useMemo } from 'react';
import type { PropsWithChildren } from 'react';

export interface IOverlayPageScope {
  /** Root-route host that renders page overlays (see `OverlayPageHost`). */
  hostKey?: string;
  /** The nearest page; page overlays hide while it is covered. */
  ownerKey?: string;
}

const OverlayPageScopeContext = createContext<IOverlayPageScope>({});

export function useOverlayPageScope(): IOverlayPageScope {
  return useContext(OverlayPageScopeContext);
}

/** Provided once per root route, around its navigator and `OverlayPageHost`. */
export function OverlayPageHostScope({
  hostKey,
  children,
}: PropsWithChildren<{ hostKey: string }>) {
  const value = useMemo(() => ({ hostKey }), [hostKey]);
  return (
    <OverlayPageScopeContext.Provider value={value}>
      {children}
    </OverlayPageScopeContext.Provider>
  );
}

/** Provided by each page; page overlays below it belong to `ownerKey`. */
export function OverlayPageOwnerScope({
  ownerKey,
  children,
}: PropsWithChildren<{ ownerKey: string }>) {
  const { hostKey } = useOverlayPageScope();
  const value = useMemo(() => ({ hostKey, ownerKey }), [hostKey, ownerKey]);
  return (
    <OverlayPageScopeContext.Provider value={value}>
      {children}
    </OverlayPageScopeContext.Provider>
  );
}
