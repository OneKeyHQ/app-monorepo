import {
  HOME_CONTAINER_TAB_IDS,
  isHomeContainerSnapshotInvariantValid,
} from './HomeContainer.types';

import type {
  IHomeContainerHeader,
  IHomeContainerNavigationTab,
  IHomeContainerOwner,
  IHomeContainerSection,
  IHomeContainerSnapshotPayload,
  IHomeContainerTab,
  IHomeContainerTabId,
  IHomeContainerTheme,
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
  surface: number;
  sections: Readonly<Record<IHomeContainerTabId, number>>;
};

export type IHomeContainerAuthorityRevisionVectorV3 = {
  shellCommands: number;
  tabApplicability: number;
  sectionCommands: Readonly<Record<IHomeContainerSectionId, number>>;
};

export type IHomeContainerCommitIdentityV3 = IHomeContainerOwner & {
  storeCommitId: number;
};

export type IHomeContainerSnapshotEnvelopeV3 = {
  kind: 'snapshot';
  protocolVersion: typeof HOME_CONTAINER_PROTOCOL_V3_VERSION;
  identity: IHomeContainerCommitIdentityV3;
  presentationRevisions: IHomeContainerPresentationRevisionVectorV3;
  authorityRevisions: IHomeContainerAuthorityRevisionVectorV3;
  payload: IHomeContainerSnapshotPayload;
};

export type IHomeContainerDomainUpdateV3 =
  | {
      kind: 'shell';
      presentationRevision: number;
      commandRevision: number;
      value: IHomeContainerHeader;
    }
  | {
      kind: 'navigation';
      presentationRevision: number;
      applicabilityRevision: number;
      value: {
        selectedTabId: IHomeContainerTabId;
        tabs: IHomeContainerNavigationTab[];
      };
    }
  | {
      kind: 'section';
      tabId: IHomeContainerTabId;
      presentationRevision: number;
      commandRevisions: Readonly<Record<IHomeContainerSectionId, number>>;
      value: IHomeContainerSection[];
    }
  | {
      kind: 'surface';
      presentationRevision: number;
      value: IHomeContainerTheme;
    };

export type IHomeContainerDomainBatchV3 = {
  kind: 'domains';
  protocolVersion: typeof HOME_CONTAINER_PROTOCOL_V3_VERSION;
  identity: IHomeContainerCommitIdentityV3;
  updates: readonly IHomeContainerDomainUpdateV3[];
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
  presentationRevisions: IHomeContainerPresentationRevisionVectorV3;
  authorityRevisions: IHomeContainerAuthorityRevisionVectorV3;
  payload: IHomeContainerSnapshotPayload;
};

export type IHomeContainerProtocolV3ApplyResult =
  | {
      kind: 'applied';
      state: IHomeContainerProtocolV3State;
      appliedDomains: readonly string[];
    }
  | { kind: 'ignored'; reason: 'ownerMismatch' | 'stale' }
  | {
      kind: 'invalid';
      reason: 'invalidInvariant' | 'unsupportedProtocol';
    };

function isSafeRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isRevisionRecord(
  value: unknown,
): value is Readonly<Record<string, number>> {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every(isSafeRevision)
  );
}

function hasExactTabRevisionKeys(
  value: Readonly<Record<string, number>>,
): boolean {
  const keys = Object.keys(value);
  return keys.length === HOME_CONTAINER_TAB_IDS.length && keys.every(isTabId);
}

function hasExactSectionRevisionKeys(
  value: Readonly<Record<string, number>>,
): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === HOME_CONTAINER_SECTION_IDS.length && keys.every(isSectionId)
  );
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
    isSafeRevision(candidate.surface) &&
    isRevisionRecord(candidate.sections) &&
    hasExactTabRevisionKeys(candidate.sections)
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
    hasExactSectionRevisionKeys(candidate.sectionCommands)
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

function payloadIsValid(payload: IHomeContainerSnapshotPayload): boolean {
  return isHomeContainerSnapshotInvariantValid({
    selectedTabId: payload.selectedTabId,
    tabs: payload.tabs,
  });
}

function snapshotState(
  envelope: IHomeContainerSnapshotEnvelopeV3,
): IHomeContainerProtocolV3State | undefined {
  if (
    envelope.protocolVersion !== HOME_CONTAINER_PROTOCOL_V3_VERSION ||
    envelope.kind !== 'snapshot' ||
    !isSafeRevision(envelope.identity.storeCommitId) ||
    envelope.identity.scopeKey.length === 0 ||
    envelope.identity.sessionId.length === 0 ||
    !isPresentationRevisionVector(envelope.presentationRevisions) ||
    !isAuthorityRevisionVector(envelope.authorityRevisions) ||
    !payloadIsValid(envelope.payload)
  ) {
    return undefined;
  }
  return {
    identity: envelope.identity,
    presentationRevisions: envelope.presentationRevisions,
    authorityRevisions: envelope.authorityRevisions,
    payload: envelope.payload,
  };
}

function navigationTabs(
  current: IHomeContainerSnapshotPayload,
  navigation: {
    selectedTabId: IHomeContainerTabId;
    tabs: IHomeContainerNavigationTab[];
  },
): IHomeContainerSnapshotPayload | undefined {
  const sectionsByTab = new Map(
    current.tabs.map((tab) => [tab.id, tab.sections] as const),
  );
  const tabs: IHomeContainerTab[] = [];
  for (const tab of navigation.tabs) {
    if (tab.destination === 'handoff') {
      if (!tab.handoffCommandId) return undefined;
      tabs.push({
        ...tab,
        destination: 'handoff',
        handoffCommandId: tab.handoffCommandId,
        sections: [],
      });
    } else {
      const { handoffCommandId: _handoffCommandId, ...inlineTab } = tab;
      tabs.push({
        ...inlineTab,
        destination: 'inline',
        sections: sectionsByTab.get(tab.id) ?? [],
      });
    }
  }
  const payload = {
    ...current,
    selectedTabId: navigation.selectedTabId,
    tabs,
  };
  return payloadIsValid(payload) ? payload : undefined;
}

function replaceTabSections(
  current: IHomeContainerSnapshotPayload,
  tabId: IHomeContainerTabId,
  sections: IHomeContainerSection[],
): IHomeContainerSnapshotPayload | undefined {
  let replaced = false;
  const tabs = current.tabs.map((tab) => {
    if (tab.id !== tabId || tab.destination !== 'inline') {
      return tab;
    }
    replaced = true;
    return { ...tab, sections };
  });
  if (!replaced) {
    return undefined;
  }
  const payload = { ...current, tabs };
  return payloadIsValid(payload) ? payload : undefined;
}

export function applyHomeContainerSnapshotV3(
  envelope: IHomeContainerSnapshotEnvelopeV3,
  current?: IHomeContainerProtocolV3State,
): IHomeContainerProtocolV3ApplyResult {
  if (envelope.protocolVersion !== HOME_CONTAINER_PROTOCOL_V3_VERSION) {
    return { kind: 'invalid', reason: 'unsupportedProtocol' };
  }
  const incoming = snapshotState(envelope);
  if (!incoming) {
    return { kind: 'invalid', reason: 'invalidInvariant' };
  }
  if (!current || !ownersMatch(current.identity, incoming.identity)) {
    return {
      kind: 'applied',
      state: incoming,
      appliedDomains: ['shell', 'navigation', 'surface', 'sections'],
    };
  }
  const updates: IHomeContainerDomainUpdateV3[] = [
    {
      kind: 'shell',
      presentationRevision: incoming.presentationRevisions.shell,
      commandRevision: incoming.authorityRevisions.shellCommands,
      value: incoming.payload.header,
    },
    {
      kind: 'navigation',
      presentationRevision: incoming.presentationRevisions.navigation,
      applicabilityRevision: incoming.authorityRevisions.tabApplicability,
      value: {
        selectedTabId: incoming.payload.selectedTabId,
        tabs: incoming.payload.tabs.map(
          ({ sections: _sections, ...tab }) => tab,
        ),
      },
    },
    {
      kind: 'surface',
      presentationRevision: incoming.presentationRevisions.surface,
      value: incoming.payload.theme,
    },
    ...incoming.payload.tabs
      .filter((tab) => tab.destination === 'inline')
      .map(
        (tab): IHomeContainerDomainUpdateV3 => ({
          kind: 'section',
          tabId: tab.id,
          presentationRevision: incoming.presentationRevisions.sections[tab.id],
          commandRevisions: incoming.authorityRevisions.sectionCommands,
          value: tab.sections,
        }),
      ),
  ];
  return applyHomeContainerDomainsV3(
    {
      kind: 'domains',
      protocolVersion: HOME_CONTAINER_PROTOCOL_V3_VERSION,
      identity: incoming.identity,
      updates,
    },
    current,
  );
}

export function applyHomeContainerDomainsV3(
  batch: IHomeContainerDomainBatchV3,
  current: IHomeContainerProtocolV3State | undefined,
): IHomeContainerProtocolV3ApplyResult {
  if (batch.protocolVersion !== HOME_CONTAINER_PROTOCOL_V3_VERSION) {
    return { kind: 'invalid', reason: 'unsupportedProtocol' };
  }
  if (
    batch.kind !== 'domains' ||
    !current ||
    !isSafeRevision(batch.identity.storeCommitId) ||
    batch.identity.scopeKey.length === 0 ||
    batch.identity.sessionId.length === 0
  ) {
    return { kind: 'invalid', reason: 'invalidInvariant' };
  }
  if (!ownersMatch(batch.identity, current.identity)) {
    return { kind: 'ignored', reason: 'ownerMismatch' };
  }

  let payload = current.payload;
  let presentationRevisions = current.presentationRevisions;
  let authorityRevisions = current.authorityRevisions;
  const appliedDomains: string[] = [];
  const seenDomains = new Set<string>();

  for (const update of batch.updates) {
    const domainKey =
      update.kind === 'section' ? `section:${update.tabId}` : update.kind;
    if (seenDomains.has(domainKey)) {
      return { kind: 'invalid', reason: 'invalidInvariant' };
    }
    seenDomains.add(domainKey);
    if (!isSafeRevision(update.presentationRevision)) {
      return { kind: 'invalid', reason: 'invalidInvariant' };
    }

    switch (update.kind) {
      case 'shell':
        if (!isSafeRevision(update.commandRevision)) {
          return { kind: 'invalid', reason: 'invalidInvariant' };
        }
        if (update.presentationRevision <= presentationRevisions.shell) {
          break;
        }
        if (update.commandRevision < authorityRevisions.shellCommands) {
          return { kind: 'invalid', reason: 'invalidInvariant' };
        }
        payload = { ...payload, header: update.value };
        presentationRevisions = {
          ...presentationRevisions,
          shell: update.presentationRevision,
        };
        authorityRevisions = {
          ...authorityRevisions,
          shellCommands: update.commandRevision,
        };
        appliedDomains.push(domainKey);
        break;
      case 'navigation': {
        if (
          !isSafeRevision(update.applicabilityRevision) ||
          update.value.tabs.some((tab) => !isTabId(tab.id))
        ) {
          return { kind: 'invalid', reason: 'invalidInvariant' };
        }
        if (update.presentationRevision <= presentationRevisions.navigation) {
          break;
        }
        if (
          update.applicabilityRevision < authorityRevisions.tabApplicability
        ) {
          return { kind: 'invalid', reason: 'invalidInvariant' };
        }
        const nextPayload = navigationTabs(payload, update.value);
        if (!nextPayload) {
          return { kind: 'invalid', reason: 'invalidInvariant' };
        }
        payload = nextPayload;
        presentationRevisions = {
          ...presentationRevisions,
          navigation: update.presentationRevision,
        };
        authorityRevisions = {
          ...authorityRevisions,
          tabApplicability: update.applicabilityRevision,
        };
        appliedDomains.push(domainKey);
        break;
      }
      case 'section': {
        if (
          !isTabId(update.tabId) ||
          !isRevisionRecord(update.commandRevisions) ||
          !hasExactSectionRevisionKeys(update.commandRevisions)
        ) {
          return { kind: 'invalid', reason: 'invalidInvariant' };
        }
        if (
          update.presentationRevision <=
          presentationRevisions.sections[update.tabId]
        ) {
          break;
        }
        const nextPayload = replaceTabSections(
          payload,
          update.tabId,
          update.value,
        );
        if (!nextPayload) {
          return { kind: 'invalid', reason: 'invalidInvariant' };
        }
        payload = nextPayload;
        presentationRevisions = {
          ...presentationRevisions,
          sections: {
            ...presentationRevisions.sections,
            [update.tabId]: update.presentationRevision,
          },
        };
        const currentSectionCommands = authorityRevisions.sectionCommands;
        const incomingSectionCommands = update.commandRevisions;
        authorityRevisions = {
          ...authorityRevisions,
          sectionCommands: Object.fromEntries(
            HOME_CONTAINER_SECTION_IDS.map((sectionId) => [
              sectionId,
              Math.max(
                currentSectionCommands[sectionId],
                incomingSectionCommands[sectionId],
              ),
            ]),
          ) as Record<IHomeContainerSectionId, number>,
        };
        appliedDomains.push(domainKey);
        break;
      }
      case 'surface':
        if (update.presentationRevision <= presentationRevisions.surface) {
          break;
        }
        payload = { ...payload, theme: update.value };
        presentationRevisions = {
          ...presentationRevisions,
          surface: update.presentationRevision,
        };
        appliedDomains.push(domainKey);
        break;
      default:
        return { kind: 'invalid', reason: 'invalidInvariant' };
    }
  }

  if (appliedDomains.length === 0) {
    return { kind: 'ignored', reason: 'stale' };
  }
  return {
    kind: 'applied',
    state: {
      identity: {
        ...batch.identity,
        storeCommitId: Math.max(
          current.identity.storeCommitId,
          batch.identity.storeCommitId,
        ),
      },
      presentationRevisions,
      authorityRevisions,
      payload,
    },
    appliedDomains,
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
