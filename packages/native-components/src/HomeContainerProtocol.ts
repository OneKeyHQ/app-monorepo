import {
  HOME_CONTAINER_TAB_IDS,
  isHomeContainerSnapshotInvariantValid,
} from './HomeContainer.types';

import type {
  IHomeContainerIntent,
  IHomeContainerOwner,
  IHomeContainerState,
  IHomeContainerTabId,
} from './HomeContainer.types';

function isTabId(value: unknown): value is IHomeContainerTabId {
  return HOME_CONTAINER_TAB_IDS.some((candidate) => candidate === value);
}

function isOwner(value: unknown): value is IHomeContainerOwner {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const owner = value as Partial<IHomeContainerOwner>;
  return (
    typeof owner.scopeKey === 'string' &&
    owner.scopeKey.length > 0 &&
    typeof owner.sessionId === 'string' &&
    owner.sessionId.length > 0
  );
}

export function isHomeContainerStateValid(state: IHomeContainerState): boolean {
  return (
    isOwner(state.owner) && isHomeContainerSnapshotInvariantValid(state.payload)
  );
}

export function parseHomeContainerIntent(
  value: string,
): IHomeContainerIntent | undefined {
  try {
    const candidate = JSON.parse(value) as {
      intentId?: unknown;
      owner?: unknown;
      intent?: {
        kind?: unknown;
        commandId?: unknown;
        itemId?: unknown;
        tabId?: unknown;
        requestId?: unknown;
      };
    };
    if (
      typeof candidate.intentId !== 'string' ||
      candidate.intentId.length === 0 ||
      !isOwner(candidate.owner) ||
      !candidate.intent
    ) {
      return undefined;
    }
    const intent = candidate.intent;
    if (intent.kind === 'selectTab' && isTabId(intent.tabId)) {
      return candidate as IHomeContainerIntent;
    }
    if (
      intent.kind === 'refresh' &&
      isTabId(intent.tabId) &&
      typeof intent.requestId === 'string' &&
      intent.requestId.length > 0
    ) {
      return candidate as IHomeContainerIntent;
    }
    if (
      intent.kind === 'action' &&
      typeof intent.commandId === 'string' &&
      intent.commandId.length > 0 &&
      (intent.itemId === undefined || typeof intent.itemId === 'string')
    ) {
      return candidate as IHomeContainerIntent;
    }
    if (
      intent.kind === 'handoff' &&
      isTabId(intent.tabId) &&
      typeof intent.commandId === 'string' &&
      intent.commandId.length > 0
    ) {
      return candidate as IHomeContainerIntent;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
