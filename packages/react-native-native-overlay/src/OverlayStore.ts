import { OverlayRequestError } from './OverlayErrors';
import { OVERLAY_LEVEL_ORDER, isBlockingLevel } from './OverlayLevels';

import type {
  IOverlayDismissReason,
  IOverlayEntry,
  IOverlayRequest,
  IOverlaySnapshot,
} from './types';

export interface IOverlayEntryHandlers {
  /** Called once when the entry leaves the store (finalized or dropped from the queue). */
  onRemoved?: (reason: IOverlayDismissReason) => void;
}

export type IOverlayBackResolution =
  | { kind: 'dismiss'; id: string }
  | { kind: 'block' }
  | { kind: 'pass' };

export interface IOverlayStoreOptions {
  /** Upper bound for a closing entry to wait for its native exit animation. */
  closingTimeoutMs?: number;
}

const DEFAULT_CLOSING_TIMEOUT_MS = 5000;

function laneKeyOf(entry: IOverlayEntry): string {
  return entry.scope === 'global'
    ? `global|${entry.level}`
    : `page|${entry.hostKey ?? ''}|${entry.level}`;
}

function compareRenderOrder(a: IOverlayEntry, b: IOverlayEntry): number {
  if (a.scope !== b.scope) {
    return a.scope === 'page' ? -1 : 1;
  }
  if (a.scope === 'page' && a.hostKey !== b.hostKey) {
    return (a.hostKey ?? '') < (b.hostKey ?? '') ? -1 : 1;
  }
  const levelDiff = OVERLAY_LEVEL_ORDER[a.level] - OVERLAY_LEVEL_ORDER[b.level];
  return levelDiff !== 0 ? levelDiff : a.seq - b.seq;
}

function compareQueueOrder(a: IOverlayEntry, b: IOverlayEntry): number {
  return b.priority !== a.priority ? b.priority - a.priority : a.seq - b.seq;
}

export class OverlayStore {
  private readonly closingTimeoutMs: number;

  private seq = 0;

  private readonly shown = new Map<string, IOverlayEntry>();

  private queued: IOverlayEntry[] = [];

  private readonly handlers = new Map<string, IOverlayEntryHandlers>();

  private readonly closingTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  private readonly pageVisibility = new Map<string, boolean>();

  private readonly listeners = new Set<() => void>();

  /** While set, levels below it are refused and closed ('security'). */
  private blockedBelowLevel: IOverlayEntry['level'] | undefined;

  private snapshot: IOverlaySnapshot = {
    entries: [],
    queued: [],
    securityBlockedBelow: undefined,
  };

  constructor(options: IOverlayStoreOptions = {}) {
    this.closingTimeoutMs =
      options.closingTimeoutMs ?? DEFAULT_CLOSING_TIMEOUT_MS;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): IOverlaySnapshot => this.snapshot;

  getEntry(id: string): IOverlayEntry | undefined {
    return this.shown.get(id) ?? this.queued.find((e) => e.id === id);
  }

  request(
    request: IOverlayRequest,
    handlers: IOverlayEntryHandlers = {},
  ): IOverlayEntry {
    if (request.id) {
      const existing = this.getEntry(request.id);
      if (existing) {
        return existing;
      }
    }
    const scope = request.scope ?? 'global';
    if (scope === 'page' && (!request.hostKey || !request.ownerKey)) {
      throw new OverlayRequestError(
        'OverlayStore: page scope requires hostKey and ownerKey',
      );
    }
    const level = request.level ?? 'modal';
    const blocking = request.blocking ?? isBlockingLevel(level);
    this.seq += 1;
    const entry: IOverlayEntry = {
      id: request.id ?? `overlay-${this.seq}`,
      scope,
      level,
      strategy: request.strategy ?? 'stack',
      priority: request.priority ?? 0,
      replaceKey: request.replaceKey,
      hostKey: scope === 'page' ? request.hostKey : undefined,
      ownerKey: scope === 'page' ? request.ownerKey : undefined,
      dismissible: request.dismissible ?? blocking,
      blocking,
      phase: 'active',
      suspended: false,
      dismissReason: undefined,
      seq: this.seq,
    };
    entry.suspended = this.isOwnerHidden(entry);
    this.handlers.set(entry.id, handlers);

    if (this.isSecurityBlocked(entry.level)) {
      entry.phase = 'closing';
      entry.dismissReason = 'security';
      queueMicrotask(() => this.notifyRemoved(entry.id, 'security'));
      return entry;
    }

    if (entry.strategy === 'replace') {
      this.replaceIn(entry);
      this.shown.set(entry.id, entry);
    } else if (entry.strategy === 'queue' && !this.canPromote(entry)) {
      entry.phase = 'queued';
      this.queued = [...this.queued, entry].toSorted(compareQueueOrder);
    } else {
      this.shown.set(entry.id, entry);
    }
    this.emit();
    return this.getEntry(entry.id) ?? entry;
  }

  /** Starts closing an entry; the native side calls `finalize` after its exit animation. */
  dismiss(id: string, reason: IOverlayDismissReason = 'programmatic'): void {
    if (this.dismissWithoutEmit(id, reason)) {
      this.emit();
    }
  }

  /** Removes a closing (or active) entry once its exit animation finished. */
  finalize(id: string): void {
    const entry = this.shown.get(id);
    if (!entry) {
      return;
    }
    this.clearClosingTimer(id);
    this.shown.delete(id);
    this.promoteQueued();
    this.emit();
    this.notifyRemoved(id, entry.dismissReason ?? 'programmatic');
  }

  dismissAll(
    filter: {
      scope?: IOverlayEntry['scope'];
      belowLevel?: IOverlayEntry['level'];
      reason?: IOverlayDismissReason;
    } = {},
  ): void {
    const reason = filter.reason ?? 'programmatic';
    const matches = (entry: IOverlayEntry) =>
      (!filter.scope || entry.scope === filter.scope) &&
      (!filter.belowLevel ||
        OVERLAY_LEVEL_ORDER[entry.level] <
          OVERLAY_LEVEL_ORDER[filter.belowLevel]);
    const dropped = this.queued.filter(matches);
    this.queued = this.queued.filter((e) => !matches(e));
    let changed = dropped.length > 0;
    for (const entry of this.shown.values()) {
      if (matches(entry)) {
        changed = this.dismissWithoutEmit(entry.id, reason) || changed;
      }
    }
    if (changed) {
      this.emit();
    }
    dropped.forEach((e) => this.notifyRemoved(e.id, reason));
  }

  /**
   * App lock: close everything below `belowLevel` and refuse new requests
   * there until unblocked. The lock screen itself renders at `lock`.
   */
  setSecurityBlocked(
    blocked: boolean,
    belowLevel: IOverlayEntry['level'] = 'lock',
  ): void {
    const next = blocked ? belowLevel : undefined;
    if (next === this.blockedBelowLevel) {
      return;
    }
    this.blockedBelowLevel = next;
    if (blocked) {
      this.dismissAll({ belowLevel, reason: 'security' });
    }
    this.emit();
  }

  /** Native / navigation signal: the owning page was covered, detached or restored. */
  setPageVisible(ownerKey: string, visible: boolean): void {
    if ((this.pageVisibility.get(ownerKey) ?? true) === visible) {
      return;
    }
    this.pageVisibility.set(ownerKey, visible);
    for (const entry of this.shown.values()) {
      if (entry.ownerKey === ownerKey) {
        entry.suspended = !visible;
      }
    }
    for (const entry of this.queued) {
      if (entry.ownerKey === ownerKey) {
        entry.suspended = !visible;
      }
    }
    if (visible) {
      this.promoteQueued();
    }
    this.emit();
  }

  /** The owning page left the navigation state for good. */
  removePage(ownerKey: string): void {
    const dropped = this.queued.filter((e) => e.ownerKey === ownerKey);
    this.queued = this.queued.filter((e) => e.ownerKey !== ownerKey);
    for (const entry of this.shown.values()) {
      if (entry.ownerKey === ownerKey) {
        this.dismissWithoutEmit(entry.id, 'page-removed');
      }
    }
    this.pageVisibility.delete(ownerKey);
    this.emit();
    dropped.forEach((e) => this.notifyRemoved(e.id, 'page-removed'));
  }

  /**
   * Decides what a back press / Escape does. Global entries win over page
   * entries; `focusedHostKey` limits page entries to the focused root route
   * (split view has one host per pane).
   */
  resolveBack(focusedHostKey?: string): IOverlayBackResolution {
    const candidates = this.snapshot.entries.filter(
      (e) =>
        e.phase === 'active' &&
        !e.suspended &&
        e.blocking &&
        (e.scope === 'global' ||
          focusedHostKey === undefined ||
          e.hostKey === focusedHostKey),
    );
    const top = candidates[candidates.length - 1];
    if (!top) {
      return { kind: 'pass' };
    }
    return top.dismissible
      ? { kind: 'dismiss', id: top.id }
      : { kind: 'block' };
  }

  /** Topmost visible blocking entry; everything rendered below it is inert. */
  getBlockingTop(): IOverlayEntry | undefined {
    const { entries } = this.snapshot;
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const entry = entries[i];
      if (
        entry &&
        entry.phase !== 'closing' &&
        !entry.suspended &&
        entry.blocking
      ) {
        return entry;
      }
    }
    return undefined;
  }

  private dismissWithoutEmit(
    id: string,
    reason: IOverlayDismissReason,
  ): boolean {
    const queuedIndex = this.queued.findIndex((e) => e.id === id);
    if (queuedIndex !== -1) {
      this.queued = this.queued.filter((e) => e.id !== id);
      // Queued entries never rendered, so they leave without an exit animation.
      queueMicrotask(() => this.notifyRemoved(id, reason));
      return true;
    }
    const entry = this.shown.get(id);
    if (!entry || entry.phase === 'closing') {
      return false;
    }
    entry.phase = 'closing';
    entry.dismissReason = reason;
    this.closingTimers.set(
      id,
      setTimeout(() => this.finalize(id), this.closingTimeoutMs),
    );
    return true;
  }

  private replaceIn(entry: IOverlayEntry): void {
    const laneKey = laneKeyOf(entry);
    const sameLane = [...this.shown.values()].filter(
      (e) => e.phase === 'active' && laneKeyOf(e) === laneKey,
    );
    const targets = entry.replaceKey
      ? sameLane.filter((e) => e.replaceKey === entry.replaceKey)
      : sameLane.slice(-1);
    targets.forEach((e) => this.dismissWithoutEmit(e.id, 'replaced'));
    if (entry.replaceKey) {
      const dropped = this.queued.filter(
        (e) => laneKeyOf(e) === laneKey && e.replaceKey === entry.replaceKey,
      );
      dropped.forEach((e) => this.dismissWithoutEmit(e.id, 'replaced'));
    }
  }

  private isSecurityBlocked(level: IOverlayEntry['level']): boolean {
    return (
      this.blockedBelowLevel !== undefined &&
      OVERLAY_LEVEL_ORDER[level] < OVERLAY_LEVEL_ORDER[this.blockedBelowLevel]
    );
  }

  private isOwnerHidden(entry: IOverlayEntry): boolean {
    return (
      entry.scope === 'page' &&
      entry.ownerKey !== undefined &&
      this.pageVisibility.get(entry.ownerKey) === false
    );
  }

  private canPromote(entry: IOverlayEntry): boolean {
    if (this.isOwnerHidden(entry)) {
      return false;
    }
    const laneKey = laneKeyOf(entry);
    for (const shown of this.shown.values()) {
      if (laneKeyOf(shown) === laneKey) {
        return false;
      }
    }
    return true;
  }

  private promoteQueued(): void {
    const promotedLanes = new Set<string>();
    const remaining: IOverlayEntry[] = [];
    for (const entry of this.queued) {
      const laneKey = laneKeyOf(entry);
      if (!promotedLanes.has(laneKey) && this.canPromote(entry)) {
        entry.phase = 'active';
        this.shown.set(entry.id, entry);
        promotedLanes.add(laneKey);
      } else {
        remaining.push(entry);
      }
    }
    this.queued = remaining;
  }

  private clearClosingTimer(id: string): void {
    const timer = this.closingTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.closingTimers.delete(id);
    }
  }

  private notifyRemoved(id: string, reason: IOverlayDismissReason): void {
    const handlers = this.handlers.get(id);
    this.handlers.delete(id);
    handlers?.onRemoved?.(reason);
  }

  private emit(): void {
    this.snapshot = {
      entries: [...this.shown.values()]
        .map((e) => ({ ...e }))
        .toSorted(compareRenderOrder),
      queued: this.queued.map((e) => ({ ...e })),
      securityBlockedBelow: this.blockedBelowLevel,
    };
    this.listeners.forEach((listener) => listener());
  }
}

export const overlayStore = new OverlayStore();
