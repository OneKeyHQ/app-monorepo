export type IOverlayScope = 'global' | 'page';

export type IOverlayLevel =
  | 'modal'
  | 'hardware'
  | 'secure'
  | 'toast'
  | 'lock'
  | 'debug';

export type IOverlayStrategy = 'stack' | 'queue' | 'replace';

export type IOverlayPhase = 'queued' | 'active' | 'closing';

export type IOverlayDismissReason =
  | 'programmatic'
  | 'back'
  | 'backdrop'
  | 'pan'
  | 'replaced'
  | 'page-removed'
  | 'system';

export interface IOverlayRequest {
  /** Stable id; generated when omitted. Re-requesting an existing id is a no-op. */
  id?: string;
  scope?: IOverlayScope;
  level?: IOverlayLevel;
  strategy?: IOverlayStrategy;
  /** Queue ordering only: higher runs first, ties keep request order. */
  priority?: number;
  /**
   * `replace` only: entries in the same lane with this key are replaced.
   * When omitted, the topmost active entry of the lane is replaced.
   */
  replaceKey?: string;
  /** Required for `page` scope: the root-route host that renders the entry. */
  hostKey?: string;
  /** Required for `page` scope: the nearest page that owns the entry. */
  ownerKey?: string;
  /** Receives back / Escape. Defaults to true for blocking levels. */
  dismissible?: boolean;
  /** Blocks interaction with everything below. Defaults by level. */
  blocking?: boolean;
}

export interface IOverlayEntry {
  id: string;
  scope: IOverlayScope;
  level: IOverlayLevel;
  strategy: IOverlayStrategy;
  priority: number;
  replaceKey: string | undefined;
  hostKey: string | undefined;
  ownerKey: string | undefined;
  dismissible: boolean;
  blocking: boolean;
  phase: IOverlayPhase;
  /** True while the owning page is covered or detached; page scope only. */
  suspended: boolean;
  dismissReason: IOverlayDismissReason | undefined;
  /** Monotonic request order. */
  seq: number;
}

export interface IOverlaySnapshot {
  /** Every non-queued entry in bottom-to-top render order. */
  entries: readonly IOverlayEntry[];
  queued: readonly IOverlayEntry[];
}
