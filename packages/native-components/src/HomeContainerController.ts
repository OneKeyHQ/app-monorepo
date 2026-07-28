import {
  HOME_CONTAINER_SCHEMA_VERSION,
  HOME_CONTAINER_TAB_IDS,
  type IHomeContainerCapabilities,
  type IHomeContainerHeader,
  type IHomeContainerOwner,
  type IHomeContainerRef,
  type IHomeContainerSection,
  type IHomeContainerSnapshot,
  type IHomeContainerTab,
  type IHomeContainerTabId,
  type IHomeContainerTheme,
  isHomeContainerSnapshotInvariantValid,
} from './HomeContainer.types';
import {
  HOME_CONTAINER_PROTOCOL_V3_VERSION,
  HOME_CONTAINER_SECTION_IDS,
} from './HomeContainerProtocolV3';

import type {
  IHomeContainerAuthorityRevisionVectorV3,
  IHomeContainerDomainBatchV3,
  IHomeContainerDomainUpdateV3,
  IHomeContainerPresentationRevisionVectorV3,
  IHomeContainerSectionId,
  IHomeContainerSnapshotEnvelopeV3,
} from './HomeContainerProtocolV3';

type IHomeContainerControllerScheduler = (flush: () => void) => void;

export interface IHomeContainerControllerFlushTiming {
  kind: 'snapshot' | 'domains';
  prepareDurationMs: number;
  transportDurationMs: number;
  totalDurationMs: number;
  updateCount: number;
}

export interface IHomeContainerControllerOptions {
  initialSnapshot: IHomeContainerSnapshot;
  initialOwner: IHomeContainerOwner;
  schedule?: IHomeContainerControllerScheduler;
  initialProtocolV3AuthorityState?: IHomeContainerControllerAuthorityStateV3;
  onFlushTiming?: (timing: IHomeContainerControllerFlushTiming) => void;
}

export interface IHomeContainerControllerAuthorityStateV3 {
  storeCommitId: number;
  authorityRevisions: IHomeContainerAuthorityRevisionVectorV3;
}

const MAX_PENDING_NATIVE_TAB_SELECTIONS = 16;

const defaultSchedule: IHomeContainerControllerScheduler = (flush) => {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => flush());
    return;
  }
  queueMicrotask(flush);
};

function createAuthorityState(): IHomeContainerControllerAuthorityStateV3 {
  const sections = Object.fromEntries(
    HOME_CONTAINER_SECTION_IDS.map((sectionId) => [sectionId, 0]),
  ) as Record<IHomeContainerSectionId, number>;
  return {
    storeCommitId: 0,
    authorityRevisions: {
      shellCommands: 0,
      tabApplicability: 0,
      sectionCommands: { ...sections },
    },
  };
}

function createDomainRevisions(): IHomeContainerPresentationRevisionVectorV3 {
  const sections = Object.fromEntries(
    HOME_CONTAINER_TAB_IDS.map((tabId) => [tabId, 0]),
  ) as Record<IHomeContainerTabId, number>;
  return {
    shell: 0,
    navigation: 0,
    surface: 0,
    sections,
  };
}

function mergeAuthorityState(
  current: IHomeContainerControllerAuthorityStateV3,
  next: IHomeContainerControllerAuthorityStateV3,
): IHomeContainerControllerAuthorityStateV3 {
  const authoritySections = Object.fromEntries(
    HOME_CONTAINER_SECTION_IDS.map((sectionId) => [
      sectionId,
      Math.max(
        current.authorityRevisions.sectionCommands[sectionId],
        next.authorityRevisions.sectionCommands[sectionId],
      ),
    ]),
  ) as Record<IHomeContainerSectionId, number>;
  return {
    storeCommitId: Math.max(current.storeCommitId, next.storeCommitId),
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
  };
}

function navigationTabs(snapshot: IHomeContainerSnapshot) {
  return snapshot.tabs.map(({ sections: _sections, ...tab }) => tab);
}

function capabilitiesMatch(
  left: IHomeContainerCapabilities,
  right: IHomeContainerCapabilities,
): boolean {
  return (
    left.protocolVersion === right.protocolVersion &&
    left.supportsNativeRefresh === right.supportsNativeRefresh &&
    left.supportsHorizontalPaging === right.supportsHorizontalPaging &&
    left.supportsSlots === right.supportsSlots &&
    left.schemaVersions.length === right.schemaVersions.length &&
    left.schemaVersions.every((version) =>
      right.schemaVersions.includes(version),
    ) &&
    left.tabIds.length === right.tabIds.length &&
    left.tabIds.every((tabId) => right.tabIds.includes(tabId))
  );
}

/**
 * Main-runtime transport for HomeContainer. Each frame carries at most one
 * self-contained value per domain, so skipped intermediate frames never block
 * a newer update from the same or another domain.
 */
export class HomeContainerController {
  private snapshot: IHomeContainerSnapshot;

  private owner: IHomeContainerOwner;

  private authorityState: IHomeContainerControllerAuthorityStateV3;

  private authorityStateIsExternal: boolean;

  private domainRevisions: IHomeContainerPresentationRevisionVectorV3;

  private target: IHomeContainerRef | undefined;

  private capabilities: IHomeContainerCapabilities | undefined;

  private pendingNativeTabSelections: IHomeContainerTabId[] = [];

  private readonly pendingDomains = new Set<string>();

  private fullSnapshotPending = false;

  private flushScheduled = false;

  private disposed = false;

  private readonly schedule: IHomeContainerControllerScheduler;

  private readonly onFlushTiming:
    | ((timing: IHomeContainerControllerFlushTiming) => void)
    | undefined;

  constructor({
    initialSnapshot,
    initialOwner,
    schedule = defaultSchedule,
    initialProtocolV3AuthorityState,
    onFlushTiming,
  }: IHomeContainerControllerOptions) {
    this.snapshot = initialSnapshot;
    this.owner = initialOwner;
    this.schedule = schedule;
    this.onFlushTiming = onFlushTiming;
    this.authorityState =
      initialProtocolV3AuthorityState ?? createAuthorityState();
    this.authorityStateIsExternal = Boolean(initialProtocolV3AuthorityState);
    this.domainRevisions = createDomainRevisions();
  }

  getSnapshot(): IHomeContainerSnapshot {
    return this.snapshot;
  }

  getOwner(): IHomeContainerOwner {
    return this.owner;
  }

  getInitialProtocolV3Snapshot(): IHomeContainerSnapshotEnvelopeV3 {
    return this.createSnapshotEnvelope();
  }

  setProtocolV3AuthorityState(
    authorityState: IHomeContainerControllerAuthorityStateV3,
  ): void {
    if (this.disposed) {
      return;
    }
    this.authorityState = mergeAuthorityState(
      this.authorityState,
      authorityState,
    );
    this.authorityStateIsExternal = true;
  }

  attach(
    target: IHomeContainerRef,
    capabilities = target.getCapabilities(),
  ): boolean {
    if (
      this.disposed ||
      !capabilities ||
      capabilities.protocolVersion !== HOME_CONTAINER_PROTOCOL_V3_VERSION ||
      !capabilities.schemaVersions.includes(HOME_CONTAINER_SCHEMA_VERSION) ||
      !this.snapshot.tabs.every((tab) =>
        capabilities.tabIds.includes(tab.id),
      ) ||
      !isHomeContainerSnapshotInvariantValid(this.snapshot)
    ) {
      return false;
    }
    if (
      this.target === target &&
      this.capabilities &&
      capabilitiesMatch(this.capabilities, capabilities)
    ) {
      return true;
    }
    this.target = target;
    this.capabilities = capabilities;
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
  }

  replaceOwner(
    owner: IHomeContainerOwner,
    nextSnapshot: IHomeContainerSnapshot,
  ): void {
    if (this.disposed || !isHomeContainerSnapshotInvariantValid(nextSnapshot)) {
      return;
    }
    // Owner transitions always start a new session. Never retain the previous
    // sessionId or mutate the previous owner's store into the next owner.
    this.owner = owner;
    this.snapshot = {
      ...nextSnapshot,
      schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
    };
    this.authorityState = createAuthorityState();
    this.authorityStateIsExternal = false;
    this.domainRevisions = createDomainRevisions();
    this.pendingNativeTabSelections = [];
    this.pendingDomains.clear();
    this.fullSnapshotPending = true;
    this.scheduleFlush();
  }

  replaceSnapshot(nextSnapshot: IHomeContainerSnapshot): void {
    if (this.disposed || !isHomeContainerSnapshotInvariantValid(nextSnapshot)) {
      return;
    }
    this.snapshot = {
      ...nextSnapshot,
      schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
    };
    this.domainRevisions = {
      shell: this.domainRevisions.shell + 1,
      navigation: this.domainRevisions.navigation + 1,
      surface: this.domainRevisions.surface + 1,
      sections: Object.fromEntries(
        HOME_CONTAINER_TAB_IDS.map((tabId) => [
          tabId,
          this.domainRevisions.sections[tabId] + 1,
        ]),
      ) as Record<IHomeContainerTabId, number>,
    };
    if (!this.authorityStateIsExternal) {
      this.authorityState = {
        storeCommitId: this.authorityState.storeCommitId + 1,
        authorityRevisions: {
          shellCommands:
            this.authorityState.authorityRevisions.shellCommands + 1,
          tabApplicability:
            this.authorityState.authorityRevisions.tabApplicability + 1,
          sectionCommands: Object.fromEntries(
            HOME_CONTAINER_SECTION_IDS.map((sectionId) => [
              sectionId,
              this.authorityState.authorityRevisions.sectionCommands[
                sectionId
              ] + 1,
            ]),
          ) as Record<IHomeContainerSectionId, number>,
        },
      };
    }
    this.fullSnapshotPending = true;
    this.pendingDomains.clear();
    this.scheduleFlush();
  }

  updateHeader(header: IHomeContainerHeader): void {
    if (this.disposed) {
      return;
    }
    this.snapshot = { ...this.snapshot, header };
    this.domainRevisions = {
      ...this.domainRevisions,
      shell: this.domainRevisions.shell + 1,
    };
    if (!this.authorityStateIsExternal) {
      this.authorityState = {
        ...this.authorityState,
        storeCommitId: this.authorityState.storeCommitId + 1,
        authorityRevisions: {
          ...this.authorityState.authorityRevisions,
          shellCommands:
            this.authorityState.authorityRevisions.shellCommands + 1,
        },
      };
    }
    this.pendingDomains.add('shell');
    this.scheduleFlush();
  }

  updateTheme(theme: IHomeContainerTheme): void {
    if (this.disposed) {
      return;
    }
    this.snapshot = { ...this.snapshot, theme };
    this.domainRevisions = {
      ...this.domainRevisions,
      surface: this.domainRevisions.surface + 1,
    };
    if (!this.authorityStateIsExternal) {
      this.authorityState = {
        ...this.authorityState,
        storeCommitId: this.authorityState.storeCommitId + 1,
      };
    }
    this.pendingDomains.add('surface');
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
    const previousInlineTabIds = new Set(
      this.snapshot.tabs
        .filter((tab) => tab.destination === 'inline')
        .map((tab) => tab.id),
    );
    this.snapshot = { ...this.snapshot, tabs };
    this.domainRevisions = {
      ...this.domainRevisions,
      navigation: this.domainRevisions.navigation + 1,
    };
    if (!this.authorityStateIsExternal) {
      this.authorityState = {
        ...this.authorityState,
        storeCommitId: this.authorityState.storeCommitId + 1,
        authorityRevisions: {
          ...this.authorityState.authorityRevisions,
          tabApplicability:
            this.authorityState.authorityRevisions.tabApplicability + 1,
        },
      };
    }
    this.pendingDomains.add('navigation');
    tabs.forEach((tab) => {
      if (tab.destination === 'inline' && !previousInlineTabIds.has(tab.id)) {
        this.domainRevisions = {
          ...this.domainRevisions,
          sections: {
            ...this.domainRevisions.sections,
            [tab.id]: this.domainRevisions.sections[tab.id] + 1,
          },
        };
        this.pendingDomains.add(`section:${tab.id}`);
      }
    });
    this.scheduleFlush();
  }

  updateTabSections(
    tabId: IHomeContainerTabId,
    sections: IHomeContainerSection[],
    sectionId: IHomeContainerSectionId = tabId,
  ): boolean {
    if (this.disposed) {
      return false;
    }
    const tabIndex = this.snapshot.tabs.findIndex((tab) => tab.id === tabId);
    if (tabIndex < 0 || this.snapshot.tabs[tabIndex].destination !== 'inline') {
      return false;
    }
    const tabs = [...this.snapshot.tabs];
    tabs[tabIndex] = { ...tabs[tabIndex], sections };
    this.snapshot = { ...this.snapshot, tabs };
    this.domainRevisions = {
      ...this.domainRevisions,
      sections: {
        ...this.domainRevisions.sections,
        [tabId]: this.domainRevisions.sections[tabId] + 1,
      },
    };
    if (!this.authorityStateIsExternal) {
      this.authorityState = {
        ...this.authorityState,
        storeCommitId: this.authorityState.storeCommitId + 1,
        authorityRevisions: {
          ...this.authorityState.authorityRevisions,
          sectionCommands: {
            ...this.authorityState.authorityRevisions.sectionCommands,
            [sectionId]:
              this.authorityState.authorityRevisions.sectionCommands[
                sectionId
              ] + 1,
          },
        },
      };
    }
    this.pendingDomains.add(`section:${tabId}`);
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
    this.domainRevisions = {
      ...this.domainRevisions,
      navigation: this.domainRevisions.navigation + 1,
    };
    if (!this.authorityStateIsExternal) {
      this.authorityState = {
        ...this.authorityState,
        storeCommitId: this.authorityState.storeCommitId + 1,
      };
    }
    this.pendingDomains.add('navigation');
    this.scheduleFlush();
    if (this.target && changesSelection && !confirmsNativeSelection) {
      this.target.selectTab(tabId, animated);
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

  flushNow(): boolean {
    const flushStartedAt = performance.now();
    this.flushScheduled = false;
    if (this.disposed || !this.target || !this.capabilities) {
      return false;
    }
    if (this.fullSnapshotPending) {
      this.fullSnapshotPending = false;
      this.pendingDomains.clear();
      const prepareStartedAt = performance.now();
      const envelope = this.createSnapshotEnvelope();
      const prepareDurationMs = performance.now() - prepareStartedAt;
      const transportStartedAt = performance.now();
      this.target.setSnapshot(envelope);
      const transportDurationMs = performance.now() - transportStartedAt;
      this.onFlushTiming?.({
        kind: 'snapshot',
        prepareDurationMs,
        transportDurationMs,
        totalDurationMs: performance.now() - flushStartedAt,
        updateCount: 1,
      });
      return true;
    }
    if (this.pendingDomains.size === 0) {
      return false;
    }
    const prepareStartedAt = performance.now();
    const updates = this.createPendingDomainUpdates();
    this.pendingDomains.clear();
    if (updates.length === 0) {
      return false;
    }
    const batch: IHomeContainerDomainBatchV3 = {
      kind: 'domains',
      protocolVersion: HOME_CONTAINER_PROTOCOL_V3_VERSION,
      identity: {
        ...this.owner,
        storeCommitId: this.authorityState.storeCommitId,
      },
      updates,
    };
    const prepareDurationMs = performance.now() - prepareStartedAt;
    const transportStartedAt = performance.now();
    this.target.setDomains(batch);
    const transportDurationMs = performance.now() - transportStartedAt;
    this.onFlushTiming?.({
      kind: 'domains',
      prepareDurationMs,
      transportDurationMs,
      totalDurationMs: performance.now() - flushStartedAt,
      updateCount: updates.length,
    });
    return true;
  }

  dispose(): void {
    this.disposed = true;
    this.target = undefined;
    this.capabilities = undefined;
    this.pendingNativeTabSelections = [];
    this.pendingDomains.clear();
  }

  private scheduleFlush(): void {
    if (this.flushScheduled || !this.target) {
      return;
    }
    this.flushScheduled = true;
    this.schedule(() => this.flushNow());
  }

  private createSnapshotEnvelope(): IHomeContainerSnapshotEnvelopeV3 {
    return {
      kind: 'snapshot',
      protocolVersion: HOME_CONTAINER_PROTOCOL_V3_VERSION,
      identity: {
        ...this.owner,
        storeCommitId: this.authorityState.storeCommitId,
      },
      presentationRevisions: this.domainRevisions,
      authorityRevisions: this.authorityState.authorityRevisions,
      payload: {
        selectedTabId: this.snapshot.selectedTabId,
        header: this.snapshot.header,
        tabs: this.snapshot.tabs,
        theme: this.snapshot.theme,
      },
    };
  }

  private createPendingDomainUpdates(): IHomeContainerDomainUpdateV3[] {
    const updates: IHomeContainerDomainUpdateV3[] = [];
    if (this.pendingDomains.has('shell')) {
      updates.push({
        kind: 'shell',
        presentationRevision: this.domainRevisions.shell,
        commandRevision: this.authorityState.authorityRevisions.shellCommands,
        value: this.snapshot.header,
      });
    }
    if (this.pendingDomains.has('navigation')) {
      updates.push({
        kind: 'navigation',
        presentationRevision: this.domainRevisions.navigation,
        applicabilityRevision:
          this.authorityState.authorityRevisions.tabApplicability,
        value: {
          selectedTabId: this.snapshot.selectedTabId,
          tabs: navigationTabs(this.snapshot),
        },
      });
    }
    HOME_CONTAINER_TAB_IDS.forEach((tabId) => {
      if (!this.pendingDomains.has(`section:${tabId}`)) {
        return;
      }
      const tab = this.snapshot.tabs.find(
        (candidate) => candidate.id === tabId,
      );
      if (!tab || tab.destination !== 'inline') {
        return;
      }
      updates.push({
        kind: 'section',
        tabId,
        presentationRevision: this.domainRevisions.sections[tabId],
        commandRevisions:
          this.authorityState.authorityRevisions.sectionCommands,
        value: tab.sections,
      });
    });
    if (this.pendingDomains.has('surface')) {
      updates.push({
        kind: 'surface',
        presentationRevision: this.domainRevisions.surface,
        value: this.snapshot.theme,
      });
    }
    return updates;
  }
}
