import {
  HOME_CONTAINER_TAB_IDS,
  isHomeContainerSnapshotInvariantValid,
} from './HomeContainer.types';

import type {
  IHomeContainerChange,
  IHomeContainerNavigationTab,
  IHomeContainerOwner,
  IHomeContainerSnapshotPayload,
  IHomeContainerTab,
  IHomeContainerTabId,
} from './HomeContainer.types';

export const HOME_CONTAINER_PROTOCOL_V3_VERSION = 3 as const;

export const HOME_CONTAINER_SECTION_IDS = [
  'portfolio',
  'perps',
  'defi',
  'nft',
  'history',
  'market',
] as const;

export type IHomeContainerSectionId =
  (typeof HOME_CONTAINER_SECTION_IDS)[number];

export type IHomeContainerPresentationRevisionVectorV3 = {
  shell: number;
  navigation: number;
  sections: Readonly<Record<IHomeContainerSectionId, number>>;
};

export type IHomeContainerAuthorityRevisionVectorV3 = {
  shellCommands: number;
  tabApplicability: number;
  sectionCommands: Readonly<Record<IHomeContainerSectionId, number>>;
};

export type IHomeContainerSlotRevisionVectorV3 = Readonly<
  Record<string, number>
>;

export type IHomeContainerCommitIdentityV3 = IHomeContainerOwner & {
  storeCommitId: number;
};

export type IHomeContainerSnapshotEnvelopeV3 = {
  kind: 'snapshot';
  protocolVersion: typeof HOME_CONTAINER_PROTOCOL_V3_VERSION;
  identity: IHomeContainerCommitIdentityV3;
  transportRevision: number;
  presentationRevisions: IHomeContainerPresentationRevisionVectorV3;
  authorityRevisions: IHomeContainerAuthorityRevisionVectorV3;
  slotRevisions: IHomeContainerSlotRevisionVectorV3;
  payload: IHomeContainerSnapshotPayload;
};

export type IHomeContainerPatchEnvelopeV3 = {
  kind: 'patch';
  protocolVersion: typeof HOME_CONTAINER_PROTOCOL_V3_VERSION;
  identity: IHomeContainerCommitIdentityV3;
  baseTransportRevision: number;
  transportRevision: number;
  presentationRevisions: IHomeContainerPresentationRevisionVectorV3;
  authorityRevisions: IHomeContainerAuthorityRevisionVectorV3;
  requiredSlotRevisions: Partial<IHomeContainerSlotRevisionVectorV3>;
  changes: readonly IHomeContainerChange[];
};

export type IHomeContainerIntentAuthorityV3 =
  | { kind: 'shellCommands'; revision: number }
  | { kind: 'tabApplicability'; revision: number }
  | {
      kind: 'sectionCommands';
      sectionId: IHomeContainerSectionId;
      revision: number;
    };

export type IHomeContainerIntentV3 = {
  protocolVersion: typeof HOME_CONTAINER_PROTOCOL_V3_VERSION;
  intentId: string;
  owner: IHomeContainerOwner;
  authority: IHomeContainerIntentAuthorityV3;
  intent:
    | { kind: 'action'; commandId: string; itemId?: string }
    | { kind: 'handoff'; tabId: IHomeContainerTabId; commandId: string }
    | {
        kind: 'refresh';
        tabId: IHomeContainerTabId;
        requestId: string;
      }
    | { kind: 'selectTab'; tabId: IHomeContainerTabId };
};

export type IHomeContainerProtocolV3State = {
  identity: IHomeContainerCommitIdentityV3;
  transportRevision: number;
  presentationRevisions: IHomeContainerPresentationRevisionVectorV3;
  authorityRevisions: IHomeContainerAuthorityRevisionVectorV3;
  slotRevisions: IHomeContainerSlotRevisionVectorV3;
  payload: IHomeContainerSnapshotPayload;
};

export type IHomeContainerProtocolV3ApplyResult =
  | { kind: 'applied'; state: IHomeContainerProtocolV3State }
  | { kind: 'duplicate'; state: IHomeContainerProtocolV3State }
  | {
      kind: 'needSnapshot';
      reason:
        | 'invalidInvariant'
        | 'ownerMismatch'
        | 'revisionGap'
        | 'slotRevisionGap'
        | 'unsupportedProtocol';
    };

function isSafeRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isRevisionRecord(
  value: unknown,
): value is Readonly<Record<string, number>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(isSafeRevision);
}

function isPresentationRevisionVector(
  value: unknown,
): value is IHomeContainerPresentationRevisionVectorV3 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const candidate =
    value as Partial<IHomeContainerPresentationRevisionVectorV3>;
  return (
    isSafeRevision(candidate.shell) &&
    isSafeRevision(candidate.navigation) &&
    isRevisionRecord(candidate.sections) &&
    HOME_CONTAINER_SECTION_IDS.every((sectionId) =>
      isSafeRevision(candidate.sections?.[sectionId]),
    )
  );
}

function isAuthorityRevisionVector(
  value: unknown,
): value is IHomeContainerAuthorityRevisionVectorV3 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<IHomeContainerAuthorityRevisionVectorV3>;
  return (
    isSafeRevision(candidate.shellCommands) &&
    isSafeRevision(candidate.tabApplicability) &&
    isRevisionRecord(candidate.sectionCommands) &&
    HOME_CONTAINER_SECTION_IDS.every((sectionId) =>
      isSafeRevision(candidate.sectionCommands?.[sectionId]),
    )
  );
}

function ownersMatch(
  left: IHomeContainerOwner,
  right: IHomeContainerOwner,
): boolean {
  return left.scopeKey === right.scopeKey && left.sessionId === right.sessionId;
}

function isTabId(value: unknown): value is IHomeContainerTabId {
  return HOME_CONTAINER_TAB_IDS.some((candidate) => candidate === value);
}

function isSectionId(value: unknown): value is IHomeContainerSectionId {
  return HOME_CONTAINER_SECTION_IDS.some((candidate) => candidate === value);
}

function revisionsDoNotRegress(
  current: IHomeContainerProtocolV3State,
  next: Pick<
    IHomeContainerProtocolV3State,
    'authorityRevisions' | 'presentationRevisions'
  >,
): boolean {
  if (
    next.presentationRevisions.shell < current.presentationRevisions.shell ||
    next.presentationRevisions.navigation <
      current.presentationRevisions.navigation ||
    next.authorityRevisions.shellCommands <
      current.authorityRevisions.shellCommands ||
    next.authorityRevisions.tabApplicability <
      current.authorityRevisions.tabApplicability
  ) {
    return false;
  }
  return HOME_CONTAINER_SECTION_IDS.every(
    (sectionId) =>
      next.presentationRevisions.sections[sectionId] >=
        current.presentationRevisions.sections[sectionId] &&
      next.authorityRevisions.sectionCommands[sectionId] >=
        current.authorityRevisions.sectionCommands[sectionId],
  );
}

function hasRequiredSlots(
  available: IHomeContainerSlotRevisionVectorV3,
  required: Partial<IHomeContainerSlotRevisionVectorV3>,
): boolean {
  return Object.entries(required).every(
    ([slotId, revision]) =>
      revision !== undefined && available[slotId] === revision,
  );
}

function applyChanges(
  payload: IHomeContainerSnapshotPayload,
  changes: readonly IHomeContainerChange[],
): IHomeContainerSnapshotPayload | undefined {
  let next = payload;
  for (const change of changes) {
    switch (change.kind) {
      case 'replaceShell':
        next = { ...next, header: change.value };
        break;
      case 'replaceNavigation': {
        const sectionsByTab = new Map(
          next.tabs.map((tab) => [tab.id, tab.sections] as const),
        );
        const tabs: IHomeContainerTab[] = [];
        for (const tab of change.value.tabs) {
          if (tab.destination === 'handoff') {
            if (!tab.handoffCommandId) return undefined;
            tabs.push({
              id: tab.id,
              title: tab.title,
              toolbarAction: tab.toolbarAction,
              destination: 'handoff',
              handoffCommandId: tab.handoffCommandId,
              sections: [],
            });
          } else {
            tabs.push({
              id: tab.id,
              title: tab.title,
              toolbarAction: tab.toolbarAction,
              destination: 'inline',
              sections: sectionsByTab.get(tab.id) ?? [],
            });
          }
        }
        next = {
          ...next,
          selectedTabId: change.value.selectedTabId,
          tabs,
        };
        break;
      }
      case 'replaceSection': {
        let changed = false;
        const tabs = next.tabs.map((tab) => {
          if (tab.id !== change.tabId || tab.destination !== 'inline') {
            return tab;
          }
          const sections = [...tab.sections];
          const existingIndex = sections.findIndex(
            (section) => section.id === change.sectionId,
          );
          if (existingIndex >= 0) {
            sections.splice(existingIndex, 1);
          }
          if (change.index < 0 || change.index > sections.length) {
            return tab;
          }
          sections.splice(change.index, 0, change.value);
          changed = true;
          return { ...tab, sections };
        });
        if (!changed) return undefined;
        next = { ...next, tabs };
        break;
      }
      case 'removeSection':
        next = {
          ...next,
          tabs: next.tabs.map((tab) =>
            tab.id === change.tabId
              ? {
                  ...tab,
                  sections: tab.sections.filter(
                    (section) => section.id !== change.sectionId,
                  ),
                }
              : tab,
          ),
        };
        break;
      case 'replaceSurface':
        next = { ...next, theme: change.value };
        break;
      default:
        return undefined;
    }
  }
  return next;
}

function payloadIsValid(payload: IHomeContainerSnapshotPayload): boolean {
  return isHomeContainerSnapshotInvariantValid({
    selectedTabId: payload.selectedTabId,
    tabs: payload.tabs,
  });
}

export function applyHomeContainerSnapshotV3(
  envelope: IHomeContainerSnapshotEnvelopeV3,
): IHomeContainerProtocolV3ApplyResult {
  if (envelope.protocolVersion !== HOME_CONTAINER_PROTOCOL_V3_VERSION) {
    return { kind: 'needSnapshot', reason: 'unsupportedProtocol' };
  }
  if (
    !isSafeRevision(envelope.transportRevision) ||
    !isSafeRevision(envelope.identity.storeCommitId) ||
    !isPresentationRevisionVector(envelope.presentationRevisions) ||
    !isAuthorityRevisionVector(envelope.authorityRevisions) ||
    !isRevisionRecord(envelope.slotRevisions) ||
    !payloadIsValid(envelope.payload)
  ) {
    return { kind: 'needSnapshot', reason: 'invalidInvariant' };
  }
  return {
    kind: 'applied',
    state: {
      identity: envelope.identity,
      transportRevision: envelope.transportRevision,
      presentationRevisions: envelope.presentationRevisions,
      authorityRevisions: envelope.authorityRevisions,
      slotRevisions: envelope.slotRevisions,
      payload: envelope.payload,
    },
  };
}

export function applyHomeContainerPatchV3({
  availableSlotRevisions,
  current,
  envelope,
}: {
  availableSlotRevisions: IHomeContainerSlotRevisionVectorV3;
  current: IHomeContainerProtocolV3State;
  envelope: IHomeContainerPatchEnvelopeV3;
}): IHomeContainerProtocolV3ApplyResult {
  if (envelope.protocolVersion !== HOME_CONTAINER_PROTOCOL_V3_VERSION) {
    return { kind: 'needSnapshot', reason: 'unsupportedProtocol' };
  }
  if (
    !isSafeRevision(envelope.baseTransportRevision) ||
    !isSafeRevision(envelope.transportRevision) ||
    !isSafeRevision(envelope.identity.storeCommitId) ||
    envelope.identity.storeCommitId < current.identity.storeCommitId ||
    !isPresentationRevisionVector(envelope.presentationRevisions) ||
    !isAuthorityRevisionVector(envelope.authorityRevisions) ||
    !isRevisionRecord(envelope.requiredSlotRevisions)
  ) {
    return { kind: 'needSnapshot', reason: 'invalidInvariant' };
  }
  if (!ownersMatch(current.identity, envelope.identity)) {
    return { kind: 'needSnapshot', reason: 'ownerMismatch' };
  }
  if (
    envelope.transportRevision === current.transportRevision &&
    envelope.baseTransportRevision < envelope.transportRevision
  ) {
    return { kind: 'duplicate', state: current };
  }
  if (
    envelope.baseTransportRevision !== current.transportRevision ||
    envelope.transportRevision !== current.transportRevision + 1
  ) {
    return { kind: 'needSnapshot', reason: 'revisionGap' };
  }
  if (
    !hasRequiredSlots(availableSlotRevisions, envelope.requiredSlotRevisions)
  ) {
    return { kind: 'needSnapshot', reason: 'slotRevisionGap' };
  }
  if (!revisionsDoNotRegress(current, envelope)) {
    return { kind: 'needSnapshot', reason: 'invalidInvariant' };
  }
  const payload = applyChanges(current.payload, envelope.changes);
  if (!payload || !payloadIsValid(payload)) {
    return { kind: 'needSnapshot', reason: 'invalidInvariant' };
  }
  return {
    kind: 'applied',
    state: {
      identity: envelope.identity,
      transportRevision: envelope.transportRevision,
      presentationRevisions: envelope.presentationRevisions,
      authorityRevisions: envelope.authorityRevisions,
      slotRevisions: { ...current.slotRevisions, ...availableSlotRevisions },
      payload,
    },
  };
}

function parseIntentAuthority(
  value: unknown,
): IHomeContainerIntentAuthorityV3 | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as {
    kind?: unknown;
    revision?: unknown;
    sectionId?: unknown;
  };
  if (!isSafeRevision(candidate.revision)) return undefined;
  if (
    candidate.kind === 'shellCommands' ||
    candidate.kind === 'tabApplicability'
  ) {
    return { kind: candidate.kind, revision: candidate.revision };
  }
  if (
    candidate.kind === 'sectionCommands' &&
    isSectionId(candidate.sectionId)
  ) {
    return {
      kind: candidate.kind,
      sectionId: candidate.sectionId,
      revision: candidate.revision,
    };
  }
  return undefined;
}

export function parseHomeContainerIntentV3(
  value: string,
): IHomeContainerIntentV3 | undefined {
  try {
    const candidate = JSON.parse(value) as {
      protocolVersion?: unknown;
      intentId?: unknown;
      owner?: { scopeKey?: unknown; sessionId?: unknown };
      authority?: unknown;
      intent?: {
        kind?: unknown;
        commandId?: unknown;
        itemId?: unknown;
        tabId?: unknown;
        requestId?: unknown;
      };
    };
    const authority = parseIntentAuthority(candidate.authority);
    if (
      candidate.protocolVersion !== HOME_CONTAINER_PROTOCOL_V3_VERSION ||
      typeof candidate.intentId !== 'string' ||
      !candidate.intentId ||
      typeof candidate.owner?.scopeKey !== 'string' ||
      typeof candidate.owner.sessionId !== 'string' ||
      !authority ||
      !candidate.intent
    ) {
      return undefined;
    }
    const intent = candidate.intent;
    if (
      intent.kind === 'selectTab' &&
      isTabId(intent.tabId) &&
      authority.kind === 'tabApplicability'
    ) {
      return candidate as IHomeContainerIntentV3;
    }
    if (
      intent.kind === 'refresh' &&
      isTabId(intent.tabId) &&
      typeof intent.requestId === 'string' &&
      authority.kind === 'sectionCommands' &&
      authority.sectionId === intent.tabId
    ) {
      return candidate as IHomeContainerIntentV3;
    }
    if (
      intent.kind === 'action' &&
      typeof intent.commandId === 'string' &&
      (intent.itemId === undefined || typeof intent.itemId === 'string') &&
      authority.kind !== 'tabApplicability'
    ) {
      return candidate as IHomeContainerIntentV3;
    }
    if (
      intent.kind === 'handoff' &&
      isTabId(intent.tabId) &&
      typeof intent.commandId === 'string' &&
      authority.kind === 'tabApplicability'
    ) {
      return candidate as IHomeContainerIntentV3;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function validateHomeContainerIntentV3({
  current,
  intent,
}: {
  current: IHomeContainerProtocolV3State;
  intent: IHomeContainerIntentV3;
}): boolean {
  if (!ownersMatch(current.identity, intent.owner)) return false;
  const { authority } = intent;
  if (authority.kind === 'shellCommands') {
    return authority.revision === current.authorityRevisions.shellCommands;
  }
  if (authority.kind === 'tabApplicability') {
    return authority.revision === current.authorityRevisions.tabApplicability;
  }
  return (
    authority.revision ===
    current.authorityRevisions.sectionCommands[authority.sectionId]
  );
}

export function navigationTabsFromPayload(
  payload: IHomeContainerSnapshotPayload,
): IHomeContainerNavigationTab[] {
  return payload.tabs.map(({ sections: _sections, ...tab }) => tab);
}
