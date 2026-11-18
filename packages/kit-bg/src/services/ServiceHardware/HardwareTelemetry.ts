import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import type {
  IHardwareTelemetryEvent,
  SimpleDbEntityHardwareTelemetry,
} from '../../dbs/simple/entity/SimpleDbEntityHardwareTelemetry';

type IStore = Pick<
  SimpleDbEntityHardwareTelemetry,
  'enqueue' | 'getPending' | 'acknowledge'
>;

type IEventInput = IHardwareTelemetryEvent extends infer T
  ? T extends IHardwareTelemetryEvent
    ? Omit<T, 'id' | 'timestamp'>
    : never
  : never;

type IBleSummary = Extract<IEventInput, { kind: 'ble' }>['params'];

export class HardwareTelemetry {
  private flushing: Promise<void> | undefined;

  private retryTimer: ReturnType<typeof setTimeout> | undefined;

  private flushRequested = false;

  private pendingBleSummary: IBleSummary | undefined;

  private bleSummaryTimer: ReturnType<typeof setTimeout> | undefined;

  private persistenceWarningReported = false;

  constructor(
    private store?: IStore,
    private readonly send = async (event: IHardwareTelemetryEvent) => {
      const metadata = {
        $insertId: event.id,
        $timestamp: event.timestamp,
      };
      if (event.kind === 'download') {
        await defaultLogger.update.firmware.reportArtifactDownload({
          ...event.params,
          ...metadata,
        });
      } else {
        await defaultLogger.hardware.connection.reportBleCommunicationResult({
          ...event.params,
          ...metadata,
        });
      }
    },
  ) {}

  private async getStore(): Promise<IStore> {
    this.store ??= (
      await import('../../dbs/simple/simpleDb')
    ).default.hardwareTelemetry;
    return this.store;
  }

  report(input: IEventInput): void {
    if (input.kind === 'ble') {
      if (input.params.status === 'success') {
        this.collectBleSummary(input.params);
        return;
      }
      this.flushBleSummary();
      this.record({
        ...input,
        params: { ...input.params, callCount: input.params.callCount ?? 1 },
      });
      return;
    }
    this.record(input);
  }

  private collectBleSummary(params: IBleSummary): void {
    const previous = this.pendingBleSummary;
    const identityFields = [
      'deviceType',
      'firmwareVersion',
      'bleVersion',
      'platform',
      'mode',
    ] as const;
    if (
      previous &&
      identityFields.some((field) => previous[field] !== params[field])
    ) {
      this.flushBleSummary();
    }
    const pending = this.pendingBleSummary;
    if (pending) {
      const durationMs = pending.durationMs + params.durationMs;
      const bytes = pending.bytes + params.bytes;
      const total = (a?: number, b?: number) =>
        a === undefined && b === undefined ? undefined : (a ?? 0) + (b ?? 0);
      this.pendingBleSummary = {
        ...pending,
        callCount: (pending.callCount ?? 1) + (params.callCount ?? 1),
        frames: pending.frames + params.frames,
        packets: pending.packets + params.packets,
        bytes,
        durationMs,
        effectiveTransferRateBytesPerSecond:
          durationMs > 0 ? (bytes * 1000) / durationMs : undefined,
        writeDurationMs: total(pending.writeDurationMs, params.writeDurationMs),
        readWaitDurationMs: total(
          pending.readWaitDurationMs,
          params.readWaitDurationMs,
        ),
      };
    } else {
      this.pendingBleSummary = { ...params, callCount: params.callCount ?? 1 };
    }
    // FileWrite pipelines can finish many times per second. Persist one scalar
    // success summary per window; failures bypass the window below.
    this.bleSummaryTimer ??= setTimeout(() => this.flushBleSummary(), 10_000);
  }

  private flushBleSummary(): void {
    if (this.bleSummaryTimer !== undefined) clearTimeout(this.bleSummaryTimer);
    this.bleSummaryTimer = undefined;
    const params = this.pendingBleSummary;
    this.pendingBleSummary = undefined;
    if (params) this.record({ kind: 'ble', params });
  }

  private record(input: IEventInput): void {
    const event: IHardwareTelemetryEvent = {
      ...input,
      id: generateUUID(),
      timestamp: Date.now(),
    };
    try {
      const metadata = { $insertId: event.id, $timestamp: event.timestamp };
      if (event.kind === 'download' && event.params.phase === 'finished') {
        defaultLogger.update.firmware.artifactDownloadRecorded({
          ...event.params,
          ...metadata,
        });
      } else if (event.kind === 'ble') {
        defaultLogger.hardware.connection.bleCommunicationRecorded({
          ...event.params,
          ...metadata,
        });
      }
    } catch {
      // Local output must not affect durable server delivery.
    }
    void this.getStore()
      .then((store) => store.enqueue(event))
      .then(() => this.flush())
      .catch(() => {
        // Diagnostics must never interrupt downloads or hardware calls.
        if (!this.persistenceWarningReported) {
          this.persistenceWarningReported = true;
          console.warn('[HardwareTelemetry] Unable to persist pending event');
        }
      });
  }

  flush(): Promise<void> {
    if (this.retryTimer !== undefined)
      return this.flushing ?? Promise.resolve();
    if (this.flushing) {
      this.flushRequested = true;
      return this.flushing;
    }
    this.flushing = this.flushPending().finally(() => {
      this.flushing = undefined;
      if (this.flushRequested && !this.retryTimer) {
        this.flushRequested = false;
        void this.flush();
      }
    });
    return this.flushing;
  }

  private async flushPending(): Promise<void> {
    this.flushRequested = false;
    try {
      const store = await this.getStore();
      for (;;) {
        const event = (await store.getPending())[0];
        if (!event) return;
        await this.send(event);
        await store.acknowledge(event.id);
      }
    } catch {
      this.retryTimer ??= setTimeout(() => {
        this.retryTimer = undefined;
        void this.flush();
      }, 60_000);
    }
  }
}

let telemetry: HardwareTelemetry | undefined;

export function getHardwareTelemetry(): HardwareTelemetry {
  if (platformEnv.isNativeMainThread && !platformEnv.isJest) {
    throw new OneKeyLocalError('Hardware telemetry must run in background');
  }
  telemetry ??= new HardwareTelemetry();
  return telemetry;
}
