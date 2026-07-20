import type { IHomeRuntimeSourceKey } from '@onekeyhq/shared/src/types/homeRuntime';

import { getHomeSourceKeyIdentity } from '../core/homeIdentity';

import type { IHomeRuntimeRejectReason } from '../runtime/homeRuntimeAdapter';

export interface IHomeStaleTraceEntry {
  reason: IHomeRuntimeRejectReason;
  sessionId: string;
  sourceKeyIdentity: string;
  requestSeq: number;
}

export class HomeStaleTrace {
  private readonly entries: IHomeStaleTraceEntry[] = [];

  constructor(private readonly capacity = 32) {}

  record({
    reason,
    requestSeq,
    sessionId,
    sourceKey,
  }: {
    reason: IHomeRuntimeRejectReason;
    requestSeq: number;
    sessionId: string;
    sourceKey: IHomeRuntimeSourceKey;
  }): void {
    if (this.capacity <= 0) {
      return;
    }
    this.entries.push({
      reason,
      requestSeq,
      sessionId,
      sourceKeyIdentity: getHomeSourceKeyIdentity(sourceKey),
    });
    if (this.entries.length > this.capacity) {
      this.entries.splice(0, this.entries.length - this.capacity);
    }
  }

  getEntries(): readonly IHomeStaleTraceEntry[] {
    return [...this.entries];
  }
}
