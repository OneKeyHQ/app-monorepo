import type { IHomeTabId } from '../semantic/homeSemanticTypes';

const DEFAULT_HOME_TAB_ID: IHomeTabId = 'portfolio';

type IHomeTabRenderState = {
  ownerKey?: string;
  renderedTabIds: ReadonlySet<IHomeTabId>;
};

function createHomeTabRenderState(
  ownerKey: string | undefined,
): IHomeTabRenderState {
  return {
    ownerKey,
    renderedTabIds: ownerKey
      ? new Set<IHomeTabId>([DEFAULT_HOME_TAB_ID])
      : new Set<IHomeTabId>(),
  };
}

function reconcileHomeTabRenderOwner(
  state: IHomeTabRenderState,
  ownerKey: string | undefined,
): IHomeTabRenderState {
  return state.ownerKey === ownerKey
    ? state
    : createHomeTabRenderState(ownerKey);
}

function markHomeTabRendered(
  state: IHomeTabRenderState,
  ownerKey: string | undefined,
  tabId: IHomeTabId,
): IHomeTabRenderState {
  const ownerState = reconcileHomeTabRenderOwner(state, ownerKey);
  if (!ownerKey || ownerState.renderedTabIds.has(tabId)) {
    return ownerState;
  }
  return {
    ownerKey,
    renderedTabIds: new Set([...ownerState.renderedTabIds, tabId]),
  };
}

function isHomeTabRendered(
  state: IHomeTabRenderState,
  ownerKey: string | undefined,
  tabId: IHomeTabId,
): boolean {
  if (!ownerKey) {
    return false;
  }
  if (tabId === DEFAULT_HOME_TAB_ID) {
    return true;
  }
  return state.ownerKey === ownerKey && state.renderedTabIds.has(tabId);
}

export {
  DEFAULT_HOME_TAB_ID,
  createHomeTabRenderState,
  isHomeTabRendered,
  markHomeTabRendered,
  reconcileHomeTabRenderOwner,
};
export type { IHomeTabRenderState };
