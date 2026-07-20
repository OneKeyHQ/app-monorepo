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

type IHomeContainerControllerScheduler = (flush: () => void) => void;

export interface IHomeContainerControllerOptions {
  initialSnapshot: IHomeContainerSnapshot;
  initialOwner?: IHomeContainerOwner;
  schedule?: IHomeContainerControllerScheduler;
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
}

const LEGACY_OWNER: IHomeContainerOwner = {
  scopeKey: 'legacy',
  sessionId: 'legacy',
};

const defaultSchedule: IHomeContainerControllerScheduler = (flush) => {
  queueMicrotask(flush);
};

function ownersMatch(
  left: IHomeContainerOwner,
  right: IHomeContainerOwner,
): boolean {
  return left.scopeKey === right.scopeKey && left.sessionId === right.sessionId;
}

function navigationTabs(snapshot: IHomeContainerSnapshot) {
  return snapshot.tabs.map(({ sections: _sections, ...tab }) => tab);
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

  private protocolVersion: 1 | 2 = 1;

  private inFlight: IHomeContainerInFlightTransaction | undefined;

  private acknowledgedSnapshot: IHomeContainerSnapshot | undefined;

  private currentSlots: IHomeContainerSlots | undefined;

  private renderedSlotState: IHomeContainerRenderedSlotState | undefined;

  private readonly pendingTabIds = new Set<IHomeContainerTabId>();

  private headerPending = false;

  private themePending = false;

  private navigationPending = false;

  private slotsPending = false;

  private fullSnapshotPending = false;

  private flushScheduled = false;

  private disposed = false;

  private readonly schedule: IHomeContainerControllerScheduler;

  constructor({
    initialSnapshot,
    initialOwner = LEGACY_OWNER,
    schedule = defaultSchedule,
  }: IHomeContainerControllerOptions) {
    this.snapshot = initialSnapshot;
    this.revision = initialSnapshot.revision;
    this.owner = initialOwner;
    this.schedule = schedule;
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

  getProtocolVersion(): 1 | 2 {
    return this.protocolVersion;
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
    this.target = target;
    this.capabilities = capabilities;
    const protocolVersions = capabilities.protocolVersions ?? [1];
    const preferredProtocol = capabilities.preferredProtocol;
    this.protocolVersion =
      preferredProtocol === 1 ||
      !protocolVersions.includes(HOME_CONTAINER_PROTOCOL_VERSION) ||
      !target.setProtocolV2Snapshot ||
      !target.applyProtocolV2Patch
        ? 1
        : 2;
    this.inFlight = undefined;
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
    this.inFlight = undefined;
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
    this.inFlight = undefined;
    this.acknowledgedSnapshot = undefined;
    this.renderedSlotState = undefined;
    this.currentSlots = undefined;
    this.replaceSnapshot(nextSnapshot);
  }

  replaceSnapshot(nextSnapshot: IHomeContainerSnapshot): void {
    if (this.disposed || !isHomeContainerSnapshotInvariantValid(nextSnapshot)) {
      return;
    }
    this.snapshot = {
      ...nextSnapshot,
      schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
      revision: this.revision,
    };
    this.fullSnapshotPending = true;
    this.clearIncrementalPending();
    this.scheduleFlush();
  }

  updateHeader(header: IHomeContainerHeader): void {
    if (this.disposed) {
      return;
    }
    this.snapshot = { ...this.snapshot, header };
    this.headerPending = true;
    this.scheduleFlush();
  }

  updateTheme(theme: IHomeContainerTheme): void {
    if (this.disposed) {
      return;
    }
    this.snapshot = { ...this.snapshot, theme };
    if (this.protocolVersion === 2) {
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
    this.snapshot = { ...this.snapshot, tabs };
    if (this.protocolVersion === 2) {
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
    this.currentSlots = slots;
    if (this.target && this.protocolVersion === 2) {
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
    const tabs = [...this.snapshot.tabs];
    tabs[tabIndex] = { ...tabs[tabIndex], sections };
    this.snapshot = { ...this.snapshot, tabs };
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
    this.snapshot = { ...this.snapshot, selectedTabId: tabId };
    if (this.target) {
      this.target.selectTab(tabId, animated);
    } else {
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
    this.snapshot = { ...this.snapshot, selectedTabId: tabId };
    return true;
  }

  handleTransportResult(
    value: string | IHomeContainerTransportResult,
  ): boolean {
    if (this.protocolVersion !== 2 || this.disposed) {
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
      if (result.owner && !ownersMatch(result.owner, this.owner)) {
        return false;
      }
      this.inFlight = undefined;
      this.acknowledgedSnapshot = undefined;
      this.renderedSlotState = undefined;
      this.fullSnapshotPending = true;
      this.clearIncrementalPending();
      this.scheduleFlush();
      return true;
    }

    const inFlight = this.inFlight;
    if (
      !inFlight ||
      result.revision !== inFlight.revision ||
      !ownersMatch(result.owner, inFlight.owner)
    ) {
      return false;
    }
    this.acknowledgedSnapshot = inFlight.snapshot;
    this.renderedSlotState = inFlight.slots
      ? {
          owner: inFlight.owner,
          revision: inFlight.revision,
          slots: inFlight.slots,
        }
      : undefined;
    this.inFlight = undefined;
    this.scheduleFlush();
    return true;
  }

  flushNow(): boolean {
    this.flushScheduled = false;
    const target = this.target;
    const capabilities = this.capabilities;
    if (this.disposed || !target || !capabilities || this.inFlight) {
      return false;
    }

    if (!this.hasPendingChanges()) {
      return false;
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
    this.inFlight = undefined;
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
    this.pendingTabIds.clear();
  }

  private scheduleFlush(): void {
    if (this.flushScheduled || !this.target || this.inFlight) {
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
    this.inFlight = {
      owner: this.owner,
      revision: this.revision,
      snapshot: sentSnapshot,
      slots: this.currentSlots,
    };
    this.fullSnapshotPending = false;
    this.clearIncrementalPending();

    if (sendsFullSnapshot) {
      target.setProtocolV2Snapshot?.(
        snapshotEnvelope(sentSnapshot, this.owner, this.revision),
      );
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
      target.applyProtocolV2Patch?.(patch);
    }
    return true;
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

  private pushFullSnapshotV1(target: IHomeContainerRef): void {
    this.revision += 1;
    this.snapshot = { ...this.snapshot, revision: this.revision };
    target.setSnapshot(this.snapshot);
    this.fullSnapshotPending = false;
    this.clearIncrementalPending();
  }
}
