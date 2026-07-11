import {
  HOME_CONTAINER_SCHEMA_VERSION,
  type IHomeContainerCapabilities,
  type IHomeContainerHeader,
  type IHomeContainerRef,
  type IHomeContainerSection,
  type IHomeContainerSnapshot,
  type IHomeContainerTab,
  type IHomeContainerTabId,
  type IHomeContainerTheme,
} from './HomeContainer.types';

type IHomeContainerControllerScheduler = (flush: () => void) => void;

export interface IHomeContainerControllerOptions {
  initialSnapshot: IHomeContainerSnapshot;
  schedule?: IHomeContainerControllerScheduler;
}

const defaultSchedule: IHomeContainerControllerScheduler = (flush) => {
  queueMicrotask(flush);
};

/**
 * Main-runtime data transport for HomeContainer. It coalesces synchronous data
 * updates and sends tab-only patches whenever the installed native capability
 * set supports them. Scroll and gesture state never enters this controller.
 */
export class HomeContainerController {
  private snapshot: IHomeContainerSnapshot;

  private revision: number;

  private target: IHomeContainerRef | undefined;

  private capabilities: IHomeContainerCapabilities | undefined;

  private readonly pendingTabIds = new Set<IHomeContainerTabId>();

  private headerPending = false;

  private fullSnapshotPending = false;

  private flushScheduled = false;

  private disposed = false;

  private readonly schedule: IHomeContainerControllerScheduler;

  constructor({
    initialSnapshot,
    schedule = defaultSchedule,
  }: IHomeContainerControllerOptions) {
    this.snapshot = initialSnapshot;
    this.revision = initialSnapshot.revision;
    this.schedule = schedule;
  }

  getSnapshot(): IHomeContainerSnapshot {
    return this.snapshot;
  }

  attach(
    target: IHomeContainerRef,
    capabilities = target.getCapabilities(),
  ): boolean {
    if (this.disposed || !capabilities) {
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
  }

  replaceSnapshot(nextSnapshot: IHomeContainerSnapshot): void {
    if (this.disposed) {
      return;
    }
    this.snapshot = {
      ...nextSnapshot,
      schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
      revision: this.revision,
    };
    this.fullSnapshotPending = true;
    this.pendingTabIds.clear();
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
    this.fullSnapshotPending = true;
    this.scheduleFlush();
  }

  updateTabs(tabs: IHomeContainerTab[]): void {
    if (this.disposed) {
      return;
    }
    this.snapshot = { ...this.snapshot, tabs };
    this.fullSnapshotPending = true;
    this.pendingTabIds.clear();
    this.scheduleFlush();
  }

  updateTabSections(
    tabId: IHomeContainerTabId,
    sections: IHomeContainerSection[],
  ): boolean {
    if (this.disposed) {
      return false;
    }
    const tabIndex = this.snapshot.tabs.findIndex((tab) => tab.id === tabId);
    if (tabIndex < 0) {
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
    if (this.disposed || !this.snapshot.tabs.some((tab) => tab.id === tabId)) {
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
    if (this.disposed || !this.snapshot.tabs.some((tab) => tab.id === tabId)) {
      return false;
    }
    this.snapshot = { ...this.snapshot, selectedTabId: tabId };
    return true;
  }

  flushNow(): boolean {
    this.flushScheduled = false;
    const target = this.target;
    const capabilities = this.capabilities;
    if (this.disposed || !target || !capabilities) {
      return false;
    }

    if (
      !this.fullSnapshotPending &&
      !this.headerPending &&
      this.pendingTabIds.size === 0
    ) {
      return false;
    }

    if (
      this.fullSnapshotPending ||
      !capabilities.supportsPatches ||
      !capabilities.supportsAtomicPatches
    ) {
      this.pushFullSnapshot(target);
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
    this.headerPending = false;
    this.pendingTabIds.clear();
  }

  private scheduleFlush(): void {
    if (this.flushScheduled || !this.target) {
      return;
    }
    this.flushScheduled = true;
    this.schedule(() => this.flushNow());
  }

  private pushFullSnapshot(target: IHomeContainerRef): void {
    this.revision += 1;
    this.snapshot = { ...this.snapshot, revision: this.revision };
    target.setSnapshot(this.snapshot);
    this.fullSnapshotPending = false;
    this.headerPending = false;
    this.pendingTabIds.clear();
  }
}
