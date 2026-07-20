/**
 * FrameSubscriberGate — pure, React-free per-kind monotonic version gate for the
 * subscriber side of a frame channel (design §4A.3).
 *
 * One gate instance per (store, owner) pass. `accept(kind, version)` returns true
 * exactly once per strictly-increasing version and records it; equal-or-lower
 * versions (stale pushes, an already-applied PULL) are dropped. `reset()` re-arms
 * all kinds to -1 on an owner switch so the new owner's first frame — which may
 * start at a low generation — is not dropped. A per-kind `floorVersion` drops
 * versions below a floor (e.g. an unknown-owner -1 PULL).
 *
 * Domain-agnostic: kind names and floors are supplied by the consumer.
 */

export interface IFrameSubscriberGateKind {
  floorVersion?: number;
}

export class FrameSubscriberGate<TKind extends string> {
  private readonly last: Record<string, number> = {};

  private readonly kindKeys: TKind[];

  constructor(private readonly kinds: Record<TKind, IFrameSubscriberGateKind>) {
    this.kindKeys = Object.keys(kinds) as TKind[];
    this.reset();
  }

  reset(): void {
    for (const k of this.kindKeys) {
      this.last[k] = -1;
    }
  }

  /**
   * Returns true if this version should be applied (and records it as the
   * last-applied for the kind); false to drop.
   */
  accept(kind: TKind, version: number): boolean {
    const floor = this.kinds[kind].floorVersion;
    if (floor !== undefined && version < floor) {
      return false;
    }
    if (version <= this.last[kind]) {
      return false;
    }
    this.last[kind] = version;
    return true;
  }
}
