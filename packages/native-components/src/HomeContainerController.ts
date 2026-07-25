import {
  HOME_CONTAINER_PROTOCOL_VERSION,
  HOME_CONTAINER_SCHEMA_VERSION,
  type IHomeContainerCapabilities,
  type IHomeContainerChange,
  type IHomeContainerHeader,
  type IHomeContainerOwner,
  type IHomeContainerPatchEnvelope,
  type IHomeContainerRef,
  type IHomeContainerSection,
  type IHomeContainerSlotKey,
  type IHomeContainerSlots,
  type IHomeContainerSnapshot,
  type IHomeContainerSnapshotEnvelope,
  type IHomeContainerTab,
  type IHomeContainerTabId,
  type IHomeContainerTheme,
  type IHomeContainerTransportResult,
  isHomeContainerSnapshotInvariantValid,
  parseHomeContainerTransportResult,
} from './HomeContainer.types';
import {
  HOME_CONTAINER_PROTOCOL_V3_VERSION,
  HOME_CONTAINER_SECTION_IDS,
} from './HomeContainerProtocolV3';

import type {
  IHomeContainerAuthorityRevisionVectorV3,
  IHomeContainerPatchEnvelopeV3,
  IHomeContainerPresentationRevisionVectorV3,
  IHomeContainerSectionId,
  IHomeContainerSlotRevisionVectorV3,
  IHomeContainerSnapshotEnvelopeV3,
} from './HomeContainerProtocolV3';

type IHomeContainerControllerScheduler = (flush: () => void) => void;
type IHomeContainerControllerDeadlineScheduler = (
  callback: () => void,
  delayMs: number,
) => () => void;

export const HOME_CONTAINER_TRANSPORT_ACK_DEADLINE_MS = 5000;

type IHomeContainerPortfolioSlotState = 'absent' | 'content' | 'geometry';

export interface IHomeContainerTransportDiagnostic {
  event: 'deadline' | 'recoverySnapshot' | 'result';
  sessionHash: string;
  revision: number;
  inFlightRevision?: number;
  inFlightAgeMs?: number;
  resultKind:
    | IHomeContainerTransportResult['kind']
    | 'deadline'
    | 'recoverySnapshot';
  exactMatch: boolean;
  mismatch?: 'missingInFlight' | 'owner' | 'revision';
  portfolioSlot: {
    current: IHomeContainerPortfolioSlotState;
    acknowledged: IHomeContainerPortfolioSlotState;
    presentation: 'absent' | 'acknowledged' | 'reserved';
  };
}

export interface IHomeContainerControllerOptions {
  initialSnapshot: IHomeContainerSnapshot;
  initialOwner?: IHomeContainerOwner;
  initialSlots?: IHomeContainerSlots;
  schedule?: IHomeContainerControllerScheduler;
  scheduleDeadline?: IHomeContainerControllerDeadlineScheduler;
  now?: () => number;
  diagnosticsEnabled?: boolean;
  reportDiagnostic?: (diagnostic: IHomeContainerTransportDiagnostic) => void;
  requireProtocolV3?: boolean;
  initialProtocolV3Revisions?: IHomeContainerControllerRevisionStateV3;
}

export interface IHomeContainerControllerRevisionStateV3 {
  storeCommitId: number;
  presentationRevisions: IHomeContainerPresentationRevisionVectorV3;
  authorityRevisions: IHomeContainerAuthorityRevisionVectorV3;
  slotRevisions?: IHomeContainerSlotRevisionVectorV3;
}

export interface IHomeContainerRenderedSlotState {
  owner: IHomeContainerOwner;
  revision: number;
  slots: IHomeContainerSlots;
}

interface IHomeContainerInFlightTransaction {
  owner: IHomeContainerOwner;
  revision: number;
  snapshot: IHomeContainerSnapshot;
  slots?: IHomeContainerSlots;
  startedAt: number;
  isRecovery: boolean;
}

const LEGACY_OWNER: IHomeContainerOwner = {
  scopeKey: 'legacy',
  sessionId: 'legacy',
};

const MAX_PENDING_NATIVE_TAB_SELECTIONS = 16;

const defaultSchedule: IHomeContainerControllerScheduler = (flush) => {
  queueMicrotask(flush);
};

const defaultScheduleDeadline: IHomeContainerControllerDeadlineScheduler = (
  callback,
  delayMs,
) => {
  const timeout = setTimeout(callback, delayMs);
  (timeout as ReturnType<typeof setTimeout> & { unref?: () => void }).unref?.();
  return () => clearTimeout(timeout);
};

function isDebugRuntime(): boolean {
  return (
    (globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ ===
      true && process.env.NODE_ENV !== 'test'
  );
}

const ignoreDiagnostic = (_diagnostic: IHomeContainerTransportDiagnostic) =>
  undefined;

function hashSessionId(sessionId: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < sessionId.length; index += 1) {
    hash ^= sessionId.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function getPortfolioSlotState(
  slots: IHomeContainerSlots | undefined,
): IHomeContainerPortfolioSlotState {
  const slot = slots?.contentStates?.portfolio;
  if (!slot) {
    return 'absent';
  }
  return slot.content === undefined || slot.content === null
    ? 'geometry'
    : 'content';
}

function ownersMatch(
  left: IHomeContainerOwner,
  right: IHomeContainerOwner,
): boolean {
  return left.scopeKey === right.scopeKey && left.sessionId === right.sessionId;
}

function getTransportResultMismatch(
  owner: IHomeContainerOwner,
  revision: number,
  candidate: IHomeContainerInFlightTransaction | undefined,
): IHomeContainerTransportDiagnostic['mismatch'] {
  if (!candidate) {
    return 'missingInFlight';
  }
  if (!ownersMatch(owner, candidate.owner)) {
    return 'owner';
  }
  if (revision !== candidate.revision) {
    return 'revision';
  }
  return undefined;
}

function getPortfolioSlotPresentation(
  current: IHomeContainerPortfolioSlotState,
  acknowledged: IHomeContainerPortfolioSlotState,
): IHomeContainerTransportDiagnostic['portfolioSlot']['presentation'] {
  if (acknowledged !== 'absent') {
    return 'acknowledged';
  }
  if (current !== 'absent') {
    return 'reserved';
  }
  return 'absent';
}

function arraysHaveSameValues<T>(left: T[], right: T[]): boolean {
  return (
    left.length === right.length && left.every((value) => right.includes(value))
  );
}

function capabilitiesMatch(
  left: IHomeContainerCapabilities,
  right: IHomeContainerCapabilities,
): boolean {
  return (
    arraysHaveSameValues(left.schemaVersions, right.schemaVersions) &&
    arraysHaveSameValues(
      left.protocolVersions ?? [],
      right.protocolVersions ?? [],
    ) &&
    arraysHaveSameValues(left.tabIds, right.tabIds) &&
    left.preferredProtocol === right.preferredProtocol &&
    left.supportsPatches === right.supportsPatches &&
    left.supportsAtomicPatches === right.supportsAtomicPatches &&
    left.supportsNativeRefresh === right.supportsNativeRefresh &&
    left.supportsHorizontalPaging === right.supportsHorizontalPaging &&
    left.supportsSlots === right.supportsSlots
  );
}

function navigationTabs(snapshot: IHomeContainerSnapshot) {
  return snapshot.tabs.map(({ sections: _sections, ...tab }) => tab);
}

function createProtocolV3RevisionState(): IHomeContainerControllerRevisionStateV3 {
  const sectionRevisions = Object.fromEntries(
    HOME_CONTAINER_SECTION_IDS.map((sectionId) => [sectionId, 0]),
  ) as Record<(typeof HOME_CONTAINER_SECTION_IDS)[number], number>;
  return {
    storeCommitId: 0,
    presentationRevisions: {
      shell: 0,
      navigation: 0,
      sections: sectionRevisions,
    },
    authorityRevisions: {
      shellCommands: 0,
      tabApplicability: 0,
      sectionCommands: sectionRevisions,
    },
    slotRevisions: {},
  };
}

function mergeProtocolV3RevisionState(
  current: IHomeContainerControllerRevisionStateV3,
  next: IHomeContainerControllerRevisionStateV3,
): IHomeContainerControllerRevisionStateV3 {
  const presentationSections = Object.fromEntries(
    HOME_CONTAINER_SECTION_IDS.map((sectionId) => [
      sectionId,
      Math.max(
        current.presentationRevisions.sections[sectionId],
        next.presentationRevisions.sections[sectionId],
      ),
    ]),
  ) as Record<IHomeContainerSectionId, number>;
  const authoritySections = Object.fromEntries(
    HOME_CONTAINER_SECTION_IDS.map((sectionId) => [
      sectionId,
      Math.max(
        current.authorityRevisions.sectionCommands[sectionId],
        next.authorityRevisions.sectionCommands[sectionId],
      ),
    ]),
  ) as Record<IHomeContainerSectionId, number>;
  const slotIds = new Set([
    ...Object.keys(current.slotRevisions ?? {}),
    ...Object.keys(next.slotRevisions ?? {}),
  ]);
  const slotRevisions = Object.fromEntries(
    Array.from(slotIds).map((slotId) => [
      slotId,
      Math.max(
        current.slotRevisions?.[slotId] ?? 0,
        next.slotRevisions?.[slotId] ?? 0,
      ),
    ]),
  );
  return {
    storeCommitId: Math.max(current.storeCommitId, next.storeCommitId),
    presentationRevisions: {
      shell: Math.max(
        current.presentationRevisions.shell,
        next.presentationRevisions.shell,
      ),
      navigation: Math.max(
        current.presentationRevisions.navigation,
        next.presentationRevisions.navigation,
      ),
      sections: presentationSections,
    },
    authorityRevisions: {
      shellCommands: Math.max(
        current.authorityRevisions.shellCommands,
        next.authorityRevisions.shellCommands,
      ),
      tabApplicability: Math.max(
        current.authorityRevisions.tabApplicability,
        next.authorityRevisions.tabApplicability,
      ),
      sectionCommands: authoritySections,
    },
    slotRevisions,
  };
}

function slotKeys(slots: IHomeContainerSlots): string[] {
  const keys: string[] = [];
  if (slots.accountRow) keys.push('header.account-row');
  if (slots.balance) keys.push('header.balance');
  if (slots.headerActionRow) keys.push('header.action-row');
  Object.entries(slots.contentFooters ?? {}).forEach(([tabId, footerSlots]) => {
    Object.keys(footerSlots ?? {}).forEach((footerId) => {
      keys.push(`content.footer.${tabId}.${footerId}`);
    });
  });
  Object.keys(slots.contentHeaders ?? {}).forEach((tabId) => {
    keys.push(`content.header.${tabId}`);
  });
  Object.keys(slots.contentStates ?? {}).forEach((tabId) => {
    keys.push(`content.state.${tabId}`);
  });
  Object.keys(slots.tabAccessories ?? {}).forEach((tabId) => {
    keys.push(`tab.accessory.${tabId}`);
  });
  return keys;
}

function pickSlotRevisions(
  revisions: IHomeContainerSlotRevisionVectorV3,
  keys: ReadonlySet<string>,
): IHomeContainerSlotRevisionVectorV3 {
  return Object.fromEntries(
    Array.from(keys).flatMap((slotId) => {
      const revision = revisions[slotId];
      return revision === undefined ? [] : [[slotId, revision]];
    }),
  );
}

function headerCommandSignature(header: IHomeContainerHeader): string {
  return JSON.stringify({
    accountActionId: header.accountActionId,
    balanceActionId: header.balanceActionId,
    copyActionId: header.copyActionId,
    networkActionId: header.networkActionId,
    actions: header.actions.map((action) => action.actionId),
    balanceActions: header.balanceActions?.map((action) => action.actionId),
    banners: header.banners.map((banner) => [
      banner.actionId,
      banner.dismissActionId,
    ]),
  });
}

function navigationAuthoritySignature(tabs: IHomeContainerTab[]): string {
  return JSON.stringify(
    tabs.map((tab) => [
      tab.id,
      tab.destination,
      tab.destination === 'handoff' ? tab.handoffCommandId : undefined,
    ]),
  );
}

function sectionCommandSignature(sections: IHomeContainerSection[]): string {
  return JSON.stringify(
    sections.map((section) => [
      section.id,
      section.actionId,
      section.items.map((item) => [
        item.id,
        item.actionId,
        item.favoriteActionId,
      ]),
    ]),
  );
}

function snapshotEnvelope(
  snapshot: IHomeContainerSnapshot,
  owner: IHomeContainerOwner,
  revision: number,
): IHomeContainerSnapshotEnvelope {
  return {
    kind: 'snapshot',
    protocolVersion: HOME_CONTAINER_PROTOCOL_VERSION,
    schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
    owner,
    revision,
    payload: {
      selectedTabId: snapshot.selectedTabId,
      header: snapshot.header,
      tabs: snapshot.tabs,
      theme: snapshot.theme,
    },
  };
}

/**
 * Main-runtime data transport for HomeContainer. Protocol v2 keeps exactly one
 * transaction in flight so native always applies patches to an acknowledged
 * owner/revision. Scroll and gesture state never enters this controller.
 */
export class HomeContainerController {
  private snapshot: IHomeContainerSnapshot;

  private revision: number;

  private owner: IHomeContainerOwner;

  private target: IHomeContainerRef | undefined;

  private capabilities: IHomeContainerCapabilities | undefined;

  private protocolVersion: 1 | 2 | 3 = 1;

  private protocolV3Revisions: IHomeContainerControllerRevisionStateV3;

  private protocolV3RevisionsAreExternal = false;

  private pendingNativeTabSelections: IHomeContainerTabId[] = [];

  private readonly requireProtocolV3: boolean;

  private inFlight: IHomeContainerInFlightTransaction | undefined;

  private expiredRecovery: IHomeContainerInFlightTransaction | undefined;

  private cancelInFlightDeadline: (() => void) | undefined;

  private nextTransactionIsRecovery = false;

  private transportRecoveryBlocked = false;

  private acknowledgedSnapshot: IHomeContainerSnapshot | undefined;

  private currentSlots: IHomeContainerSlots | undefined;

  private renderedSlotState: IHomeContainerRenderedSlotState | undefined;

  private readonly pendingTabIds = new Set<IHomeContainerTabId>();

  private headerPending = false;

  private themePending = false;

  private navigationPending = false;

  private slotsPending = false;

  private readonly pendingRequiredSlotIds = new Set<IHomeContainerSlotKey>();

  private slotRevisionsForCurrentSlots: IHomeContainerSlotRevisionVectorV3;

  private fullSnapshotPending = false;

  private flushScheduled = false;

  private disposed = false;

  private readonly schedule: IHomeContainerControllerScheduler;

  private readonly scheduleDeadline: IHomeContainerControllerDeadlineScheduler;

  private readonly now: () => number;

  private readonly diagnosticsEnabled: boolean;

  private readonly reportDiagnostic: (
    diagnostic: IHomeContainerTransportDiagnostic,
  ) => void;

  constructor({
    initialSnapshot,
    initialOwner = LEGACY_OWNER,
    initialSlots,
    schedule = defaultSchedule,
    scheduleDeadline = defaultScheduleDeadline,
    now = Date.now,
    diagnosticsEnabled = isDebugRuntime(),
    reportDiagnostic = ignoreDiagnostic,
    requireProtocolV3 = false,
    initialProtocolV3Revisions,
  }: IHomeContainerControllerOptions) {
    this.snapshot = initialSnapshot;
    this.revision = initialSnapshot.revision;
    this.owner = initialOwner;
    this.currentSlots = initialSlots;
    this.schedule = schedule;
    this.scheduleDeadline = scheduleDeadline;
    this.now = now;
    this.diagnosticsEnabled = diagnosticsEnabled;
    this.reportDiagnostic = reportDiagnostic;
    this.requireProtocolV3 = requireProtocolV3;
    this.protocolV3Revisions =
      initialProtocolV3Revisions ?? createProtocolV3RevisionState();
    this.protocolV3RevisionsAreExternal = Boolean(initialProtocolV3Revisions);
    this.slotRevisionsForCurrentSlots = {
      ...this.protocolV3Revisions.slotRevisions,
    };
  }

  getSnapshot(): IHomeContainerSnapshot {
    return this.snapshot;
  }

  getOwner(): IHomeContainerOwner {
    return this.owner;
  }

  getRenderedRevision(): number | undefined {
    return this.acknowledgedSnapshot?.revision;
  }

  getProtocolVersion(): 1 | 2 | 3 {
    return this.protocolVersion;
  }

  getInitialProtocolV3Snapshot(): IHomeContainerSnapshotEnvelopeV3 {
    return this.createProtocolV3SnapshotEnvelope(
      this.snapshot,
      this.revision + 1,
      this.currentSlots,
    );
  }

  setProtocolV3RevisionState(
    revisionState: IHomeContainerControllerRevisionStateV3,
  ): void {
    if (this.disposed) {
      return;
    }
    this.protocolV3Revisions = mergeProtocolV3RevisionState(
      this.protocolV3Revisions,
      revisionState,
    );
    this.protocolV3RevisionsAreExternal = true;
  }

  getRenderedSlotState(): IHomeContainerRenderedSlotState | undefined {
    return this.renderedSlotState;
  }

  attach(
    target: IHomeContainerRef,
    capabilities = target.getCapabilities(),
  ): boolean {
    if (
      this.disposed ||
      !capabilities ||
      !isHomeContainerSnapshotInvariantValid(this.snapshot)
    ) {
      return false;
    }
    const supportsSchema = capabilities.schemaVersions.includes(
      HOME_CONTAINER_SCHEMA_VERSION,
    );
    const supportsTabs = this.snapshot.tabs.every((tab) =>
      capabilities.tabIds.includes(tab.id),
    );
    if (!supportsSchema || !supportsTabs) {
      return false;
    }
    const protocolVersions = capabilities.protocolVersions ?? [1];
    const preferredProtocol = capabilities.preferredProtocol;
    const supportsProtocolV3 = Boolean(
      protocolVersions.includes(HOME_CONTAINER_PROTOCOL_V3_VERSION) &&
      target.setProtocolV3Snapshot &&
      target.applyProtocolV3Patch,
    );
    if (this.requireProtocolV3 && !supportsProtocolV3) {
      return false;
    }
    const supportsProtocolV2 = Boolean(
      protocolVersions.includes(HOME_CONTAINER_PROTOCOL_VERSION) &&
      target.setProtocolV2Snapshot &&
      target.applyProtocolV2Patch,
    );
    let protocolVersion: 1 | 2 | 3 = 1;
    if (
      supportsProtocolV3 &&
      (this.requireProtocolV3 ||
        (preferredProtocol !== 1 && preferredProtocol !== 2))
    ) {
      protocolVersion = 3;
    } else if (supportsProtocolV2 && preferredProtocol !== 1) {
      protocolVersion = 2;
    }
    if (
      this.target === target &&
      this.capabilities &&
      capabilitiesMatch(this.capabilities, capabilities) &&
      this.protocolVersion === protocolVersion
    ) {
      return true;
    }
    this.target = target;
    this.capabilities = capabilities;
    this.protocolVersion = protocolVersion;
    this.resetTransportRecovery();
    this.acknowledgedSnapshot = undefined;
    this.renderedSlotState = undefined;
    this.fullSnapshotPending = true;
    this.flushNow();
    return true;
  }

  detach(target?: IHomeContainerRef): void {
    if (target && target !== this.target) {
      return;
    }
    this.target = undefined;
    this.capabilities = undefined;
    this.pendingNativeTabSelections = [];
    this.resetTransportRecovery();
    this.acknowledgedSnapshot = undefined;
    this.renderedSlotState = undefined;
  }

  replaceOwner(
    owner: IHomeContainerOwner,
    nextSnapshot: IHomeContainerSnapshot,
  ): void {
    if (this.disposed || !isHomeContainerSnapshotInvariantValid(nextSnapshot)) {
      return;
    }
    this.owner = owner;
    this.pendingNativeTabSelections = [];
    this.resetTransportRecovery();
    this.acknowledgedSnapshot = undefined;
    this.renderedSlotState = undefined;
    this.currentSlots = undefined;
    this.slotRevisionsForCurrentSlots = {};
    this.protocolV3Revisions = createProtocolV3RevisionState();
    this.protocolV3RevisionsAreExternal = false;
    this.replaceSnapshot(nextSnapshot);
  }

  replaceSnapshot(nextSnapshot: IHomeContainerSnapshot): void {
    if (this.disposed || !isHomeContainerSnapshotInvariantValid(nextSnapshot)) {
      return;
    }
    this.resumeTransportForNewData();
    this.snapshot = {
      ...nextSnapshot,
      schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
      revision: this.revision,
    };
    this.bumpProtocolV3({
      authoritySections: HOME_CONTAINER_SECTION_IDS,
      navigationAuthority: true,
      presentationSections: HOME_CONTAINER_SECTION_IDS,
      shellAuthority: true,
      shellPresentation: true,
      navigationPresentation: true,
    });
    this.fullSnapshotPending = true;
    this.clearIncrementalPending();
    this.scheduleFlush();
  }

  updateHeader(header: IHomeContainerHeader): void {
    if (this.disposed) {
      return;
    }
    this.resumeTransportForNewData();
    const changesAuthority =
      headerCommandSignature(this.snapshot.header) !==
      headerCommandSignature(header);
    this.snapshot = { ...this.snapshot, header };
    this.bumpProtocolV3({
      shellAuthority: changesAuthority,
      shellPresentation: true,
    });
    this.headerPending = true;
    this.scheduleFlush();
  }

  updateTheme(theme: IHomeContainerTheme): void {
    if (this.disposed) {
      return;
    }
    this.resumeTransportForNewData();
    this.snapshot = { ...this.snapshot, theme };
    this.bumpProtocolV3({});
    if (this.protocolVersion === 2 || this.protocolVersion === 3) {
      this.themePending = true;
    } else {
      this.fullSnapshotPending = true;
    }
    this.scheduleFlush();
  }

  updateTabs(tabs: IHomeContainerTab[]): void {
    if (
      this.disposed ||
      !isHomeContainerSnapshotInvariantValid({
        selectedTabId: this.snapshot.selectedTabId,
        tabs,
      })
    ) {
      return;
    }
    this.resumeTransportForNewData();
    const changesAuthority =
      navigationAuthoritySignature(this.snapshot.tabs) !==
      navigationAuthoritySignature(tabs);
    this.snapshot = { ...this.snapshot, tabs };
    this.bumpProtocolV3({
      navigationAuthority: changesAuthority,
      navigationPresentation: true,
    });
    if (this.protocolVersion === 2 || this.protocolVersion === 3) {
      this.navigationPending = true;
      tabs.forEach((tab) => {
        if (tab.destination === 'inline') {
          this.pendingTabIds.add(tab.id);
        }
      });
    } else {
      this.fullSnapshotPending = true;
      this.pendingTabIds.clear();
    }
    this.scheduleFlush();
  }

  updateSlots(slots: IHomeContainerSlots): void {
    if (this.disposed || this.currentSlots === slots) {
      return;
    }
    this.resumeTransportForNewData();
    const previousSlots = this.currentSlots;
    const previousSlotRevisions = this.slotRevisionsForCurrentSlots;
    this.currentSlots = slots;
    this.bumpProtocolV3Slots(slots);
    const nextSlotRevisions = this.protocolV3Revisions.slotRevisions ?? {};
    const nextSlotIds = new Set(slotKeys(slots));
    const previousSlotIds = new Set(slotKeys(previousSlots ?? {}));
    nextSlotIds.forEach((slotId) => {
      if (
        !previousSlotIds.has(slotId) ||
        previousSlotRevisions[slotId] !== nextSlotRevisions[slotId]
      ) {
        this.pendingRequiredSlotIds.add(slotId as IHomeContainerSlotKey);
      }
    });
    this.slotRevisionsForCurrentSlots = { ...nextSlotRevisions };
    if (
      this.target &&
      (this.protocolVersion === 2 || this.protocolVersion === 3)
    ) {
      this.slotsPending = true;
      this.scheduleFlush();
    }
  }

  updateTabSections(
    tabId: IHomeContainerTabId,
    sections: IHomeContainerSection[],
  ): boolean {
    if (this.disposed) {
      return false;
    }
    const tabIndex = this.snapshot.tabs.findIndex((tab) => tab.id === tabId);
    if (tabIndex < 0 || this.snapshot.tabs[tabIndex].destination !== 'inline') {
      return false;
    }
    this.resumeTransportForNewData();
    const previousSections = this.snapshot.tabs[tabIndex].sections;
    const tabs = [...this.snapshot.tabs];
    tabs[tabIndex] = { ...tabs[tabIndex], sections };
    this.snapshot = { ...this.snapshot, tabs };
    this.bumpProtocolV3({
      authoritySections:
        sectionCommandSignature(previousSections) !==
        sectionCommandSignature(sections)
          ? [tabId]
          : [],
      presentationSections: [tabId],
    });
    this.pendingTabIds.add(tabId);
    this.scheduleFlush();
    return true;
  }

  selectTab(tabId: IHomeContainerTabId, animated = true): boolean {
    if (
      this.disposed ||
      !this.snapshot.tabs.some(
        (tab) => tab.id === tabId && tab.destination === 'inline',
      )
    ) {
      return false;
    }
    const nativeSelectionIndex = this.pendingNativeTabSelections.indexOf(tabId);
    const confirmsNativeSelection = nativeSelectionIndex >= 0;
    if (confirmsNativeSelection) {
      this.pendingNativeTabSelections.splice(0, nativeSelectionIndex + 1);
    } else {
      this.pendingNativeTabSelections = [];
    }
    const changesSelection = this.snapshot.selectedTabId !== tabId;
    this.snapshot = { ...this.snapshot, selectedTabId: tabId };
    this.bumpProtocolV3({ navigationPresentation: true });
    if (this.protocolVersion === 2 || this.protocolVersion === 3) {
      this.resumeTransportForNewData();
      this.navigationPending = true;
      this.scheduleFlush();
    }
    if (this.target && !confirmsNativeSelection && changesSelection) {
      this.target.selectTab(tabId, animated);
    } else if (!this.target) {
      this.fullSnapshotPending = true;
    }
    return true;
  }

  recordSelectedTab(tabId: IHomeContainerTabId): boolean {
    if (
      this.disposed ||
      !this.snapshot.tabs.some(
        (tab) => tab.id === tabId && tab.destination === 'inline',
      )
    ) {
      return false;
    }
    if (this.pendingNativeTabSelections.at(-1) !== tabId) {
      this.pendingNativeTabSelections.push(tabId);
      this.pendingNativeTabSelections = this.pendingNativeTabSelections.slice(
        -MAX_PENDING_NATIVE_TAB_SELECTIONS,
      );
    }
    this.snapshot = { ...this.snapshot, selectedTabId: tabId };
    return true;
  }

  handleTransportResult(
    value: string | IHomeContainerTransportResult,
  ): boolean {
    if (this.protocolVersion === 1 || this.disposed) {
      return false;
    }
    const result =
      typeof value === 'string'
        ? parseHomeContainerTransportResult(value)
        : value;
    if (!result) {
      return false;
    }

    if (result.kind === 'needSnapshot') {
      const inFlight = this.inFlight;
      const ownerMatches =
        !result.owner || ownersMatch(result.owner, this.owner);
      this.emitDiagnostic({
        event: 'result',
        revision: result.currentRevision ?? this.revision,
        resultKind: result.kind,
        exactMatch: ownerMatches,
        mismatch: ownerMatches ? undefined : 'owner',
        inFlight,
      });
      if (!ownerMatches) {
        return false;
      }
      this.resetTransportRecovery();
      this.acknowledgedSnapshot = undefined;
      this.renderedSlotState = undefined;
      this.fullSnapshotPending = true;
      this.clearIncrementalPending();
      this.scheduleFlush();
      return true;
    }

    const activeInFlight = this.inFlight;
    const candidate = activeInFlight ?? this.expiredRecovery;
    const mismatch = getTransportResultMismatch(
      result.owner,
      result.revision,
      candidate,
    );
    if (mismatch) {
      this.emitDiagnostic({
        event: 'result',
        revision: result.revision,
        resultKind: result.kind,
        exactMatch: false,
        mismatch,
        inFlight: candidate,
      });
      return false;
    }
    if (!candidate) {
      return false;
    }
    if (activeInFlight) {
      this.clearInFlightDeadline();
    }
    this.acknowledgedSnapshot = candidate.snapshot;
    this.renderedSlotState = candidate.slots
      ? {
          owner: candidate.owner,
          revision: candidate.revision,
          slots: candidate.slots,
        }
      : undefined;
    this.inFlight = undefined;
    this.expiredRecovery = undefined;
    this.nextTransactionIsRecovery = false;
    this.transportRecoveryBlocked = false;
    this.emitDiagnostic({
      event: 'result',
      revision: result.revision,
      resultKind: result.kind,
      exactMatch: true,
      inFlight: candidate,
    });
    this.scheduleFlush();
    return true;
  }

  flushNow(): boolean {
    this.flushScheduled = false;
    const target = this.target;
    const capabilities = this.capabilities;
    if (
      this.disposed ||
      !target ||
      !capabilities ||
      this.inFlight ||
      this.transportRecoveryBlocked
    ) {
      return false;
    }

    if (!this.hasPendingChanges()) {
      return false;
    }

    if (this.protocolVersion === 3) {
      return this.flushProtocolV3(target);
    }

    if (this.protocolVersion === 2) {
      return this.flushProtocolV2(target);
    }

    if (
      this.fullSnapshotPending ||
      !capabilities.supportsPatches ||
      !capabilities.supportsAtomicPatches
    ) {
      this.pushFullSnapshotV1(target);
      return true;
    }

    this.revision += 1;
    target.applyPatch({
      schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
      revision: this.revision,
      header: this.headerPending ? this.snapshot.header : undefined,
      tabs: Array.from(this.pendingTabIds).flatMap((tabId) => {
        const tab = this.snapshot.tabs.find((item) => item.id === tabId);
        return tab ? [{ tabId, sections: tab.sections }] : [];
      }),
    });
    this.snapshot = { ...this.snapshot, revision: this.revision };
    this.headerPending = false;
    this.pendingTabIds.clear();
    return true;
  }

  dispose(): void {
    this.disposed = true;
    this.target = undefined;
    this.capabilities = undefined;
    this.pendingNativeTabSelections = [];
    this.resetTransportRecovery();
    this.acknowledgedSnapshot = undefined;
    this.renderedSlotState = undefined;
    this.clearIncrementalPending();
  }

  private hasPendingChanges(): boolean {
    return (
      this.fullSnapshotPending ||
      this.headerPending ||
      this.themePending ||
      this.navigationPending ||
      this.slotsPending ||
      this.pendingTabIds.size > 0
    );
  }

  private clearIncrementalPending(): void {
    this.headerPending = false;
    this.themePending = false;
    this.navigationPending = false;
    this.slotsPending = false;
    this.pendingRequiredSlotIds.clear();
    this.pendingTabIds.clear();
  }

  private scheduleFlush(): void {
    if (
      this.flushScheduled ||
      !this.target ||
      this.inFlight ||
      this.transportRecoveryBlocked
    ) {
      return;
    }
    this.flushScheduled = true;
    this.schedule(() => this.flushNow());
  }

  private flushProtocolV2(target: IHomeContainerRef): boolean {
    let sendsFullSnapshot =
      this.fullSnapshotPending || !this.acknowledgedSnapshot;
    let baseRevision: number | undefined;
    let changes: IHomeContainerChange[] | undefined;
    if (!sendsFullSnapshot) {
      const baseSnapshot = this.acknowledgedSnapshot;
      if (!baseSnapshot) {
        return false;
      }
      baseRevision = baseSnapshot.revision;
      changes = this.buildProtocolV2Changes(baseSnapshot);
      if (changes.length === 0 && this.slotsPending) {
        sendsFullSnapshot = true;
        changes = undefined;
        baseRevision = undefined;
      }
    }
    if (changes?.length === 0) {
      this.clearIncrementalPending();
      return false;
    }

    this.revision += 1;
    this.snapshot = { ...this.snapshot, revision: this.revision };
    const sentSnapshot = this.snapshot;
    const isRecovery = this.nextTransactionIsRecovery;
    this.nextTransactionIsRecovery = false;
    this.inFlight = {
      owner: this.owner,
      revision: this.revision,
      snapshot: sentSnapshot,
      slots: this.currentSlots,
      startedAt: this.now(),
      isRecovery,
    };
    const inFlight = this.inFlight;
    this.fullSnapshotPending = false;
    this.clearIncrementalPending();
    this.armInFlightDeadline(inFlight);

    if (sendsFullSnapshot) {
      target.setProtocolV2Snapshot?.(
        snapshotEnvelope(sentSnapshot, this.owner, this.revision),
        inFlight.slots,
      );
      if (isRecovery) {
        this.emitDiagnostic({
          event: 'recoverySnapshot',
          revision: inFlight.revision,
          resultKind: 'recoverySnapshot',
          exactMatch: true,
          inFlight,
        });
      }
    } else {
      if (baseRevision === undefined || !changes) {
        return false;
      }
      const patch: IHomeContainerPatchEnvelope = {
        kind: 'patch',
        protocolVersion: HOME_CONTAINER_PROTOCOL_VERSION,
        schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
        owner: this.owner,
        baseRevision,
        revision: this.revision,
        changes,
      };
      target.applyProtocolV2Patch?.(patch, inFlight.slots);
    }
    return true;
  }

  private flushProtocolV3(target: IHomeContainerRef): boolean {
    const hasPendingSlots = this.slotsPending;
    const requiredSlotRevisions = pickSlotRevisions(
      this.protocolV3Revisions.slotRevisions ?? {},
      new Set(
        Array.from(this.pendingRequiredSlotIds).filter((slotId) =>
          slotKeys(this.currentSlots ?? {}).includes(slotId),
        ),
      ),
    );
    const sendsFullSnapshot =
      this.fullSnapshotPending || !this.acknowledgedSnapshot;
    let baseRevision: number | undefined;
    let changes: IHomeContainerChange[] | undefined;
    if (!sendsFullSnapshot) {
      const baseSnapshot = this.acknowledgedSnapshot;
      if (!baseSnapshot) {
        return false;
      }
      baseRevision = baseSnapshot.revision;
      changes = this.buildProtocolV2Changes(baseSnapshot);
    }
    if (changes?.length === 0 && !hasPendingSlots) {
      this.clearIncrementalPending();
      return false;
    }

    this.revision += 1;
    this.snapshot = { ...this.snapshot, revision: this.revision };
    const sentSnapshot = this.snapshot;
    const isRecovery = this.nextTransactionIsRecovery;
    this.nextTransactionIsRecovery = false;
    this.inFlight = {
      owner: this.owner,
      revision: this.revision,
      snapshot: sentSnapshot,
      slots: this.currentSlots,
      startedAt: this.now(),
      isRecovery,
    };
    const inFlight = this.inFlight;
    const revisionState = this.protocolV3Revisions;
    this.fullSnapshotPending = false;
    this.clearIncrementalPending();
    this.armInFlightDeadline(inFlight);

    if (sendsFullSnapshot) {
      const envelope = this.createProtocolV3SnapshotEnvelope(
        sentSnapshot,
        this.revision,
        inFlight.slots,
      );
      target.setProtocolV3Snapshot?.(envelope, inFlight.slots);
      if (isRecovery) {
        this.emitDiagnostic({
          event: 'recoverySnapshot',
          revision: inFlight.revision,
          resultKind: 'recoverySnapshot',
          exactMatch: true,
          inFlight,
        });
      }
    } else {
      if (baseRevision === undefined || !changes) {
        return false;
      }
      const patch: IHomeContainerPatchEnvelopeV3 = {
        kind: 'patch',
        protocolVersion: HOME_CONTAINER_PROTOCOL_V3_VERSION,
        identity: {
          ...this.owner,
          storeCommitId: revisionState.storeCommitId,
        },
        baseTransportRevision: baseRevision,
        transportRevision: this.revision,
        presentationRevisions: revisionState.presentationRevisions,
        authorityRevisions: revisionState.authorityRevisions,
        requiredSlotRevisions: hasPendingSlots ? requiredSlotRevisions : {},
        changes,
      };
      target.applyProtocolV3Patch?.(patch, inFlight.slots);
    }
    return true;
  }

  private createProtocolV3SnapshotEnvelope(
    snapshot: IHomeContainerSnapshot,
    transportRevision: number,
    slots: IHomeContainerSlots | undefined,
  ): IHomeContainerSnapshotEnvelopeV3 {
    const revisionState = this.protocolV3Revisions;
    return {
      kind: 'snapshot',
      protocolVersion: HOME_CONTAINER_PROTOCOL_V3_VERSION,
      identity: {
        ...this.owner,
        storeCommitId: revisionState.storeCommitId,
      },
      transportRevision,
      presentationRevisions: revisionState.presentationRevisions,
      authorityRevisions: revisionState.authorityRevisions,
      slotRevisions: pickSlotRevisions(
        revisionState.slotRevisions ?? {},
        new Set(slotKeys(slots ?? {})),
      ),
      payload: {
        selectedTabId: snapshot.selectedTabId,
        header: snapshot.header,
        tabs: snapshot.tabs,
        theme: snapshot.theme,
      },
    };
  }

  private armInFlightDeadline(
    inFlight: IHomeContainerInFlightTransaction,
  ): void {
    this.clearInFlightDeadline();
    this.cancelInFlightDeadline = this.scheduleDeadline(() => {
      this.cancelInFlightDeadline = undefined;
      this.handleInFlightDeadline(inFlight);
    }, HOME_CONTAINER_TRANSPORT_ACK_DEADLINE_MS);
  }

  private handleInFlightDeadline(
    inFlight: IHomeContainerInFlightTransaction,
  ): void {
    if (this.disposed || this.inFlight !== inFlight) {
      return;
    }
    this.emitDiagnostic({
      event: 'deadline',
      revision: inFlight.revision,
      resultKind: 'deadline',
      exactMatch: true,
      inFlight,
    });
    this.inFlight = undefined;
    if (inFlight.isRecovery) {
      // Keep only the latest timed-out recovery eligible for a late exact ack.
      // A new transport attempt requires new data, an explicit resync, or reattach.
      this.expiredRecovery = inFlight;
      this.transportRecoveryBlocked = true;
      if (this.hasPendingChanges()) {
        this.resumeTransportForNewData();
        this.scheduleFlush();
      }
      return;
    }
    this.expiredRecovery = undefined;
    this.acknowledgedSnapshot = undefined;
    this.fullSnapshotPending = true;
    this.nextTransactionIsRecovery = true;
    this.scheduleFlush();
  }

  private clearInFlightDeadline(): void {
    this.cancelInFlightDeadline?.();
    this.cancelInFlightDeadline = undefined;
  }

  private resetTransportRecovery(): void {
    this.clearInFlightDeadline();
    this.inFlight = undefined;
    this.expiredRecovery = undefined;
    this.nextTransactionIsRecovery = false;
    this.transportRecoveryBlocked = false;
  }

  private resumeTransportForNewData(): void {
    if (!this.transportRecoveryBlocked) {
      return;
    }
    this.expiredRecovery = undefined;
    this.transportRecoveryBlocked = false;
    this.nextTransactionIsRecovery = false;
    this.fullSnapshotPending = true;
  }

  private emitDiagnostic({
    event,
    revision,
    resultKind,
    exactMatch,
    mismatch,
    inFlight,
  }: {
    event: IHomeContainerTransportDiagnostic['event'];
    revision: number;
    resultKind: IHomeContainerTransportDiagnostic['resultKind'];
    exactMatch: boolean;
    mismatch?: IHomeContainerTransportDiagnostic['mismatch'];
    inFlight?: IHomeContainerInFlightTransaction;
  }): void {
    if (!this.diagnosticsEnabled) {
      return;
    }
    const current = getPortfolioSlotState(this.currentSlots);
    const acknowledged = getPortfolioSlotState(this.renderedSlotState?.slots);
    this.reportDiagnostic({
      event,
      sessionHash: hashSessionId(
        (inFlight ?? this.inFlight)?.owner.sessionId ?? this.owner.sessionId,
      ),
      revision,
      inFlightRevision: inFlight?.revision,
      inFlightAgeMs: inFlight
        ? Math.max(0, this.now() - inFlight.startedAt)
        : undefined,
      resultKind,
      exactMatch,
      mismatch,
      portfolioSlot: {
        current,
        acknowledged,
        presentation: getPortfolioSlotPresentation(current, acknowledged),
      },
    });
  }

  private buildProtocolV2Changes(
    baseSnapshot: IHomeContainerSnapshot,
  ): IHomeContainerChange[] {
    const changes: IHomeContainerChange[] = [];
    if (this.headerPending) {
      changes.push({ kind: 'replaceShell', value: this.snapshot.header });
    }
    if (this.themePending) {
      changes.push({ kind: 'replaceSurface', value: this.snapshot.theme });
    }
    if (this.navigationPending) {
      changes.push({
        kind: 'replaceNavigation',
        value: {
          selectedTabId: this.snapshot.selectedTabId,
          tabs: navigationTabs(this.snapshot),
        },
      });
    }

    this.pendingTabIds.forEach((tabId) => {
      const nextTab = this.snapshot.tabs.find((tab) => tab.id === tabId);
      if (!nextTab || nextTab.destination !== 'inline') {
        return;
      }
      const previousSections =
        baseSnapshot.tabs.find((tab) => tab.id === tabId)?.sections ?? [];
      const nextIds = new Set(nextTab.sections.map((section) => section.id));
      previousSections.forEach((section) => {
        if (!nextIds.has(section.id)) {
          changes.push({
            kind: 'removeSection',
            tabId,
            sectionId: section.id,
          });
        }
      });
      nextTab.sections.forEach((section, index) => {
        changes.push({
          kind: 'replaceSection',
          tabId,
          sectionId: section.id,
          index,
          value: section,
        });
      });
    });
    return changes;
  }

  private bumpProtocolV3({
    authoritySections = [],
    navigationAuthority = false,
    navigationPresentation = false,
    presentationSections = [],
    shellAuthority = false,
    shellPresentation = false,
  }: {
    authoritySections?: readonly IHomeContainerSectionId[];
    navigationAuthority?: boolean;
    navigationPresentation?: boolean;
    presentationSections?: readonly IHomeContainerSectionId[];
    shellAuthority?: boolean;
    shellPresentation?: boolean;
  }): void {
    if (this.protocolV3RevisionsAreExternal) {
      return;
    }
    const current = this.protocolV3Revisions;
    const presentationSectionsState = {
      ...current.presentationRevisions.sections,
    };
    presentationSections.forEach((sectionId) => {
      presentationSectionsState[sectionId] += 1;
    });
    const authoritySectionsState = {
      ...current.authorityRevisions.sectionCommands,
    };
    authoritySections.forEach((sectionId) => {
      authoritySectionsState[sectionId] += 1;
    });
    this.protocolV3Revisions = {
      ...current,
      storeCommitId: current.storeCommitId + 1,
      presentationRevisions: {
        shell:
          current.presentationRevisions.shell + (shellPresentation ? 1 : 0),
        navigation:
          current.presentationRevisions.navigation +
          (navigationPresentation ? 1 : 0),
        sections: presentationSectionsState,
      },
      authorityRevisions: {
        shellCommands:
          current.authorityRevisions.shellCommands + (shellAuthority ? 1 : 0),
        tabApplicability:
          current.authorityRevisions.tabApplicability +
          (navigationAuthority ? 1 : 0),
        sectionCommands: authoritySectionsState,
      },
    };
  }

  private bumpProtocolV3Slots(slots: IHomeContainerSlots): void {
    if (this.protocolV3RevisionsAreExternal) {
      return;
    }
    const current = this.protocolV3Revisions;
    const revisions = { ...current.slotRevisions };
    slotKeys(slots).forEach((slotId) => {
      revisions[slotId] = (revisions[slotId] ?? 0) + 1;
    });
    this.protocolV3Revisions = {
      ...current,
      slotRevisions: revisions,
    };
  }

  private pushFullSnapshotV1(target: IHomeContainerRef): void {
    this.revision += 1;
    this.snapshot = { ...this.snapshot, revision: this.revision };
    target.setSnapshot(this.snapshot);
    this.fullSnapshotPending = false;
    this.clearIncrementalPending();
  }
}
