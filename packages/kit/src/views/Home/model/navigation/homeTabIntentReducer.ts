import type { IHomeRuntimeOwnerToken } from '@onekeyhq/shared/src/types/homeRuntime';

import type { IHomeTabId } from '../semantic/homeSemanticTypes';

type IHomeTabIntentState = {
  ownerToken?: IHomeRuntimeOwnerToken;
  selectedTabId?: IHomeTabId;
};

type IHomeTabIntentEvent =
  | {
      kind: 'reconcile';
      ownerToken: IHomeRuntimeOwnerToken;
      tabs: readonly [IHomeTabId, ...IHomeTabId[]];
    }
  | {
      kind: 'select';
      ownerToken: IHomeRuntimeOwnerToken;
      tabId: IHomeTabId;
      tabs: readonly [IHomeTabId, ...IHomeTabId[]];
    }
  | { kind: 'clear' };

const initialHomeTabIntentState: IHomeTabIntentState = {};

function ownersMatch(
  left: IHomeRuntimeOwnerToken | undefined,
  right: IHomeRuntimeOwnerToken,
): boolean {
  return (
    left?.scopeKey === right.scopeKey && left.sessionId === right.sessionId
  );
}

function reduceHomeTabIntent(
  state: IHomeTabIntentState,
  event: IHomeTabIntentEvent,
): IHomeTabIntentState {
  if (event.kind === 'clear') {
    return state.ownerToken || state.selectedTabId
      ? initialHomeTabIntentState
      : state;
  }
  const ownerMatches = ownersMatch(state.ownerToken, event.ownerToken);
  if (event.kind === 'select') {
    if (!event.tabs.includes(event.tabId)) {
      return state;
    }
    return {
      ownerToken: event.ownerToken,
      selectedTabId: event.tabId,
    };
  }
  const selectedTabId =
    ownerMatches &&
    state.selectedTabId &&
    event.tabs.includes(state.selectedTabId)
      ? state.selectedTabId
      : event.tabs[0];
  if (
    ownerMatches &&
    state.selectedTabId === selectedTabId &&
    state.ownerToken
  ) {
    return state;
  }
  return { ownerToken: event.ownerToken, selectedTabId };
}

export { initialHomeTabIntentState, reduceHomeTabIntent };
export type { IHomeTabIntentEvent, IHomeTabIntentState };
