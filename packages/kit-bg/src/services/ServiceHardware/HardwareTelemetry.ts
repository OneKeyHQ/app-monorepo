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

export class HardwareTelemetry {
  private flushing: Promise<void> | undefined;

  private retryTimer: ReturnType<typeof setTimeout> | undefined;

  private flushRequested = false;

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
    const event: IHardwareTelemetryEvent = {
      ...input,
      id: generateUUID(),
      timestamp: Date.now(),
    };
    void this.getStore()
      .then((store) => store.enqueue(event))
      .then(() => this.flush())
      .catch(() => {
        // Diagnostics must never interrupt downloads or hardware calls.
        console.warn('[HardwareTelemetry] Unable to persist pending event');
      });
  }

  flush(): Promise<void> {
    if (this.flushing) {
      this.flushRequested = true;
      return this.flushing;
    }
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
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
