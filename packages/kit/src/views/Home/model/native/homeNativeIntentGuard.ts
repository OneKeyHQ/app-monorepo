import {
  HOME_CONTAINER_TAB_IDS,
  type IHomeContainerIntent,
  type IHomeContainerOwner,
  type IHomeContainerSnapshot,
} from '@onekeyhq/native-components';

import type {
  IHomeNavigationSemanticModel,
  IHomeShellSemanticModel,
} from '../semantic/homeSemanticTypes';

type IHomeNativeIntentRejectionReason =
  | 'invalidIntent'
  | 'ownerMismatch'
  | 'revisionMismatch'
  | 'commandUnavailable'
  | 'tabUnavailable';

type IHomeNativeIntentGuardResult =
  | { accepted: true; intent: IHomeContainerIntent }
  | {
      accepted: false;
      reason: IHomeNativeIntentRejectionReason;
      intent?: IHomeContainerIntent;
    };

function ownersMatch(
  left: IHomeContainerOwner,
  right: IHomeContainerOwner,
): boolean {
  return left.scopeKey === right.scopeKey && left.sessionId === right.sessionId;
}

function collectCommandIds(snapshot: IHomeContainerSnapshot): Set<string> {
  const result = new Set<string>();
  const add = (value: string | undefined) => {
    if (value) {
      result.add(value);
    }
  };

  add(snapshot.header.accountActionId);
  add(snapshot.header.copyActionId);
  add(snapshot.header.networkActionId);
  add(snapshot.header.balanceActionId);
  snapshot.header.actions.forEach((action) => add(action.actionId));
  snapshot.header.balanceActions?.forEach((action) => add(action.actionId));
  snapshot.header.banners.forEach((banner) => {
    add(banner.actionId);
    add(banner.dismissActionId);
  });
  snapshot.tabs.forEach((tab) => {
    add(tab.toolbarAction?.actionId);
    tab.sections.forEach((section) => {
      add(section.actionId);
      section.items.forEach((item) => {
        add(item.actionId);
        add(item.favoriteActionId);
        item.segments?.forEach((segment) => add(segment.actionId));
      });
    });
  });
  return result;
}

function isHomeNativeLegacyHandoffAvailable({
  commandId,
  currentNavigation,
  currentSnapshot,
  tabId,
}: {
  commandId: string;
  currentNavigation: IHomeNavigationSemanticModel | undefined;
  currentSnapshot: IHomeContainerSnapshot;
  tabId: string;
}): boolean {
  if (
    commandId !== 'home.perps.openWeb' ||
    tabId !== 'perps' ||
    currentNavigation?.kind !== 'ready' ||
    currentNavigation.destinations?.perps !== 'web'
  ) {
    return false;
  }
  const tab = currentSnapshot.tabs.find((candidate) => candidate.id === tabId);
  return Boolean(
    tab?.destination === 'handoff' && tab.handoffCommandId === commandId,
  );
}

function handleHomeNativeLegacyHandoff({
  commandId,
  currentNavigation,
  currentSnapshot,
  onOpenPerpsWeb,
  tabId,
}: {
  commandId: string;
  currentNavigation: IHomeNavigationSemanticModel | undefined;
  currentSnapshot: IHomeContainerSnapshot;
  onOpenPerpsWeb: () => void;
  tabId: string;
}): boolean {
  if (
    !isHomeNativeLegacyHandoffAvailable({
      commandId,
      currentNavigation,
      currentSnapshot,
      tabId,
    })
  ) {
    return false;
  }
  onOpenPerpsWeb();
  return true;
}

const shellIndependentHeaderCommands = new Set([
  'home.header.account',
  'home.header.copy',
  'home.header.network',
]);

const fundedHeaderCommands = new Set([
  'home.header.buy',
  'home.header.more',
  'home.header.receive',
  'home.header.send',
  'home.header.swap',
]);

function isHomeShellCommandAvailable(
  shell: IHomeShellSemanticModel,
  commandId: string,
): boolean {
  if (shellIndependentHeaderCommands.has(commandId)) {
    return true;
  }
  if (shell.kind === 'backupRequired') {
    return commandId === shell.commandId;
  }
  if (shell.kind !== 'portfolio') {
    return (
      !commandId.startsWith('home.header.') &&
      !commandId.startsWith('home.banner.')
    );
  }

  const { presentation } = shell;
  if (commandId.startsWith('home.banner.')) {
    return presentation.banner.kind === 'positive';
  }
  if (!commandId.startsWith('home.header.')) {
    return true;
  }
  if (presentation.kind === 'loading' || presentation.kind === 'unavailable') {
    return false;
  }
  if (commandId === 'home.header.balance') {
    return presentation.kind === 'zero' || presentation.kind === 'funded';
  }
  if (commandId === 'home.header.balanceDetails') {
    return presentation.kind === 'funded';
  }
  if (presentation.kind === 'zero') {
    return (
      commandId === 'home.header.receive' || commandId === 'home.header.more'
    );
  }
  return fundedHeaderCommands.has(commandId);
}

function parseHomeNativeIntent(
  value: string,
): IHomeContainerIntent | undefined {
  try {
    const parsed = JSON.parse(value) as {
      intentId?: unknown;
      owner?: { scopeKey?: unknown; sessionId?: unknown };
      renderedRevision?: unknown;
      intent?: {
        kind?: unknown;
        commandId?: unknown;
        itemId?: unknown;
        tabId?: unknown;
        requestId?: unknown;
      };
    };
    if (
      typeof parsed.intentId !== 'string' ||
      typeof parsed.renderedRevision !== 'number' ||
      !Number.isSafeInteger(parsed.renderedRevision) ||
      parsed.renderedRevision < 0 ||
      typeof parsed.owner?.scopeKey !== 'string' ||
      typeof parsed.owner.sessionId !== 'string' ||
      !parsed.intent
    ) {
      return undefined;
    }
    const isTabId = (tabId: unknown) =>
      typeof tabId === 'string' &&
      HOME_CONTAINER_TAB_IDS.some((candidate) => candidate === tabId);
    switch (parsed.intent.kind) {
      case 'action':
        if (
          typeof parsed.intent.commandId !== 'string' ||
          (parsed.intent.itemId !== undefined &&
            typeof parsed.intent.itemId !== 'string')
        ) {
          return undefined;
        }
        break;
      case 'handoff':
        if (
          !isTabId(parsed.intent.tabId) ||
          typeof parsed.intent.commandId !== 'string' ||
          parsed.intent.commandId.length === 0
        ) {
          return undefined;
        }
        break;
      case 'refresh':
        if (
          !isTabId(parsed.intent.tabId) ||
          typeof parsed.intent.requestId !== 'string'
        ) {
          return undefined;
        }
        break;
      case 'selectTab':
        if (!isTabId(parsed.intent.tabId)) {
          return undefined;
        }
        break;
      default:
        return undefined;
    }
    return parsed as IHomeContainerIntent;
  } catch {
    return undefined;
  }
}

function guardHomeNativeIntent({
  currentNavigation,
  currentOwner,
  currentRevision,
  currentShell,
  currentSnapshot,
  value,
}: {
  currentNavigation?: IHomeNavigationSemanticModel;
  currentOwner: IHomeContainerOwner;
  currentRevision: number;
  currentShell?: IHomeShellSemanticModel;
  currentSnapshot: IHomeContainerSnapshot;
  value: string;
}): IHomeNativeIntentGuardResult {
  const intent = parseHomeNativeIntent(value);
  if (!intent) {
    return { accepted: false, reason: 'invalidIntent' };
  }
  if (!ownersMatch(intent.owner, currentOwner)) {
    return { accepted: false, reason: 'ownerMismatch', intent };
  }

  const intentPayload = intent.intent;
  switch (intentPayload.kind) {
    case 'action':
      if (intent.renderedRevision !== currentRevision) {
        return { accepted: false, reason: 'revisionMismatch', intent };
      }
      if (!collectCommandIds(currentSnapshot).has(intentPayload.commandId)) {
        return { accepted: false, reason: 'commandUnavailable', intent };
      }
      if (
        currentShell &&
        !isHomeShellCommandAvailable(currentShell, intentPayload.commandId)
      ) {
        return { accepted: false, reason: 'commandUnavailable', intent };
      }
      break;
    case 'handoff': {
      if (intent.renderedRevision !== currentRevision) {
        return { accepted: false, reason: 'revisionMismatch', intent };
      }
      const tab = currentSnapshot.tabs.find(
        (candidate) => candidate.id === intentPayload.tabId,
      );
      if (!tab || tab.destination !== 'handoff') {
        return { accepted: false, reason: 'tabUnavailable', intent };
      }
      if (tab.handoffCommandId !== intentPayload.commandId) {
        return { accepted: false, reason: 'commandUnavailable', intent };
      }
      if (
        currentNavigation?.kind === 'ready' &&
        !currentNavigation.tabs.includes(intentPayload.tabId)
      ) {
        return { accepted: false, reason: 'tabUnavailable', intent };
      }
      break;
    }
    case 'refresh':
    case 'selectTab':
      // Protocol v2 has one global rendered revision. Shell or unrelated
      // section updates must not invalidate a still-applicable tab intent.
      // Owner and current Navigation remain the business authority here;
      // protocol v3 carries the dedicated tab/section authority revision.
      if (
        !currentSnapshot.tabs.some(
          (tab) =>
            tab.id === intentPayload.tabId && tab.destination === 'inline',
        )
      ) {
        return { accepted: false, reason: 'tabUnavailable', intent };
      }
      if (
        currentNavigation?.kind === 'ready' &&
        !currentNavigation.tabs.includes(intentPayload.tabId)
      ) {
        return { accepted: false, reason: 'tabUnavailable', intent };
      }
      break;
    default:
      return { accepted: false, reason: 'invalidIntent', intent };
  }
  return { accepted: true, intent };
}

export {
  collectCommandIds,
  guardHomeNativeIntent,
  handleHomeNativeLegacyHandoff,
  isHomeNativeLegacyHandoffAvailable,
  isHomeShellCommandAvailable,
  parseHomeNativeIntent,
};
export type { IHomeNativeIntentGuardResult, IHomeNativeIntentRejectionReason };
